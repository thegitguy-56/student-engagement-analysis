// frontend/src/services/classroomSocket.js

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Derive WS base from API base — swap http(s) for ws(s), stripping /api if present
// because the socket endpoint URLs manually append /api/classroom/ws/...
let WS_BASE = import.meta.env.VITE_WS_URL;
if (!WS_BASE) {
  let base = API_BASE.replace("https://", "wss://").replace("http://", "ws://");
  if (base.endsWith("/api")) {
    base = base.slice(0, -4);
  } else if (base.endsWith("/api/")) {
    base = base.slice(0, -5);
  }
  WS_BASE = base;
} else {
  // Strip any accidental path suffix from VITE_WS_URL (e.g. /api/ws)
  // and ensure the correct ws:// ↔ wss:// protocol is used.
  try {
    const u = new URL(WS_BASE);
    const proto = u.protocol === "wss:" || u.protocol === "https:" ? "wss://" : "ws://";
    WS_BASE = proto + u.host;           // host includes port if present
  } catch {
    // Malformed URL — leave as-is and let the browser surface the error
  }
}

export class StudentClassroomSocket {
  constructor(roomCode, userId, onScore) {
    this.roomCode = roomCode;
    this.userId = userId;
    this.onScore = onScore;
    this.ws = null;
    this._reconnectTimer = null;
    this._destroyed = false;   // set true on intentional disconnect — prevents reconnect loop
  }

  connect() {
    if (this._destroyed) return;
    const url = `${WS_BASE}/api/classroom/ws/${this.roomCode}/student/${this.userId}`;
    this.ws = new WebSocket(url);

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "score_update") this.onScore(msg);
      } catch { }
    };

    this.ws.onclose = () => {
      if (this._destroyed) return;           // don't reconnect after intentional close
      this._reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = (err) => console.error("Student WS error:", err);
  }

  sendFrame(base64frame) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "frame", frame: base64frame }));
    }
  }

  disconnect() {
    this._destroyed = true;                  // must be set BEFORE ws.close() fires onclose
    clearTimeout(this._reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}

export class TeacherClassroomSocket {
  constructor(roomCode, userId, onUpdate) {
    this.roomCode = roomCode;
    this.userId = userId;
    this.onUpdate = onUpdate;
    this.ws = null;
    this._pingInterval = null;
    this._reconnectTimer = null;
    this._destroyed = false;   // set true on intentional disconnect — prevents reconnect loop
  }

  connect() {
    if (this._destroyed) return;
    const url = `${WS_BASE}/api/classroom/ws/${this.roomCode}/teacher/${this.userId}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this._pingInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 20000);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "classroom_update") this.onUpdate(msg);
      } catch { }
    };

    this.ws.onclose = () => {
      clearInterval(this._pingInterval);
      if (this._destroyed) return;           // don't reconnect after intentional close
      this._reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = (err) => console.error("Teacher WS error:", err);
  }

  disconnect() {
    this._destroyed = true;                  // must be set BEFORE ws.close() fires onclose
    clearTimeout(this._reconnectTimer);
    clearInterval(this._pingInterval);
    this.ws?.close();
    this.ws = null;
  }
}