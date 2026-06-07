# backend/app/models/classroom.py
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.connection import Base


class Classroom(Base):
    __tablename__ = "classrooms"

    id          = Column(Integer, primary_key=True, index=True, autoincrement=True)
    room_code   = Column(String(10), unique=True, index=True, nullable=False)
    title       = Column(String(200), nullable=False)
    teacher_id  = Column(String(36), ForeignKey("users.id"), nullable=False)   # ← String(36), was Integer
    status      = Column(String(20), default="waiting")   # waiting | active | ended
    created_at  = Column(DateTime, default=datetime.utcnow)
    ended_at    = Column(DateTime, nullable=True)

    participants = relationship("RoomParticipant", back_populates="classroom")
    engagements  = relationship("ClassroomEngagement", back_populates="classroom")


class RoomParticipant(Base):
    __tablename__ = "room_participants"

    id           = Column(Integer, primary_key=True, index=True, autoincrement=True)
    room_id      = Column(Integer, ForeignKey("classrooms.id"), nullable=False)
    user_id      = Column(String(36), ForeignKey("users.id"), nullable=False)  # ← String(36), was Integer
    display_name = Column(String(100), nullable=True)
    joined_at    = Column(DateTime, default=datetime.utcnow)
    left_at      = Column(DateTime, nullable=True)

    classroom = relationship("Classroom", back_populates="participants")


class ClassroomEngagement(Base):
    __tablename__ = "classroom_engagements"

    id               = Column(Integer, primary_key=True, index=True, autoincrement=True)
    room_id          = Column(Integer, ForeignKey("classrooms.id"), nullable=False)
    user_id          = Column(String(36), ForeignKey("users.id"), nullable=False)  # ← String(36), was Integer
    timestamp        = Column(DateTime, default=datetime.utcnow)
    engagement_score = Column(Float, default=0.0)
    classification   = Column(String(50), default="Unknown")
    emotion          = Column(String(50), default="neutral")
    signals          = Column(JSON, nullable=True)

    classroom = relationship("Classroom", back_populates="engagements")