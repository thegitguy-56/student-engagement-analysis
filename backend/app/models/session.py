from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text, ForeignKey
from sqlalchemy import JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database.connection import Base

class Session(Base):
    __tablename__ = "sessions"

    id              = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id         = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title           = Column(String(255), default="Learning Session")
    status          = Column(String(50), default="active")   # active | completed | paused
    avg_engagement  = Column(Float, default=0.0)
    total_frames    = Column(Integer, default=0)
    duration_seconds= Column(Integer, default=0)
    started_at      = Column(DateTime(timezone=True), server_default=func.now())
    ended_at        = Column(DateTime(timezone=True), nullable=True)
    report_url      = Column(Text, nullable=True)

    user            = relationship("User", back_populates="sessions")
    engagements     = relationship("EngagementRecord", back_populates="session", cascade="all, delete-orphan")