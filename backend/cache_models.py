"""
cache_models.py — Run ONCE before building the installer.

Downloads all HuggingFace model weights into backend/models_cache/
so they can be bundled by PyInstaller and the app works 100% offline.

Usage:
    cd backend
    python cache_models.py

This creates:
    backend/models_cache/
        hub/models--rizvandwiki--gender-classification/  (~330 MB)
        torch/hub/checkpoints/                            (ResNet50)
        (MTCNN weights are bundled inside facenet_pytorch package)
"""
import os
import sys
from pathlib import Path

# ── Point ALL caches to backend/models_cache ─────────────────────────────────
HERE       = Path(__file__).parent.resolve()
CACHE_DIR  = HERE / "models_cache"
CACHE_DIR.mkdir(exist_ok=True)

os.environ["HF_HOME"]            = str(CACHE_DIR)
os.environ["HUGGINGFACE_HUB_CACHE"] = str(CACHE_DIR / "hub")
os.environ["TRANSFORMERS_CACHE"] = str(CACHE_DIR / "hub")
os.environ["TORCH_HOME"]         = str(CACHE_DIR / "torch")
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
# Disable symlinks on Windows (causes issues in some setups)
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["HUGGINGFACE_HUB_VERBOSITY"] = "info"

print(f"\n{'='*60}")
print(f"  VisionIQ — Offline Model Cache Builder")
print(f"  Cache directory: {CACHE_DIR}")
print(f"{'='*60}\n")

import torch

# ── 1. MTCNN (facenet_pytorch — weights bundled in package itself) ───────────
print("[1/3] MTCNN face detector...")
try:
    from facenet_pytorch import MTCNN
    mtcnn = MTCNN(keep_all=True, device=torch.device("cpu"), post_process=False)
    print("      MTCNN OK (weights are part of facenet_pytorch package)\n")
    del mtcnn
except Exception as e:
    print(f"      FAILED: {e}", file=sys.stderr)
    sys.exit(1)

# ── 2. ViT-B/16 gender classifier (downloads to models_cache/hub/) ──────────
print("[2/3] ViT-B/16 gender classifier (~330 MB)...")
print("      Downloading from HuggingFace Hub...")
try:
    from transformers import AutoImageProcessor, AutoModelForImageClassification
    from PIL import Image

    processor = AutoImageProcessor.from_pretrained(
        "rizvandwiki/gender-classification",
        cache_dir=str(CACHE_DIR / "hub"),
    )
    model = AutoModelForImageClassification.from_pretrained(
        "rizvandwiki/gender-classification",
        cache_dir=str(CACHE_DIR / "hub"),
        dtype=torch.float16,
        low_cpu_mem_usage=True,
    ).eval()

    # Smoke test
    dummy  = Image.new("RGB", (64, 64), (128, 128, 128))
    inputs = processor(images=dummy, return_tensors="pt")
    inputs = {k: v.half() if v.dtype == torch.float32 else v for k, v in inputs.items()}
    with torch.no_grad():
        out = model(**inputs)
    label = model.config.id2label[int(out.logits.argmax())]
    print(f"      ViT-B/16 OK — smoke test result: {label}")
    sz = sum(f.stat().st_size for f in (CACHE_DIR / "hub").rglob("*") if f.is_file())
    print(f"      Cache size: {sz/1e6:.0f} MB\n")
    del model

except Exception as e:
    print(f"      FAILED: {e}", file=sys.stderr)
    import traceback; traceback.print_exc()
    sys.exit(1)

# ── 3. ResNet50 ImageNet (downloads to models_cache/torch/) ─────────────────
print("[3/3] ResNet50 ImageNet (~100 MB)...")
try:
    from torchvision.models import resnet50, ResNet50_Weights
    m = resnet50(weights=ResNet50_Weights.IMAGENET1K_V2).half().eval()
    print("      ResNet50 OK\n")
    del m
except Exception as e:
    print(f"      FAILED: {e}", file=sys.stderr)
    sys.exit(1)

print(f"{'='*60}")
print(f"  All models cached in: {CACHE_DIR}")
print(f"  Total cache size: {sum(f.stat().st_size for f in CACHE_DIR.rglob('*') if f.is_file())/1e6:.0f} MB")
print(f"  Ready to build installer — run build.bat")
print(f"{'='*60}\n")
