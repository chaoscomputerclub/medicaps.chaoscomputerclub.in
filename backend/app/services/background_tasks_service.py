"""
Chaos Computer Club -- Production Background Tasks Service

Two recurring background coroutines run inside the same uvicorn process:

  1. Session Expiry Sweeper (every 60s)
     Finds AssessmentSession rows whose 120-minute clock expired but are
     still "in_progress". Marks them "submitted" and flushes ranking cache.
     Without this, a session only gets auto-closed on the user's next request.

  2. Auto-Qualify Top 30 (every 2 min, fires once after window closes)
     After the Round 1 entry window closes, sets is_top_30_qualified=True on
     the Top-30 sessions and ContestRegistration rows so the live final gate
     works without organiser intervention.

Both tasks are idempotent.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

logger = logging.getLogger("ccc.background")

_auto_qualify_done: set[str] = set()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _sweep_expired_sessions(session_factory: async_sessionmaker) -> None:
    from app.models.db_models import Assessment, AssessmentSession
    from app.services.contest_lifecycle_service import session_deadline
    from app.services.ranking_service import invalidate_ranking

    async with session_factory() as db:
        try:
            result = await db.execute(
                select(AssessmentSession).where(AssessmentSession.status == "in_progress")
            )
            sessions = result.scalars().all()
            expired_slugs: list[str] = []
            for s in sessions:
                deadline = session_deadline(s.started_at)
                if _utcnow() > deadline:
                    s.status = "submitted"
                    s.submitted_at = s.submitted_at or deadline
                    logger.info(
                        "sweeper: auto-submitting session %s (member=%s, expired=%s)",
                        s.id, s.member_id, deadline.isoformat(),
                    )
                    assess_res = await db.execute(
                        select(Assessment).where(Assessment.id == s.assessment_id)
                    )
                    assess = assess_res.scalars().first()
                    if assess and assess.slug not in expired_slugs:
                        expired_slugs.append(assess.slug)

            if expired_slugs:
                await db.commit()
                for slug in expired_slugs:
                    await invalidate_ranking(slug)
                logger.info("sweeper: expired %d session(s)", len(expired_slugs))

        except Exception as exc:
            logger.exception("sweeper error: %s", exc)
            await db.rollback()


async def session_expiry_loop(session_factory: async_sessionmaker, interval: int = 60) -> None:
    logger.info("session expiry sweeper started (interval=%ds)", interval)
    while True:
        await asyncio.sleep(interval)
        await _sweep_expired_sessions(session_factory)


async def _auto_qualify_top30(session_factory: async_sessionmaker) -> None:
    from app.models.db_models import (
        Assessment, AssessmentSession, OfflineContest,
    )
    from app.services.contest_lifecycle_service import FINALIST_SEATS, rank_sessions
    from app.services.ranking_service import invalidate_ranking, ranking_released

    async with session_factory() as db:
        try:
            contests_res = await db.execute(
                select(OfflineContest).where(OfflineContest.status == "upcoming")
            )
            contests = contests_res.scalars().all()

            for contest in contests:
                slug = contest.slug
                if slug in _auto_qualify_done:
                    continue
                if not contest.starts_at:
                    continue
                if not ranking_released(contest.starts_at):
                    continue

                assess_res = await db.execute(
                    select(Assessment).where(Assessment.contest_id == contest.id)
                )
                assessment = assess_res.scalars().first()
                if not assessment:
                    continue

                sessions_res = await db.execute(
                    select(AssessmentSession).where(
                        AssessmentSession.assessment_id == assessment.id,
                        AssessmentSession.status != "disqualified",
                    )
                )
                all_sessions = sessions_res.scalars().all()
                if not all_sessions:
                    _auto_qualify_done.add(slug)
                    continue

                ranked = rank_sessions(all_sessions)
                qualified_member_ids: set[str] = set()

                for rank, session in ranked:
                    if rank <= FINALIST_SEATS:
                        session.is_top_30_qualified = True
                        qualified_member_ids.add(session.member_id)
                        logger.info(
                            "auto-qualify: rank %d session=%s member=%s",
                            rank, session.id, session.member_id,
                        )
                    else:
                        session.is_top_30_qualified = False

                # ContestRegistration has no is_top_30_qualified column.
                # The registration-status endpoint reads the flag directly from
                # AssessmentSession.is_top_30_qualified, so no mirror is needed.

                await db.commit()
                await invalidate_ranking(slug)
                _auto_qualify_done.add(slug)
                logger.info(
                    "auto-qualify: '%s' done — %d qualifier(s)", slug, len(qualified_member_ids)
                )

        except Exception as exc:
            logger.exception("auto-qualify error: %s", exc)
            await db.rollback()


async def auto_qualify_loop(session_factory: async_sessionmaker, interval: int = 120) -> None:
    logger.info("auto-qualify loop started (interval=%ds)", interval)
    while True:
        await asyncio.sleep(interval)
        await _auto_qualify_top30(session_factory)


def start_background_tasks(session_factory: async_sessionmaker) -> list[asyncio.Task]:
    """
    Spawn production background tasks. Returns task handles for clean
    cancellation in the lifespan shutdown hook.
    """
    loop = asyncio.get_event_loop()
    tasks = [
        loop.create_task(
            session_expiry_loop(session_factory, interval=60),
            name="ccc.session_expiry_sweeper",
        ),
        loop.create_task(
            auto_qualify_loop(session_factory, interval=120),
            name="ccc.auto_qualify_top30",
        ),
    ]
    logger.info(
        "Production background tasks started: %s", [t.get_name() for t in tasks]
    )
    return tasks
