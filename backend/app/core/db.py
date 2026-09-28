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

            # 2b. Ensure unique constraint on scoreboard_entries (contest_id, member_id)
            sb_uq_res = await session.execute(text("""
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'uq_scoreboard_contest_member'
            """))
            if not sb_uq_res.scalar():
                await session.execute(text("""
                    DELETE FROM scoreboard_entries
                    WHERE id NOT IN (
                        SELECT DISTINCT ON (contest_id, member_id) id
                        FROM scoreboard_entries
                        WHERE member_id IS NOT NULL
                        ORDER BY contest_id, member_id, score DESC, penalty_seconds ASC, id ASC
                    ) AND member_id IS NOT NULL;
                """))
                await session.execute(text("""
                    ALTER TABLE scoreboard_entries 
                    ADD CONSTRAINT uq_scoreboard_contest_member 
                    UNIQUE (contest_id, member_id);
                """))

            # 2c. Ensure unique constraint on assessment_sessions (assessment_id, member_id)
            sess_uq_res = await session.execute(text("""
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'uq_assessment_session_member'
            """))
            if not sess_uq_res.scalar():
                await session.execute(text("""
                    DELETE FROM assessment_sessions
                    WHERE id NOT IN (
                        SELECT DISTINCT ON (assessment_id, member_id) id
                        FROM assessment_sessions
                        ORDER BY assessment_id, member_id, started_at DESC, total_score DESC, id ASC
                    );
                """))
                await session.execute(text("""
                    ALTER TABLE assessment_sessions 
                    ADD CONSTRAINT uq_assessment_session_member 
                    UNIQUE (assessment_id, member_id);
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

                # Composite Indexes for Instantaneous University Leaderboard & Star Divisions
                "CREATE INDEX IF NOT EXISTS ix_member_profiles_leaderboard_core ON member_profiles (is_onboarded, rating DESC, peak_rating DESC, id ASC)",
                "CREATE INDEX IF NOT EXISTS ix_member_profiles_dept_rating_peak ON member_profiles (is_onboarded, department, rating DESC, peak_rating DESC)",
                "CREATE INDEX IF NOT EXISTS ix_member_profiles_batch_rating_peak ON member_profiles (is_onboarded, batch, rating DESC, peak_rating DESC)",
                "CREATE INDEX IF NOT EXISTS ix_member_profiles_dept_batch_rating ON member_profiles (department, batch, rating DESC)",
                "CREATE INDEX IF NOT EXISTS ix_member_profiles_onboarded_rating ON member_profiles (is_onboarded, rating DESC)",

                # Composite Indexes for Live Scoreboard Re-Ranking & Division Standings
                "CREATE INDEX IF NOT EXISTS ix_scoreboard_contest_score_penalty ON scoreboard_entries (contest_id, score DESC, penalty_seconds ASC)",
                "CREATE INDEX IF NOT EXISTS ix_scoreboard_contest_division_rank ON scoreboard_entries (contest_id, division, rank ASC)",
                "CREATE INDEX IF NOT EXISTS ix_scoreboard_contest_department_rank ON scoreboard_entries (contest_id, department, rank ASC)",
                "CREATE INDEX IF NOT EXISTS ix_scoreboard_contest_rank ON scoreboard_entries (contest_id, rank ASC)",
                "CREATE INDEX IF NOT EXISTS ix_scoreboard_member_contest ON scoreboard_entries (member_id, contest_id)",

                # Composite Indexes for Contest Submissions & Problem Solving Telemetry
                "CREATE INDEX IF NOT EXISTS ix_contest_submissions_contest_problem_verdict ON contest_submissions (contest_id, problem_id, verdict)",
                "CREATE INDEX IF NOT EXISTS ix_contest_submissions_contest_member_submitted ON contest_submissions (contest_id, member_id, submitted_at DESC)",
                "CREATE INDEX IF NOT EXISTS ix_contest_submissions_member_problem_verdict ON contest_submissions (member_id, problem_id, verdict)",

                # Composite Covering Index for Rating Trajectories & Elo Changes
                "CREATE INDEX IF NOT EXISTS ix_rating_history_member_contested_new_rating ON rating_history (member_id, contested_at ASC, new_rating)",
                "CREATE INDEX IF NOT EXISTS ix_rating_history_contest_rank ON rating_history (contest_id, rank ASC)",

                # Composite Indexes for Contest Schedulers, Registrations & Turnstile Gates
                "CREATE INDEX IF NOT EXISTS ix_offline_contests_status_starts ON offline_contests (status, starts_at DESC)",
                "CREATE INDEX IF NOT EXISTS ix_contest_registrations_contest_status ON contest_registrations (contest_id, status)",
                "CREATE INDEX IF NOT EXISTS ix_contest_registrations_contest_checked_in ON contest_registrations (contest_id, checked_in_at)",

                # Outbox event polling index
                "CREATE INDEX IF NOT EXISTS ix_outbox_events_status_created ON outbox_events (status, created_at ASC)",
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

            # 5. Schema Evolution: Monotonic resource versions & table version columns
            await session.execute(text("""
                ALTER TABLE offline_contests ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;
            """))
            await session.execute(text("""
                ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;
            """))
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS resource_versions (
                    resource_id VARCHAR(120) PRIMARY KEY,
                    version BIGINT NOT NULL DEFAULT 1,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            """))

            # 6. Schema Evolution: Problem Authoring & Function Execution Contract Tables
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS problems (
                    id VARCHAR(36) PRIMARY KEY,
                    problem_index VARCHAR(5) NOT NULL DEFAULT 'A',
                    title VARCHAR(120) NOT NULL,
                    slug VARCHAR(80) UNIQUE NOT NULL,
                    difficulty VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
                    topic VARCHAR(60) NOT NULL DEFAULT 'Algorithms',
                    points INTEGER NOT NULL DEFAULT 100,
                    description TEXT NOT NULL,
                    constraints TEXT,
                    input_format TEXT,
                    output_format TEXT,
                    execution_mode VARCHAR(20) NOT NULL DEFAULT 'FUNCTION',
                    function_signature JSON NOT NULL DEFAULT '{}'::json,
                    starter_code JSON NOT NULL DEFAULT '{}'::json,
                    time_limit DOUBLE PRECISION NOT NULL DEFAULT 2.0,
                    memory_limit INTEGER NOT NULL DEFAULT 256,
                    evaluation_config JSON NOT NULL DEFAULT '{}'::json,
                    sandbox_config JSON NOT NULL DEFAULT '{}'::json,
                    reference_solution JSON DEFAULT '{}'::json,
                    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
                    version INTEGER NOT NULL DEFAULT 1,
                    created_by VARCHAR(36),
                    updated_by VARCHAR(36),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            """))
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS problem_versions (
                    id VARCHAR(36) PRIMARY KEY,
                    problem_id VARCHAR(36) NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
                    version INTEGER NOT NULL,
                    title VARCHAR(120) NOT NULL,
                    slug VARCHAR(80) NOT NULL,
                    difficulty VARCHAR(20) NOT NULL,
                    topic VARCHAR(60) NOT NULL,
                    points INTEGER NOT NULL,
                    description TEXT NOT NULL,
                    constraints TEXT,
                    input_format TEXT,
                    output_format TEXT,
                    execution_mode VARCHAR(20) NOT NULL,
                    function_signature JSON NOT NULL,
                    starter_code JSON NOT NULL,
                    time_limit DOUBLE PRECISION NOT NULL,
                    memory_limit INTEGER NOT NULL,
                    evaluation_config JSON NOT NULL,
                    sandbox_config JSON NOT NULL,
                    reference_solution JSON,
                    created_by VARCHAR(36),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_problem_versions_id_version UNIQUE (problem_id, version)
                );
            """))
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS problem_testcases (
                    id VARCHAR(36) PRIMARY KEY,
                    problem_id VARCHAR(36) NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
                    version INTEGER NOT NULL DEFAULT 1,
                    testcase_id VARCHAR(50) NOT NULL,
                    input_data JSON NOT NULL,
                    expected_output JSON NOT NULL,
                    explanation TEXT,
                    weight DOUBLE PRECISION NOT NULL DEFAULT 1.0,
                    is_hidden BOOLEAN NOT NULL DEFAULT TRUE,
                    "order" INTEGER NOT NULL DEFAULT 0,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    content_hash VARCHAR(64),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_problem_testcase_id_ver UNIQUE (problem_id, version, testcase_id)
                );
            """))
            await session.execute(text("""
                ALTER TABLE contest_problems ADD COLUMN IF NOT EXISTS problem_id VARCHAR(36) REFERENCES problems(id) ON DELETE SET NULL;
            """))
            await session.execute(text("""
                ALTER TABLE contest_problems ADD COLUMN IF NOT EXISTS problem_version INTEGER;
            """))
            await session.execute(text("""
                ALTER TABLE contest_problems ADD COLUMN IF NOT EXISTS points_override INTEGER;
            """))
            await session.execute(text("""
                ALTER TABLE contest_problems ADD COLUMN IF NOT EXISTS execution_mode VARCHAR(20) DEFAULT 'FUNCTION';
            """))
            await session.execute(text("""
                ALTER TABLE contest_problems ADD COLUMN IF NOT EXISTS function_signature JSON DEFAULT '{}'::json;
            """))
            await session.execute(text("""
                ALTER TABLE contest_problems ADD COLUMN IF NOT EXISTS evaluation_config JSON DEFAULT '{}'::json;
            """))
            await session.execute(text("""
                ALTER TABLE contest_problems ADD COLUMN IF NOT EXISTS sandbox_config JSON DEFAULT '{}'::json;
            """))
            await session.execute(text("""
                ALTER TABLE contest_submissions ADD COLUMN IF NOT EXISTS attempt_id VARCHAR(36)
                REFERENCES contest_attempts(id) ON DELETE CASCADE;
            """))
            await session.execute(text("""
                ALTER TABLE contest_submissions ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64);
            """))
            await session.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_contest_submissions_attempt_id ON contest_submissions (attempt_id);
            """))
            await session.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS uq_contest_submission_attempt_key
                ON contest_submissions (attempt_id, idempotency_key)
                WHERE idempotency_key IS NOT NULL;
            """))


            await session.commit()
        except Exception as e:
            await session.rollback()
            print(f"Notice during ensure_database_integrity: {e}")


async def get_next_resource_version(session: AsyncSession, resource_id: str) -> int:
    """
    Atomically advance and return the monotonic integer version for a resource in PostgreSQL.
    Guarantees strict monotonicity across concurrent transactions.
    """
    stmt = text("""
        INSERT INTO resource_versions (resource_id, version, updated_at)
        VALUES (:resource_id, 1, NOW())
        ON CONFLICT (resource_id) DO UPDATE
        SET version = resource_versions.version + 1, updated_at = NOW()
        RETURNING version;
    """)
    res = await session.execute(stmt, {"resource_id": resource_id})
    val = res.scalar()
    return int(val if val is not None else 1)


async def get_current_resource_version(session: AsyncSession, resource_id: str) -> int:
    """Read the current committed version for a resource in PostgreSQL."""
    stmt = text("SELECT version FROM resource_versions WHERE resource_id = :resource_id")
    res = await session.execute(stmt, {"resource_id": resource_id})
    val = res.scalar()
    return int(val if val is not None else 0)


async def init_db():
    """Create all database tables on initial startup and verify relational schema integrity."""
    import app.models.db_models  # noqa: F401
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        print(f"Notice during init_db Base.metadata.create_all: {e}")

    await ensure_database_integrity()
