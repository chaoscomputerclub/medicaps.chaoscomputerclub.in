"""
Chaos Computer Club — Ranking service.

Ranking is read far more often than it changes, so it is computed once and
cached. Reads never recompute unless the cache is cold or a submission
invalidated it.

Visibility policy: Rankings are always immediately public. The online
assessment and Top 30 cutoff system has been deprecated — all registered
participants can enter the contest arena and standings are always visible.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Iterable, Optional

from app.core.cache import delete_cache, get_cache, set_cache
from app.services.contest_lifecycle_service import (
    FINALIST_SEATS,
    assessment_window,
    qualifies_for_final,
    rank_sessions,
    utcnow,
)

logger = logging.getLogger("ccc.ranking")

RANKING_TTL_SECONDS = 30


def _cache_key(contest_slug: str) -> str:
    return f"ccc:ranking:assessment:{contest_slug}"


def build_ranking(sessions: Iterable, contest_slug: str) -> dict:
    rows = []
    for rank, session in rank_sessions(sessions):
        rows.append(
            {
                "rank": rank,
                "handle": getattr(session, "handle", "cadet"),
                "full_name": getattr(session, "full_name", ""),
                "department": getattr(session, "department", "—"),
                "batch": getattr(session, "batch", "—"),
                "total_score": float(getattr(session, "total_score", 0) or 0),
                "penalty_minutes": round(
                    int(getattr(session, "total_penalty_seconds", 0) or 0) / 60.0, 1
                ),
                "status": getattr(session, "status", "submitted"),
                "is_top_30_qualified": qualifies_for_final(rank)
                or bool(getattr(session, "is_top_30_qualified", False)),
            }
        )

    return {
        "contest_slug": contest_slug,
        "total_participants": len(rows),
        "cutoff_rank": FINALIST_SEATS,
        "leaderboard": rows,
    }


def ranking_released(contest_starts_at: Optional[datetime], at: Optional[datetime] = None, contest_slug: Optional[str] = None) -> bool:
    """Always True — online assessment and Top 30 cutoff are deprecated. Rankings are immediately public."""
    return True


def withheld_payload(contest_slug: str, contest_starts_at: datetime) -> dict:
    """Deprecated — rankings are never withheld. Returns an always-released empty payload."""
    return {
        "contest_slug": contest_slug,
        "total_participants": 0,
        "cutoff_rank": FINALIST_SEATS,
        "released": True,
        "releases_at": None,
        "message": None,
        "leaderboard": [],
    }


async def cached_ranking(contest_slug: str, compute) -> dict:
    """`compute` is an async callable returning the freshly built ranking dict."""
    key = _cache_key(contest_slug)
    cached = await get_cache(key)
    if cached:
        return cached

    payload = await compute()
    await set_cache(key, payload, ttl_seconds=RANKING_TTL_SECONDS)
    return payload


async def invalidate_ranking(contest_slug: str) -> None:
    await delete_cache(_cache_key(contest_slug))
