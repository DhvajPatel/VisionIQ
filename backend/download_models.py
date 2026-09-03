"""
download_models.py — Run at BUILD time on Render to pre-cache model weights.

Downloads all weights into the persistent build directory so runtime startup
needs no network access and completes in ~15-20 seconds.
"""
import os, sys

CACHE_DIR = os.environ.get("HF_HOME", "/opt/render/project/src/.hf_cache")
os.environ["HF_HOME"]            = CACHE_DIR
os.environ["TRANSFORMERS_CACHE"] = CACHE_DIR
os.environ["TORCH_HOME"]         = CACHE_DIR

print(f"[download_models] Cache: {CACHE_DIR}")
os.makedirs(CACHE_DIR, exist_ok=True)

# ── 1. MTCNN ────────────────────────────────────────────────────────────────
print("[download_models] Downloading MTCNN weights...")
try:
    import torch
    from facenet_pytorch import MTCNN
    _ = MTCNN(keep_all=True, device=torch.device("cpu"), post_process=False)
    print("[download_models] MTCNN OK")
except Exception as e:
    print(f"[download_models] MTCNN FAILED: {e}", file=sys.stderr)
    sys.exit(1)

# ── 2. ViT-B/16 gender — download only (float16 load at runtime) ─────────
print("[download_models] Downloading ViT-B/16 weights (~330 MB on disk, ~165 MB in RAM)...")
try:
    from transformers import AutoImageProcessor, AutoModelForImageClassification
    processor = AutoImageProcessor.from_pretrained("rizvandwiki/gender-classification")
    model = AutoModelForImageClassification.from_pretrained(
        "rizvandwiki/gender-classification",
        torch_dtype=torch.float16,
        low_cpu_mem_usage=True,
    )
    # Quick smoke test
    from PIL import Image
    dummy = Image.new("RGB", (64, 64), color=(128, 128, 128))
    inputs = processor(images=dummy, return_tensors="pt")
    inputs = {k: v.half() if v.dtype == torch.float32 else v for k, v in inputs.items()}
    with torch.no_grad():
        out = model(**inputs)
    label = model.config.id2label[int(out.logits.argmax())]
    print(f"[download_models] ViT-B/16 OK — test: {label}")
    del model
except Exception as e:
    print(f"[download_models] ViT-B/16 FAILED: {e}", file=sys.stderr)
    sys.exit(1)

# ── 3. ResNet50 ──────────────────────────────────────────────────────────────
print("[download_models] Downloading ResNet50 weights (~100 MB on disk)...")
try:
    from torchvision.models import resnet50, ResNet50_Weights
    _ = resnet50(weights=ResNet50_Weights.IMAGENET1K_V2)
    print("[download_models] ResNet50 OK")
    del _
except Exception as e:
    print(f"[download_models] ResNet50 FAILED: {e}", file=sys.stderr)
    sys.exit(1)

print("[download_models] All models cached. Build complete.")
