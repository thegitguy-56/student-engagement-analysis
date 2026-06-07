// frontend/src/services/classroomSocket.js

const WS_BASE = import.meta.env.VITE_WS_URL
  ? import.meta.env.VITE_WS_URL
  : (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host
/**
 * Student WebSocket — sends frames, receives own score.
 *
 * Usage:
 *   const socket = new StudentClassroomSocket("ENG-4X9K", 7, (score) => ...);
 *   socket.connect();
 *   socket.sendFrame(base64string);
 *   socket.disconnect();
 */
export class StudentClassroomSocket {
  constructor(roomCode, userId, onScore) {
    this.roomCode = roomCode;
    this.userId = userId;
    this.onScore = onScore;       // callback(scoreObj)
    this.ws = null;
    this._reconnectTimer = null;
  }

  connect() {
    const url = `${WS_BASE}/api/classroom/ws/${this.roomCode}/student/${this.userId}`;
    this.ws = new WebSocket(url);

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "score_update") {
          this.onScore(msg);
        }
      } catch {}
    };

    this.ws.onclose = () => {
      // Auto-reconnect after 3s
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
    clearTimeout(this._reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}

/**
 * Teacher WebSocket — receives live classroom snapshot.
 *
 * Usage:
 *   const socket = new TeacherClassroomSocket("ENG-4X9K", 2, (snapshot) => ...);
 *   socket.connect();
 *   socket.disconnect();
 */
export class TeacherClassroomSocket {
  constructor(roomCode, userId, onUpdate) {
    this.roomCode = roomCode;
    this.userId = userId;
    this.onUpdate = onUpdate;     // callback(snapshotObj)
    this.ws = null;
    this._pingInterval = null;
    this._reconnectTimer = null;
  }

  connect() {
    const url = `${WS_BASE}/api/classroom/ws/${this.roomCode}/teacher/${this.userId}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      // Send heartbeat every 20s to keep connection alive
      this._pingInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 20000);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "classroom_update") {
          this.onUpdate(msg);
        }
      } catch {}
    };

    this.ws.onclose = () => {
      clearInterval(this._pingInterval);
      this._reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = (err) => console.error("Teacher WS error:", err);
  }

  disconnect() {
    clearTimeout(this._reconnectTimer);
    clearInterval(this._pingInterval);
    this.ws?.close();
    this.ws = null;
  }
}