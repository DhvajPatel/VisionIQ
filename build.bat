@echo off
setlocal EnableDelayedExpansion
title VisionIQ — Build

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
set "ELECTRON=%ROOT%electron"
set "DIST=%ROOT%dist-electron"

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
    echo Installing PyInstaller...
    pip install pyinstaller --quiet
)
echo    Prerequisites OK

:: ── 2. Install Python deps ────────────────────────────────────────────────────
echo.
echo [2/5] Installing Python dependencies...
cd /d "%BACKEND%"
pip install -r requirements.txt --quiet
if errorlevel 1 ( echo ERROR: pip install failed & pause & exit /b 1 )
pip install "facenet-pytorch==2.6.0" --no-deps --quiet
if errorlevel 1 ( echo ERROR: facenet-pytorch install failed & pause & exit /b 1 )
echo    Python deps OK

:: ── 3. PyInstaller — bundle Python backend ────────────────────────────────────
echo.
echo [3/5] Building Python backend with PyInstaller (this takes 5-10 min)...
cd /d "%BACKEND%"
if exist "dist\visioniq_server" (
    echo    Removing old backend dist...
    rmdir /s /q "dist\visioniq_server"
)
python -m PyInstaller visioniq_server.spec --noconfirm
if errorlevel 1 ( echo ERROR: PyInstaller build failed & pause & exit /b 1 )
echo    Backend build OK  →  backend\dist\visioniq_server\

:: ── 4. Vite — build React frontend ───────────────────────────────────────────
echo.
echo [4/5] Building React frontend...
cd /d "%FRONTEND%"
if not exist "node_modules" (
    echo    Running npm install...
    call npm install --silent
    if errorlevel 1 ( echo ERROR: npm install failed & pause & exit /b 1 )
)
call npm run build
if errorlevel 1 ( echo ERROR: Vite build failed & pause & exit /b 1 )
echo    Frontend build OK  →  frontend\dist\

:: ── 5. electron-builder — package the app ────────────────────────────────────
echo.
echo [5/5] Packaging with electron-builder...
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
