"""
download_models.py — Run at BUILD time on Render to pre-cache model weights.

Why: Render free tier has 512 MB RAM. Downloading 330 MB of weights at
     runtime while also running FastAPI + MTCNN causes OOM. Doing it at
     build time (where Render allows more RAM) avoids this completely.

Usage (in render.yaml buildCommand):
    python download_models.py
"""
import os
import sys

# Force all HuggingFace / torch caches to the persistent tmp path
CACHE_DIR = os.environ.get("HF_HOME", "/tmp/hf_cache")
os.environ["HF_HOME"]           = CACHE_DIR
os.environ["TRANSFORMERS_CACHE"] = CACHE_DIR
os.environ["TORCH_HOME"]         = CACHE_DIR

print(f"[download_models] Cache directory: {CACHE_DIR}")
os.makedirs(CACHE_DIR, exist_ok=True)

# ── 1. MTCNN weights (facenet-pytorch downloads on first MTCNN() call) ───────
print("[download_models] Downloading MTCNN weights...")
try:
    import torch
    from facenet_pytorch import MTCNN
    _ = MTCNN(keep_all=True, device=torch.device("cpu"), post_process=False)
    print("[download_models] MTCNN OK")
except Exception as e:
    print(f"[download_models] MTCNN failed: {e}", file=sys.stderr)
    sys.exit(1)

# ── 2. ViT-B/16 gender classifier ────────────────────────────────────────────
print("[download_models] Downloading ViT-B/16 gender model (~330 MB)...")
try:
    from transformers import pipeline as hf_pipeline
    pipe = hf_pipeline(
        "image-classification",
        model="rizvandwiki/gender-classification",
        device=-1,
    )
    # Run a tiny dummy inference to confirm weights are fully loaded
    from PIL import Image
    dummy = Image.new("RGB", (64, 64), color=(128, 128, 128))
    result = pipe(dummy)
    print(f"[download_models] ViT-B/16 OK — test output: {result[0]}")
    del pipe
except Exception as e:
    print(f"[download_models] ViT-B/16 failed: {e}", file=sys.stderr)
    sys.exit(1)

# ── 3. ResNet50 ImageNet weights ──────────────────────────────────────────────
print("[download_models] Downloading ResNet50 weights (~100 MB)...")
try:
    from torchvision.models import resnet50, ResNet50_Weights
    weights = ResNet50_Weights.IMAGENET1K_V2
    model = resnet50(weights=weights)
    print("[download_models] ResNet50 OK")
    del model
except Exception as e:
    print(f"[download_models] ResNet50 failed: {e}", file=sys.stderr)
    sys.exit(1)

print("[download_models] All models downloaded successfully. Ready for runtime.")
