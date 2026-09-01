# Divya Chakshu 2.0 — AI Image Recognition

> **"The Divine Eye that Sees, Analyzes, and Understands"**

A full-stack deep learning web application that detects and classifies **Male**, **Female**, and **Animals** in uploaded images using an ensemble of pretrained models. Built with FastAPI (Python) + React (Vite + Tailwind CSS).

---

## Project Overview

| Item | Detail |
|------|--------|
| **Project Name** | Divya Chakshu 2.0 |
| **Type** | Deep Learning · Computer Vision · Full-Stack Web App |
| **Models Used** | MTCNN · ViT · SigLIP2 · ResNet50 |
| **Backend** | Python 3.14 · FastAPI · SQLite |
| **Frontend** | React 18 · Vite · Tailwind CSS · Framer Motion |
| **Detection** | Male · Female · Animal · Unknown |

---

## Project Structure

```
divya-chakshu/
├── backend/
│   ├── app.py              # FastAPI server + SQLite history
│   ├── pipeline.py         # ML inference engine (ensemble)
│   ├── requirements.txt    # Python dependencies
│   ├── install.bat         # One-click dependency installer
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
│   │   │   ├── UploadZone.jsx       # Canvas + face box overlay
│   │   │   ├── ResultsPanel.jsx     # Detection results
│   │   │   ├── ModelStatusCard.jsx
│   │   │   ├── ConfidenceChart.jsx  # Donut chart
│   │   │   ├── ProcessingTimeChart.jsx
│   │   │   └── TopCategories.jsx
│   │   └── pages/
│   │       ├── DashboardPage.jsx    # Upload + live stats
│   │       ├── HistoryPage.jsx      # DB-backed history
│   │       └── ModelStatusPage.jsx  # Model metrics
│   ├── index.html
│   ├── tailwind.config.js
│   └── vite.config.js
│
└── README.md
```

---

## Setup & Installation

### Prerequisites

- Python 3.12+ (tested on 3.14)
- Node.js 18+
- npm 9+
- Internet connection (first run downloads model weights ~2 GB)

---

### Backend Setup

```bash

cd backend

install.bat

# OR manually:
pip install "fastapi==0.115.0" "uvicorn[standard]==0.30.6" "python-multipart==0.0.9" "pillow>=10.4.0" "numpy>=2.3" "torch>=2.5" "torchvision>=0.20" "transformers>=4.45"
pip install "facenet-pytorch==2.6.0" --no-deps

# 3. Start the server
python app.py
```

Server runs at: **http://localhost:8000**
API End-Point : **http://localhost:8000/docs**

> **First start is slow** — HuggingFace downloads ~2 GB of model weights. Subsequent starts are fast (weights cached locally).

---

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: **http://localhost:5173**

> The frontend proxies `/api/*` requests to `http://localhost:8000` automatically via Vite config.

---

### Quick Start Summary

```
Terminal 1:   cd backend   →  python app.py
Terminal 2:   cd frontend  →  npm run dev
Browser:      http://localhost:5173
```

---

## API Endpoints

### `GET /`
Returns app info and links.

### `GET /api/health`
Check model loading status and device.

### `POST /api/predict`
Upload an image for classification.

### `GET /api/history?limit=100`
Retrieve all saved analyses from the database.

### `DELETE /api/history`
Clear all history entries.

### `DELETE /api/history/{id}`
Delete a single history entry by ID.


### Interactive API Docs

FastAPI auto-generates interactive documentation:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

---

## ML Model Architecture

### Inference Pipeline

```
Input Image
    │
    ▼
MTCNN Face Detector  ──── Face detected? ────────────────────────┐
    │                                                             │
    │ Yes                                                         │ No
    ▼                                                             ▼
Face Crop (+ body context)                               ResNet50 ImageNet
    │                                                             │
    ▼                                                       Animal index?
ViT Gender Classifier (Primary)                               │       │
    +                                                       Yes      No
SigLIP2 Gender Classifier (Secondary)                        │       │
    │                                                        ▼       ▼
Ensemble Average                                          Animal  Unknown
    │
    ▼
Male / Female Result
```

### Models Used

| Model | Purpose | Source | Accuracy |
|-------|---------|--------|----------|
| **MTCNN** | Face bounding box detection | facenet-pytorch | ~94% precision |
| **ViT (rizvandwiki)** | Gender classification (primary) | Hugging Face | ~91% |
| **SigLIP2 (prithivMLmods)** | Gender classification (secondary) | Hugging Face | ~93% |
| **ResNet50 IMAGENET1K_V2** | Animal/object fallback | torchvision | 80.3% top-1 |

