# -*- mode: python ; coding: utf-8 -*-
#
# visioniq_server.spec — PyInstaller build spec for VisionIQ backend
#
# IMPORTANT: Run  python cache_models.py  FIRST to populate backend/models_cache/
#
# Usage:
#   cd backend
#   python cache_models.py      ← downloads HF weights offline (~430 MB)
#   pyinstaller visioniq_server.spec --noconfirm
#
# Output: backend/dist/visioniq_server/   (folder-based, fast startup)

import sys
import os
from pathlib import Path
from PyInstaller.utils.hooks import collect_all, collect_submodules, collect_data_files, copy_metadata

HERE = Path(SPECPATH)

# ── collect packages ──────────────────────────────────────────────────────────
torch_datas,       torch_bins,       torch_hidden       = collect_all("torch")
torchvision_datas, torchvision_bins, tv_hidden          = collect_all("torchvision")
transformers_datas,transformers_bins,tf_hidden          = collect_all("transformers")
facenet_datas,     facenet_bins,     facenet_hidden      = collect_all("facenet_pytorch")

# metadata required by transformers / huggingface_hub
meta_pkgs = [
    "transformers", "tokenizers", "huggingface_hub",
    "filelock", "requests", "packaging", "tqdm", "safetensors",
]
metadata_datas = []
for pkg in meta_pkgs:
    try:
        metadata_datas += copy_metadata(pkg)
    except Exception:
        pass

# ── Bundle the offline model cache ────────────────────────────────────────────
# models_cache/ was populated by  python cache_models.py
# It contains the ViT-B/16 HuggingFace weights + torch/hub ResNet50 weights.
# We place it next to the exe so pipeline.py can find it via _get_models_cache().
models_cache_src = HERE / "models_cache"
if not models_cache_src.exists():
    print("="*70)
    print("ERROR: backend/models_cache/ not found!")
    print("Run:  python cache_models.py  first to download model weights.")
    print("="*70)
    raise SystemExit(1)

# Bundle models_cache/ at the root of the dist folder (next to the exe)
model_datas = [(str(models_cache_src), "models_cache")]

all_datas = (
    torch_datas + torchvision_datas + transformers_datas +
    facenet_datas + metadata_datas + model_datas
)
all_binaries = torch_bins + torchvision_bins + transformers_bins + facenet_bins

all_hiddenimports = (
    torch_hidden + tv_hidden + tf_hidden + facenet_hidden +
    collect_submodules("torch") +
    collect_submodules("torchvision") +
    collect_submodules("transformers") +
    collect_submodules("huggingface_hub") +
    collect_submodules("PIL") +
    collect_submodules("numpy") +
    collect_submodules("uvicorn") +
    collect_submodules("fastapi") +
    collect_submodules("starlette") +
    collect_submodules("pydantic") +
    [
        "uvicorn.logging",
        "uvicorn.loops", "uvicorn.loops.auto", "uvicorn.loops.asyncio",
        "uvicorn.protocols", "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto", "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.http.httptools_impl",
        "uvicorn.protocols.websockets", "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan", "uvicorn.lifespan.off", "uvicorn.lifespan.on",
        "anyio", "anyio._backends._asyncio", "anyio._backends._trio",
        "sqlite3", "email.mime.text", "email.mime.multipart",
    ]
)

# ── analysis ──────────────────────────────────────────────────────────────────
a = Analysis(
    ["app.py"],
    pathex=[str(HERE)],
    binaries=all_binaries,
    datas=all_datas,
    hiddenimports=all_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=["runtime_hook.py"],
    excludes=[
        "matplotlib", "IPython", "notebook", "jupyter",
        "scipy", "pandas", "sklearn", "cv2",
        "tkinter", "_tkinter",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="visioniq_server",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon="../frontend/public/icon.ico",
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="visioniq_server",
)
