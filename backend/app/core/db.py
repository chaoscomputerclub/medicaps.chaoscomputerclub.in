"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Database Engine and Async Session Management
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base
from app.core.config import settings, BASE_DIR

db_url = settings.DATABASE_URL
if "sqlite" in db_url and "///./" in db_url:
    rel_path = db_url.split("///./")[-1]
    backend_db = BASE_DIR / rel_path
    db_url = f"sqlite+aiosqlite:///{backend_db}"

# Engine configuration
engine_kwargs = {
    "echo": False,
    "future": True,
}
if "sqlite" in db_url:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_size"] = 20
    engine_kwargs["max_overflow"] = 30
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 1800
    engine_kwargs["pool_timeout"] = 10

engine = create_async_engine(db_url, **engine_kwargs)

from sqlalchemy import event

if "sqlite" in db_url:
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.close()

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

from sqlalchemy import text
from sqlalchemy.orm import declarative_base

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for obtaining async DB sessions in routes."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all database tables on initial startup."""
    import app.models.db_models  # noqa: F401
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        print(f"Notice during init_db (tables already created or concurrency race handled): {e}")
