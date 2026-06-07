# Vision-Based Student Engagement Analysis
## Complete Setup & Run Guide

---

## FOLDER STRUCTURE — WHERE EVERYTHING GOES

```
student-engagement-analysis/          ← root folder
│
├── backend/
│   ├── venv/                         ← Python virtual env (auto-created)
│   ├── .env                          ← your secrets (never commit to GitHub)
│   ├── requirements.txt              ← Python packages
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── database/
│       │   ├── __init__.py
│       │   └── connection.py
│       ├── models/
│       │   ├── __init__.py
│       │   ├── user.py
│       │   ├── session.py
│       │   └── engagement.py
│       ├── schemas/
│       │   ├── __init__.py
│       │   ├── auth.py
│       │   └── session.py
│       ├── services/
│       │   ├── __init__.py
│       │   ├── auth_service.py
│       │   ├── auth_dependency.py
│       │   └── report_service.py
│       ├── routes/
│       │   ├── __init__.py
│       │   ├── auth.py
│       │   ├── sessions.py
│       │   ├── analytics.py
│       │   └── reports.py
│       └── cv_engine/
│           ├── __init__.py
│           ├── face_detection.py
│           ├── gaze_tracking.py
│           ├── head_pose.py
│           ├── emotion_detection.py
│           ├── yawn_detection.py
│           ├── hand_raise_detection.py
│           ├── engagement_scoring.py
│           └── pipeline.py
│
└── frontend/
    ├── .env
    ├── .env.production
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── context/
        │   └── AuthContext.jsx
        ├── services/
        │   ├── api.js
        │   └── websocket.js
        ├── components/
        │   └── Layout.jsx
        └── pages/
            ├── Login.jsx
            ├── Register.jsx
            ├── Dashboard.jsx
            ├── Monitor.jsx
            ├── Sessions.jsx
            └── Analytics.jsx
```

---

## STEP 1 — SUPABASE DATABASE SETUP (FREE)

1. Go to https://supabase.com → click "Start your project" → sign up free
2. Click "New project" → name it "engagement-db" → set a strong password → choose region closest to you
3. Wait ~2 minutes for it to set up
4. Go to Settings → Database → copy the "Connection string (URI)"
   - It looks like: postgresql://postgres:[YOUR-PASSWORD]@db.xxxx.supabase.co:5432/postgres
5. Change "postgresql://" to "postgresql+asyncpg://" (needed for async Python)
6. Paste this into your backend/.env as DATABASE_URL

---

## STEP 2 — BACKEND SETUP

Open terminal in the project root:

```bash
cd student-engagement-analysis/backend

# Create Python virtual environment
python -m venv venv

# Activate (Windows):
venv\Scripts\activate
# Activate (Mac/Linux):
source venv/bin/activate

# You should see (venv) at the start of the line

# Install all packages
pip install fastapi==0.111.0 uvicorn[standard]==0.30.1 python-multipart==0.0.9
pip install python-jose[cryptography]==3.3.0 passlib[bcrypt]==1.7.4
pip install sqlalchemy==2.0.30 asyncpg==0.29.0 alembic==1.13.1
pip install pydantic==2.7.1 pydantic-settings==2.3.1 python-dotenv==1.0.1
pip install websockets==12.0 opencv-python==4.10.0.84 mediapipe==0.10.14
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install ultralytics==8.2.18 deepface==0.0.93 Pillow==10.3.0
pip install numpy==1.26.4 scipy==1.13.1 cloudinary==1.40.0
pip install httpx==0.27.0 psycopg2-binary==2.9.9 reportlab==4.2.2 aiofiles==23.2.1
pip install tf-keras

# Save requirements
pip freeze > requirements.txt
```

Fill in your .env file:
```
SECRET_KEY=make-this-a-long-random-string-like-abc123xyz789
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_SUPABASE_PASSWORD@db.XXXX.supabase.co:5432/postgres
FRONTEND_URL=http://localhost:5173
```

Start the backend:
```bash
uvicorn app.main:app --reload --port 8000
```

✅ Open http://localhost:8000 — should show:
   {"message": "Student Engagement Analysis API", "version": "1.0.0", "status": "running"}

✅ Open http://localhost:8000/docs — interactive API docs

---

## STEP 3 — FRONTEND SETUP

Open a NEW terminal window (keep backend running):

```bash
cd student-engagement-analysis/frontend
npm install
npm run dev
```

✅ Open http://localhost:5173 — should show the login page!

---

## STEP 4 — TEST THE FULL FLOW

1. Go to http://localhost:5173/register
2. Create an account (any name/email/password)
3. You're automatically logged in to the Dashboard
4. Click "Live Monitor" in the sidebar
5. Type a session title, click "Start"
6. Allow webcam access when the browser asks
7. Watch the real-time scores update every 500ms!
8. Click "End session" → go to Sessions → download PDF report

---

## STEP 5 — DEPLOY (make it live on the internet)

### Deploy backend to Render (FREE):

1. Go to https://github.com → create a new repository called "student-engagement-analysis"
2. Push your code:
   ```bash
   cd student-engagement-analysis
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/student-engagement-analysis.git
   git push -u origin main
   ```
3. Go to https://render.com → sign up → New → Web Service
4. Connect your GitHub repo
5. Settings:
   - Root directory: backend
   - Runtime: Python 3
   - Build command: pip install -r requirements.txt
   - Start command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
6. Add environment variables (same as your .env file)
7. Click Deploy → wait 3-5 minutes
8. Copy your Render URL (like https://student-engagement-backend.onrender.com)

### Deploy frontend to Vercel (FREE):

1. Go to https://vercel.com → sign up with GitHub
2. Click "New Project" → import your GitHub repo
3. Framework: Vite, Root directory: frontend
4. Add environment variable:
   - VITE_API_URL = https://your-backend.onrender.com
   - VITE_WS_URL  = wss://your-backend.onrender.com
5. Click Deploy → done in ~2 minutes!
6. Your site is now live at https://your-project.vercel.app

Also update your Render backend env:
- FRONTEND_URL = https://your-project.vercel.app

---

## TROUBLESHOOTING

### "ModuleNotFoundError: No module named 'mediapipe'"
→ Make sure your venv is activated: venv\Scripts\activate (Windows)

### "Connection refused" on port 8000
→ Make sure backend is running: uvicorn app.main:app --reload --port 8000

### WebSocket not connecting
→ Check that both backend (port 8000) and frontend (port 5173) are running

### "Cannot connect to database"
→ Double-check your DATABASE_URL in .env
→ Make sure you changed "postgresql://" to "postgresql+asyncpg://"

### Webcam not working
→ Make sure you clicked "Allow" when browser asked for camera permission
→ Use Chrome or Firefox (Safari has limited WebRTC support)

### DeepFace first-run slow
→ First time DeepFace runs it downloads a ~100MB model, normal to wait 1-2 mins

---

## WHAT EACH FILE DOES

| File | Purpose |
|------|---------|
| backend/app/main.py | FastAPI app entry point, registers all routes |
| backend/app/config.py | Reads .env settings |
| backend/app/database/connection.py | PostgreSQL connection pool |
| backend/app/models/*.py | Database table definitions |
| backend/app/schemas/*.py | Request/response data shapes |
| backend/app/services/auth_service.py | JWT tokens, password hashing |
| backend/app/routes/auth.py | /api/auth/register, /api/auth/login |
| backend/app/routes/sessions.py | Session CRUD + WebSocket |
| backend/app/routes/analytics.py | Stats/charts API |
| backend/app/routes/reports.py | PDF download |
| backend/app/cv_engine/pipeline.py | Master function: frame → engagement score |
| frontend/src/App.jsx | React router + page layout |
| frontend/src/context/AuthContext.jsx | Global login state |
| frontend/src/services/api.js | Axios HTTP client |
| frontend/src/services/websocket.js | WebSocket frame sender |
| frontend/src/pages/Monitor.jsx | Webcam + live analysis page |
| frontend/src/pages/Dashboard.jsx | Stats overview |
| frontend/src/pages/Analytics.jsx | Charts and session comparison |
| frontend/src/pages/Sessions.jsx | Session history + PDF download |
