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
from app.core.config import settings

# Engine configuration
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
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
    """Create all database tables on initial startup and apply non-destructive column migrations."""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

            # Non-destructive migrations for existing PostgreSQL databases
            if "postgresql" in settings.DATABASE_URL or "postgres" in settings.DATABASE_URL:
                migration_sqls = [
                    "ALTER TABLE offline_contests ADD COLUMN IF NOT EXISTS cadence VARCHAR(20) DEFAULT 'weekly';",
                    "ALTER TABLE offline_contests ADD COLUMN IF NOT EXISTS edition INTEGER;",
                    "ALTER TABLE offline_contests ADD COLUMN IF NOT EXISTS banner_url VARCHAR(500);",
                    "ALTER TABLE campus_passes ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP WITH TIME ZONE;",
                    "ALTER TABLE campus_passes ADD COLUMN IF NOT EXISTS checked_in_by VARCHAR(100);",
                    "ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP WITH TIME ZONE;",
                    "ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS seat_assigned VARCHAR(20);",
                    "ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS campus_pass_code VARCHAR(50);",
                    "ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS is_top_30_qualified BOOLEAN DEFAULT FALSE;",
                    "ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS assessment_taken BOOLEAN DEFAULT FALSE;",
                    "ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS assessment_score FLOAT;",
                    "ALTER TABLE contest_registrations ADD COLUMN IF NOT EXISTS assessment_rank INTEGER;",
                    "ALTER TABLE contest_problems ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20) DEFAULT 'MEDIUM';",
                    "ALTER TABLE contest_problems ADD COLUMN IF NOT EXISTS description TEXT;",
                    "ALTER TABLE contest_problems ADD COLUMN IF NOT EXISTS input_format TEXT;",
                    "ALTER TABLE contest_problems ADD COLUMN IF NOT EXISTS output_format TEXT;",
                    "ALTER TABLE contest_problems ADD COLUMN IF NOT EXISTS constraints TEXT;",
                    "ALTER TABLE contest_problems ADD COLUMN IF NOT EXISTS time_limit FLOAT DEFAULT 2.0;",
                    "ALTER TABLE contest_problems ADD COLUMN IF NOT EXISTS memory_limit INTEGER DEFAULT 256;",
                    "ALTER TABLE contest_problems ADD COLUMN IF NOT EXISTS starter_codes JSON DEFAULT '{}';",
                    "ALTER TABLE contest_problems ADD COLUMN IF NOT EXISTS sample_testcases JSON DEFAULT '[]';",
                    "ALTER TABLE contest_problems ADD COLUMN IF NOT EXISTS hidden_testcases JSON DEFAULT '[]';",
                    "ALTER TABLE assessment_problems ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20) DEFAULT 'MEDIUM';",
                    "ALTER TABLE assessment_problems ADD COLUMN IF NOT EXISTS description TEXT;",
                    "ALTER TABLE assessment_problems ADD COLUMN IF NOT EXISTS input_format TEXT;",
                    "ALTER TABLE assessment_problems ADD COLUMN IF NOT EXISTS output_format TEXT;",
                    "ALTER TABLE assessment_problems ADD COLUMN IF NOT EXISTS constraints TEXT;",
                    "ALTER TABLE assessment_problems ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 100;",
                    "ALTER TABLE assessment_problems ADD COLUMN IF NOT EXISTS time_limit FLOAT DEFAULT 2.0;",
                    "ALTER TABLE assessment_problems ADD COLUMN IF NOT EXISTS memory_limit INTEGER DEFAULT 256;",
                    "ALTER TABLE assessment_problems ADD COLUMN IF NOT EXISTS starter_codes JSON DEFAULT '{}';",
                    "ALTER TABLE assessment_problems ADD COLUMN IF NOT EXISTS sample_testcases JSON DEFAULT '[]';",
                    "ALTER TABLE assessment_problems ADD COLUMN IF NOT EXISTS hidden_testcases JSON DEFAULT '[]';",
                    "ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS is_top_30_qualified BOOLEAN DEFAULT FALSE;",
                    "ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS anti_cheat_violations INTEGER DEFAULT 0;",
                ]
                for sql in migration_sqls:
                    try:
                        await conn.execute(text(sql))
                    except Exception as col_err:
                        pass
    except Exception as e:
        print(f"Notice during init_db (tables already created or concurrency race handled): {e}")
