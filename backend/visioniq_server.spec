# -*- mode: python ; coding: utf-8 -*-
#
# visioniq_server.spec — PyInstaller build spec for VisionIQ backend
#
# Usage:
#   cd backend
#   pyinstaller visioniq_server.spec
#
# Output: backend/dist/visioniq_server/visioniq_server.exe
#         (a folder-based distribution — NOT a single .exe to keep startup fast)
#
# The folder is then packaged by electron-builder via extraResources.

import sys
import os
from PyInstaller.utils.hooks import collect_all, collect_submodules, copy_metadata

# ── collect heavy packages ────────────────────────────────────────────────────
torch_datas, torch_binaries, torch_hiddenimports       = collect_all("torch")
torchvision_datas, torchvision_binaries, tv_hidden     = collect_all("torchvision")
transformers_datas, transformers_binaries, tf_hidden   = collect_all("transformers")
facenet_datas, facenet_binaries, facenet_hidden        = collect_all("facenet_pytorch")
timm_datas, timm_binaries, timm_hidden                 = collect_all("timm")

# metadata needed by transformers
meta_pkgs = [
    "transformers", "tokenizers", "huggingface_hub",
    "filelock", "requests", "packaging", "tqdm",
    "safetensors", "accelerate",
]
metadata_datas = []
for pkg in meta_pkgs:
    try:
        metadata_datas += copy_metadata(pkg)
    except Exception:
        pass

all_datas = (
    torch_datas + torchvision_datas + transformers_datas +
    facenet_datas + timm_datas + metadata_datas
)
all_binaries = torch_binaries + torchvision_binaries + transformers_binaries + facenet_binaries + timm_binaries

all_hiddenimports = (
    torch_hiddenimports + tv_hidden + tf_hidden + facenet_hidden + timm_hidden +
    collect_submodules("torch") +
    collect_submodules("torchvision") +
    collect_submodules("transformers") +
    collect_submodules("PIL") +
    collect_submodules("numpy") +
    collect_submodules("uvicorn") +
    collect_submodules("fastapi") +
    collect_submodules("starlette") +
    collect_submodules("pydantic") +
    [
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.loops.asyncio",
        "uvicorn.loops.uvloop",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.http.httptools_impl",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.off",
        "uvicorn.lifespan.on",
        "anyio",
        "anyio._backends._asyncio",
        "anyio._backends._trio",
        "sqlite3",
        "email.mime.text",
        "email.mime.multipart",
    ]
)

# ── analysis ──────────────────────────────────────────────────────────────────
a = Analysis(
    ["app.py"],
    pathex=["."],
    binaries=all_binaries,
    datas=all_datas,
    hiddenimports=all_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
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

# ── folder-based exe (faster startup than onefile) ────────────────────────────
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="visioniq_server",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,             # UPX breaks torch DLLs on Windows
    console=True,          # keep console so logs are visible during dev/debug
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
