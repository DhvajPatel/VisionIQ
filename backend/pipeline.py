"""
pipeline.py — VisionIQ inference core (render-optimised build).

Render free tier: 512 MB RAM, no GPU.

Model stack (RAM budget ~420 MB total):
  1. MTCNN             (facenet-pytorch)                  ~50 MB  — face detection
  2. ViT-B/16          (rizvandwiki/gender-classification) ~330 MB — gender classification
  3. ResNet50 V2       (torchvision)                      ~100 MB — animal / object fallback

ViT-L/16 (~1.2 GB) and SigLIP2-Mini (~900 MB) are excluded on Render to stay
within 512 MB. The single ViT-B/16 model still achieves ~91% gender accuracy.

Models are loaded lazily on the first /api/predict request so the process starts
fast and Render's port-binding check passes before the ~2 min HuggingFace download.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Tuple
import logging
import os

import torch
import torch.nn.functional as F
from PIL import Image
from facenet_pytorch import MTCNN
from torchvision.models import resnet50, ResNet50_Weights
from transformers import pipeline as hf_pipeline

logger = logging.getLogger("visioniq.pipeline")

# ── constants ────────────────────────────────────────────────────────────────

# ImageNet-1k: indices 0–397 are animal synsets (fish → mammals).
ANIMAL_CLASS_MAX_INDEX = 397

# MTCNN minimum detection confidence.
FACE_CONFIDENCE_THRESHOLD = 0.85

# Cap faces per image to bound CPU time on free tier.
MAX_FACES = 8

# Crop padding fractions
FACE_PAD_X     = 0.20
FACE_PAD_Y_TOP = 0.15
FACE_PAD_Y_BOT = 0.05

# Context crop: extend below chin (fraction of face height)
BODY_CONTEXT_FACTOR = 0.5

# Temperature sharpening (T < 1 → more decisive confidence scores)
SHARPEN_TEMPERATURE = 0.65

# Minimum crop dimension in pixels
MIN_CROP_SIZE = 32

# Normalise varied label strings → "Male" / "Female"
GENDER_LABEL_MAP = {
    "male":   "Male",  "man":    "Male",  "boy":    "Male",
    "female": "Female","woman":  "Female","girl":   "Female",
    "0":      "Male",  "1":      "Female",
}

# ── detect render environment ─────────────────────────────────────────────────
# On Render the HOME is /root and RENDER env var is set.
IS_RENDER = os.environ.get("RENDER") == "true" or os.environ.get("HF_HOME", "").startswith("/tmp")


# ── data classes ─────────────────────────────────────────────────────────────

@dataclass
class FaceResult:
    box: List[int]
    face_confidence: float
    gender: str
    gender_confidence: float


@dataclass
class PredictionResult:
    category: str                       # "person" | "animal" | "unknown"
    faces: List[FaceResult] = field(default_factory=list)
    animal_label: Optional[str] = None
    animal_confidence: Optional[float] = None
    fallback_label: Optional[str] = None
    fallback_confidence: Optional[float] = None


# ── engine ───────────────────────────────────────────────────────────────────

class VisionIQEngine:
    """
    Lazy-loading inference engine.
    Models are downloaded and loaded on the first call to predict(),
    not at import time, so the server starts fast on Render.
    """

    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info("Device: %s", self.device)
        self._loaded = False

        # placeholders — populated by _load_models()
        self.face_detector    = None
        self.gender_model     = None
        self.animal_classifier = None
        self.animal_transform  = None
        self.animal_categories = None

    # ── lazy loader ──────────────────────────────────────────────────────────

    def _load_models(self):
        """Download and initialise all models. Called once on first predict()."""
        if self._loaded:
            return

        logger.info("Loading MTCNN face detector…")
        self.face_detector = MTCNN(
            keep_all=True,
            device=self.device,
            post_process=False,
            min_face_size=20,
        )

        logger.info("Loading ViT-B/16 gender classifier…")
        _dev = 0 if self.device.type == "cuda" else -1
        self.gender_model = hf_pipeline(
            "image-classification",
            model="rizvandwiki/gender-classification",
            device=_dev,
        )

        logger.info("Loading ResNet50 animal classifier…")
        weights = ResNet50_Weights.IMAGENET1K_V2
        self.animal_classifier = resnet50(weights=weights).to(self.device).eval()
        self.animal_transform  = weights.transforms()
        self.animal_categories = weights.meta["categories"]

        self._loaded = True
        logger.info("All models ready.")

    # ── helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _norm_label(raw: str) -> str:
        return GENDER_LABEL_MAP.get(raw.strip().lower(), raw.title())

    def _gender_scores(self, crop: Image.Image) -> dict:
        """Run ViT-B/16 on crop → normalised {'Male': p, 'Female': p}."""
        preds = self.gender_model(crop)
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
    def _sharpen(male_prob: float, female_prob: float) -> Tuple[float, float]:
        """Temperature sharpening — pushes scores away from 0.5."""
        p_m = max(male_prob,   1e-6)
        p_f = max(female_prob, 1e-6)
        logit_m = torch.tensor(p_m).log() / SHARPEN_TEMPERATURE
        logit_f = torch.tensor(p_f).log() / SHARPEN_TEMPERATURE
        probs   = F.softmax(torch.stack([logit_m, logit_f]), dim=0)
        return float(probs[0]), float(probs[1])

    def _classify_gender(self, face_crop: Image.Image, ctx_crop: Image.Image) -> Tuple[str, float]:
        """
        Average ViT-B/16 scores over face crop + context crop, then sharpen.
        Two crops on one model ≈ same accuracy as one crop on two models,
        but uses half the RAM.
        """
        sf = self._gender_scores(face_crop)
        sc = self._gender_scores(ctx_crop)

        avg_m = (sf["Male"]   + sc["Male"])   / 2
        avg_f = (sf["Female"] + sc["Female"]) / 2
        total = avg_m + avg_f
        if total > 1e-6:
            avg_m /= total
            avg_f /= total

        sharp_m, sharp_f = self._sharpen(avg_m, avg_f)
        label = "Female" if sharp_f >= sharp_m else "Male"
        return label, round(sharp_f if label == "Female" else sharp_m, 4)

    @staticmethod
    def _tight_face_crop(image: Image.Image, box: List[int]) -> Image.Image:
        x0, y0, x1, y1 = box
        w, h   = x1 - x0, y1 - y0
        pad_x  = int(w * FACE_PAD_X)
        pad_t  = int(h * FACE_PAD_Y_TOP)
        pad_b  = int(h * FACE_PAD_Y_BOT)
        crop = image.crop((
            max(0, x0 - pad_x), max(0, y0 - pad_t),
            min(image.width,  x1 + pad_x),
            min(image.height, y1 + pad_b),
        ))
        if min(crop.width, crop.height) < MIN_CROP_SIZE:
            scale = MIN_CROP_SIZE / min(crop.width, crop.height)
            crop = crop.resize(
                (max(int(crop.width * scale), MIN_CROP_SIZE),
                 max(int(crop.height * scale), MIN_CROP_SIZE)),
                Image.LANCZOS,
            )
        return crop

    @staticmethod
    def _context_crop(image: Image.Image, box: List[int]) -> Image.Image:
        x0, y0, x1, y1 = box
        face_h = y1 - y0
        pad_w  = int((x1 - x0) * 0.20)
        crop = image.crop((
            max(0, x0 - pad_w),
            y0,
            min(image.width,  x1 + pad_w),
            min(image.height, y1 + int(face_h * BODY_CONTEXT_FACTOR)),
        ))
        if min(crop.width, crop.height) < MIN_CROP_SIZE:
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
            probs = F.softmax(self.animal_classifier(tensor), dim=1).squeeze(0)
        top_idx  = int(torch.argmax(probs).item())
        return top_idx, self.animal_categories[top_idx], round(float(probs[top_idx]), 4)

    # ── main predict ─────────────────────────────────────────────────────────

    def predict(self, image: Image.Image) -> PredictionResult:
        # Load models on first call (lazy)
        self._load_models()

        image = image.convert("RGB")
        boxes, probs = self.face_detector.detect(image)

        faces: List[FaceResult] = []
        if boxes is not None:
            # Keep only high-confidence detections, sorted best-first, capped
            candidates = sorted(
                [(b, p) for b, p in zip(boxes, probs)
                 if p is not None and p >= FACE_CONFIDENCE_THRESHOLD],
                key=lambda x: x[1], reverse=True
            )[:MAX_FACES]

            for box, prob in candidates:
                x0, y0, x1, y1 = [int(max(v, 0)) for v in box]
                x1 = min(x1, image.width)
                y1 = min(y1, image.height)
                if x1 <= x0 or y1 <= y0:
                    continue
                try:
                    face_crop = self._tight_face_crop(image, [x0, y0, x1, y1])
                    ctx_crop  = self._context_crop(image,   [x0, y0, x1, y1])
                    gender, conf = self._classify_gender(face_crop, ctx_crop)
                    faces.append(FaceResult(
                        box=[x0, y0, x1, y1],
                        face_confidence=round(float(prob), 4),
                        gender=gender,
                        gender_confidence=conf,
                    ))
                except Exception as exc:
                    logger.warning("Skipping face %s: %s", [x0,y0,x1,y1], exc)

        if faces:
            return PredictionResult(category="person", faces=faces)

        top_idx, label, top_prob = self._run_animal_classifier(image)
        if top_idx <= ANIMAL_CLASS_MAX_INDEX:
            return PredictionResult(category="animal", animal_label=label, animal_confidence=top_prob)
        return PredictionResult(category="unknown", fallback_label=label, fallback_confidence=top_prob)


# Backwards-compatible alias (app.py imports DivyaChakshuEngine)
DivyaChakshuEngine = VisionIQEngine
