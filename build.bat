@echo off
setlocal EnableDelayedExpansion
title VisionIQ — Desktop Build

echo.
echo ============================================================
echo   VisionIQ Desktop Build
echo   Builds: Python backend .exe + React frontend + Installer
echo ============================================================
echo.

:: ── 0. Paths ─────────────────────────────────────────────────────────────────
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

:: ── 1. Check prerequisites ────────────────────────────────────────────────────
echo [1/5] Checking prerequisites...

where python >nul 2>&1
if errorlevel 1 ( echo ERROR: python not found in PATH & pause & exit /b 1 )

where node >nul 2>&1
if errorlevel 1 ( echo ERROR: node not found in PATH & pause & exit /b 1 )

where npm >nul 2>&1
if errorlevel 1 ( echo ERROR: npm not found in PATH & pause & exit /b 1 )

python -m PyInstaller --version >nul 2>&1
if errorlevel 1 (
    echo    Installing PyInstaller...
    pip install pyinstaller --quiet
    if errorlevel 1 ( echo ERROR: Could not install PyInstaller & pause & exit /b 1 )
)
echo    Prerequisites OK

:: ── 2. Install / verify Python deps ──────────────────────────────────────────
echo.
echo [2/5] Verifying Python dependencies...
cd /d "%BACKEND%"

:: Check if torch is already installed (any version >= 2.5)
python -c "import torch; print('torch', torch.__version__)" >nul 2>&1
if errorlevel 1 (
    echo    torch not found — installing CPU build...
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu --quiet
    if errorlevel 1 ( echo ERROR: torch install failed & pause & exit /b 1 )
) else (
    echo    torch already installed — skipping
)

:: Check transformers
python -c "import transformers" >nul 2>&1
if errorlevel 1 (
    echo    transformers not found — installing...
    pip install "transformers>=4.45.0" --quiet
)

:: Check fastapi / uvicorn / multipart / pillow / numpy
python -c "import fastapi, uvicorn, multipart, PIL, numpy" >nul 2>&1
if errorlevel 1 (
    echo    Installing remaining web/image deps...
    pip install "fastapi>=0.115.0" "uvicorn[standard]>=0.30.0" "python-multipart>=0.0.9" "pillow>=10.4.0" "numpy>=2.0" --quiet
)

:: facenet-pytorch (must install WITHOUT deps due to old Pillow constraint)
python -c "from facenet_pytorch import MTCNN" >nul 2>&1
if errorlevel 1 (
    echo    Installing facenet-pytorch...
    pip install "facenet-pytorch==2.6.0" --no-deps --quiet
    if errorlevel 1 ( echo ERROR: facenet-pytorch install failed & pause & exit /b 1 )
)

echo    All Python deps OK

:: ── 3. Quick backend smoke-test ───────────────────────────────────────────────
echo.
echo [2b] Smoke-testing backend imports...
python -c "
import sys
try:
    import torch, torchvision, transformers, fastapi, uvicorn, PIL, numpy
    from facenet_pytorch import MTCNN
    print('  All imports OK')
    print('  torch:', torch.__version__)
    print('  transformers:', transformers.__version__)
except Exception as e:
    print('  IMPORT ERROR:', e)
    sys.exit(1)
"
if errorlevel 1 ( echo ERROR: Backend import test failed & pause & exit /b 1 )

:: ── 4. PyInstaller — bundle Python backend ────────────────────────────────────
echo.
echo [3/5] Building Python backend with PyInstaller...
echo    (This takes 5-15 min on first run — subsequent builds are faster)
cd /d "%BACKEND%"
if exist "dist\visioniq_server" (
    echo    Removing old backend dist...
    rmdir /s /q "dist\visioniq_server"
)
python -m PyInstaller visioniq_server.spec --noconfirm
if errorlevel 1 ( echo ERROR: PyInstaller build failed & pause & exit /b 1 )
echo    Backend build OK  ->  backend\dist\visioniq_server\

:: ── 5. Vite — build React frontend ───────────────────────────────────────────
echo.
echo [4/5] Building React frontend...
cd /d "%FRONTEND%"
if not exist "node_modules\electron" (
    echo    Running npm install...
    call npm install
    if errorlevel 1 ( echo ERROR: npm install failed & pause & exit /b 1 )
)
call npm run build
if errorlevel 1 ( echo ERROR: Vite build failed & pause & exit /b 1 )
echo    Frontend build OK  ->  frontend\dist\

:: ── 6. electron-builder — package the app ────────────────────────────────────
echo.
echo [5/5] Packaging Electron app and creating installer...
cd /d "%FRONTEND%"
call npm run electron:build
if errorlevel 1 ( echo ERROR: electron-builder failed & pause & exit /b 1 )

echo.
echo ============================================================
echo   BUILD COMPLETE!
echo   Installer: dist-electron\VisionIQ Setup 1.0.0.exe
echo ============================================================
echo.
pause
