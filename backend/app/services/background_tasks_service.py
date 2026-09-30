"""
Chaos Computer Club -- Production Background Tasks Service

Five recurring background coroutines run with distributed locking protection:

  1. Session Expiry Sweeper (every 60s)
     Finds AssessmentSession rows whose 120-minute clock expired but are
     still "in_progress". Marks them "submitted" and flushes ranking cache.
     Protected by Redis distributed lock.

  2. Auto-Qualify Top 30 (every 2 min, fires once after window closes)
     After the Round 1 entry window closes, sets is_top_30_qualified=True on
     the Top-30 sessions and ContestRegistration rows so the live final gate
     works without organiser intervention.

  3. Auto-Start Upcoming Contests (every 30s)
     Transitions UPCOMING contests to 'live' when starts_at arrives.
     Protected by Redis distributed lock.

  4. Auto-Finish Live Contests (every 60s)
     Watches LIVE contests whose ends_at has passed. Transitions them to
     'finished' and enqueues 'FINALIZE_CONTEST_RATINGS' to the contest_lifecycle
     queue for non-blocking asynchronous rating delta processing.

  5. Transactional Outbox Relay (every 5s)
     Dispatches pending PostgreSQL outbox events into Redis with at-least-once delivery.

All tasks are idempotent and cluster-safe across multiple ASGI workers.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.contest_lifecycle import ContestLifecycleState, set_lifecycle_state
from app.core.queue.lock import distributed_lock
from app.core.queue.redis_queue import RedisQueueEngine
from app.core.queue.outbox import relay_outbox_events

logger = logging.getLogger("ccc.background")

_auto_qualify_done: set[str] = set()
_auto_finish_done: set[str] = set()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ─── Task 1: Session Expiry Sweeper ──────────────────────────────────────────

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
                # Allow a 24-hour grace period for candidates to review summary console and submit explicitly
                if _utcnow() > (deadline + timedelta(hours=24)):
                    s.status = "submitted"
                    s.submitted_at = s.submitted_at or deadline
                    logger.info(
                        "sweeper: finalizing abandoned session %s (member=%s, deadline=%s)",
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
        try:
            async with distributed_lock("scheduler:session_sweeper", ttl_seconds=50) as acquired:
                if acquired:
                    await _sweep_expired_sessions(session_factory)
        except Exception as exc:
            logger.debug("session expiry sweeper loop notice: %s", exc)


# ─── Task 2: Auto-Qualify Top 30 ─────────────────────────────────────────────

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
        try:
            async with distributed_lock("scheduler:auto_qualify", ttl_seconds=100) as acquired:
                if acquired:
                    await _auto_qualify_top30(session_factory)
        except Exception as exc:
            logger.debug("auto-qualify loop notice: %s", exc)


# ─── Task 3: Auto-Finish Live Contests ───────────────────────────────────────

async def _auto_finish_contests(session_factory: async_sessionmaker) -> None:
    """
    Transitions LIVE contests to 'finished' when ends_at has passed.
    Enqueues 'FINALIZE_CONTEST_RATINGS' to the contest_lifecycle queue
    for asynchronous rating delta computation and scoreboard finalization.
    """
    from app.models.db_models import OfflineContest
    from app.services.dynamic_contest_service import DynamicContestService

    now = _utcnow()

    async with session_factory() as db:
        try:
            live_res = await db.execute(
                select(OfflineContest).where(OfflineContest.status == "live")
            )
            live_contests = live_res.scalars().all()

            for contest in live_contests:
                slug = contest.slug
                if slug in _auto_finish_done:
                    continue

                ends_at = contest.ends_at
                if ends_at is None:
                    continue
                if ends_at.tzinfo is None:
                    ends_at = ends_at.replace(tzinfo=timezone.utc)

                if now < ends_at:
                    continue  # Contest still running

                logger.info("auto-finish: '%s' ended at %s — transitioning to finished", slug, ends_at.isoformat())

                # 1. Mark as finished in database and set lifecycle to DRAINING
                contest.status = "finished"
                await db.commit()
                _auto_finish_done.add(slug)

                # Real-time state gate: submissions reject immediately while queue drains
                await set_lifecycle_state(slug, ContestLifecycleState.DRAINING)

                await DynamicContestService._invalidate_contest_caches(include_rating_caches=True)

                # 2. Enqueue asynchronous rating calculation & scoreboard finalization job
                await RedisQueueEngine.enqueue(
                    queue_name="contest_lifecycle",
                    job_type="FINALIZE_CONTEST_RATINGS",
                    payload={"contest_slug": slug},
                    idempotency_key=f"finalize:{slug}",
                )

                logger.info("auto-finish: '%s' marked finished; rating finalization job enqueued", slug)

        except Exception as exc:
            logger.exception("auto-finish error: %s", exc)
            await db.rollback()


async def auto_finish_loop(session_factory: async_sessionmaker, interval: int = 60) -> None:
    logger.info("auto-finish contest loop started (interval=%ds)", interval)
    while True:
        await asyncio.sleep(interval)
        try:
            async with distributed_lock("scheduler:auto_finish", ttl_seconds=50) as acquired:
                if acquired:
                    await _auto_finish_contests(session_factory)
        except Exception as exc:
            logger.debug("auto-finish loop notice: %s", exc)


# ─── Task 4: Auto-Start Upcoming Contests ────────────────────────────────────

async def _auto_start_contests(session_factory: async_sessionmaker) -> None:
    from app.models.db_models import OfflineContest
    from app.services.event_broadcaster import broadcast_event
    from app.services.dynamic_contest_service import DynamicContestService

    now = _utcnow()

    async with session_factory() as db:
        try:
            upcoming_res = await db.execute(
                select(OfflineContest).where(OfflineContest.status == "upcoming")
            )
            upcoming_contests = upcoming_res.scalars().all()

            for contest in upcoming_contests:
                slug = contest.slug
                starts_at = contest.starts_at
                if starts_at is None:
                    continue
                if starts_at.tzinfo is None:
                    starts_at = starts_at.replace(tzinfo=timezone.utc)

                if now < starts_at:
                    # Warmup window: mark PRE_CONTEST within 30 minutes of start
                    if 0 < (starts_at - now).total_seconds() <= 1800:
                        await set_lifecycle_state(slug, ContestLifecycleState.PRE_CONTEST)
                    continue  # Not yet time to start

                logger.info(
                    "auto-start: '%s' starts_at=%s — transitioning to live",
                    slug, starts_at.isoformat(),
                )

                contest.status = "live"
                await db.commit()

                # Mark CONTEST_ACTIVE in Redis lifecycle state
                await set_lifecycle_state(slug, ContestLifecycleState.CONTEST_ACTIVE)

                await DynamicContestService._invalidate_contest_caches()

                try:
                    await broadcast_event(
                        "contest_status_changed",
                        {
                            "contest_slug": slug,
                            "contest_title": contest.title,
                            "old_status": "upcoming",
                            "new_status": "live",
                            "starts_at": contest.starts_at.isoformat() if contest.starts_at else None,
                            "ends_at": contest.ends_at.isoformat() if contest.ends_at else None,
                            "change": "status_changed",
                        },
                        contest_slug=slug,
                    )
                except Exception:
                    pass

                logger.info("auto-start: '%s' → live", slug)

        except Exception as exc:
            logger.exception("auto-start error: %s", exc)
            await db.rollback()


async def auto_start_loop(session_factory: async_sessionmaker, interval: int = 30) -> None:
    logger.info("auto-start contest loop started (interval=%ds)", interval)
    while True:
        await asyncio.sleep(interval)
        try:
            async with distributed_lock("scheduler:auto_start", ttl_seconds=25) as acquired:
                if acquired:
                    await _auto_start_contests(session_factory)
        except Exception as exc:
            logger.debug("auto-start loop notice: %s", exc)


# ─── Task 5: Transactional Outbox Relay ───────────────────────────────────────

async def outbox_relay_loop(session_factory: async_sessionmaker, interval: int = 5) -> None:
    logger.info("outbox relay loop started (interval=%ds)", interval)
    while True:
        await asyncio.sleep(interval)
        try:
            async with distributed_lock("scheduler:outbox_relay", ttl_seconds=10) as acquired:
                if acquired:
                    async with session_factory() as db:
                        await relay_outbox_events(db)
        except Exception as exc:
            logger.debug("outbox relay loop notice: %s", exc)


# ─── Entry Point ─────────────────────────────────────────────────────────────

def start_background_tasks(session_factory: async_sessionmaker) -> list[asyncio.Task]:
    """
    Spawn all five production background tasks with distributed locking protection.
    Returns task handles for clean cancellation in the lifespan shutdown hook.
    """
    loop = asyncio.get_running_loop()
    tasks = [
        loop.create_task(
            session_expiry_loop(session_factory, interval=60),
            name="ccc.session_expiry_sweeper",
        ),
        loop.create_task(
            auto_qualify_loop(session_factory, interval=120),
            name="ccc.auto_qualify_top30",
        ),
        loop.create_task(
            auto_start_loop(session_factory, interval=30),
            name="ccc.auto_start_contest",
        ),
        loop.create_task(
            auto_finish_loop(session_factory, interval=60),
            name="ccc.auto_finish_contest",
        ),
        loop.create_task(
            outbox_relay_loop(session_factory, interval=5),
            name="ccc.outbox_relay_sweeper",
        ),
    ]
    logger.info(
        "Production background tasks started: %s", [t.get_name() for t in tasks]
    )
    return tasks
