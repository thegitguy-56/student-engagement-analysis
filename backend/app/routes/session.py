from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime
import json, base64, asyncio

from app.database.connection import get_db
from app.models.user import User
from app.models.session import Session
from app.models.engagement import EngagementRecord
from app.schemas.session import SessionCreate, SessionResponse, EngagementData
from app.services.auth_dependency import get_current_user
from app.cv_engine.pipeline import process_frame

router = APIRouter()

@router.post("/", response_model=SessionResponse, status_code=201)
async def create_session(
    data: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = Session(user_id=current_user.id, title=data.title)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionResponse.model_validate(session)

@router.get("/", response_model=list[SessionResponse])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Session)
        .where(Session.user_id == current_user.id)
        .order_by(Session.started_at.desc())
    )
    return [SessionResponse.model_validate(s) for s in result.scalars().all()]

@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionResponse.model_validate(session)

@router.patch("/{session_id}/end")
async def end_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.status = "completed"
    session.ended_at = datetime.utcnow()
    await db.commit()
    return {"message": "Session ended", "session_id": session_id}

# WebSocket endpoint for real-time frame analysis
@router.websocket("/ws/{session_id}")
async def websocket_analyze(websocket: WebSocket, session_id: str):
    await websocket.accept()
    frame_count = 0
    try:
        while True:
            # Receive base64-encoded frame from frontend
            data = await websocket.receive_text()
            payload = json.loads(data)
            frame_b64 = payload.get("frame", "")

            if not frame_b64:
                continue

            # Decode and analyze
            import numpy as np, cv2
            img_bytes = base64.b64decode(frame_b64)
            nparr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                continue

            # Run CV pipeline
            result = await asyncio.get_event_loop().run_in_executor(
                None, process_frame, frame
            )

            frame_count += 1
            result["frame_count"] = frame_count

            await websocket.send_text(json.dumps(result))

    except WebSocketDisconnect:
        print(f"WebSocket disconnected for session {session_id}")
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.close()