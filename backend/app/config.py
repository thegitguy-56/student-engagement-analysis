from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv

# Load .env file explicitly
env_file = Path(__file__).parent.parent / ".env"
load_dotenv(env_file)

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(env_file), env_file_encoding='utf-8')
    
    APP_NAME: str = "Student Engagement Analysis"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    DATABASE_URL: str
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    FRONTEND_URL: str = "http://localhost:5173"

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()