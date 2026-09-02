# VisionIQ — AI Image Recognition

> **AI-powered vision that sees, analyzes, and understands.**

A full-stack deep learning web application that detects and classifies **Male**, **Female**, and **Animals** in uploaded images using an ensemble of pretrained models.

**Stack:** FastAPI (Python) + React (Vite + Tailwind CSS)

---

## Project Overview

| Item | Detail |
|------|--------|
| **Project Name** | VisionIQ |
| **Type** | Deep Learning · Computer Vision · Full-Stack Web App |
| **Models Used** | MTCNN · ViT · SigLIP2 · ResNet50 |
| **Backend** | Python 3.11 · FastAPI · SQLite |
| **Frontend** | React 18 · Vite · Tailwind CSS · Framer Motion |
| **Detection** | Male · Female · Animal · Unknown |

---

## Project Structure

```
VisionIQ/
├── backend/
│   ├── app.py              # FastAPI server + SQLite history
│   ├── pipeline.py         # ML inference engine (ensemble)
│   ├── requirements.txt    # Python dependencies
│   ├── install.bat         # One-click dependency installer (Windows)
│   └── history.db          # Auto-created SQLite database
│
├── frontend/
│   ├── public/
│   │   └── icon.png        # App icon
│   ├── src/
│   │   ├── App.jsx         # Root component + routing
│   │   ├── ThemeContext.jsx # Light/Dark theme provider
│   │   ├── main.jsx
│   │   ├── index.css       # CSS variables (light + dark)
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── UploadZone.jsx
│   │   │   ├── ResultsPanel.jsx
│   │   │   ├── ModelStatusCard.jsx
│   │   │   ├── ConfidenceChart.jsx
│   │   │   ├── ProcessingTimeChart.jsx
│   │   │   └── TopCategories.jsx
│   │   └── pages/
│   │       ├── DashboardPage.jsx
│   │       ├── HistoryPage.jsx
│   │       └── ModelStatusPage.jsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── render.yaml             # Render deployment config (backend)
├── vercel.json             # Vercel deployment config (frontend)
└── README.md
```

---

## Local Development

### Prerequisites

- Python 3.12+
- Node.js 18+
- npm 9+
- Internet connection (first run downloads model weights ~2 GB)

### Backend

```bash
cd backend

# Windows one-click:
install.bat

# Or manually:
pip install -r requirements.txt
pip install "facenet-pytorch==2.6.0" --no-deps

python app.py
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger UI)
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

The frontend proxies `/api/*` to `http://localhost:8000` automatically via Vite config.

### Quick Start

```
Terminal 1:  cd backend   →  python app.py
Terminal 2:  cd frontend  →  npm run dev
Browser:     http://localhost:5173
```

---

## Free Deployment (Vercel + Render)

Deploy the backend on **Render** (free tier) and the frontend on **Vercel** (free tier) — both are 100% free, no credit card needed.

```
Internet → Vercel (React frontend) → Render (FastAPI backend)
```

---

### Step 1 — Deploy Backend on Render

1. Push your project to a GitHub repository.

2. Go to [render.com](https://render.com) → **New → Web Service**.

3. Connect your GitHub repo. Render auto-detects `render.yaml` — it will pre-fill all settings:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt && pip install "facenet-pytorch==2.6.0" --no-deps`
   - **Start Command:** `uvicorn app:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free

4. Click **Create Web Service**. Wait for the build to finish (5–10 min on first deploy — it downloads ~2 GB of model weights).

5. Your backend URL will look like:
   ```
   https://visioniq-backend.onrender.com
   ```
   Copy this URL — you'll need it in Step 2.

> **Free tier note:** Render free services spin down after 15 minutes of inactivity. The first request after a cold start takes ~30–60 seconds while models reload. Subsequent requests are fast.

---

### Step 2 — Configure Frontend for Production

Open `vercel.json` and replace the placeholder with your actual Render backend URL:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://visioniq-backend.onrender.com/api/:path*" }
  ]
}
```

This tells Vercel to forward all `/api/*` calls to your Render backend — no CORS issues.

---

### Step 3 — Deploy Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New → Project**.

2. Import your GitHub repository.

3. Set the **Root Directory** to `frontend`.

4. Vercel auto-detects Vite and applies the correct build settings:
   - **Framework:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

5. Click **Deploy**. Your frontend will be live at:
   ```
   https://visioniq.vercel.app
   ```

---

### Step 4 — Verify

| Check | URL |
|-------|-----|
| Frontend | `https://your-app.vercel.app` |
| Backend health | `https://visioniq-backend.onrender.com/api/health` |
| Backend API docs | `https://visioniq-backend.onrender.com/docs` |

If the health check returns `"models_loaded": true`, everything is working.

---

### Deployment Summary

| Service | Platform | Plan | Cost |
|---------|----------|------|------|
| React frontend | Vercel | Hobby (free) | $0 |
| FastAPI backend | Render | Free | $0 |

---

## API Endpoints

Base URL (local): `http://localhost:8000`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Model load status + device |
| `POST` | `/api/predict` | Upload image → classification |
| `GET` | `/api/history` | Saved analyses (newest first) |
| `DELETE` | `/api/history` | Clear all history |
| `DELETE` | `/api/history/{id}` | Delete single entry |

---

## ML Model Architecture

```
Input Image
    │
    ▼
MTCNN Face Detector
    │
    ├── Face found? ─── YES ──► ViT + SigLIP2 Ensemble ──► Male / Female
    │
    └── No face ──► ResNet50 ImageNet
                        │
                        ├── class idx ≤ 397 ──► Animal
                        └── otherwise ────────► Unknown
```

| Model | Purpose | Accuracy |
|-------|---------|----------|
| MTCNN | Face detection | ~94% precision |
| ViT (rizvandwiki) | Gender — primary | ~91% |
| SigLIP2 (prithivMLmods) | Gender — secondary | ~93% |
| ResNet50 IMAGENET1K_V2 | Animal/object fallback | 80.3% top-1 |
