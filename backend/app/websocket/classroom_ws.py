# backend/app/websocket/classroom_ws.py
import asyncio
import json
import logging
import time
from collections import defaultdict
from datetime import datetime
from typing import Dict, Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class StudentState:
    def __init__(self, user_id: str, display_name: str):   # ← str, was int
        self.user_id = user_id
        self.display_name = display_name
        self.websocket: Optional[WebSocket] = None
        self.engagement_score: float = 0.0
        self.classification: str = "Unknown"
        self.emotion: str = "neutral"
        self.signals: dict = {}
        self.last_update: float = time.time()
        self.low_engagement_since: Optional[float] = None
        self.alert_active: bool = False

    def to_dict(self) -> dict:
        return {
            "user_id":          self.user_id,
            "display_name":     self.display_name,
            "engagement_score": round(self.engagement_score, 1),
            "classification":   self.classification,
            "emotion":          self.emotion,
            "signals":          self.signals,
            "alert":            self.alert_active,
            "last_update":      self.last_update,
        }


class ClassroomManager:
    def __init__(self):
        # room_students[room_code][user_id] = StudentState
        self.room_students: Dict[str, Dict[str, StudentState]] = defaultdict(dict)   # ← Dict key str
        self.teacher_sockets: Dict[str, Dict[str, WebSocket]] = defaultdict(dict)    # ← Dict key str

    # ── Student connections ────────────────────────────────────────────────────

    async def connect_student(
        self, room_code: str, user_id: str, display_name: str, ws: WebSocket  # ← str
    ):
        await ws.accept()
        state = self.room_students[room_code].get(user_id)
        if state is None:
            state = StudentState(user_id, display_name)
            self.room_students[room_code][user_id] = state
        state.websocket = ws
        state.display_name = display_name
        logger.info(f"Student {user_id} ({display_name}) connected to room {room_code}")

    def disconnect_student(self, room_code: str, user_id: str):   # ← str
        if room_code in self.room_students:
            state = self.room_students[room_code].get(user_id)
            if state:
                state.websocket = None
        logger.info(f"Student {user_id} disconnected from room {room_code}")

    # ── Teacher connections ────────────────────────────────────────────────────

    async def connect_teacher(self, room_code: str, user_id: str, ws: WebSocket):  # ← str
        await ws.accept()
        self.teacher_sockets[room_code][user_id] = ws
        logger.info(f"Teacher {user_id} connected to room {room_code}")
        await self._send_snapshot_to_teacher(room_code, ws)

    def disconnect_teacher(self, room_code: str, user_id: str):   # ← str
        self.teacher_sockets[room_code].pop(user_id, None)
        logger.info(f"Teacher {user_id} disconnected from room {room_code}")

    # ── Score update & broadcast ───────────────────────────────────────────────

    async def update_student_score(
        self, room_code: str, user_id: str, result: dict   # ← str
    ):
        state = self.room_students[room_code].get(user_id)
        if not state:
            return

        state.engagement_score = result.get("engagement_score", 0.0)
        # pipeline returns "engagement_level", map it to classification
        state.classification   = result.get("engagement_level", "Unknown")
        state.emotion          = result.get("emotion", "neutral")
        state.signals          = {
            "face_score":    result.get("face_score", 0.0),
            "gaze_score":    result.get("gaze_score", 0.0),
            "pose_score":    result.get("pose_score", 0.0),
            "emotion_score": result.get("emotion_score", 0.0),
            "yawn_score":    result.get("yawn_score", 0.0),
            "hand_score":    result.get("hand_score", 0.0),
        }
        state.last_update = time.time()

        # Alert: score < 40 for 30+ consecutive seconds
        if state.engagement_score < 40:
            if state.low_engagement_since is None:
                state.low_engagement_since = time.time()
            elif time.time() - state.low_engagement_since >= 30:
                state.alert_active = True
        else:
            state.low_engagement_since = None
            state.alert_active = False

        # Push score back to student
        if state.websocket:
            try:
                await state.websocket.send_json({
                    "type":             "score_update",
                    "engagement_score": round(state.engagement_score, 1),
                    "classification":   state.classification,
                    "emotion":          state.emotion,
                    "signals":          state.signals,
                })
            except Exception:
                pass

        await self._broadcast_to_teachers(room_code)

    async def _broadcast_to_teachers(self, room_code: str):
        payload = self._build_classroom_snapshot(room_code)
        dead = []
        for tid, ws in self.teacher_sockets.get(room_code, {}).items():
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(tid)
        for tid in dead:
            self.teacher_sockets[room_code].pop(tid, None)

    async def _send_snapshot_to_teacher(self, room_code: str, ws: WebSocket):
        payload = self._build_classroom_snapshot(room_code)
        try:
            await ws.send_json(payload)
        except Exception:
            pass

    def _build_classroom_snapshot(self, room_code: str) -> dict:
        students = self.room_students.get(room_code, {})
        student_list = [s.to_dict() for s in students.values()]
        scores = [s.engagement_score for s in students.values() if s.websocket]
        avg    = round(sum(scores) / len(scores), 1) if scores else 0.0
        alerts = [s.user_id for s in students.values() if s.alert_active]
        return {
            "type":          "classroom_update",
            "room_code":     room_code,
            "student_count": len([s for s in students.values() if s.websocket]),
            "class_average": avg,
            "students":      student_list,
            "alerts":        alerts,
            "timestamp":     datetime.utcnow().isoformat(),
        }

    def get_room_students(self, room_code: str) -> list:
        return list(self.room_students.get(room_code, {}).values())

    def cleanup_room(self, room_code: str):
        self.room_students.pop(room_code, None)
        self.teacher_sockets.pop(room_code, None)


manager = ClassroomManager()