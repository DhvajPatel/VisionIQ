"""
runtime_hook.py — PyInstaller runtime hook for VisionIQ backend.

Executed BEFORE any user code. Inserts sys._MEIPASS into sys.path
so that uvicorn can re-import "app" by name even inside a frozen bundle.
"""
import sys
import os

# Add the frozen bundle dir to sys.path so "import app" works
if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    meipass = sys._MEIPASS
    if meipass not in sys.path:
        sys.path.insert(0, meipass)
    # Also set working dir to _MEIPASS so relative imports work
    os.chdir(meipass)
