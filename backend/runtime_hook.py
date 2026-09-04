"""
runtime_hook.py — PyInstaller runtime hook for VisionIQ backend.

Executed BEFORE any user code when running as a frozen bundle.

Fixes:
1. sys.path: insert _MEIPASS so module imports work
2. inspect.getsource patch: torch.distributed.config calls inspect.getsource()
   at import time which crashes in a frozen bundle (no .py source files).
   We patch inspect.getsource to return empty string instead of raising OSError.
3. torch.distributed: patch the problematic config install to be a no-op
"""
import sys
import os

# ── 1. sys.path fix ───────────────────────────────────────────────────────────
if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    meipass = sys._MEIPASS
    if meipass not in sys.path:
        sys.path.insert(0, meipass)
    os.chdir(meipass)

# ── 2. inspect.getsource patch ────────────────────────────────────────────────
# torch.distributed.config calls inspect.getsource() during module init.
# In a frozen bundle there are no .py files, so this raises OSError.
# Patch inspect to return empty string instead.
import inspect as _inspect

_orig_getsource = _inspect.getsource
_orig_getsourcelines = _inspect.getsourcelines
_orig_findsource = _inspect.findsource

def _safe_getsource(obj):
    try:
        return _orig_getsource(obj)
    except (OSError, TypeError):
        return ""

def _safe_getsourcelines(obj):
    try:
        return _orig_getsourcelines(obj)
    except (OSError, TypeError):
        return ([], 0)

def _safe_findsource(obj):
    try:
        return _orig_findsource(obj)
    except (OSError, TypeError):
        # Return empty source lines and line 0
        return ([], 0)

_inspect.getsource = _safe_getsource
_inspect.getsourcelines = _safe_getsourcelines
_inspect.findsource = _safe_findsource

# ── 3. torch._config_module patch ────────────────────────────────────────────
# torch.utils._config_module.get_assignments_with_compile_ignored_comments
# also calls inspect.getsource — patch it to be safe too.
# This is done via the inspect patch above, but we also stub the function
# directly to be extra safe.
try:
    import torch.utils._config_module as _cm
    _orig_ga = _cm.get_assignments_with_compile_ignored_comments

    def _safe_ga(module):
        try:
            return _orig_ga(module)
        except (OSError, TypeError):
            return {}

    _cm.get_assignments_with_compile_ignored_comments = _safe_ga
except Exception:
    pass
