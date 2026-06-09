# 🔍 Student Engagement Analysis — Full Architecture & Debugging Report

---

## Section 1 — Current Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Vercel)                           │
│                                                                     │
│  App.jsx (Router)                                                   │
│  ├── /monitor  →  Monitor.jsx                                       │
│  │     ├── react-webcam  → captures JPEG frames                    │
│  │     ├── EngagementWebSocket  (websocket.js)                      │
│  │     │     └── WS → /api/sessions/ws/{session_id}?token=...      │
│  │     └── renders: ScoreRing, MetricPill, Line chart               │
│  │                                                                  │
│  ├── /classroom/:code/student  →  StudentClassroomRoom.jsx          │
│  │     ├── getUserMedia() → cameraStream                            │
│  │     ├── JitsiMeetExternalAPI (meet.ffmuc.net)                    │
│  │     └── EngagementOverlay.jsx                                    │
│  │           ├── hidden <video> + <canvas>                          │
│  │           ├── StudentClassroomSocket (classroomSocket.js)        │
│  │           │     └── WS → /api/classroom/ws/{code}/student/{uid}  │
│  │           └── renders score/classification/emotion pill          │
│  │                                                                  │
│  └── /classroom/:code/teacher  →  TeacherClassroomRoom.jsx         │
│        ├── JitsiMeetExternalAPI (meet.ffmuc.net)                    │
│        ├── TeacherClassroomSocket (classroomSocket.js)              │
│        │     └── WS → /api/classroom/ws/{code}/teacher/{uid}       │
│        └── renders: StudentCard grid, snapshot stats                │
└─────────────────────────────────────────────────────────────────────┘
                            │  HTTPS / WSS
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Render)                            │
│                                                                     │
│  main.py  (FastAPI + CORSMiddleware)                                │
│  ├── /api/auth/*       auth.py                                      │
│  ├── /api/sessions/*   session.py                                   │
│  │     └── WS /ws/{session_id}  ← solo-monitor WebSocket            │
│  ├── /api/analytics/*  analytics.py                                 │
│  ├── /api/reports/*    reports.py                                   │
│  └── /api/classroom/*  classroom.py                                 │
│        ├── REST  (create / join / start / end / report)             │
│        └── WS /ws/{code}/student/{uid}  ← classroom student WS     │
│             WS /ws/{code}/teacher/{uid}  ← classroom teacher WS    │
│                                                                     │
│  CV Engine                                                          │
│  └── pipeline.process_frame(frame_bgr)                             │
│        ├── FaceDetector (MediaPipe FaceMesh)                        │
│        ├── compute_gaze (MediaPipe iris landmarks)                  │
│        ├── estimate_head_pose (solvePnP)                            │
│        ├── detect_emotion (landmark geometry)                       │
│        ├── detect_yawn (MAR)                                        │
│        ├── HandRaiseDetector (MediaPipe Hands)                      │
│        └── compute_engagement_score → (score, level)               │
│                                                                     │
│  ClassroomManager (in-memory)                                       │
│  └── room_students[room_code][user_id] = StudentState               │
│        teacher_sockets[room_code][user_id] = WebSocket             │
│                                                                     │
│  Database (SQLite local / Supabase PostgreSQL prod)                 │
│  └── users / sessions / engagement_records                         │
│        classrooms / room_participants / classroom_engagements       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Section 2 — Full Request Flow Diagram

### Flow A: Solo Monitor (`/monitor` page)

```
[User clicks Start]
  │
  ▼
POST /api/sessions/          (creates Session row, returns id)
  │
  ▼
EngagementWebSocket.connect()
  WS URL: ws://render-host/api/sessions/ws/{session_id}?token={jwt}
  │
  │  ⚠ BUG #1: Token passed as query-param, BUT backend session.py WS
  │             handler NEVER reads the token — no auth on this endpoint!
  │             (It silently proceeds without verifying the user)
  │
  ▼
setInterval (500ms) → webcamRef.getScreenshot() → base64 JPEG
  │
  ▼
ws.send(JSON.stringify({ frame: base64 }))
  │
  ▼
Backend: session.py WS handler receives text
  │
  ▼
json.loads() → frame_b64 = payload["frame"]
  │
  ▼
base64.b64decode → np.frombuffer → cv2.imdecode → frame (BGR ndarray)
  │
  ▼
asyncio.get_event_loop().run_in_executor(None, process_frame, frame)
  │
  ▼
pipeline.process_frame(frame_bgr) → result dict
  │
  ▼
ws.send_text(json.dumps(result))
  │
  ▼
Frontend: handleWsMessage(data) → setMetrics / setScores
  │
  ▼
UI re-renders ScoreRing, MetricPill, Line chart  ✅
```

### Flow B: Classroom Student (`/classroom/:code/student`)

```
[Student page mounts]
  │
  ▼
getUserMedia() → cameraStream  (Step 1)
  │
  ▼
JitsiMeetExternalAPI loads  (Step 2, after cameraReady)
  │
  ▼
EngagementOverlay mounts with {roomCode, userId, stream}
  │
  ▼
  videoRef.current.srcObject = stream
  StudentClassroomSocket.connect()
  │
  │ WS URL: {WS_BASE}/api/classroom/ws/{roomCode}/student/{userId}
  │
  │  ⚠ BUG #2: WS_BASE construction — classroomSocket.js derives
  │             WS_BASE by stripping /api from VITE_API_URL.
  │             But VITE_WS_URL = "ws://render-host/api/ws"  ← WRONG PATH
  │             This env var contains /api/ws suffix which is NEVER stripped.
  │             Final URL becomes: ws://render-host/api/ws/api/classroom/ws/...
  │             (double /api/ segment) — connection FAILS immediately.
  │
  ▼
setInterval (500ms):
  canvas.drawImage(video, 0, 0, 320, 240)
  base64 = canvas.toDataURL("image/jpeg", 0.6).split(",")[1]
  socket.sendFrame(base64)
  │
  │  ⚠ BUG #3: video.readyState < 2 guard — video element is hidden,
  │             autoPlay is set, but there's NO explicit video.play() call.
  │             On some browsers, muted+hidden video may not auto-play
  │             until .play() is explicitly called, meaning readyState
  │             stays at 1 (HAVE_METADATA) forever → frames are never captured.
  │
  ▼
Backend classroom.py WS: student_ws()
  receives: { type: "frame", frame: base64 }
  │
  ▼
  checks msg.get("type") != "frame" → continues ✅
  base64.b64decode → cv2.imdecode → frame
  │
  ▼
  process_frame(frame)  [synchronous call on async event loop!]
  │
  │  ⚠ BUG #4 (CRITICAL): classroom.py calls process_frame(frame) DIRECTLY
  │             (synchronous blocking call) on the async FastAPI event loop.
  │             session.py correctly wraps it in run_in_executor().
  │             classroom.py does NOT. This blocks the entire event loop
  │             during CV processing (~100–300ms per frame), causing:
  │             - Other WS connections to stall/timeout
  │             - Potential WebSocket disconnects
  │             - No engine blocking protection
  │
  ▼
  manager.update_student_score(room_code, user_id, result_data)
  │
  ▼
  score_update → ws.send_json() back to student  ✅ (if connection survived)
  classroom_update → broadcast to teacher(s)     ✅
```

### Flow C: Teacher Dashboard

```
[Teacher page mounts]
  │
  ▼
TeacherClassroomSocket.connect()
  WS URL: {WS_BASE}/api/classroom/ws/{roomCode}/teacher/{userId}
  │
  │  ⚠ BUG #2 applies here too: same WS_BASE misconstruction
  │
  ▼
onmessage → if type === "classroom_update" → setSnapshot(msg)
  │
  ▼
Renders StudentCard grid from snapshot.students[]
  │
  ▼
  activeStudents = students where last_update > Date.now()/1000 - 10
  │
  │  ⚠ BUG #5: last_update in StudentState is time.time() (Unix epoch float,
  │             seconds). Teacher compares Date.now()/1000 - 10 (also seconds).
  │             BUT: StudentState.last_update is set at server time.
  │             If server clock differs from client, or if no frames arrive,
  │             this filter silently removes all students from display.
  │             (Low severity but causes confusion)
  │
  ▼
snapshot?.class_average, student_count, alerts rendered  ✅
```

---

## Section 3 — What Is Working ✅

| Component | Status | Evidence |
|-----------|--------|----------|
| Authentication (login/register) | ✅ Working | auth.py correct, JWT issued, interceptors present |
| Session creation (POST /sessions/) | ✅ Working | session.py correct |
| Monitor page webcam capture | ✅ Working | react-webcam getScreenshot() used correctly |
| Solo WebSocket frame send format | ✅ Working | `{ frame: base64 }` sent, backend reads same key |
| Backend frame decode logic | ✅ Working | base64 → numpy → cv2.imdecode chain correct |
| CV pipeline completeness | ✅ Working | All 6 modules called, all return correct types |
| Engagement scoring formula | ✅ Working | Weights sum to 1.0, levels correctly classified |
| Pipeline response schema | ✅ Working | All keys frontend expects are returned |
| ClassroomManager in-memory state | ✅ Working | StudentState, broadcast logic correct |
| Teacher → student broadcast | ✅ Working | _broadcast_to_teachers() correct |
| DB models / migrations | ✅ Working | create_tables() imports all models |
| CORS config | ✅ Working | Allows localhost:5173 + FRONTEND_URL |
| Route registration in main.py | ✅ Working | All 5 routers registered correctly |
| ClassroomCreate / ClassroomJoin pages | ✅ Working | REST API calls correct |
| Jitsi meeting embedding | ✅ Working | Script injection + API init correct |
| Score display in EngagementOverlay | ✅ Working | UI correctly renders msg fields |

---

## Section 4 — What Is Broken ❌

| # | Bug | Severity | Location |
|---|-----|----------|----------|
| 1 | `VITE_WS_URL` in `.env` has wrong value — contains `/api/ws` path suffix | **CRITICAL** | `frontend/.env` |
| 2 | Solo-monitor WS URL hardcodes `/api/sessions/ws/` but `websocket.js` uses `WS_BASE` which, when derived from the wrong `VITE_WS_URL`, breaks the path | **CRITICAL** | `frontend/.env` + `websocket.js` |
| 3 | `classroom.py` calls `process_frame()` synchronously on the async event loop | **CRITICAL** | `backend/app/routes/classroom.py:225` |
| 4 | `video.play()` never called on hidden `<video>` in `EngagementOverlay` | **HIGH** | `frontend/src/components/EngagementOverlay.jsx:29-31` |
| 5 | `classroomSocket.js` `WS_BASE` derivation only strips `/api` suffix from `VITE_API_URL` but `VITE_WS_URL` override is taken as-is with wrong path | **CRITICAL** | `frontend/src/services/classroomSocket.js:7-16` |
| 6 | `EngagementRecord` schema in `classroom.py` response has `display_name` field but `ClassroomEngagement` DB model has no `display_name` column | **MEDIUM** | `backend/app/schemas/classroom.py:43` + `models/classroom.py` |

---

## Section 5 — Root Causes (Detailed Evidence)

---

### BUG #1 + #2 — **CRITICAL** — Wrong `VITE_WS_URL` Environment Variable

**Problem:** The solo-monitor WebSocket (`websocket.js`) constructs its URL as:
```js
const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
// URL = `${WS_BASE}/api/sessions/ws/${sessionId}?token=${token}`
```

The `.env` file currently sets:
```
VITE_WS_URL=ws://student-engagement-backend-dpqa.onrender.com/api/ws
```

This produces the URL:
```
ws://render-host/api/ws/api/sessions/ws/{id}?token=...
                 ^^^^^^^^ wrong path prefix, /api/ws is junk
```

The **correct** value should be just the base host with `wss://`:
```
VITE_WS_URL=wss://student-engagement-backend-dpqa.onrender.com
```

**Evidence:** `websocket.js` line 14 appends `/api/sessions/ws/${this.sessionId}` to `WS_BASE`. The current `VITE_WS_URL` already includes an extra path, creating a double-path URL that doesn't exist on the server.

**Also:** Render deploys over HTTPS, so WebSocket must use **`wss://`** not `ws://`. A plain `ws://` connection to an HTTPS Render service is refused by the browser (mixed content / TLS requirement).

---

### BUG #3 — **CRITICAL** — Classroom WebSocket URL Double-Path

**Problem:** `classroomSocket.js` derives `WS_BASE` from `VITE_API_URL` or uses `VITE_WS_URL` directly:
```js
let WS_BASE = import.meta.env.VITE_WS_URL;  // taken verbatim if set
```
Since `VITE_WS_URL=ws://render-host/api/ws`, `WS_BASE` = `ws://render-host/api/ws`.

Then the student socket URL is built as:
```js
const url = `${WS_BASE}/api/classroom/ws/${this.roomCode}/student/${this.userId}`;
// → ws://render-host/api/ws/api/classroom/ws/{code}/student/{uid}
//                   ^^^^^^^ wrong prefix, double /api/
```

The 404 is guaranteed. The WebSocket connection either refuses immediately or gets an HTTP 404 upgrade response.

**Also:** Again `ws://` vs `wss://` TLS problem applies.

---

### BUG #4 — **CRITICAL** — Blocking CV Pipeline on Async Event Loop (Classroom Only)

**Problem:** In `session.py` the solo-monitor correctly offloads processing:
```python
result = await asyncio.get_event_loop().run_in_executor(
    None, process_frame, frame   # ✅ runs in thread pool
)
```

But `classroom.py` calls it **directly** on the async event loop:
```python
result_data = process_frame(frame)   # ❌ BLOCKING — no executor
```

**Evidence:** `process_frame` runs MediaPipe (FaceMesh + Hands), NumPy, and OpenCV PnP solving. Each call takes ~100–300ms. Called synchronously inside an `async` coroutine, it **blocks the entire uvicorn event loop**. This means:
- No other WebSocket messages can be processed during that time
- Teacher WebSocket pings time out
- Student reconnection attempts pile up
- Under load (multiple students), cascading timeouts cause all WS connections to drop

---

### BUG #5 — **HIGH** — `video.play()` Never Called on Hidden Video Element

**Problem:** `EngagementOverlay.jsx` attaches the camera stream to a hidden `<video>`:
```jsx
<video ref={videoRef} autoPlay muted playsInline className="hidden" />
```

And in the `useEffect`:
```js
if (videoRef.current && stream) {
  videoRef.current.srcObject = stream;
  // ← No .play() call
}
```

**Evidence:** Setting `srcObject` on a video and relying on `autoPlay` is browser-dependent when the element is `display:none` (which `className="hidden"` sets via Tailwind). Chromium-based browsers often suppress auto-play for hidden `display:none` elements. The `readyState` guard in the frame capture interval:
```js
if (!video || !canvas || video.readyState < 2) return;
```
will continuously skip frames because `readyState` never reaches `HAVE_CURRENT_DATA (2)` if `.play()` was never called and the video never started. **Result: zero frames are ever sent even if the WebSocket connects.**

---

### BUG #6 — **MEDIUM** — `EngagementRecord` Schema Has `display_name` Field Missing from Model

**Problem:** The Pydantic schema `EngagementRecord` (used in `GET /{room_code}/report`) includes:
```python
class EngagementRecord(BaseModel):
    display_name: Optional[str]  # ← not in ClassroomEngagement model
```

But `ClassroomEngagement` DB model has no `display_name` column:
```python
class ClassroomEngagement(Base):
    # id, room_id, user_id, timestamp, engagement_score,
    # classification, emotion, signals
    # ← NO display_name
```

**Evidence:** The endpoint does `return result.scalars().all()` which returns `ClassroomEngagement` ORM objects. Pydantic will attempt to serialize `display_name` but the attribute doesn't exist → `None` is returned (Pydantic optional) OR a validation error occurs depending on config. The report endpoint's data will always have `display_name: null`, making teacher reports unusable for identifying which student had which score.

---

## Section 6 — Priority Order of Fixes

### 🔴 Critical (System Completely Down)

| Priority | Fix |
|----------|-----|
| C-1 | Fix `VITE_WS_URL` in `frontend/.env` — change to `wss://render-host` (no path suffix) |
| C-2 | Fix `classroomSocket.js` WS_BASE derivation — respect `VITE_WS_URL` as a pure host, not include path |
| C-3 | Add `run_in_executor` to `process_frame` call in `classroom.py` |

### 🟠 High (Engagement Scores Never Produced)

| Priority | Fix |
|----------|-----|
| H-1 | Call `videoRef.current.play()` after setting `srcObject` in `EngagementOverlay` |

### 🟡 Medium (Data Quality / Reports Broken)

| Priority | Fix |
|----------|-----|
| M-1 | Fix `EngagementRecord` schema — join `room_participants.display_name` in the report query OR remove the field from schema |

### 🟢 Low (Polish / Production Hardening)

| Priority | Fix |
|----------|-----|
| L-1 | Add authentication to solo-monitor WebSocket endpoint (currently unauthenticated) |
| L-2 | Fix `render.yaml` FRONTEND_URL — still says `your-vercel-app.vercel.app` placeholder |
| L-3 | Fix `VITE_WS_URL` also needs updating in `.env.production` (currently empty) |
| L-4 | Add `asyncio.get_event_loop().run_in_executor` defensive wrapper around any future sync CV calls |

---

## Section 7 — Minimal Changes Required

> **No full rewrites. No architectural overhaul. Surgical fixes only.**

### Change 1 — `frontend/.env` (1 line change)

```diff
- VITE_WS_URL=ws://student-engagement-backend-dpqa.onrender.com/api/ws
+ VITE_WS_URL=wss://student-engagement-backend-dpqa.onrender.com
```

### Change 2 — `frontend/src/services/websocket.js` (0 code changes needed)

The WS path `/api/sessions/ws/{id}` is already correct. Only the env var fix is needed.

### Change 3 — `frontend/src/services/classroomSocket.js` (defensive cleanup)

```diff
  let WS_BASE = import.meta.env.VITE_WS_URL;
  if (!WS_BASE) {
    let base = API_BASE.replace("https://", "wss://").replace("http://", "ws://");
    if (base.endsWith("/api")) {
      base = base.slice(0, -4);
    } else if (base.endsWith("/api/")) {
      base = base.slice(0, -5);
    }
    WS_BASE = base;
+ } else {
+   // Strip any accidental path suffix from VITE_WS_URL (e.g. /api/ws)
+   try {
+     const u = new URL(WS_BASE);
+     WS_BASE = u.origin.replace("https://", "wss://").replace("http://", "ws://");
+   } catch { /* leave as-is */ }
  }
```

### Change 4 — `backend/app/routes/classroom.py` (1 line change, ~3 lines added)

```diff
- result_data = process_frame(frame)
+ import asyncio
+ loop = asyncio.get_event_loop()
+ result_data = await loop.run_in_executor(None, process_frame, frame)
```

### Change 5 — `frontend/src/components/EngagementOverlay.jsx` (2 lines added)

```diff
  if (videoRef.current && stream) {
    videoRef.current.srcObject = stream;
+   videoRef.current.play().catch(() => {});
  }
```

### Change 6 — `frontend/.env.production` (currently empty — fill in)

```
VITE_API_URL=https://student-engagement-backend-dpqa.onrender.com/api
VITE_WS_URL=wss://student-engagement-backend-dpqa.onrender.com
```

---

## Section 8 — Exact Files Needing Modification

| File | Change Type | Reason |
|------|-------------|--------|
| [`frontend/.env`](file:///c:/Users/volap/Desktop/CV/student-engagement-analysis/frontend/.env) | Fix env var value | `VITE_WS_URL` has wrong path suffix and uses `ws://` instead of `wss://` |
| [`frontend/.env.production`](file:///c:/Users/volap/Desktop/CV/student-engagement-analysis/frontend/.env.production) | Fill in missing vars | File is empty — production Vercel build has no API/WS URLs |
| [`frontend/src/services/classroomSocket.js`](file:///c:/Users/volap/Desktop/CV/student-engagement-analysis/frontend/src/services/classroomSocket.js) | Add URL sanitization | When `VITE_WS_URL` is set, it's taken verbatim including path — must strip path and fix protocol |
| [`frontend/src/components/EngagementOverlay.jsx`](file:///c:/Users/volap/Desktop/CV/student-engagement-analysis/frontend/src/components/EngagementOverlay.jsx) | Call `.play()` | Hidden video element never starts playing without explicit `.play()` call |
| [`backend/app/routes/classroom.py`](file:///c:/Users/volap/Desktop/CV/student-engagement-analysis/backend/app/routes/classroom.py) | Add `run_in_executor` | Blocking CV pipeline call on async event loop causes all classroom WebSocket connections to stall |

---

## Section 9 — Implementation Roadmap

### Phase 1 — Fix the Connection (Engagement Analysis will start flowing)

> Estimated effort: 15 minutes. No redeploy of backend required.

1. Fix `frontend/.env` — correct `VITE_WS_URL` value
2. Fill `frontend/.env.production` with the same values
3. Fix `classroomSocket.js` — sanitize the `VITE_WS_URL` on receipt
4. Redeploy frontend to Vercel (or test locally)

**Expected result:** WebSocket connections establish successfully for both solo-monitor and classroom.

---

### Phase 2 — Fix Frame Delivery (Actual frames reach the CV pipeline)

> Estimated effort: 10 minutes. No backend redeploy required.

5. Add `videoRef.current.play()` in `EngagementOverlay.jsx` after setting `srcObject`
6. Redeploy frontend

**Expected result:** Camera frames begin flowing from the student browser to the backend. Engagement scores appear in the overlay and on the teacher dashboard.

---

### Phase 3 — Fix Backend Stability (Classroom sessions don't crash under load)

> Estimated effort: 5 minutes. Backend redeploy required.

7. Wrap `process_frame(frame)` in `run_in_executor` in `classroom.py`
8. Optionally: add auth to solo-monitor WS endpoint in `session.py`
9. Fix `EngagementRecord` schema / report query to include `display_name`
10. Update `render.yaml` `FRONTEND_URL` placeholder with the actual Vercel URL

**Expected result:** Multiple simultaneous students no longer block each other's event loop. Teacher reports show student names. Production CORS is correctly configured.

---

## Summary Table

```
Issue                              │ File                          │ Impact
───────────────────────────────────┼───────────────────────────────┼───────────────────────────
VITE_WS_URL has wrong path+scheme  │ frontend/.env                 │ ALL WebSocket connections fail
classroomSocket uses URL verbatim  │ classroomSocket.js            │ Classroom WS URL is garbled
process_frame blocks event loop    │ classroom.py                  │ Timeouts / cascade disconnects
video.play() never called          │ EngagementOverlay.jsx         │ Zero frames captured
.env.production is empty           │ frontend/.env.production      │ Production Vercel build broken
display_name missing from DB model │ schemas/classroom.py          │ Reports always null for names
```

> **The single most impactful fix is changing `VITE_WS_URL` in `.env` from**
> `ws://render-host/api/ws` **to** `wss://render-host`.
> That one change unblocks every WebSocket path in the system.
