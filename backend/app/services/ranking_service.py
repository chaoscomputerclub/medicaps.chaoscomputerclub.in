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


# ─── Authoritative Platform Ranking Domain Service ─────────────────────────

from dataclasses import dataclass
from typing import Tuple
from sqlalchemy import func, select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.member import MemberProfile


@dataclass(frozen=True)
class MemberRankResult:
    university_rank: Optional[int]
    department_rank: Optional[int]
    active_ranked_count: int
    percentile: Optional[float]
    top_percentage: Optional[float]
    standing: str
    is_ranked: bool
    season: str = "2024-2025"
    scope: str = "university"


class RankingService:
    """
    Canonical Domain Service for Medi-Caps University Cadet Rankings.
    Single source of truth for:
      - Eligibility Gating: Cadets with 0 contest attendance are UNRANKED (rank = None, percentile = None, standing = "Unranked").
      - Strict Deterministic Tie-Breaking (Ordinal Model C): rating DESC, peak_rating DESC, id ASC.
      - Mathematical Identity: Leaderboard row rank == Profile rank == Dashboard rank.
      - Standing Percent: rank / active_ranked_count * 100 (Top X%).
      - Percentile: (active_ranked_count - rank) / active_ranked_count * 100 (strictly below).
    """

    @staticmethod
    def get_base_ranked_filter():
        """Standard filter defining officially ranked cadet population in university leaderboard."""
        return [
            MemberProfile.is_onboarded.is_(True),
            MemberProfile.handle.isnot(None),
            MemberProfile.attendance_count > 0,
            ~MemberProfile.email.like("qa.%"),
            ~MemberProfile.handle.like("qa_%"),
            ~MemberProfile.email.like("loadtest_%"),
            ~MemberProfile.handle.like("lt_%"),
        ]

    @staticmethod
    async def get_total_ranked_members(db: AsyncSession) -> int:
        """Count total officially ranked cadets across the university."""
        res = await db.scalar(
            select(func.count(MemberProfile.id)).where(*RankingService.get_base_ranked_filter())
        )
        return res or 0

    @staticmethod
    async def get_member_ranks(
        db: AsyncSession,
        member: MemberProfile,
    ) -> MemberRankResult:
        """
        Calculates authoritative university and department ranks for a member.
        Enforces strict participation gating: members with attendance_count == 0
        are designated as Unranked with rank = None, percentile = None, and standing = 'Unranked'.
        Deterministic tie-breaker hierarchy: rating DESC, peak_rating DESC, attendance_count DESC, id ASC.
        """
        active_count = await RankingService.get_total_ranked_members(db)

        # Strict Participation Gating (TRD Section 11 & PRD Core Specification)
        attendance = member.attendance_count or 0
        if attendance <= 0 or not member.is_onboarded or not member.handle:
            return MemberRankResult(
                university_rank=None,
                department_rank=None,
                active_ranked_count=active_count,
                percentile=None,
                top_percentage=None,
                standing="Unranked",
                is_ranked=False,
            )

        rating = member.rating if member.rating is not None else 1200
        peak = member.peak_rating if member.peak_rating is not None else rating
        mid = member.id

        # Deterministic multi-column tie-breaker condition (Ordinal Model C):
        # 1. Higher rating beats
        # 2. Equal rating, higher peak beats
        # 3. Equal rating & peak, higher contest attendance beats
        # 4. All equal, lexicographically smaller ID beats
        beats_condition = or_(
            MemberProfile.rating > rating,
            and_(
                MemberProfile.rating == rating,
                MemberProfile.peak_rating > peak,
            ),
            and_(
                MemberProfile.rating == rating,
                MemberProfile.peak_rating == peak,
                MemberProfile.attendance_count > attendance,
            ),
            and_(
                MemberProfile.rating == rating,
                MemberProfile.peak_rating == peak,
                MemberProfile.attendance_count == attendance,
                MemberProfile.id < mid,
            ),
        )

        base_filter = RankingService.get_base_ranked_filter()

        # University-wide rank
        univ_higher = await db.scalar(
            select(func.count(MemberProfile.id)).where(*base_filter, beats_condition)
        )
        univ_rank = (univ_higher or 0) + 1

        # Department rank
        dept_rank = None
        if member.department:
            dept_higher = await db.scalar(
                select(func.count(MemberProfile.id)).where(
                    *base_filter,
                    MemberProfile.department == member.department,
                    beats_condition,
                )
            )
            dept_rank = (dept_higher or 0) + 1

        # Canonical Standing and Percentile Definitions:
        pop_size = max(1, active_count)
        standing_pct = round((univ_rank / pop_size) * 100, 1)
        standing_str = "Top 1%" if standing_pct <= 1.0 else f"Top {standing_pct}%"
        users_below = max(0, active_count - univ_rank)
        percentile = round((users_below / pop_size) * 100, 1)

        return MemberRankResult(
            university_rank=univ_rank,
            department_rank=dept_rank,
            active_ranked_count=active_count,
            percentile=percentile,
            top_percentage=standing_pct,
            standing=standing_str,
            is_ranked=True,
        )

    @staticmethod
    def calculate_ordinal_ranks(members: list[MemberProfile]) -> list[MemberRankResult]:
        """
        Pure deterministic ranking function for any cohort of members.
        Enforces identical ordinal tie-breaking: rating DESC, peak_rating DESC, attendance_count DESC, id ASC.
        """
        eligible = [
            m for m in members
            if getattr(m, "is_onboarded", True)
            and getattr(m, "handle", None)
            and (getattr(m, "attendance_count", 0) or 0) > 0
            and not (getattr(m, "email", "") or "").startswith("qa.")
            and not (getattr(m, "handle", "") or "").startswith("qa_")
            and not (getattr(m, "email", "") or "").startswith("loadtest_")
            and not (getattr(m, "handle", "") or "").startswith("lt_")
        ]

        eligible.sort(
            key=lambda m: (
                -(m.rating if m.rating is not None else 1200),
                -(m.peak_rating if m.peak_rating is not None else (m.rating if m.rating is not None else 1200)),
                -(m.attendance_count if m.attendance_count is not None else 0),
                str(m.id),
            )
        )

        n = len(eligible)
        results = {}
        for rank_0, m in enumerate(eligible):
            rank = rank_0 + 1
            pop_size = max(1, n)
            standing_pct = round((rank / pop_size) * 100, 1)
            standing_str = "Top 1%" if standing_pct <= 1.0 else f"Top {standing_pct}%"
            users_below = max(0, n - rank)
            percentile = round((users_below / pop_size) * 100, 1)
            results[m.id] = MemberRankResult(
                university_rank=rank,
                department_rank=None,
                active_ranked_count=n,
                percentile=percentile,
                top_percentage=standing_pct,
                standing=standing_str,
                is_ranked=True,
            )

        final_list = []
        for m in members:
            if m.id in results:
                final_list.append(results[m.id])
            else:
                final_list.append(
                    MemberRankResult(
                        university_rank=None,
                        department_rank=None,
                        active_ranked_count=n,
                        percentile=None,
                        top_percentage=None,
                        standing="Unranked",
                        is_ranked=False,
                    )
                )
        return final_list

