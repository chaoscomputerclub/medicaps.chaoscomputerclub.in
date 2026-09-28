"""Server-authoritative lifecycle for an individual member's live contest attempt."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import delete_cache_pattern
from app.models.db_models import ContestAttempt, MemberProfile, OfflineContest, ScoreboardEntry
from app.models.base import now_utc


def attempt_is_closed(attempt: Optional[ContestAttempt]) -> bool:
    return bool(attempt and attempt.status in {"finalized", "expired"})


async def get_attempt(
    db: AsyncSession,
    contest_id: str,
    member_id: str,
    *,
    for_update: bool = False,
) -> Optional[ContestAttempt]:
    stmt = select(ContestAttempt).where(
        ContestAttempt.contest_id == contest_id,
        ContestAttempt.member_id == member_id,
    )
    if for_update:
        stmt = stmt.with_for_update()
    result = await db.execute(stmt)
    return result.scalars().first()


async def start_or_get_attempt(
    db: AsyncSession,
    contest: OfflineContest,
    member: MemberProfile,
    ends_at: datetime,
) -> ContestAttempt:
    """Create exactly one attempt per contest/member, safe under concurrent opens."""
    from app.models.db_models import ContestRegistration

    reg_exists = await db.scalar(
        select(ContestRegistration).where(
            ContestRegistration.contest_id == contest.id,
            ContestRegistration.member_id == member.id,
        )
    )
    if not reg_exists:
        db.add(
            ContestRegistration(
                contest_id=contest.id,
                member_id=member.id,
                status="confirmed",
            )
        )
        contest.registered_count = (contest.registered_count or 0) + 1

    await db.execute(
        insert(ContestAttempt)
        .values(
            contest_id=contest.id,
            member_id=member.id,
            status="in_progress",
            started_at=now_utc(),
            ends_at=ends_at,
        )
        .on_conflict_do_nothing(constraint="uq_contest_attempt_member")
    )
    attempt = await get_attempt(db, contest.id, member.id, for_update=True)
    if attempt is None:
        await db.rollback()
        raise HTTPException(status_code=503, detail="Could not initialize the contest attempt.")
    await db.commit()
    return attempt


import logging

logger = logging.getLogger(__name__)


async def finalize_attempt(
    slug: str,
    member: MemberProfile,
    db: AsyncSession,
    expected_attempt_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Atomically finalize an attempt and snapshot its current server-side score."""
    from sqlalchemy import or_, func

    contest_result = await db.execute(
        select(OfflineContest).where(
            or_(
                OfflineContest.slug == slug,
                OfflineContest.id == slug,
                func.lower(OfflineContest.slug) == slug.lower(),
            )
        ).with_for_update()
    )
    contest = contest_result.scalars().first()
    if contest is None:
        raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

    attempt = await get_attempt(db, contest.id, member.id, for_update=True)
    if attempt is None:
        raise HTTPException(status_code=409, detail="No live contest attempt has been started.")

    if expected_attempt_id and attempt.id != expected_attempt_id:
        raise HTTPException(status_code=403, detail="Specified attempt does not match the active contest attempt.")

    if attempt_is_closed(attempt):
        return {
            "success": True,
            "contest_id": contest.id,
            "contest_slug": contest.slug,
            "attempt_id": attempt.id,
            "status": attempt.status,
            "already_finalized": True,
            "finalized_at": attempt.finalized_at.isoformat() if attempt.finalized_at else None,
            "score": attempt.final_score or 0,
            "total_score": attempt.final_score or 0,
            "message": "Contest attempt is already closed.",
        }

    now = now_utc()
    ends_at = attempt.ends_at
    if ends_at.tzinfo is None:
        ends_at = ends_at.replace(tzinfo=timezone.utc)
    is_expired = contest.status == "finished" or now >= ends_at

    score_result = await db.execute(
        select(ScoreboardEntry).where(
            ScoreboardEntry.contest_id == contest.id,
            ScoreboardEntry.member_id == member.id,
        )
    )
    scoreboard = score_result.scalars().first()
    attempt.final_score = scoreboard.score if scoreboard else 0
    attempt.status = "expired" if is_expired else "finalized"
    attempt.finalized_at = now
    await db.commit()

    logger.info(
        "Contest attempt finalized: contest_id=%s slug=%s attempt_id=%s member_id=%s score=%s status=%s",
        contest.id,
        contest.slug,
        attempt.id,
        member.id,
        attempt.final_score,
        attempt.status,
    )

    await delete_cache_pattern("cache:contest:*")
    await delete_cache_pattern("cache:scoreboard:*")
    try:
        from app.services.event_broadcaster import broadcast_event

        await broadcast_event(
            "contest_attempt_finalized",
            {
                "contest_id": contest.id,
                "contest_slug": contest.slug,
                "attempt_id": attempt.id,
                "member_id": member.id,
                "status": attempt.status,
                "final_score": attempt.final_score,
                "score": attempt.final_score,
                "finalized_at": attempt.finalized_at.isoformat(),
            },
            contest_slug=contest.slug,
        )
    except Exception:
        # Finalization has committed; realtime delivery must not change its result.
        pass

    return {
        "success": True,
        "contest_id": contest.id,
        "contest_slug": contest.slug,
        "attempt_id": attempt.id,
        "status": attempt.status,
        "already_finalized": False,
        "finalized_at": attempt.finalized_at.isoformat(),
        "score": attempt.final_score or 0,
        "total_score": attempt.final_score or 0,
        "message": "Contest attempt finalized." if not is_expired else "Contest attempt expired and was closed.",
    }

