"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Seed & Purge Service: Zero Static / Zero Mock Data Policy.
All contest and assessment data is managed dynamically via administrator endpoints.
"""

import logging
from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import (
    OfflineContest,
    ContestProblem,
    ContestSubmission,
    ScoreboardEntry,
    ContestRegistration,
    Assessment,
    AssessmentProblem,
    AssessmentSession,
    AssessmentSubmission,
    CampusPass,
    TrustProof,
    Announcement,
    RatingHistory,
    MemberProfile,
)

logger = logging.getLogger(__name__)


async def seed_initial_data(db: AsyncSession):
    """Zero-static-data seed handler. Intentionally clean."""
    logger.info("Zero static data policy: Database initialized clean.")
    return


async def purge_all_contest_data(db: AsyncSession) -> dict:
    """
    Strictly purge all contest, assessment, problem, submission, pass,
    announcement, and scoreboard data from the database.
    Preserves actual registered student accounts in MemberProfile.
    """
    logger.warning("Initiating strict purge of all contest and assessment data...")

    tables = [
        AssessmentSubmission,
        AssessmentSession,
        ContestSubmission,
        AssessmentProblem,
        Assessment,
        ContestProblem,
        ContestRegistration,
        CampusPass,
        ScoreboardEntry,
        TrustProof,
        Announcement,
        RatingHistory,
        OfflineContest,
    ]

    for table in tables:
        try:
            await db.execute(delete(table))
            await db.flush()
        except Exception as e:
            logger.warning(f"Notice on purging {table}: {e}")

    # 5. Purge Any Mock / Funnel Test Member Accounts
    try:
        await db.execute(
            delete(MemberProfile).where(
                (MemberProfile.handle.like("cadet_funnel%"))
                | (MemberProfile.email.like("%test%@medicaps.ac.in"))
                | (MemberProfile.handle.like("test_%"))
            )
        )
        await db.flush()
    except Exception:
        pass

    # 6. Reset all surviving MemberProfiles to baseline rating & zero attendance
    try:
        await db.execute(
            update(MemberProfile).values(
                rating=1200,
                peak_rating=1200,
                attendance_count=0,
                attendance_total=0,
            )
        )
        await db.flush()
    except Exception as e:
        logger.warning(f"Notice on resetting member profiles: {e}")

    await db.commit()

    # Invalidate Redis Caches
    try:
        from app.core.cache import delete_cache_pattern
        await delete_cache_pattern("cache:*")
    except Exception as e:
        logger.info("Redis cache clear notice: %s", e)

    logger.info("✓ All contest and assessment data purged successfully.")
    return {
        "success": True,
        "message": "All static and contest data purged strictly from database.",
    }


# Backwards-compatible alias
seed_database = seed_initial_data
