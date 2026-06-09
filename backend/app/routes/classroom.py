# backend/app/routes/classroom.py
import asyncio
import base64
import json
import logging
import random
import string
from datetime import datetime
from typing import List

import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database.connection import get_db
from app.models.classroom import Classroom, ClassroomEngagement, RoomParticipant
from app.models.user import User
from app.schemas.classroom import (
    ClassroomCreate,
    ClassroomDetail,
    ClassroomJoin,
    ClassroomOut,
    EngagementRecord,
)
from app.services.auth_dependency import get_current_user
from app.cv_engine.pipeline import process_frame   # ← plain function import, not class
from app.websocket.classroom_ws import manager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Classroom"])   # prefix set in main.py


# ── Helpers ────────────────────────────────────────────────────────────────────

def _generate_room_code() -> str:
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"ENG-{suffix}"


async def _get_classroom_or_404(room_code: str, db: AsyncSession) -> Classroom:
    result = await db.execute(
        select(Classroom).where(Classroom.room_code == room_code)
    )
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


# ── REST endpoints ─────────────────────────────────────────────────────────────

@router.post("/create", response_model=ClassroomOut)
async def create_classroom(
    payload: ClassroomCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create classrooms")

    for _ in range(10):
        code = _generate_room_code()
        existing = await db.execute(select(Classroom).where(Classroom.room_code == code))
        if not existing.scalar_one_or_none():
            break

    room = Classroom(
        room_code=code,
        title=payload.title,
        teacher_id=current_user.id,   # UUID string
        status="waiting",
    )
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return room


@router.post("/join", response_model=ClassroomOut)
async def join_classroom(
    payload: ClassroomJoin,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = await _get_classroom_or_404(payload.room_code.upper().strip(), db)
    if room.status == "ended":
        raise HTTPException(status_code=400, detail="This session has ended")

    result = await db.execute(
        select(RoomParticipant).where(
            RoomParticipant.room_id == room.id,
            RoomParticipant.user_id == current_user.id,
        )
    )
    participant = result.scalar_one_or_none()
    if not participant:
        participant = RoomParticipant(
            room_id=room.id,
            user_id=current_user.id,
            display_name=current_user.full_name,   # ← full_name, not username
        )
        db.add(participant)
        await db.commit()

    return room


@router.get("/{room_code}", response_model=ClassroomDetail)
async def get_classroom(
    room_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = await _get_classroom_or_404(room_code.upper(), db)
    result = await db.execute(
        select(RoomParticipant).where(RoomParticipant.room_id == room.id)
    )
    participants = result.scalars().all()
    return ClassroomDetail(
        id=room.id,
        room_code=room.room_code,
        title=room.title,
        teacher_id=room.teacher_id,
        status=room.status,
        created_at=room.created_at,
        ended_at=room.ended_at,
        participants=[
            {
                "user_id":      p.user_id,
                "display_name": p.display_name,
                "joined_at":    p.joined_at,
            }
            for p in participants
        ],
    )


@router.post("/{room_code}/start")
async def start_classroom(
    room_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = await _get_classroom_or_404(room_code.upper(), db)
    if room.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the room's teacher can start it")
    room.status = "active"
    await db.commit()
    return {"status": "active", "room_code": room_code}


@router.post("/{room_code}/end")
async def end_classroom(
    room_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = await _get_classroom_or_404(room_code.upper(), db)
    if room.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the room's teacher can end it")
    room.status = "ended"
    room.ended_at = datetime.utcnow()
    await db.commit()
    manager.cleanup_room(room_code.upper())
    return {"status": "ended"}


@router.get("/{room_code}/report", response_model=List[EngagementRecord])
async def get_classroom_report(
    room_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = await _get_classroom_or_404(room_code.upper(), db)
    result = await db.execute(
        select(ClassroomEngagement)
        .where(ClassroomEngagement.room_id == room.id)
        .order_by(ClassroomEngagement.timestamp)
    )
    return result.scalars().all()


# ── WebSocket: Student ─────────────────────────────────────────────────────────

@router.websocket("/ws/{room_code}/student/{user_id}")
async def student_ws(
    websocket: WebSocket,
    room_code: str,
    user_id: str,           # ← str, was int (UUID)
    db: AsyncSession = Depends(get_db),
):
    room_code = room_code.upper()

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    display_name = user.full_name if user else f"Student"   # ← full_name, not username

    await manager.connect_student(room_code, user_id, display_name, websocket)

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg.get("type") != "frame":
                continue

            frame_b64 = msg.get("frame", "")
            if not frame_b64:
                continue

            try:
                img_bytes = base64.b64decode(frame_b64)
                nparr = np.frombuffer(img_bytes, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                if frame is None:
                    continue
            except Exception as e:
                logger.warning(f"Frame decode error for user {user_id}: {e}")
                continue

            # Offload the blocking CV pipeline to a thread-pool executor.
            # process_frame() runs MediaPipe + OpenCV (~100–300 ms) — calling it
            # directly on the event loop would stall every other WS connection.
            # session.py does this correctly; replicate the same pattern here.
            try:
                result_data = await asyncio.get_event_loop().run_in_executor(
                    None, process_frame, frame
                )
            except Exception as e:
                logger.error(f"Pipeline error for user {user_id}: {e}")
                continue

            await manager.update_student_score(room_code, user_id, result_data)

            # Throttle DB writes to ~10% of frames
            if random.random() < 0.1:
                room_result = await db.execute(
                    select(Classroom).where(Classroom.room_code == room_code)
                )
                room = room_result.scalar_one_or_none()
                if room:
                    eng = ClassroomEngagement(
                        room_id=room.id,
                        user_id=user_id,
                        engagement_score=result_data.get("engagement_score", 0.0),
                        # ← pipeline key is "engagement_level", stored as classification
                        classification=result_data.get("engagement_level", "Unknown"),
                        emotion=result_data.get("emotion", "neutral"),
                        signals={
                            "face_score":    result_data.get("face_score", 0.0),
                            "gaze_score":    result_data.get("gaze_score", 0.0),
                            "pose_score":    result_data.get("pose_score", 0.0),
                            "emotion_score": result_data.get("emotion_score", 0.0),
                            "yawn_score":    result_data.get("yawn_score", 0.0),
                            "hand_score":    result_data.get("hand_score", 0.0),
                        },
                    )
                    db.add(eng)
                    await db.commit()

    except WebSocketDisconnect:
        manager.disconnect_student(room_code, user_id)
    except Exception as e:
        logger.error(f"Student WS error: {e}")
        manager.disconnect_student(room_code, user_id)


# ── WebSocket: Teacher ─────────────────────────────────────────────────────────

@router.websocket("/ws/{room_code}/teacher/{user_id}")
async def teacher_ws(
    websocket: WebSocket,
    room_code: str,
    user_id: str,           # ← str, was int (UUID)
):
    room_code = room_code.upper()
    await manager.connect_teacher(room_code, user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect_teacher(room_code, user_id)
    except Exception as e:
        logger.error(f"Teacher WS error: {e}")
        manager.disconnect_teacher(room_code, user_id)