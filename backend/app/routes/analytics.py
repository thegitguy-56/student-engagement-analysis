from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database.connection import get_db
from app.models.user import User
from app.models.session import Session
from app.models.engagement import EngagementRecord
from app.services.auth_dependency import get_current_user

router = APIRouter()

@router.get("/summary")
async def get_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Total sessions
    sessions_result = await db.execute(
        select(func.count(Session.id)).where(Session.user_id == current_user.id)
    )
    total_sessions = sessions_result.scalar()

    # Average engagement across all sessions
    avg_result = await db.execute(
        select(func.avg(Session.avg_engagement)).where(Session.user_id == current_user.id)
    )
    avg_engagement = round(avg_result.scalar() or 0, 2)

    # Emotion distribution from all records
    emotion_result = await db.execute(
        select(EngagementRecord.emotion, func.count(EngagementRecord.id).label("count"))
        .join(Session, EngagementRecord.session_id == Session.id)
        .where(Session.user_id == current_user.id)
        .group_by(EngagementRecord.emotion)
    )
    emotions = {row.emotion: row.count for row in emotion_result}

    return {
        "total_sessions": total_sessions,
        "avg_engagement": avg_engagement,
        "emotion_distribution": emotions,
    }

@router.get("/session/{session_id}/timeline")
async def get_session_timeline(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(
            EngagementRecord.timestamp,
            EngagementRecord.engagement_score,
            EngagementRecord.emotion,
            EngagementRecord.head_pose,
            EngagementRecord.engagement_level
        )
        .join(Session, EngagementRecord.session_id == Session.id)
        .where(
            EngagementRecord.session_id == session_id,
            Session.user_id == current_user.id
        )
        .order_by(EngagementRecord.timestamp)
    )
    rows = result.all()
    return [
        {
            "timestamp": r.timestamp.isoformat(),
            "engagement_score": r.engagement_score,
            "emotion": r.emotion,
            "head_pose": r.head_pose,
            "engagement_level": r.engagement_level,
        }
        for r in rows
    ]