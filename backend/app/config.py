# backend/app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./engagement.db"
    SECRET_KEY: str = "dev-secret-change-in-production"
    FRONTEND_URL: str = "http://localhost:5173"
    DEBUG: bool = False
    APP_NAME: str = "Student Engagement Analysis"
    APP_VERSION: str = "2.0.0"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()