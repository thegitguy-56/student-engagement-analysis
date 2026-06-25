# backend/app/database/connection.py
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

DATABASE_URL = settings.DATABASE_URL

# Render / Neon give postgres:// — convert to asyncpg dialect
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "+asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

is_sqlite = "sqlite" in DATABASE_URL
is_postgres = not is_sqlite

# For PostgreSQL (including Neon), strip query params that asyncpg doesn't
# understand (sslmode, channel_binding, etc.) and pass ssl via connect_args.
engine_kwargs: dict = {
    "echo": settings.DEBUG,
    "pool_pre_ping": True,
}

if is_sqlite:
    # aiosqlite doesn't support pool_size / max_overflow
    pass
else:
    # Strip unsupported query params from the URL (sslmode, channel_binding, etc.)
    parsed = urlparse(DATABASE_URL)
    supported_params = {}  # asyncpg handles SSL via connect_args, not URL params
    clean_query = urlencode(supported_params)
    cleaned = parsed._replace(query=clean_query)
    DATABASE_URL = urlunparse(cleaned)

    engine_kwargs["connect_args"] = {
        "ssl": "require",
        "timeout": 30,          # seconds to wait for connection
        "command_timeout": 30,  # seconds to wait for a query
    }
    engine_kwargs["pool_size"]    = 5
    engine_kwargs["max_overflow"] = 10
    engine_kwargs["pool_timeout"] = 30

engine = create_async_engine(DATABASE_URL, **engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

class Base(DeclarativeBase):
    pass

async def create_tables():
    async with engine.begin() as conn:
        from app.models import user, session, engagement  # noqa
        from app.models import classroom                  # noqa
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)

async def get_db():
    async with AsyncSessionLocal() as db:
        try:
            yield db
            await db.commit()
        except Exception:
            await db.rollback()
            raise
        finally:
            await db.close()