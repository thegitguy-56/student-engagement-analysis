from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class SessionCreate(BaseModel):
    title: str = "Learning Session"

class SessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    status: str
    avg_engagement: float
    total_frames: int
    duration_seconds: int
    started_at: datetime
    ended_at: datetime | None
    report_url: str | None

    class Config:
        from_attributes = True

class EngagementData(BaseModel):
    face_present: bool
    eye_contact: bool
    head_pose: str
    emotion: str
    yawning: bool
    hand_raised: bool
    face_score: float
    gaze_score: float
    pose_score: float
    emotion_score: float
    yawn_score: float
    hand_score: float
    engagement_score: float
    engagement_level: str