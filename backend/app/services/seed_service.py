"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Seed & Purge Service: Zero Static / Zero Mock Data Policy.
All contest and assessment data is managed dynamically via administrator endpoints.
"""

import logging
from sqlalchemy import delete
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

    # 1. Purge Submissions & Sessions
    await db.execute(delete(AssessmentSubmission))
    await db.execute(delete(AssessmentSession))
    await db.execute(delete(ContestSubmission))

    # 2. Purge Problems & Assessments
    await db.execute(delete(AssessmentProblem))
    await db.execute(delete(Assessment))
    await db.execute(delete(ContestProblem))

    # 3. Purge Registrations, Passes, Scoreboards & Proofs
    await db.execute(delete(ContestRegistration))
    await db.execute(delete(CampusPass))
    await db.execute(delete(ScoreboardEntry))
    await db.execute(delete(TrustProof))
    await db.execute(delete(Announcement))
    await db.execute(delete(RatingHistory))

    # 4. Purge All Contests
    await db.execute(delete(OfflineContest))

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
