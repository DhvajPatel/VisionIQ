# Divya Chakshu 2.0 — Complete Project Guide

> **"The Divine Eye that Sees, Analyzes, and Understands"**
> A Deep Learning Computer Vision project for gender and species classification from images.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [How to Build & Run](#2-how-to-build--run)
3. [API Endpoints Reference](#3-api-endpoints-reference)
4. [Transformer Models Used](#4-transformer-models-used)
5. [Inference Pipeline (Deep Dive)](#5-inference-pipeline-deep-dive)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Database Schema](#7-database-schema)
8. [Q&A — Interview / Viva Preparation](#8-qa--interview--viva-preparation)
9. [Project Phases & PPT Presentation Guide](#9-project-phases--ppt-presentation-guide)

---

## 1. Project Overview

| Item | Detail |
|------|--------|
| **Project Name** | Divya Chakshu 2.0 |
| **Type** | Deep Learning · Computer Vision · Full-Stack Web App |
| **Goal** | Detect and classify uploaded images as Male, Female, Animal, or Unknown |
| **Backend** | Python · FastAPI · SQLite |
| **Frontend** | React 18 · Vite · Tailwind CSS · Framer Motion |
| **Models** | MTCNN · ViT (Vision Transformer) · SigLIP2 · ResNet50 |
| **Key Technique** | Ensemble averaging of two transformer models for gender bias correction |

**What makes it unique:**
- Uses two independent transformer models (ViT + SigLIP2) and **averages their probability scores** — this removes the strong "Male" bias that a single model has for ambiguous inputs like children or non-Western attire.
- Uses an **expanded body context crop** (includes shoulders + torso) because clothing style/color is a strong gender discriminator, especially for children.

---

## 2. How to Build & Run

### Prerequisites

| Tool | Minimum Version |
|------|----------------|
| Python | 3.12+ (tested on 3.14) |
| Node.js | 18+ |
| npm | 9+ |
| Internet | Required on first run (downloads ~2 GB model weights) |

---

### Step 1 — Clone / Open Project

```
divya-chakshu/
├── backend/    ← Python FastAPI server
└── frontend/   ← React Vite app
```

---

### Step 2 — Backend Setup

Open **Terminal 1** and run:

```bash
cd backend
```

**Option A — One-click installer (Windows):**
```bash
install.bat
```

**Option B — Manual install:**
```bash
# Core packages
pip install "fastapi==0.115.0" "uvicorn[standard]==0.30.6" "python-multipart==0.0.9"
pip install "pillow>=10.4.0" "numpy>=2.3"
pip install "torch>=2.5" "torchvision>=0.20" "transformers>=4.45"

# IMPORTANT: facenet-pytorch must be installed WITHOUT its dependencies
# because it has a stale Pillow version constraint that breaks Python 3.14
pip install "facenet-pytorch==2.6.0" --no-deps
```

**Start the backend server:**
```bash
python app.py
```

- Server URL: **http://localhost:8000**
- Interactive API docs: **http://localhost:8000/docs**
- On first start, Hugging Face downloads ~2 GB of model weights (cached after that).

---

### Step 3 — Frontend Setup

Open **Terminal 2** (new terminal window):

```bash
cd frontend
npm install
npm run dev
```

- App URL: **http://localhost:5173**
- The Vite dev server automatically proxies all `/api/*` requests to `http://localhost:8000` — no manual CORS config needed in dev.

---

### Step 4 — Production Build (optional)

```bash
cd frontend
npm run build       # outputs to frontend/dist/
npm run preview     # preview the production build locally
```

You can then serve the `dist/` folder via nginx or any static host, pointing the API base to your deployed FastAPI server.

---

### Quick Reference

```
Terminal 1 → cd backend   → python app.py       (http://localhost:8000)
Terminal 2 → cd frontend  → npm run dev          (http://localhost:5173)
Browser    → http://localhost:5173
```

---

## 3. API Endpoints Reference

Base URL: `http://localhost:8000`

All endpoints return JSON. The frontend uses relative `/api/*` paths which Vite proxies to port 8000.

---

### `GET /`
**Purpose:** Root info endpoint.

**Response:**
```json
{
  "app": "Divya Chakshu 2.0",
  "status": "running",
  "frontend": "http://localhost:5173",
  "docs": "http://localhost:8000/docs"
}
```

---

### `GET /api/health`
**Purpose:** Check whether all ML models loaded successfully and which device (CPU/GPU) is active.

**Response — models loaded:**
```json
{
  "status": "ok",
  "models_loaded": true,
  "error": null,
  "device": "cpu"
}
```

**Response — models failed:**
```json
{
  "status": "error",
  "models_loaded": false,
  "error": "CUDA out of memory / import error message",
  "device": null
}
```

The frontend polls this on startup and shows the "Models Active" / "Models Offline" pill in the header.

---

### `POST /api/predict`
**Purpose:** Main inference endpoint. Upload an image, get back category + details.

**Request:** `multipart/form-data`, field name: `file` (any common image format: JPEG, PNG, WEBP, BMP).

**Response — Person detected (one or more faces found):**
```json
{
  "category": "person",
  "faces": [
    {
      "box": [x0, y0, x1, y1],
      "face_confidence": 0.9987,
      "gender": "Male",
      "gender_confidence": 0.9341
    },
    {
      "box": [120, 45, 310, 290],
      "face_confidence": 0.9712,
      "gender": "Female",
      "gender_confidence": 0.8823
    }
  ],
  "proc_ms": 842.3
}
```

- `box`: pixel coordinates `[left, top, right, bottom]`
- `face_confidence`: MTCNN's detection confidence (threshold: 0.85)
- `gender_confidence`: averaged score from both ViT + SigLIP2 ensemble

**Response — Animal detected:**
```json
{
  "category": "animal",
  "label": "golden retriever",
  "confidence": 0.8821,
  "proc_ms": 312.1
}
```

**Response — Unknown object:**
```json
{
  "category": "unknown",
  "best_guess_label": "park bench",
  "best_guess_confidence": 0.4210,
  "proc_ms": 298.5
}
```

**Error — backend models offline (HTTP 503):**
```json
{ "detail": "Models failed to load: <error message>" }
```

**Error — unreadable file (HTTP 400):**
```json
{ "detail": "Not a readable image." }
```

---

### `GET /api/history?limit=100`
**Purpose:** Retrieve all saved analyses from SQLite, newest first.

**Query params:**
- `limit` (optional, default 100): max number of records to return.

**Response:**
```json
[
  {
    "id": 42,
    "ts": 1751234567.89,
    "category": "person",
    "label": "1 Male, 1 Female",
    "result": { "category": "person", "faces": [ ... ] },
    "image_b64": "<base64-encoded JPEG thumbnail, max 400px wide>",
    "proc_ms": 1240.5
  }
]
```

- `ts`: Unix timestamp (seconds)
- `image_b64`: thumbnail stored as base64 JPEG (quality 75, max 400 px wide) to keep DB size manageable

---

### `DELETE /api/history`
**Purpose:** Wipe all history records.

**Response:**
```json
{ "deleted": "all" }
```

---

### `DELETE /api/history/{id}`
**Purpose:** Delete a single history record by its integer ID.

**Response:**
```json
{ "deleted": 42 }
```

---

### Interactive API Docs (auto-generated by FastAPI)

| UI | URL |
|----|-----|
| Swagger UI (try it live) | http://localhost:8000/docs |
| ReDoc (clean reference) | http://localhost:8000/redoc |

---

## 4. Transformer Models Used

### Overview Table

| # | Model | Architecture | Source | Task | Metric |
|---|-------|-------------|--------|------|--------|
| 1 | MTCNN | CNN cascade | facenet-pytorch | Face bounding box detection | ~94% precision |
| 2 | ViT Gender (rizvandwiki) | Vision Transformer (ViT-B/16) | Hugging Face | Gender classification — primary | ~91% accuracy |
| 3 | SigLIP2 Gender (prithivMLmods) | SigLIP2 (Google) | Hugging Face | Gender classification — secondary | ~93% accuracy |
| 4 | ResNet50 IMAGENET1K_V2 | ResNet-50 (deep residual CNN) | torchvision | Animal / object fallback | 80.3% top-1 |

---

### Model 1: MTCNN (Multi-task Cascaded Convolutional Networks)

**What it does:** Detects faces in an image and returns bounding boxes with confidence scores.

**How it works:**
- Three-stage cascade: P-Net (proposal), R-Net (refinement), O-Net (output)
- P-Net rapidly scans the image at multiple scales proposing face candidate regions
- R-Net refines those candidates, filtering false positives
- O-Net outputs final boxes + landmark positions (eyes, nose, mouth corners)

**Configuration in this project:**
- `keep_all=True` — detect all faces in the image, not just the largest
- `min_face_size=20` — detect smaller faces (useful for children and distant faces)
- Confidence threshold lowered to **0.85** (from typical 0.92) — catches tilted/oblique faces

**Package:** `facenet-pytorch==2.6.0`

---

### Model 2: ViT Gender Classifier (Primary)

**Model ID:** `rizvandwiki/gender-classification`
**Architecture:** Vision Transformer (ViT-B/16)

**What is a Vision Transformer (ViT)?**
- Splits the image into fixed-size 16×16 pixel patches
- Each patch is embedded as a token (like words in NLP)
- A standard Transformer encoder processes all patch tokens with self-attention
- A classification head (`[CLS]` token) outputs the final label

**Why ViT is powerful:**
- Self-attention captures global context across the whole image simultaneously (not just local neighborhoods like CNNs)
- Pre-trained on ImageNet-21k (14 million images), fine-tuned for binary gender classification
- ~1.4 million downloads on Hugging Face

**Limitation (handled by ensemble):** Strong "Male" prior on ambiguous inputs.

---

### Model 3: SigLIP2 Gender Classifier (Secondary)

**Model ID:** `prithivMLmods/Gender-Classifier-Mini`
**Architecture:** SigLIP2 (Sigmoid Loss for Image-Language Pre-training v2) by Google

**What is SigLIP2?**
- A vision-language model trained with sigmoid contrastive loss instead of softmax (unlike original CLIP)
- Sigmoid loss treats each image-text pair independently (no negative sampling required), making training more stable at scale
- The "Mini" variant is a compact version fine-tuned for gender classification

**Advantage over ViT alone:**
- Trained on more diverse, globally representative data (less Western-skewed)
- Complementary bias profile — where ViT over-predicts Male, SigLIP2 balances it

**Ensemble Strategy:**
```
avg_male   = (vit_male   + siglip_male)   / 2
avg_female = (vit_female + siglip_female) / 2
prediction = "Female" if avg_female >= avg_male else "Male"
confidence = max(avg_male, avg_female)
```

---

### Model 4: ResNet50 (Animal / Object Fallback)

**Source:** `torchvision.models.resnet50(weights=ResNet50_Weights.IMAGENET1K_V2)`
**Architecture:** Deep Residual Network — 50 layers

**What is ResNet-50?**
- A CNN with residual (skip) connections that prevent vanishing gradients in deep networks
- The "shortcut" connections let gradients flow directly through layers during backpropagation
- Trained on ImageNet-1k (1000 classes, 1.28 million images)

**How it's used here:**
- Runs only when MTCNN finds NO face in the image
- ImageNet class indices 0–397 correspond to animals (fish, birds, reptiles, mammals)
- If the top-predicted class index ≤ 397 → output as "Animal"
- Otherwise → output as "Unknown" with the best-guess label

**Weights:** IMAGENET1K_V2 (80.3% top-1 accuracy — improved over V1)

---

### Body Context Crop (Key Technique)

Instead of feeding just the face crop to the gender models, the crop is **expanded downward** to include shoulders and upper torso:

```python
BODY_CONTEXT_FACTOR = 1.2  # extend 1.2× face-height below chin

# Extend downward
y1_extended = min(y1 + face_height * 1.2, image_height)

# Widen by 15% on each side (shoulder context)
x0_extended = max(0, x0 - face_width * 0.15)
x1_extended = min(image_width, x1 + face_width * 0.15)
```

**Why:** Clothing color and style carry significant gender information, especially for:
- Young children (where facial features alone are often ambiguous)
- Partially occluded faces
- Non-frontal face orientations

---

## 5. Inference Pipeline (Deep Dive)

```
Input Image (any format)
       │
       ▼
  image.convert("RGB")     ← normalize color channels
       │
       ▼
  MTCNN.detect()           ← returns bounding boxes + probabilities
       │
       ├── boxes is None OR all probs < 0.85?
       │              │
       │              ▼
       │         ResNet50 ImageNet
       │              │
       │         top_class_idx ≤ 397?
       │              ├── YES → category: "animal"
       │              └── NO  → category: "unknown"
       │
       └── valid faces found?
                      │
                      ▼
              For each face box:
                1. _expanded_crop()       ← add body context
                2. ViT pipeline(crop)     ← scores: {Male: p1, Female: p1}
                3. SigLIP2 pipeline(crop) ← scores: {Male: p2, Female: p2}
                4. Ensemble average       ← avg = (p1+p2)/2 per class
                5. argmax → gender label + confidence
                      │
                      ▼
              category: "person"
              faces: [FaceResult, ...]
```

**Time complexity:**
- MTCNN detection: ~50–150 ms (CPU)
- Each face gender ensemble: ~200–400 ms (CPU, two transformer forward passes)
- ResNet50 fallback: ~50–100 ms
- Total typical range: 300 ms – 2 s depending on face count and hardware

---

## 6. Frontend Architecture

### Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| React | 18.3.1 | UI component library |
| Vite | 8.x | Dev server, bundler, HMR |
| Tailwind CSS | 3.4.4 | Utility-first CSS |
| Framer Motion | 11.x | Animations and page transitions |
| PostCSS / Autoprefixer | — | CSS processing |

### Pages & Components

```
App.jsx                     ← root: routing state, API calls, session data
│
├── Sidebar.jsx             ← navigation (Dashboard / History / Model Status)
│
├── pages/
│   ├── DashboardPage.jsx   ← stat cards + upload + results + charts
│   ├── HistoryPage.jsx     ← SQLite-backed grid with detail panel
│   └── ModelStatusPage.jsx ← model cards + pipeline diagram
│
└── components/
    ├── UploadZone.jsx           ← drag-drop + canvas face box overlay
    ├── ResultsPanel.jsx         ← per-face gender bars
    ├── ConfidenceChart.jsx      ← donut chart
    ├── ProcessingTimeChart.jsx  ← line chart (last 10 analyses)
    ├── ModelStatusCard.jsx      ← device + model active indicator
    ├── TopCategories.jsx        ← session category breakdown
    └── Sidebar.jsx              ← icon + text nav links
```

### How Face Boxes are Drawn

The `UploadZone` component renders the image on an HTML5 `<canvas>` element and draws bounding boxes:
- Blue box → Male face
- Pink box → Female face
- Hovering a row in ResultsPanel calls `onHoverFace(index)` which highlights that specific box on the canvas

### Theme System

`ThemeContext.jsx` provides a React context with `theme` ("dark" | "light") and `toggle()`. The value is persisted to `localStorage` so it survives page refreshes. All colors are CSS custom properties defined in `index.css`:

```css
:root { --color-bg-primary: ...; --color-tx-primary: ...; }
.dark { --color-bg-primary: ...; --color-tx-primary: ...; }
```

Tailwind config maps these variables to utility classes like `bg-bg-primary`, `text-tx-primary`.

### Vite Proxy Config

`vite.config.js` proxies `/api/*` → `http://localhost:8000` so the frontend can use relative `/api/predict` URLs during development without CORS issues:

```js
server: {
  proxy: {
    '/api': 'http://localhost:8000'
  }
}
```

---

## 7. Database Schema

File: `backend/history.db` (SQLite, auto-created on first run)

```sql
CREATE TABLE analyses (
  id        INTEGER  PRIMARY KEY AUTOINCREMENT,
  ts        REAL     NOT NULL,          -- Unix timestamp (seconds)
  category  TEXT     NOT NULL,          -- 'person' | 'animal' | 'unknown'
  label     TEXT     NOT NULL,          -- human-readable e.g. "2 Male, 1 Female"
  result    TEXT     NOT NULL,          -- full JSON result blob
  image_b64 TEXT     NOT NULL,          -- base64 JPEG thumbnail (≤400px wide)
  proc_ms   REAL                        -- inference time in milliseconds
);
```

Thumbnails are resized to max 400 px width at quality 75 before storing, keeping the database from growing too large. The full prediction JSON is stored in the `result` column as a serialized string.

---

## 8. Q&A — Interview / Viva Preparation

### Conceptual Questions

**Q1. What is Divya Chakshu and what problem does it solve?**
A: Divya Chakshu is a real-time image recognition web application that classifies uploaded images into three categories: person (with gender), animal, or unknown. It solves the challenge of quick, accessible visual intelligence without requiring users to have any ML knowledge — just upload and get results.

---

**Q2. Why did you use a Transformer model instead of a simple CNN for gender classification?**
A: CNNs are excellent at recognizing local texture patterns but have limited ability to capture global contextual relationships. A Vision Transformer (ViT) divides the image into patches and uses self-attention to relate every patch to every other patch simultaneously. This global context is important for gender classification — for example, relating a person's face patch to their clothing patch gives additional discriminative signal.

---

**Q3. What is an ensemble model and why did you use it here?**
A: An ensemble combines predictions from multiple independent models to produce a more robust result. Here, ViT and SigLIP2 are trained differently and have different biases. ViT has a strong "Male" prior for ambiguous inputs (children, non-Western faces). SigLIP2 has a more balanced distribution due to diverse training data. Averaging their probability scores before making a decision cancels out each model's individual bias, improving overall accuracy especially for edge cases.

---

**Q4. What is MTCNN and how does it detect faces?**
A: MTCNN (Multi-task Cascaded Convolutional Networks) uses three progressively refined stages:
- **P-Net**: Rapidly scans the image at multiple scales to propose candidate face regions
- **R-Net**: Filters out false candidates from P-Net
- **O-Net**: Outputs final precise bounding boxes and 5 facial landmarks

This cascaded design is both fast and accurate because most regions are eliminated in the early cheap stages.

---

**Q5. Why did you lower MTCNN's confidence threshold from 0.92 to 0.85?**
A: The default higher threshold works well for well-lit, frontal adult faces. But it misses:
- Children's faces (less defined facial features)
- Oblique or partially turned faces
- Faces in low-resolution regions of the image
Lowering to 0.85 increases recall (catches more faces) at a small cost of slightly more false positives, which is acceptable because the subsequent gender classifier further filters the crop.

---

**Q6. What is the Body Context Crop and why is it important?**
A: Instead of cropping just the tight face bounding box, the pipeline extends the crop 1.2× the face height downward (to include shoulders/chest) and widens by 15% on each side. Clothing color, style, and jewelry are highly discriminative gender cues — especially for children where facial features alone are ambiguous. This single change significantly improved accuracy on child images.

---

**Q7. How does ResNet50 know if something is an animal?**
A: ResNet50 is pre-trained on ImageNet-1k which has 1000 classes. The first 398 classes (indices 0–397) in ImageNet correspond to animal species (fish, birds, reptiles, insects, mammals, etc.). After running the image through ResNet50, the pipeline checks if the top predicted class index falls within this range. If yes → animal. If no → unknown.

---

**Q8. What is SigLIP2 and how is it different from CLIP?**
A: Both are vision-language models that learn image-text relationships. The difference is in the loss function:
- **CLIP** uses **softmax** contrastive loss across all pairs in a batch — each positive pair must "win" against all negatives
- **SigLIP** uses **sigmoid** loss treating each pair independently, which scales better to large batches and doesn't require large negative sets
SigLIP2 is Google's second generation with improved training, better multilingual performance, and more balanced predictions.

---

**Q9. How is the prediction result stored in the database?**
A: After every prediction, the app:
1. Builds a label string (e.g., "2 Male, 1 Female")
2. Resizes the uploaded image to max 400px wide and encodes it as base64 JPEG
3. Stores: timestamp, category, label, full JSON result, image thumbnail, processing time
This allows the History page to show thumbnails and full details without re-running inference.

---

**Q10. What is FastAPI and why use it over Flask?**
A: FastAPI is a modern Python web framework built on ASGI (Asynchronous Server Gateway Interface). Key advantages over Flask:
- **Async support** natively — important for I/O-bound operations (reading uploaded files)
- **Automatic OpenAPI docs** generated from type hints (Swagger UI at `/docs`)
- **Pydantic validation** built in for request/response types
- **Significantly faster** than Flask in benchmarks (comparable to Node.js)

---

**Q11. What is Vite and why use it over Create React App?**
A: Vite is a build tool that uses native ES modules in development (no bundling during dev). This gives near-instant startup and blazing fast Hot Module Replacement. Create React App (CRA) uses Webpack which bundles everything even in development, making it slow for large projects. Vite's production build uses Rollup for optimized output.

---

**Q12. How does the frontend know whether models are loaded?**
A: On startup, `App.jsx` calls `GET /api/health` which returns `{ models_loaded: true/false, device: "cpu" }`. This state is passed down to all components. The header shows a green pulsing dot ("Models Active") or red dot ("Models Offline"). The prediction button is disabled if models are offline.

---

**Q13. What happens if someone uploads a non-image file?**
A: The backend tries to open the file using `PIL.Image.open()`. If it fails (corrupt file, wrong format, non-image), it raises an HTTP 400 error: `"Not a readable image."` The frontend catches this in the try/catch block and shows an error state.

---

**Q14. Can this run on GPU? How?**
A: Yes. The `DivyaChakshuEngine` checks `torch.cuda.is_available()`. If a CUDA-compatible GPU is detected:
- MTCNN runs on `device="cuda:0"`
- HuggingFace pipelines use `device=0`
- ResNet50 is moved to `.to(self.device)`

No code changes are needed — just have CUDA drivers + a GPU-compatible PyTorch build installed.

---

**Q15. How do you handle multiple faces in a single image?**
A: MTCNN is initialized with `keep_all=True` which returns ALL detected bounding boxes. The pipeline loops through each box, runs the gender ensemble on each face's expanded crop, and returns an array of `FaceResult` objects. The frontend draws individual colored boxes (blue/pink) for each face and shows a row per face in the results panel.

---

### Technical / Code Questions

**Q16. Why install facenet-pytorch with `--no-deps`?**
A: `facenet-pytorch==2.6.0` has an outdated `Pillow<10.3.0` constraint in its setup. Python 3.14 requires newer Pillow (10.4+). Installing with `--no-deps` skips dependency resolution, letting us supply the correct Pillow version ourselves.

---

**Q17. How does the frontend proxy work in development?**
A: `vite.config.js` contains:
```js
server: { proxy: { '/api': 'http://localhost:8000' } }
```
When the browser calls `/api/predict`, Vite's dev server intercepts it and forwards it to `http://localhost:8000/api/predict`. This means the frontend and backend appear to be on the same origin — no CORS preflight needed during development.

---

**Q18. Why is the image stored as base64 in SQLite instead of as a file?**
A: Simplicity. Storing it in SQLite keeps the entire application self-contained — one `history.db` file holds all data. The thumbnails are compressed to max 400px × quality 75 JPEG, keeping individual records small (~15–30 KB each). For a production app with many users, a proper object store (S3, filesystem) would be used.

---

**Q19. What animation library is used and why?**
A: Framer Motion (`framer-motion@11`). It provides React-native declarative animations using the `motion` component and `AnimatePresence` for enter/exit animations. Page transitions, card hover effects, stat card entrances, and the accuracy bar fill animations all use Framer Motion. It integrates cleanly with React state without manual animation lifecycle management.

---

**Q20. What does `proc_ms` measure exactly?**
A: In the backend, `proc_ms = (time.perf_counter() - t0) * 1000` where `t0` is set just before `engine.predict(image)` and measured after. This is pure ML inference time (MTCNN + gender models or ResNet50). It excludes file upload time, image decoding, and database write time. The frontend also measures end-to-end time from API call to response received using `performance.now()`.

---

## 9. Project Phases & PPT Presentation Guide

### Phase 1 — Problem Definition & Research (Week 1–2)
**PPT Slides:**
- Title slide: Project name, team, date
- Problem statement: Why is automated gender/species classification useful?
- Existing solutions and their limitations (single-model bias, no real-time UI)
- Proposed solution overview (ensemble + web app)
- Tools and technologies selected (justify each choice)

**Key talking points:**
- Real-world use cases: surveillance, retail analytics, wildlife monitoring
- Gap in existing tools: single-model systems have demographic bias
- Why full-stack: makes the ML accessible without coding knowledge

---

### Phase 2 — Data & Model Selection (Week 3–4)
**PPT Slides:**
- Why pre-trained models? (Transfer learning explanation)
- Model comparison table (MTCNN vs OpenCV Haar vs Dlib for face detection)
- Why ViT over ResNet for gender? (Global attention vs local features)
- Why SigLIP2 as secondary? (Sigmoid loss, diverse training data)
- Ensemble strategy diagram (probability averaging flowchart)
- Body context crop motivation with before/after example images

**Key talking points:**
- Transfer learning reduces need for labeled training data
- ImageNet pre-training gives strong visual feature representations
- Two models × different biases = more balanced final prediction

---

### Phase 3 — Backend Development (Week 5–6)
**PPT Slides:**
- FastAPI architecture diagram
- `pipeline.py` class diagram (DivyaChakshuEngine, FaceResult, PredictionResult)
- Full inference pipeline flowchart (from input image to JSON response)
- API endpoints table with request/response examples
- SQLite schema diagram
- Challenge: facenet-pytorch Python 3.14 compatibility fix

**Demo for PPT:**
- Show Swagger UI at `localhost:8000/docs`
- Live `POST /api/predict` call via Swagger with a test image

---

### Phase 4 — Frontend Development (Week 7–8)
**PPT Slides:**
- Component hierarchy diagram
- Screenshot: Dashboard page (upload zone + stat cards + charts)
- Screenshot: History page (thumbnail grid + detail panel)
- Screenshot: Model Status page (model cards + pipeline diagram)
- Canvas-based face box overlay explanation
- Light/Dark theme system (CSS variables diagram)
- Vite proxy setup (why no CORS issues)

**Demo for PPT:**
- Upload image with multiple faces — show real-time boxes
- Switch theme (dark ↔ light)
- Navigate to History — show persisted results with thumbnails

---

### Phase 5 — Integration & Testing (Week 9–10)
**PPT Slides:**
- End-to-end architecture diagram (browser → Vite → FastAPI → models → SQLite → response)
- Test cases table: person images, child images, animal images, unknown objects, edge cases
- Accuracy results on your test set
- Processing time comparison: CPU vs GPU (if tested)
- Known limitations and failure cases (e.g., heavy sunglasses, cartoons)

**Metrics to show:**
- Average inference time (CPU): ~800–1200 ms for person images
- MTCNN face precision: ~94%
- ViT gender accuracy: ~91%
- SigLIP2 gender accuracy: ~93%
- Ensemble improvement on child images (show concrete examples)

---

### Phase 6 — Results, Conclusions & Future Work (Week 11–12)
**PPT Slides:**
- Final demo video / live demo
- Summary of what was achieved vs. what was proposed
- Key learnings (ensemble strategy, body context crop impact, FastAPI async advantages)
- Limitations: no GPU in demo, no age detection, binary gender classification only
- Future improvements:
  - Age estimation (add a third model)
  - Emotion detection
  - Multi-language UI
  - Docker containerization for one-click deployment
  - Replace SQLite with PostgreSQL for multi-user support
  - Mobile app (React Native)
  - Fine-tune models on custom dataset for higher accuracy

**Final slide — Thank you / Q&A**

---

### PPT Design Tips

- Use dark theme screenshots (matches the app's default dark mode — looks professional)
- Include the Divya Chakshu logo/icon on every slide footer
- For the pipeline diagram, use colored boxes (purple for transformers, green for outputs) matching the app's color scheme
- Demo slides: use actual screenshots from your running app, not stock photos
- Keep bullet points short — explain verbally, slides are visual support not a script
- Add slide numbers and a consistent header with the project name

---

*Document version: 2.0 | Last updated: September 2026*
