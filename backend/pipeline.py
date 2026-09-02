"""
pipeline.py -- Divya-Chakshu inference core (v3 — high-confidence accuracy).

Model stack:
  1. MTCNN (facenet-pytorch)                   — face detection
  2. rizvandwiki/gender-classification          — ViT-B/16 gender (primary,   weight 0.45)
  3. rizvandwiki/gender-classification-2        — ViT-L/16 gender (secondary, weight 0.40)
  4. prithivMLmods/Gender-Classifier-Mini       — SigLIP2   gender (tertiary,  weight 0.15)
  5. ResNet50 IMAGENET1K_V2                     — animal / object fallback

Accuracy improvements in v3 over v2:
  - Three-model weighted ensemble (ViT-B × 0.45 + ViT-L × 0.40 + SigLIP2 × 0.15)
    replaces equal 50/50 average. The SigLIP2 Mini model is small and often
    uncertain; over-weighting it dragged strong ViT predictions toward 50%.
  - Dual-crop strategy: both a tight face crop AND a context-expanded crop are
    fed to all models, then their scores are averaged. The face crop captures
    the strongest discriminative signal (beard, jaw, cheekbones); the context
    crop adds clothing/hair cues for ambiguous or child faces.
  - Temperature sharpening (T=0.6) applied after ensemble averaging to spread
    probabilities away from 0.5. This converts genuine 70% → ~85% confidence
    without changing the predicted label.
  - Increased face crop padding (20% each side, 15% top) so the model sees
    hair, ears, and neck — all informative for gender.
  - BODY_CONTEXT_FACTOR reduced from 1.2 → 0.6 because overly long body crops
    (for tall/distant subjects) introduced background noise.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Tuple
import logging

import torch
import torch.nn.functional as F
from PIL import Image
from facenet_pytorch import MTCNN
from torchvision.models import resnet50, ResNet50_Weights
from transformers import pipeline as hf_pipeline

logger = logging.getLogger("divya-chakshu.pipeline")

# ── constants ────────────────────────────────────────────────────────────────

# ImageNet-1k: indices 0–397 are animal synsets (fish → mammals).
ANIMAL_CLASS_MAX_INDEX = 397

# MTCNN minimum detection confidence.
FACE_CONFIDENCE_THRESHOLD = 0.85

# Maximum faces to run gender classification on per image.
# Caps CPU time for group photos (e.g. 23 faces × 6 passes = ~125 s).
# Faces are ranked by MTCNN confidence; top N are processed.
MAX_FACES = 10

# How far below chin to extend context crop (fraction of face height).
# Reduced from 1.2 → 0.6 to limit background noise for adults.
BODY_CONTEXT_FACTOR = 0.6

# How much to pad the tight face crop on each side (fraction of face dimension).
FACE_PAD_X = 0.20   # 20% left/right  — captures ears, hair sides
FACE_PAD_Y_TOP = 0.15   # 15% above — captures forehead/hair
FACE_PAD_Y_BOT = 0.05   # 5% below  — captures chin

# Ensemble model weights (must sum to 1.0).
# ViT-B and ViT-L are both strong; SigLIP2-Mini is a small model so lower weight.
W_PRIMARY   = 0.45   # rizvandwiki/gender-classification   (ViT-B/16)
W_SECONDARY = 0.40   # rizvandwiki/gender-classification-2 (ViT-L/16)
W_TERTIARY  = 0.15   # prithivMLmods/Gender-Classifier-Mini (SigLIP2)

# Temperature for confidence sharpening after ensemble (< 1 = sharper).
# Applied to logits derived from probabilities — pushes uncertain scores away from 0.5.
SHARPEN_TEMPERATURE = 0.6

# Minimum crop size (pixels) below which we skip gender classification.
MIN_CROP_SIZE = 32

# Label normalisation map shared by all three models.
GENDER_LABEL_MAP = {
    "male":        "Male",
    "man":         "Male",
    "boy":         "Male",
    "female":      "Female",
    "woman":       "Female",
    "girl":        "Female",
    "0":           "Male",    # some models output numeric labels
    "1":           "Female",
}


# ── data classes ─────────────────────────────────────────────────────────────

@dataclass
class FaceResult:
    box: List[int]
    face_confidence: float
    gender: str
    gender_confidence: float


@dataclass
class PredictionResult:
    category: str                    # "person" | "animal" | "unknown"
    faces: List[FaceResult] = field(default_factory=list)
    animal_label: Optional[str] = None
    animal_confidence: Optional[float] = None
    fallback_label: Optional[str] = None
    fallback_confidence: Optional[float] = None


# ── engine ───────────────────────────────────────────────────────────────────

class DivyaChakshuEngine:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info("Using device: %s", self.device)

        # ── face detector ────────────────────────────────────────────────────
        self.face_detector = MTCNN(
            keep_all=True,
            device=self.device,
            post_process=False,
            min_face_size=20,   # catch small / child faces
        )

        # ── gender models ────────────────────────────────────────────────────
        _dev = 0 if self.device.type == "cuda" else -1

        # Primary: ViT-B/16, fine-tuned for gender (1.4 M HF downloads)
        self.gender_primary = hf_pipeline(
            "image-classification",
            model="rizvandwiki/gender-classification",
            device=_dev,
        )
        logger.info("Loaded gender model 1 (ViT-B/16 primary)")

        # Secondary: ViT-L/16, larger model, more parameters → higher accuracy
        self.gender_secondary = hf_pipeline(
            "image-classification",
            model="rizvandwiki/gender-classification-2",
            device=_dev,
        )
        logger.info("Loaded gender model 2 (ViT-L/16 secondary)")

        # Tertiary: SigLIP2-Mini — diverse training data, lower weight
        self.gender_tertiary = hf_pipeline(
            "image-classification",
            model="prithivMLmods/Gender-Classifier-Mini",
            device=_dev,
        )
        logger.info("Loaded gender model 3 (SigLIP2-Mini tertiary)")

        # ── animal / object fallback ─────────────────────────────────────────
        weights = ResNet50_Weights.IMAGENET1K_V2
        self.animal_classifier = resnet50(weights=weights).to(self.device).eval()
        self.animal_transform  = weights.transforms()
        self.animal_categories = weights.meta["categories"]
        logger.info("Loaded ResNet50 fallback classifier")

        self.ready = True

    # ── helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _norm_label(raw: str) -> str:
        """Normalise varied model label strings to 'Male' / 'Female'."""
        return GENDER_LABEL_MAP.get(raw.strip().lower(), raw.title())

    def _scores_from_pipeline(self, pipe, crop: Image.Image) -> dict:
        """
        Run a HF image-classification pipeline on a crop and return
        normalised {'Male': p, 'Female': p} scores that sum to 1.0.
        """
        preds = pipe(crop)
        scores: dict = {}
        for p in preds:
            label = self._norm_label(p["label"])
            scores[label] = scores.get(label, 0.0) + p["score"]
        scores.setdefault("Male",   0.0)
        scores.setdefault("Female", 0.0)
        total = scores["Male"] + scores["Female"]
        if total > 1e-6:
            scores = {k: v / total for k, v in scores.items()}
        return scores

    @staticmethod
    def _sharpen(male_prob: float, female_prob: float, temperature: float = SHARPEN_TEMPERATURE) -> Tuple[float, float]:
        """
        Temperature sharpening: convert probabilities → logits → scale by 1/T → softmax.
        With T < 1, probabilities move away from 0.5 (more decisive).
        Example: (0.70, 0.30) at T=0.6 → (~0.83, ~0.17)
        """
        # Clamp to avoid log(0)
        p_m = max(male_prob,   1e-6)
        p_f = max(female_prob, 1e-6)
        # Convert to log-odds (logits)
        logit_m = torch.tensor(p_m).log() / temperature
        logit_f = torch.tensor(p_f).log() / temperature
        logits  = torch.stack([logit_m, logit_f])
        probs   = F.softmax(logits, dim=0)
        return float(probs[0].item()), float(probs[1].item())

    def _weighted_ensemble(
        self,
        face_crop: Image.Image,
        ctx_crop: Image.Image,
    ) -> Tuple[str, float]:
        """
        Three-model weighted ensemble with dual-crop strategy.

        For each model:
          1. Run on tight face crop  → scores_face
          2. Run on context crop     → scores_ctx
          3. Average scores_face and scores_ctx → model scores

        Then combine models using (W_PRIMARY, W_SECONDARY, W_TERTIARY).
        Apply temperature sharpening to final probabilities.

        Returns (gender_label, sharpened_confidence).
        """
        def _model_score(pipe, w: float) -> Tuple[float, float]:
            """Returns (male_contribution, female_contribution) weighted."""
            s_face = self._scores_from_pipeline(pipe, face_crop)
            s_ctx  = self._scores_from_pipeline(pipe, ctx_crop)
            # average the two crops for this model
            avg_m = (s_face["Male"]   + s_ctx["Male"])   / 2
            avg_f = (s_face["Female"] + s_ctx["Female"]) / 2
            # normalise again after averaging
            total = avg_m + avg_f
            if total > 1e-6:
                avg_m /= total
                avg_f /= total
            return avg_m * w, avg_f * w

        cm1, cf1 = _model_score(self.gender_primary,   W_PRIMARY)
        cm2, cf2 = _model_score(self.gender_secondary, W_SECONDARY)
        cm3, cf3 = _model_score(self.gender_tertiary,  W_TERTIARY)

        total_male   = cm1 + cm2 + cm3
        total_female = cf1 + cf2 + cf3

        # Normalise weighted sum (weights sum to 1 but per-model normalisations
        # can cause tiny floating point drift)
        grand = total_male + total_female
        if grand > 1e-6:
            total_male   /= grand
            total_female /= grand

        # Sharpen probabilities away from the 0.5 boundary
        sharp_m, sharp_f = self._sharpen(total_male, total_female)

        label = "Female" if sharp_f >= sharp_m else "Male"
        conf  = round(sharp_f if label == "Female" else sharp_m, 4)
        return label, conf

    @staticmethod
    def _tight_face_crop(image: Image.Image, box: List[int]) -> Image.Image:
        """
        Padded tight face crop: adds margins around the MTCNN box to include
        hair, ears, forehead, and chin — all informative for gender.
        """
        x0, y0, x1, y1 = box
        w = x1 - x0
        h = y1 - y0
        pad_x   = int(w * FACE_PAD_X)
        pad_top = int(h * FACE_PAD_Y_TOP)
        pad_bot = int(h * FACE_PAD_Y_BOT)

        x0_p = max(0, x0 - pad_x)
        x1_p = min(image.width,  x1 + pad_x)
        y0_p = max(0, y0 - pad_top)
        y1_p = min(image.height, y1 + pad_bot)

        crop = image.crop((x0_p, y0_p, x1_p, y1_p))
        if crop.width < MIN_CROP_SIZE or crop.height < MIN_CROP_SIZE:
            # Upscale tiny crops so transformer patch embeddings work well
            scale = MIN_CROP_SIZE / min(crop.width, crop.height)
            crop = crop.resize(
                (max(int(crop.width * scale), MIN_CROP_SIZE),
                 max(int(crop.height * scale), MIN_CROP_SIZE)),
                Image.LANCZOS,
            )
        return crop

    @staticmethod
    def _context_crop(image: Image.Image, box: List[int]) -> Image.Image:
        """
        Context-extended crop: extends downward to include upper body
        (clothing, hair, shoulders) — useful for children and ambiguous cases.
        Factor reduced to 0.6 to avoid pulling in too much background.
        """
        x0, y0, x1, y1 = box
        face_h = y1 - y0
        extend = int(face_h * BODY_CONTEXT_FACTOR)
        y1_ext = min(y1 + extend, image.height)

        # Widen a bit for shoulder context
        pad_w  = int((x1 - x0) * 0.20)
        x0_ext = max(0, x0 - pad_w)
        x1_ext = min(image.width, x1 + pad_w)

        crop = image.crop((x0_ext, y0, x1_ext, y1_ext))
        if crop.width < MIN_CROP_SIZE or crop.height < MIN_CROP_SIZE:
            scale = MIN_CROP_SIZE / min(crop.width, crop.height)
            crop = crop.resize(
                (max(int(crop.width * scale), MIN_CROP_SIZE),
                 max(int(crop.height * scale), MIN_CROP_SIZE)),
                Image.LANCZOS,
            )
        return crop

    def _run_animal_classifier(self, image: Image.Image) -> Tuple[int, str, float]:
        tensor = self.animal_transform(image).unsqueeze(0).to(self.device)
        with torch.no_grad():
            logits = self.animal_classifier(tensor)
            probs  = F.softmax(logits, dim=1).squeeze(0)
        top_idx  = int(torch.argmax(probs).item())
        top_prob = float(probs[top_idx].item())
        label    = self.animal_categories[top_idx]
        return top_idx, label, round(top_prob, 4)

    # ── main predict ─────────────────────────────────────────────────────────

    def predict(self, image: Image.Image) -> PredictionResult:
        image = image.convert("RGB")

        boxes, probs = self.face_detector.detect(image)

        faces: List[FaceResult] = []
        if boxes is not None:
            # Filter to confident detections first
            candidates = [
                (box, prob) for box, prob in zip(boxes, probs)
                if prob is not None and prob >= FACE_CONFIDENCE_THRESHOLD
            ]

            # Sort by confidence desc, cap at MAX_FACES to keep CPU time bounded
            candidates.sort(key=lambda x: x[1], reverse=True)
            candidates = candidates[:MAX_FACES]

            for box, prob in candidates:
                x0, y0, x1, y1 = [int(max(v, 0)) for v in box]
                x1 = min(x1, image.width)
                y1 = min(y1, image.height)
                if x1 <= x0 or y1 <= y0:
                    continue

                try:
                    # Build both crops
                    face_crop = self._tight_face_crop(image, [x0, y0, x1, y1])
                    ctx_crop  = self._context_crop(image,   [x0, y0, x1, y1])

                    # Weighted ensemble with dual-crop + temperature sharpening
                    gender, gender_conf = self._weighted_ensemble(face_crop, ctx_crop)

                    faces.append(FaceResult(
                        box=[x0, y0, x1, y1],
                        face_confidence=round(float(prob), 4),
                        gender=gender,
                        gender_confidence=gender_conf,
                    ))
                except Exception as exc:
                    logger.warning("Skipping face at box %s due to error: %s", [x0, y0, x1, y1], exc)
                    continue

        if faces:
            return PredictionResult(category="person", faces=faces)

        # No confident face → check for animal
        top_idx, label, top_prob = self._run_animal_classifier(image)
        if top_idx <= ANIMAL_CLASS_MAX_INDEX:
            return PredictionResult(
                category="animal",
                animal_label=label,
                animal_confidence=top_prob,
            )

        return PredictionResult(
            category="unknown",
            fallback_label=label,
            fallback_confidence=top_prob,
        )
