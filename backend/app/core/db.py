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

# Optimized connection pool tuned for PostgreSQL 16
engine = create_async_engine(
    db_url,
    echo=False,
    future=True,
    pool_size=10,
    max_overflow=15,
    pool_pre_ping=True,
    pool_recycle=1800,
    pool_timeout=15,
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


async def ensure_database_integrity():
    """
    Validates and guarantees foreign key constraints, indexes, and data integrity
    across all tables in PostgreSQL. Eliminates any orphaned rating histories,
    trust proofs, or phantom profile ratings left by deleted contests.
    """
    async with AsyncSessionLocal() as session:
        try:
            # 1. Clean orphaned rating_history and ensure foreign key constraint
            fk_res = await session.execute(text("""
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'rating_history_contest_id_fkey'
            """))
            if not fk_res.scalar():
                await session.execute(text("""
                    DELETE FROM rating_history 
                    WHERE contest_id IS NOT NULL 
                      AND contest_id NOT IN (SELECT id FROM offline_contests)
                """))
                await session.execute(text("""
                    ALTER TABLE rating_history 
                    ADD CONSTRAINT rating_history_contest_id_fkey 
                    FOREIGN KEY (contest_id) REFERENCES offline_contests(id) ON DELETE CASCADE
                """))

            # 2. Clean orphaned trust_proofs
            await session.execute(text("""
                DELETE FROM trust_proofs 
                WHERE contest_id IS NOT NULL 
                  AND contest_id NOT IN (SELECT id FROM offline_contests)
            """))

            # 3. Ensure essential query & foreign key indexes
            index_statements = [
                "CREATE INDEX IF NOT EXISTS ix_rating_history_contest_id ON rating_history (contest_id)",
                "CREATE INDEX IF NOT EXISTS ix_rating_history_member_id ON rating_history (member_id)",
                "CREATE INDEX IF NOT EXISTS ix_rating_history_contested_at ON rating_history (contested_at)",
                "CREATE INDEX IF NOT EXISTS ix_trust_proofs_contest_id ON trust_proofs (contest_id)",
                "CREATE INDEX IF NOT EXISTS ix_trust_proofs_member_id ON trust_proofs (member_id)",
                "CREATE INDEX IF NOT EXISTS ix_trust_proofs_issued_at ON trust_proofs (issued_at)",
                "CREATE INDEX IF NOT EXISTS ix_scoreboard_entries_contest_id ON scoreboard_entries (contest_id)",
                "CREATE INDEX IF NOT EXISTS ix_scoreboard_entries_member_id ON scoreboard_entries (member_id)",
                "CREATE INDEX IF NOT EXISTS ix_scoreboard_entries_rank ON scoreboard_entries (rank)",
                "CREATE INDEX IF NOT EXISTS ix_contest_problems_contest_id ON contest_problems (contest_id)",
                "CREATE INDEX IF NOT EXISTS ix_assessments_contest_id ON assessments (contest_id)",
                "CREATE INDEX IF NOT EXISTS ix_assessment_problems_assessment_id ON assessment_problems (assessment_id)",
                "CREATE INDEX IF NOT EXISTS ix_assessment_sessions_assessment_id ON assessment_sessions (assessment_id)",
                "CREATE INDEX IF NOT EXISTS ix_assessment_sessions_member_id ON assessment_sessions (member_id)",
                "CREATE INDEX IF NOT EXISTS ix_assessment_submissions_session_id ON assessment_submissions (session_id)",
                "CREATE INDEX IF NOT EXISTS ix_assessment_submissions_problem_id ON assessment_submissions (problem_id)",
                "CREATE INDEX IF NOT EXISTS ix_assessment_submissions_member_id ON assessment_submissions (member_id)",
                "CREATE INDEX IF NOT EXISTS ix_announcements_published_at ON announcements (published_at)",
                "CREATE INDEX IF NOT EXISTS ix_announcements_contest_slug ON announcements (contest_slug)",
            ]
            for stmt in index_statements:
                await session.execute(text(stmt))

            # 4. Data hygiene: Reset any member profiles with phantom ratings or attendance
            # where no valid contest history or scoreboards exist
            await session.execute(text("""
                UPDATE member_profiles mp
                SET rating = 1200, peak_rating = 1200, attendance_count = 0
                WHERE NOT EXISTS (
                    SELECT 1 FROM rating_history rh
                    JOIN offline_contests oc ON rh.contest_id = oc.id
                    WHERE rh.member_id = mp.id
                ) AND NOT EXISTS (
                    SELECT 1 FROM scoreboard_entries se
                    JOIN offline_contests oc ON se.contest_id = oc.id
                    WHERE se.member_id = mp.id
                ) AND (mp.rating != 1200 OR mp.peak_rating != 1200 OR mp.attendance_count != 0)
            """))

            await session.commit()
        except Exception as e:
            await session.rollback()
            print(f"Notice during ensure_database_integrity: {e}")


async def init_db():
    """Create all database tables on initial startup and verify relational schema integrity."""
    import app.models.db_models  # noqa: F401
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        print(f"Notice during init_db Base.metadata.create_all: {e}")

    await ensure_database_integrity()
