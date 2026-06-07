# backend/app/schemas/classroom.py
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ClassroomCreate(BaseModel):
    title: str


class ClassroomJoin(BaseModel):
    room_code: str


class ParticipantOut(BaseModel):
    user_id: str          # ← str, was int (UUID)
    display_name: Optional[str]
    joined_at: datetime

    class Config:
        from_attributes = True


class ClassroomOut(BaseModel):
    id: int
    room_code: str
    title: str
    teacher_id: str       # ← str, was int (UUID)
    status: str
    created_at: datetime
    ended_at: Optional[datetime]

    class Config:
        from_attributes = True


class ClassroomDetail(ClassroomOut):
    participants: List[ParticipantOut] = []


class EngagementRecord(BaseModel):
    user_id: str          # ← str, was int (UUID)
    display_name: Optional[str]
    engagement_score: float
    classification: str
    emotion: str
    signals: Optional[dict]
    timestamp: datetime

    class Config:
        from_attributes = True