@echo off
echo ============================================================
echo  Divya-Chakshu backend installer (Python 3.14 compatible)
echo ============================================================

:: Step 1: install everything except facenet-pytorch
echo.
echo [1/2] Installing core dependencies...
pip install ^
    "fastapi==0.115.0" ^
    "uvicorn[standard]==0.30.6" ^
    "python-multipart==0.0.9" ^
    "pillow>=10.4.0" ^
    "numpy>=2.3" ^
    "torch>=2.5" ^
    "torchvision>=0.20" ^
    "transformers>=4.45"

if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Core dependency install failed. See above for details.
    pause
    exit /b 1
)

:: Step 2: install facenet-pytorch WITHOUT its broken Pillow constraint
echo.
echo [2/2] Installing facenet-pytorch (no-deps to skip Pillow conflict)...
pip install "facenet-pytorch==2.6.0" --no-deps

if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: facenet-pytorch install failed. See above for details.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  All dependencies installed successfully!
echo  Start the server with:  python app.py
echo ============================================================
pause
