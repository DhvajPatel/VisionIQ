"""
FastAPI server for VisionIQ
Endpoints:
  GET  /api/health          -> model status
  POST /api/predict         -> image upload -> prediction
  GET  /api/history         -> all saved analyses
  DELETE /api/history       -> clear all history
  DELETE /api/history/{id}  -> delete single entry
"""
import base64, io, json, logging, sqlite3, time
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from pipeline import DivyaChakshuEngine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("visioniq")

# ── database ──────────────────────────────────────────────────────────────────
DB_PATH = Path(__file__).parent / "history.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS analyses (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                ts        REAL    NOT NULL,
                category  TEXT    NOT NULL,
                label     TEXT    NOT NULL,
                result    TEXT    NOT NULL,
                image_b64 TEXT    NOT NULL,
                proc_ms   REAL
            )
        """)
        conn.commit()

init_db()

# ── app ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="VisionIQ API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = None
load_error = None
try:
    logger.info("Loading models (float16 mode)…")
    engine = DivyaChakshuEngine()
    logger.info("All models ready.")
except Exception as exc:
    load_error = str(exc)
    logger.exception("Failed to load models")


# ── helpers ───────────────────────────────────────────────────────────────────
def build_label(result_dict: dict) -> str:
    cat = result_dict.get("category", "unknown")
    if cat == "person":
        genders = [f.get("gender", "") for f in result_dict.get("faces", [])]
        counts = {}
        for g in genders:
            counts[g] = counts.get(g, 0) + 1
        return ", ".join(f"{n} {g}" for g, n in counts.items()) if counts else "Person"
    if cat == "animal":
        return result_dict.get("label") or "Animal"
    return result_dict.get("best_guess_label") or "Unknown"

def image_to_b64(image: Image.Image, max_w=400) -> str:
    """Resize and encode image to base64 JPEG for storage."""
    ratio = min(1.0, max_w / max(image.width, 1))
    w, h  = int(image.width * ratio), int(image.height * ratio)
    thumb = image.resize((w, h), Image.LANCZOS)
    buf   = io.BytesIO()
    thumb.convert("RGB").save(buf, format="JPEG", quality=75)
    return base64.b64encode(buf.getvalue()).decode()


# ── routes ────────────────────────────────────────────────────────────────────
@app.get("/")
def root(request: Request):
    base = str(request.base_url).rstrip("/")
    return {
        "app": "VisionIQ",
        "status": "running",
        "frontend": "https://visioniq-zeta.vercel.app",
        "docs": f"{base}/docs",
        "health": f"{base}/api/health",
    }


@app.get("/api/health")
def health():
    loaded = engine is not None and getattr(engine, "_loaded", False)
    return {
        "status":        "ok" if engine else "error",
        "models_loaded": loaded,
        "error":         load_error,
        "device":        str(engine.device) if engine else None,
    }


@app.post("/api/predict")
async def predict(file: UploadFile = File(...)):
    if engine is None:
        raise HTTPException(503, f"Models failed to load: {load_error}")

    raw = await file.read()
    try:
        image = Image.open(io.BytesIO(raw))
    except Exception:
        raise HTTPException(400, "Not a readable image.")

    t0     = time.perf_counter()
    try:
        result = engine.predict(image)
    except Exception as exc:
        logger.exception("Prediction failed")
        raise HTTPException(500, f"Prediction failed: {exc}")
    proc_ms = (time.perf_counter() - t0) * 1000

    if result.category == "person":
        result_dict = {
            "category": "person",
            "faces": [
                {
                    "box":              f.box,
                    "face_confidence":  f.face_confidence,
                    "gender":           f.gender,
                    "gender_confidence": f.gender_confidence,
                }
                for f in result.faces
            ],
        }
    elif result.category == "animal":
        result_dict = {
            "category":   "animal",
            "label":      result.animal_label,
            "confidence": result.animal_confidence,
        }
    else:
        result_dict = {
            "category":             "unknown",
            "best_guess_label":     result.fallback_label,
            "best_guess_confidence": result.fallback_confidence,
        }

    # persist to SQLite
    label    = build_label(result_dict)
    img_b64  = image_to_b64(image)
    with get_db() as conn:
        conn.execute(
            "INSERT INTO analyses (ts, category, label, result, image_b64, proc_ms) VALUES (?,?,?,?,?,?)",
            (time.time(), result_dict["category"], label, json.dumps(result_dict), img_b64, round(proc_ms, 1))
        )
        conn.commit()

    result_dict["proc_ms"] = round(proc_ms, 1)
    return result_dict


@app.get("/api/history")
def get_history(limit: int = 100):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM analyses ORDER BY ts DESC LIMIT ?", (limit,)
        ).fetchall()
    return [
        {
            "id":       r["id"],
            "ts":       r["ts"],
            "category": r["category"],
            "label":    r["label"],
            "result":   json.loads(r["result"]),
            "image_b64": r["image_b64"],
            "proc_ms":  r["proc_ms"],
        }
        for r in rows
    ]


@app.delete("/api/history")
def clear_history():
    with get_db() as conn:
        conn.execute("DELETE FROM analyses")
        conn.commit()
    return {"deleted": "all"}


@app.delete("/api/history/{entry_id}")
def delete_entry(entry_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM analyses WHERE id=?", (entry_id,))
        conn.commit()
    return {"deleted": entry_id}


if __name__ == "__main__":
    import sys
    import asyncio
    import uvicorn

    async def _serve():
        config = uvicorn.Config(
            app=app,           # pass object — never a string
            host="127.0.0.1",
            port=8000,
            reload=False,
            log_level="info",
            loop="asyncio",
            # Disable lifespan so uvicorn doesn't try to re-import the app
            lifespan="off",
        )
        server = uvicorn.Server(config)
        await server.serve()

    asyncio.run(_serve())
