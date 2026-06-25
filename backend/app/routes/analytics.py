from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database.connection import get_db
from app.models.user import User
from app.models.session import Session
from app.models.engagement import EngagementRecord
from app.models.classroom import ClassroomEngagement, RoomParticipant
from app.services.auth_dependency import get_current_user

router = APIRouter()

@router.get("/summary")
async def get_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Total sessions (Solo sessions + Online classes joined)
    sessions_result = await db.execute(
        select(func.count(Session.id)).where(Session.user_id == current_user.id)
    )
    solo_sessions = sessions_result.scalar() or 0

    classes_result = await db.execute(
        select(func.count(RoomParticipant.id)).where(RoomParticipant.user_id == current_user.id)
    )
    class_sessions = classes_result.scalar() or 0
    total_sessions = solo_sessions + class_sessions

    # 2. Average engagement (weighted average of all records)
    solo_agg = await db.execute(
        select(
            func.sum(EngagementRecord.engagement_score),
            func.count(EngagementRecord.id)
        )
        .join(Session, EngagementRecord.session_id == Session.id)
        .where(Session.user_id == current_user.id)
    )
    solo_sum, solo_count = solo_agg.one()

    class_agg = await db.execute(
        select(
            func.sum(ClassroomEngagement.engagement_score),
            func.count(ClassroomEngagement.id)
        )
        .where(ClassroomEngagement.user_id == current_user.id)
    )
    class_sum, class_count = class_agg.one()

    total_sum = (solo_sum or 0) + (class_sum or 0)
    total_count = (solo_count or 0) + (class_count or 0)
    avg_engagement = round(total_sum / total_count, 2) if total_count > 0 else 0.0

    # 3. Emotion distribution (merge solo and class records)
    emotions = {}

    # Solo emotions
    emotion_solo_result = await db.execute(
        select(EngagementRecord.emotion, func.count(EngagementRecord.id).label("count"))
        .join(Session, EngagementRecord.session_id == Session.id)
        .where(Session.user_id == current_user.id)
        .group_by(EngagementRecord.emotion)
    )
    for row in emotion_solo_result:
        emotions[row.emotion] = emotions.get(row.emotion, 0) + row.count

    # Class emotions
    emotion_class_result = await db.execute(
        select(ClassroomEngagement.emotion, func.count(ClassroomEngagement.id).label("count"))
        .where(ClassroomEngagement.user_id == current_user.id)
        .group_by(ClassroomEngagement.emotion)
    )
    for row in emotion_class_result:
        emotions[row.emotion] = emotions.get(row.emotion, 0) + row.count

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