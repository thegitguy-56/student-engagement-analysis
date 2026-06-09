# Student Engagement Analysis

A vision-based system for real-time student engagement monitoring in virtual classrooms. It combines computer vision, WebSocket streaming, and a collaborative classroom platform to give educators live, per-student engagement metrics during online sessions.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Environment Variables](#environment-variables)
- [CV Pipeline](#cv-pipeline)
- [Engagement Scoring](#engagement-scoring)
- [Classroom Mode](#classroom-mode)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## Overview

The system operates in two modes:

**Solo Monitor** — A student opens their webcam on the Monitor page. Frames are streamed over WebSocket to the backend every 500 ms. The computer vision pipeline analyzes each frame and returns an engagement score in real time. The student sees a live score ring, detection signals, and a trend chart.

**Classroom Mode** — A teacher creates a virtual room. Students join using a room code and participate in an embedded Jitsi video meeting. Each student's browser captures their own webcam frames and streams them to the backend over an individual WebSocket. The teacher sees a live dashboard with per-student scores, class average, and low-engagement alerts.

---

## Features

- Real-time engagement scoring from webcam frames (no cloud CV dependency)
- Six behavioral signals: face presence, gaze direction, head pose, emotion, yawn detection, hand raise
- Weighted composite engagement score (0-100) with three classification levels
- Virtual classroom with embedded video meeting (Jitsi)
- Teacher dashboard with live per-student cards, class average, and alerts
- Session history, analytics, and PDF/CSV report generation
- JWT authentication with role-based access (student / teacher)
- SQLite for local development, Supabase PostgreSQL for production

---

## Architecture

```
Browser (Student)
  |
  |-- Webcam frames (JPEG, base64, 500 ms interval)
  |
  v
WebSocket  (/api/sessions/ws/{id}     -- solo monitor)
           (/api/classroom/ws/{code}/student/{uid}  -- classroom)
  |
FastAPI Backend (Render)
  |
  |-- CV Pipeline (thread pool executor)
  |     |-- MediaPipe FaceMesh  -> face detection, gaze, head pose, emotion, yawn
  |     |-- MediaPipe Hands     -> hand raise detection
  |     |-- Engagement Scorer   -> weighted score + classification
  |
  |-- Score broadcast
  |     |-- Solo: JSON response over same WebSocket
  |     |-- Classroom: update ClassroomManager -> push to student + all teacher sockets
  |
  v
Browser (Student / Teacher Dashboard)
  |-- Score ring, detection pills, trend chart (Monitor)
  |-- Per-student cards, class average, alert banner (Teacher Dashboard)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 18 + Vite |
| Styling | Tailwind CSS |
| Charts | Chart.js + react-chartjs-2 |
| Video meeting | Jitsi Meet External API (meet.jit.si) |
| HTTP client | Axios |
| Backend framework | FastAPI |
| Runtime | Python 3.11 |
| WebSocket | FastAPI native WebSocket (uvicorn) |
| Computer vision | MediaPipe 0.10 |
| Image processing | OpenCV (headless) + NumPy |
| ORM | SQLAlchemy 2 (async) |
| Local database | SQLite + aiosqlite |
| Production database | Supabase PostgreSQL + asyncpg |
| Authentication | JWT (python-jose) + bcrypt (passlib) |
| Frontend hosting | Vercel |
| Backend hosting | Render |

---

## Project Structure

```
student-engagement-analysis/
|
|-- backend/
|   |-- app/
|   |   |-- main.py               FastAPI app, CORS, router registration
|   |   |-- config.py             Settings via pydantic-settings
|   |   |-- database/
|   |   |   |-- connection.py     Async engine, session factory, create_tables
|   |   |-- models/
|   |   |   |-- user.py           User ORM model
|   |   |   |-- session.py        Solo session ORM model
|   |   |   |-- engagement.py     Engagement record ORM model
|   |   |   |-- classroom.py      Classroom, RoomParticipant, ClassroomEngagement models
|   |   |-- schemas/
|   |   |   |-- auth.py           Register / login / token schemas
|   |   |   |-- session.py        Session create / response schemas
|   |   |   |-- classroom.py      Classroom schemas
|   |   |-- routes/
|   |   |   |-- auth.py           /api/auth  (register, login, me)
|   |   |   |-- session.py        /api/sessions  (CRUD + WebSocket)
|   |   |   |-- classroom.py      /api/classroom (CRUD + student/teacher WebSocket)
|   |   |   |-- analytics.py      /api/analytics
|   |   |   |-- reports.py        /api/reports
|   |   |-- services/
|   |   |   |-- auth_service.py   JWT creation, token decode, password hashing
|   |   |   |-- auth_dependency.py  FastAPI dependency for current user
|   |   |   |-- report_service.py   PDF/CSV generation
|   |   |-- cv_engine/
|   |   |   |-- pipeline.py        Orchestrates all CV modules, returns result dict
|   |   |   |-- face_detection.py  MediaPipe FaceMesh wrapper
|   |   |   |-- gaze_tracking.py   Iris landmark ratio -> gaze direction + score
|   |   |   |-- head_pose.py       solvePnP Euler angles -> pose classification
|   |   |   |-- emotion_detection.py  Landmark geometry -> emotion classification
|   |   |   |-- yawn_detection.py  Mouth Aspect Ratio -> yawn detection
|   |   |   |-- hand_raise_detection.py  MediaPipe Hands -> hand raise
|   |   |   |-- engagement_scoring.py   Weighted score (0-100) + level
|   |   |-- websocket/
|   |       |-- classroom_ws.py    ClassroomManager (in-memory state + broadcast)
|   |-- requirements.txt
|   |-- .env                      Local environment variables
|   |-- .env.example
|
|-- frontend/
|   |-- src/
|   |   |-- App.jsx               Router + Protected route wrapper
|   |   |-- main.jsx              React entry point
|   |   |-- context/
|   |   |   |-- AuthContext.jsx   Auth state, login/register/logout helpers
|   |   |-- services/
|   |   |   |-- api.js            Axios instance, interceptors, classroom helpers
|   |   |   |-- websocket.js      EngagementWebSocket class (solo monitor)
|   |   |   |-- classroomSocket.js  StudentClassroomSocket + TeacherClassroomSocket
|   |   |-- components/
|   |   |   |-- Layout.jsx        Sidebar navigation shell
|   |   |   |-- EngagementOverlay.jsx  Floating score overlay (classroom student)
|   |   |   |-- StudentCard.jsx   Per-student tile on teacher dashboard
|   |   |-- pages/
|   |       |-- Login.jsx
|   |       |-- Register.jsx
|   |       |-- Dashboard.jsx
|   |       |-- Monitor.jsx           Solo webcam engagement monitor
|   |       |-- Analytics.jsx
|   |       |-- Sessions.jsx
|   |       |-- ClassroomCreate.jsx
|   |       |-- ClassroomJoin.jsx
|   |       |-- TeacherClassroomRoom.jsx  Teacher view (Jitsi + dashboard sidebar)
|   |       |-- StudentClassroomRoom.jsx  Student view (Jitsi + engagement overlay)
|   |-- .env                      Development environment variables
|   |-- .env.production           Production environment variables (committed)
|   |-- package.json
|   |-- vite.config.js
|   |-- tailwind.config.js
|
|-- render.yaml                   Render deployment configuration
|-- vercel.json                   Vercel SPA rewrite rules
|-- README.md
```

---

## Getting Started

### Prerequisites

- Python 3.11
- Node.js 18+
- npm 9+

### Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Copy and fill environment file
copy .env.example .env

# Start the development server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The API will be available at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create local env override (do not commit this file)
# See "Environment Variables" section for values
copy .env .env.local

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLAlchemy async connection string | `sqlite+aiosqlite:///./engagement_db.db` |
| `SECRET_KEY` | JWT signing key | Required |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime in minutes | `1440` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:5173` |
| `DEBUG` | Enable SQLAlchemy echo | `False` |

For production on Render, set `DATABASE_URL` to your Supabase PostgreSQL connection string. The backend automatically rewrites `postgres://` to `postgresql+asyncpg://`.

### Frontend (`frontend/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend REST API base URL | `https://your-backend.onrender.com/api` |
| `VITE_WS_URL` | Backend WebSocket base URL (scheme + host only, no path) | `wss://your-backend.onrender.com` |
| `VITE_JITSI_DOMAIN` | Jitsi server domain | `meet.jit.si` |

> **Important**: `VITE_WS_URL` must be the bare host with the correct scheme (`wss://` for HTTPS backends, `ws://` for local). Do not append any path to this value.

For local development, create `frontend/.env.local` (this file is gitignored):

```
VITE_API_URL=http://localhost:8000/api
VITE_WS_URL=ws://localhost:8000
VITE_JITSI_DOMAIN=meet.jit.si
```

---

## CV Pipeline

Each incoming frame goes through the following stages in sequence. All stages run in a thread pool executor to avoid blocking the async event loop.

```
frame_bgr (NumPy ndarray)
    |
    v
FaceDetector.detect()
    MediaPipe FaceMesh -> face_present, landmarks, bbox
    |
    v (if face_present)
compute_gaze()
    Iris landmark ratio -> eye_contact (bool), gaze_score (0-1), direction (str)
    |
    v
estimate_head_pose()
    solvePnP + Euler angles -> pose (str), pose_score (0-1), yaw, pitch
    |
    v
detect_emotion()
    Mouth curvature + eye openness + brow raise -> emotion (str), emotion_score (0-1)
    |
    v
detect_yawn()
    Mouth Aspect Ratio -> yawning (bool), yawn_score (0-1), mar (float)
    |
    v
HandRaiseDetector.detect()
    MediaPipe Hands + wrist/tip Y position -> hand_raised (bool), hand_score (0-1)
    |
    v
compute_engagement_score()
    Weighted sum -> engagement_score (0-100), engagement_level (str)
```

The pipeline result is a single dict returned over the WebSocket connection.

---

## Engagement Scoring

The final score is a weighted sum of six component scores, each normalized to [0, 1]:

| Component | Weight | Measures |
|-----------|--------|---------|
| Face presence | 20% | Is the student in frame? |
| Gaze | 25% | Is the student looking at the screen? |
| Head pose | 20% | Is the head centered and forward? |
| Emotion | 20% | Is the detected emotion positive / engaged? |
| Alertness (yawn) | 10% | Is the student alert (not yawning)? |
| Participation (hand) | 5% | Is the student raising their hand? |

The raw weighted sum is multiplied by 100 to produce a score in [0, 100].

**Classification thresholds:**

| Score range | Level |
|-------------|-------|
| >= 70 | Highly Engaged |
| 40 - 69 | Moderately Engaged |
| < 40 | Distracted |

If no face is detected, the score is immediately 0 (Distracted).

---

## Classroom Mode

### Teacher Flow

1. Register / login with role **teacher**.
2. Navigate to Classroom -> Create. A unique room code (`ENG-XXXX`) is generated.
3. Share the room code with students.
4. Click **Start Session** to mark the room as active.
5. The teacher dashboard sidebar shows live student cards, class average score, and an alert banner for students whose score has been below 40 for 30+ consecutive seconds.

### Student Flow

1. Register / login with role **student**.
2. Navigate to Classroom -> Join and enter the room code.
3. The student room page opens. The browser acquires the camera once (shared between Jitsi and the engagement overlay).
4. A floating overlay in the bottom-right corner shows the student's own engagement score, classification, and emotion in real time.

### In-Memory State

Engagement state for active classrooms is held in `ClassroomManager` (a module-level singleton). This means classroom state resets on backend restart. Engagement records are persisted to the database at approximately 10% of processed frames to reduce write load.

---

## API Reference

Full interactive documentation is available at `/docs` when the backend is running.

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Obtain JWT |
| GET | `/api/auth/me` | Get current user |

### Sessions (Solo Monitor)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sessions/` | Create session |
| GET | `/api/sessions/` | List sessions |
| GET | `/api/sessions/{id}` | Get session |
| PATCH | `/api/sessions/{id}/end` | End session |
| WS | `/api/sessions/ws/{id}` | Engagement WebSocket |

### Classroom

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/classroom/create` | Create room |
| POST | `/api/classroom/join` | Join room |
| GET | `/api/classroom/{code}` | Get room details |
| POST | `/api/classroom/{code}/start` | Mark room active |
| POST | `/api/classroom/{code}/end` | End room |
| GET | `/api/classroom/{code}/report` | Get engagement records |
| WS | `/api/classroom/ws/{code}/student/{uid}` | Student engagement stream |
| WS | `/api/classroom/ws/{code}/teacher/{uid}` | Teacher dashboard stream |

### WebSocket Frame Format

Frames are sent as JSON text messages:

**Solo monitor:**
```json
{ "frame": "<base64-encoded JPEG>" }
```

**Classroom student:**
```json
{ "type": "frame", "frame": "<base64-encoded JPEG>" }
```

The backend responds with a JSON object containing all engagement metrics.

---

## Deployment

### Backend (Render)

The `render.yaml` at the project root defines the service configuration. The backend is deployed as a Python web service.

Required environment variables to set in the Render dashboard:

```
FRONTEND_URL=https://your-app.vercel.app
SECRET_KEY=<generate a strong random key>
DATABASE_URL=<Supabase PostgreSQL connection string>
DEBUG=false
```

### Frontend (Vercel)

The `vercel.json` at the project root defines SPA rewrite rules (all paths to `index.html`).

The `frontend/.env.production` file is committed to the repository and contains the production API and WebSocket URLs. Vercel reads this file during the build step. If you have previously set `VITE_*` overrides in the Vercel dashboard, those take precedence and must be updated to match.

```
VITE_API_URL=https://your-backend.onrender.com/api
VITE_WS_URL=wss://your-backend.onrender.com
VITE_JITSI_DOMAIN=meet.jit.si
```

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature`.
3. Make changes and ensure the backend starts without errors: `uvicorn app.main:app --reload`.
4. Ensure the frontend builds without errors: `npm run build`.
5. Open a pull request against `main`.

Local `.env.local` files are gitignored and should never be committed.
