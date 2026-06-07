from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database.connection import Base

class User(Base):
    __tablename__ = "users"

    id             = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email          = Column(String(255), unique=True, nullable=False, index=True)
    full_name      = Column(String(255), nullable=False)
    hashed_password= Column(String(255), nullable=False)
    role           = Column(String(50), default="student")   # student | teacher | admin
    avatar_url     = Column(Text, nullable=True)
    is_active      = Column(Boolean, default=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now())

    sessions       = relationship("Session", back_populates="user", cascade="all, delete-orphan")