from sqlalchemy import Column, String, Float, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy import JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database.connection import Base

class EngagementRecord(Base):
    __tablename__ = "engagement_records"

    id                = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id        = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    timestamp         = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # CV analysis results
    face_present      = Column(Boolean, default=False)
    eye_contact       = Column(Boolean, default=False)
    head_pose         = Column(String(50), default="center")   # center|left|right|up|down
    emotion           = Column(String(50), default="neutral")  # happy|neutral|sad|surprised|bored|angry
    yawning           = Column(Boolean, default=False)
    hand_raised       = Column(Boolean, default=False)

    # Scores (0.0 – 1.0 each)
    face_score        = Column(Float, default=0.0)
    gaze_score        = Column(Float, default=0.0)
    pose_score        = Column(Float, default=0.0)
    emotion_score     = Column(Float, default=0.0)
    yawn_score        = Column(Float, default=0.0)
    hand_score        = Column(Float, default=0.0)

    # Final composite score
    engagement_score  = Column(Float, default=0.0)   # 0–100
    engagement_level  = Column(String(50), default="distracted")  # highly_engaged|moderately_engaged|distracted

    # Raw landmarks (optional, for debugging)
    raw_data          = Column(JSON, nullable=True)

    session           = relationship("Session", back_populates="engagements")