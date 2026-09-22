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

db_url = settings.DATABASE_URL.strip()

# Validate and normalize PostgreSQL connection URI
if "sqlite" in db_url.lower():
    raise RuntimeError(
        "\n" + "=" * 80 + "\n"
        "❌ SQLITE HAS BEEN REMOVED — POSTGRESQL 16+ REQUIRED\n"
        "Chaos Computer Club Medi-Caps Chapter backend strictly uses PostgreSQL 16+.\n\n"
        "Please configure a valid PostgreSQL async URI in backend/.env:\n"
        "  DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/ccc_medicaps\n\n"
        "To quickly spin up a local PostgreSQL 16 container with Docker:\n"
        "  docker run --name ccc-postgres -p 5432:5432 -e POSTGRES_DB=ccc_medicaps -e POSTGRES_PASSWORD=postgres -d postgres:16-alpine\n"
        + "=" * 80 + "\n"
    )

if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)

if not db_url.startswith("postgresql+asyncpg://"):
    raise RuntimeError(
        f"Invalid DATABASE_URL scheme '{db_url.split('://')[0]}'. "
        "CCC Medi-Caps backend requires 'postgresql+asyncpg://...' (PostgreSQL 16+ with asyncpg)."
    )

# High-concurrency connection pool tuned for PostgreSQL 16
engine = create_async_engine(
    db_url,
    echo=False,
    future=True,
    pool_size=20,
    max_overflow=30,
    pool_pre_ping=True,
    pool_recycle=1800,
    pool_timeout=10,
)

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
