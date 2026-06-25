# Vision-Based Student Engagement Analysis: Master Document

## 1. Introduction & Overview

**Vision-Based Student Engagement Analysis** is a comprehensive, real-time engagement monitoring system designed for virtual classrooms and individual learning sessions. It utilizes computer vision directly processed through backend pipelines (with no external cloud CV dependencies) and WebSocket streaming to provide continuous engagement metrics for students.

The system is designed to provide educators with actionable, real-time insights into student attention, helping to foster a more interactive and focused online learning environment.

### Operating Modes
The application supports two distinct workflows:
1. **Solo Monitor (Student Mode):** A student uses their webcam on the Monitor page. The browser captures frames and streams them to the backend via WebSocket every 500 ms. The computer vision pipeline analyzes these frames to return an engagement score in real-time, displaying a live score ring, detection signals, and trend charts.
2. **Classroom Mode (Teacher & Student Collaboration):** A teacher creates a virtual room. Students join via a room code and participate in an embedded Jitsi video meeting. Each student streams their webcam frames to the backend. The teacher has access to a live dashboard displaying per-student scores, class averages, and alerts for low engagement.

---

## 2. Core Features

- **Real-Time CV Processing:** In-house computer vision pipeline analyzing webcam frames on the fly.
- **Six Behavioral Signals:**
  - Face presence (MediaPipe FaceMesh)
  - Gaze direction (Iris landmark ratio)
  - Head pose (solvePnP Euler angles)
  - Emotion detection (Mouth curvature, eye openness, brow raise)
  - Yawn / Alertness detection (Mouth Aspect Ratio)
  - Hand raise participation (MediaPipe Hands)
- **Composite Engagement Scoring:** A weighted score from 0-100, segmented into three classification levels (Highly Engaged, Moderately Engaged, Distracted).
- **Embedded Virtual Classroom:** Integrated Jitsi Meet for seamless video conferencing alongside engagement tracking.
- **Teacher Dashboard:** Live per-student metric cards, overall class average, and real-time alert banners.
- **Analytics & Reporting:** Session history tracking, deep analytics, and PDF/CSV report generation.
- **Secure Authentication:** JWT-based auth with Role-Based Access Control (RBAC) for distinguishing teachers and students.

---

## 3. Architecture Design

The system follows a modern decoupled client-server architecture relying heavily on asynchronous processing and WebSockets for real-time capabilities.

### Flow Diagram

```
[ Browser Client ]
  |-- (Webcam frames: JPEG, base64, 500ms intervals)
  |
  v  WebSocket (Solo: /api/sessions/ws/{id} | Classroom: /api/classroom/ws/{code}/student/{uid})
  |
[ FastAPI Backend ]
  |
  |-- Thread Pool Executor (CV Pipeline)
  |     |-- MediaPipe FaceMesh -> Face detection, Gaze, Head pose, Emotion, Yawn
  |     |-- MediaPipe Hands    -> Hand raise detection
  |     |-- Engagement Scorer  -> Weighted score & Classification calculation
  |
  |-- Score Broadcast
  |     |-- Solo: Responds via the same WebSocket connection.
  |     |-- Classroom: ClassroomManager updates state -> Pushes to student + all connected teacher sockets.
  |
  v
[ Browser Client / Teacher Dashboard ]
  |-- Updates Score rings, trend charts, teacher dashboard cards, alert banners.
```

---

## 4. Computer Vision Pipeline & Scoring

The computer vision pipeline is the core engine of the application. It runs synchronously within a thread pool executor to prevent blocking the asynchronous event loop of FastAPI.

### Pipeline Stages
1. **FaceDetector.detect():** Evaluates face presence using MediaPipe FaceMesh.
2. **compute_gaze():** Calculates eye contact and gaze direction based on Iris landmark ratios.
3. **estimate_head_pose():** Uses solvePnP to get Euler angles, categorizing the pose (forward, left, right, etc.).
4. **detect_emotion():** Evaluates landmarks for emotional states (positive vs. neutral/negative).
5. **detect_yawn():** Computes the Mouth Aspect Ratio (MAR) to detect yawning or drowsiness.
6. **HandRaiseDetector.detect():** Uses MediaPipe Hands to track wrist/tip Y-positions to detect raised hands.
7. **compute_engagement_score():** Aggregates the results into a final score.

### Engagement Weights & Thresholds
- **Face Presence (20%)**
- **Gaze (25%)**
- **Head Pose (20%)**
- **Emotion (20%)**
- **Alertness/Yawn (10%)**
- **Participation/Hand Raise (5%)**

**Classification Thresholds:**
- `>= 70`: Highly Engaged
- `40 - 69`: Moderately Engaged
- `< 40`: Distracted
*(Note: If no face is detected, the score drops to 0 immediately).*

---

## 5. Technology Stack

### Frontend
- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS
- **Visualization:** Chart.js + react-chartjs-2
- **Video Conferencing:** Jitsi Meet External API (`meet.jit.si`)
- **HTTP Client:** Axios
- **Hosting:** Vercel

### Backend
- **Framework:** FastAPI (Python 3.11)
- **WebSocket:** FastAPI native WebSocket (Uvicorn)
- **Computer Vision:** MediaPipe 0.10, OpenCV (headless), NumPy, DeepFace, ultralytics
- **ORM & Database:** SQLAlchemy 2 (async), SQLite (local), Supabase PostgreSQL (production) + asyncpg
- **Authentication:** JWT (`python-jose`) + bcrypt (`passlib`)
- **Hosting:** Render

---

## 6. Project Structure & File Roles

### Backend Structure (`/backend`)
- `app/main.py`: Entry point for FastAPI, registers routers and CORS.
- `app/config.py`: Environment configuration via `pydantic-settings`.
- `app/database/connection.py`: Async engine and session factories.
- `app/models/*.py`: SQLAlchemy ORM models (`user`, `session`, `engagement`, `classroom`).
- `app/schemas/*.py`: Pydantic models for request/response validation.
- `app/routes/*.py`: API Endpoints (Auth, Sessions, Classroom, Analytics, Reports).
- `app/cv_engine/*.py`: Modular scripts for each stage of the CV pipeline (Face, Gaze, Pose, Emotion, etc.).
- `app/websocket/classroom_ws.py`: In-memory state manager (`ClassroomManager`) for broadcasting metrics.

### Frontend Structure (`/frontend`)
- `src/App.jsx`: Router definition and protected route wrappers.
- `src/context/AuthContext.jsx`: Global authentication state management.
- `src/services/`: API configuration (`api.js`) and WebSocket handlers (`websocket.js`, `classroomSocket.js`).
- `src/components/`: Reusable UI elements (`Layout.jsx`, `EngagementOverlay.jsx`, `StudentCard.jsx`).
- `src/pages/`: Main application views (`Monitor.jsx`, `Dashboard.jsx`, `TeacherClassroomRoom.jsx`, etc.).

---

## 7. API & WebSocket Reference

### REST API Endpoints
- **Authentication:**
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
- **Solo Sessions:**
  - `POST /api/sessions/`
  - `GET /api/sessions/{id}`
  - `PATCH /api/sessions/{id}/end`
- **Classroom:**
  - `POST /api/classroom/create`
  - `POST /api/classroom/join`
  - `POST /api/classroom/{code}/start`
  - `GET /api/classroom/{code}/report`

### WebSockets
- **Solo Monitor:** `WS /api/sessions/ws/{id}`
- **Classroom Student Frame Stream:** `WS /api/classroom/ws/{code}/student/{uid}`
- **Classroom Teacher Dashboard Stream:** `WS /api/classroom/ws/{code}/teacher/{uid}`

**WebSocket Payload Format:**
Frames are sent as base64 encoded JPEGs:
```json
// Student Stream Payload
{ "type": "frame", "frame": "<base64-encoded JPEG>" }
```
The server responds with a comprehensive JSON object detailing the engagement breakdown.

---

## 8. Deployment Strategy

- **Backend (Render):** Deployed as a Python Web Service. Uses a standard `requirements.txt` and starts via `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Requires environment variables for `SECRET_KEY`, `DATABASE_URL` (Supabase Async PG), and `FRONTEND_URL`.
- **Frontend (Vercel):** Deployed as a Vite SPA. `vercel.json` provides rewrite rules routing to `index.html`. Uses `.env.production` to store Production API (`VITE_API_URL`) and WebSocket (`VITE_WS_URL`) endpoints.
