"""
Chaos Computer Club -- Production Background Tasks Service

Three recurring background coroutines run inside the same uvicorn process:

  1. Session Expiry Sweeper (every 60s)
     Finds AssessmentSession rows whose 120-minute clock expired but are
     still "in_progress". Marks them "submitted" and flushes ranking cache.
     Without this, a session only gets auto-closed on the user's next request.

  2. Auto-Qualify Top 30 (every 2 min, fires once after window closes)
     After the Round 1 entry window closes, sets is_top_30_qualified=True on
     the Top-30 sessions and ContestRegistration rows so the live final gate
     works without organiser intervention.

  3. Auto-Finish Contest (every 60s)
     Watches LIVE contests whose ends_at has passed. Transitions them to
     "finished", re-ranks the ScoreboardEntry table, computes ELO-style
     rating deltas, and applies them to MemberProfile.rating + RatingHistory.

All tasks are idempotent.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

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
        await _auto_qualify_top30(session_factory)


# ─── Task 3: Auto-Finish Live Contests ───────────────────────────────────────

async def _auto_finish_contests(session_factory: async_sessionmaker) -> None:
    """
    Transitions LIVE contests to 'finished' when ends_at has passed.
    Then:
      - Re-ranks ScoreboardEntry rows for this contest.
      - Computes ELO-style rating deltas via rating_service.
      - Applies deltas to MemberProfile.rating and MemberProfile.peak_rating.
      - Writes a RatingHistory entry per participant.
    Idempotent: each contest slug is only processed once per process lifetime.
    """
    from app.models.db_models import (
        MemberProfile, OfflineContest, RatingHistory, ScoreboardEntry,
    )
    from app.services.rating_service import calculate_rating_deltas
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

                # Ensure ends_at is timezone-aware before comparing
                ends_at = contest.ends_at
                if ends_at is None:
                    continue
                if ends_at.tzinfo is None:
                    ends_at = ends_at.replace(tzinfo=timezone.utc)

                if now < ends_at:
                    continue  # Contest still running

                logger.info("auto-finish: '%s' ended at %s — transitioning to finished", slug, ends_at.isoformat())

                # 1. Mark as finished
                contest.status = "finished"

                # 2. Fetch all scoreboard entries, re-rank by score DESC, then penalty ASC
                sb_res = await db.execute(
                    select(ScoreboardEntry)
                    .where(ScoreboardEntry.contest_id == contest.id)
                    .order_by(
                        ScoreboardEntry.score.desc(),
                        ScoreboardEntry.penalty_seconds.asc(),
                    )
                )
                entries = sb_res.scalars().all()

                if not entries:
                    await db.commit()
                    _auto_finish_done.add(slug)
                    await DynamicContestService._invalidate_contest_caches(include_rating_caches=True)
                    try:
                        from app.services.event_broadcaster import broadcast_event as _broadcast
                        finish_payload = {
                            "contest_slug": slug,
                            "contest_title": contest.title,
                            "old_status": "live",
                            "new_status": "finished",
                            "status": "finished",
                            "starts_at": contest.starts_at.isoformat() if contest.starts_at else None,
                            "ends_at": contest.ends_at.isoformat() if contest.ends_at else None,
                            "change": "concluded",
                        }
                        await _broadcast("contest_status_changed", finish_payload, contest_slug=slug)
                        await _broadcast("contest_concluded", finish_payload, contest_slug=slug)
                        await _broadcast("contest_concluded", finish_payload, contest_slug=None)
                    except Exception:
                        pass
                    logger.info("auto-finish: '%s' → finished (no scoreboard entries)", slug)
                    continue

                # Re-assign ranks
                for new_rank, entry in enumerate(entries, start=1):
                    entry.rank = new_rank

                # 3. Build standings list for rating calculator
                standings = []
                for entry in entries:
                    member_res = await db.execute(
                        select(MemberProfile).where(MemberProfile.id == entry.member_id)
                    )
                    member = member_res.scalars().first()
                    if member:
                        standings.append({
                            "rank": entry.rank,
                            "handle": entry.handle,
                            "member_id": entry.member_id,
                            "rating": member.rating if member.rating is not None else 1200,
                        })

                # 4. Compute rating deltas
                deltas = calculate_rating_deltas(standings)  # [(handle, delta, new_rating), ...]
                delta_map: dict[str, tuple[int, int]] = {
                    handle: (delta, new_rating) for handle, delta, new_rating in deltas
                }

                # 5. Apply deltas to members + write RatingHistory + update ScoreboardEntry
                for entry in entries:
                    handle = entry.handle
                    if handle not in delta_map:
                        continue
                    delta, new_rating = delta_map[handle]
                    entry.rating_delta = delta

                    member_res = await db.execute(
                        select(MemberProfile).where(MemberProfile.id == entry.member_id)
                    )
                    member = member_res.scalars().first()
                    if not member:
                        continue

                    old_rating = member.rating if member.rating is not None else 1200
                    member.rating = new_rating
                    if member.peak_rating is None or new_rating > member.peak_rating:
                        member.peak_rating = new_rating

                    # Write RatingHistory ledger entry
                    history = RatingHistory(
                        member_id=member.id,
                        contest_id=contest.id,
                        contest_title=contest.title,
                        contested_at=ends_at,
                        old_rating=old_rating,
                        new_rating=new_rating,
                        rank=entry.rank,
                    )
                    db.add(history)
                    logger.info(
                        "rating: %s rank=%d %d→%d (Δ%+d)",
                        handle, entry.rank, old_rating, new_rating, delta,
                    )

                await db.commit()
                _auto_finish_done.add(slug)

                await DynamicContestService._invalidate_contest_caches(include_rating_caches=True)

                # Broadcast SSE so connected frontends move contest to history
                try:
                    from app.services.event_broadcaster import broadcast_event as _broadcast
                    finish_payload = {
                        "contest_slug": slug,
                        "contest_title": contest.title,
                        "old_status": "live",
                        "new_status": "finished",
                        "status": "finished",
                        "starts_at": contest.starts_at.isoformat() if contest.starts_at else None,
                        "ends_at": contest.ends_at.isoformat() if contest.ends_at else None,
                        "change": "concluded",
                    }
                    await _broadcast("contest_status_changed", finish_payload, contest_slug=slug)
                    await _broadcast("contest_concluded", finish_payload, contest_slug=slug)
                    await _broadcast("contest_concluded", finish_payload, contest_slug=None)
                except Exception:
                    pass

                logger.info(
                    "auto-finish: '%s' done — %d participants rated", slug, len(entries)
                )

        except Exception as exc:
            logger.exception("auto-finish error: %s", exc)
            await db.rollback()


async def auto_start_loop(session_factory: async_sessionmaker, interval: int = 30) -> None:
    logger.info("auto-start contest loop started (interval=%ds)", interval)
    while True:
        await asyncio.sleep(interval)
        await _auto_start_contests(session_factory)


# ─── Task 4: Auto-Start Upcoming Contests ────────────────────────────────────

async def _auto_start_contests(session_factory: async_sessionmaker) -> None:
    """
    Transitions UPCOMING contests to 'live' when starts_at has arrived.
    This is the LeetCode-style auto-start: no admin action required.
    Broadcasts 'contest_status_changed' SSE so frontend reacts in real-time.
    Idempotent: each contest slug is only processed once per process lifetime.
    """
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
                    continue  # Not yet time to start

                logger.info(
                    "auto-start: '%s' starts_at=%s — transitioning to live",
                    slug, starts_at.isoformat(),
                )

                contest.status = "live"
                await db.commit()

                await DynamicContestService._invalidate_contest_caches()

                # Broadcast SSE so connected frontends update without polling
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


async def auto_finish_loop(session_factory: async_sessionmaker, interval: int = 60) -> None:
    logger.info("auto-finish contest loop started (interval=%ds)", interval)
    while True:
        await asyncio.sleep(interval)
        await _auto_finish_contests(session_factory)


# ─── Entry Point ─────────────────────────────────────────────────────────────

def start_background_tasks(session_factory: async_sessionmaker) -> list[asyncio.Task]:
    """
    Spawn all four production background tasks.
    Returns task handles for clean cancellation in the lifespan shutdown hook.

    Task schedule:
      1. session_expiry_sweeper  — every 60s  (auto-submit expired assessment sessions)
      2. auto_qualify_top30      — every 120s (qualify top-30 after Round 1 window closes)
      3. auto_start_contest      — every 30s  (upcoming → live at starts_at)
      4. auto_finish_contest     — every 60s  (live → finished at ends_at, ELO rating)
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
        loop.create_task(
            auto_start_loop(session_factory, interval=30),
            name="ccc.auto_start_contest",
        ),
        loop.create_task(
            auto_finish_loop(session_factory, interval=60),
            name="ccc.auto_finish_contest",
        ),
    ]
    logger.info(
        "Production background tasks started: %s", [t.get_name() for t in tasks]
    )
    return tasks
