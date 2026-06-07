# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database.connection import create_tables
from app.routes import auth, session, analytics, reports
from app.routes.classroom import router as classroom_router   # ← ADD

@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    print(f" {settings.APP_NAME} started")
    yield
    print(" Server shutting down")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,        prefix="/api/auth",       tags=["Authentication"])
app.include_router(session.router,     prefix="/api/sessions",   tags=["Sessions"])
app.include_router(analytics.router,   prefix="/api/analytics",  tags=["Analytics"])
app.include_router(reports.router,     prefix="/api/reports",    tags=["Reports"])
app.include_router(classroom_router,   prefix="/api/classroom",  tags=["Classroom"])  # ← ADD

@app.get("/")
async def root():
    return {"message": f"{settings.APP_NAME} API", "version": settings.APP_VERSION, "status": "running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}