"""
Chaos Computer Club — Medi-Caps Chapter
modules/leaderboard/leaderboard_repository.py — Data Persistence Repository for Leaderboards & Scoreboards
"""

import logging
from typing import Any, Dict, List, Optional, Sequence, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import MemberProfile, OfflineContest, RatingHistory, ScoreboardEntry
from app.lib.chunking import chunked_in_query

logger = logging.getLogger(__name__)


class LeaderboardRepository:
    """Encapsulates SQL persistence and aggregation queries for university leaderboards and scoreboards."""

    @staticmethod
    async def get_university_leaderboard_members(
        db: AsyncSession,
        department: Optional[str] = None,
        batch: Optional[str] = None,
        tier: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[Sequence[MemberProfile], int]:
        from app.services.ranking_service import RankingService
        base_filters = RankingService.get_base_ranked_filter()
        stmt = select(MemberProfile).where(*base_filters)
        count_stmt = select(func.count(MemberProfile.id)).where(*base_filters)

        if department:
            stmt = stmt.where(MemberProfile.department == department)
            count_stmt = count_stmt.where(MemberProfile.department == department)
        if batch:
            stmt = stmt.where(MemberProfile.batch == batch)
            count_stmt = count_stmt.where(MemberProfile.batch == batch)

        if tier:
            if tier == "5_star":
                stmt = stmt.where(MemberProfile.rating >= 2000)
                count_stmt = count_stmt.where(MemberProfile.rating >= 2000)
            elif tier == "4_star":
                stmt = stmt.where((MemberProfile.rating >= 1800) & (MemberProfile.rating < 2000))
                count_stmt = count_stmt.where((MemberProfile.rating >= 1800) & (MemberProfile.rating < 2000))
            elif tier == "3_star":
                stmt = stmt.where((MemberProfile.rating >= 1600) & (MemberProfile.rating < 1800))
                count_stmt = count_stmt.where((MemberProfile.rating >= 1600) & (MemberProfile.rating < 1800))
            elif tier == "2_star":
                stmt = stmt.where((MemberProfile.rating >= 1400) & (MemberProfile.rating < 1600))
                count_stmt = count_stmt.where((MemberProfile.rating >= 1400) & (MemberProfile.rating < 1600))
            elif tier == "1_star":
                stmt = stmt.where(MemberProfile.rating < 1400)
                count_stmt = count_stmt.where(MemberProfile.rating < 1400)

        total_count = await db.scalar(count_stmt) or 0

        stmt = (
            stmt.order_by(
                MemberProfile.rating.desc(),
                MemberProfile.peak_rating.desc(),
                MemberProfile.attendance_count.desc(),
                MemberProfile.id.asc(),
            )
            .limit(limit)
            .offset(offset)
        )
        result = await db.execute(stmt)
        return result.scalars().all(), total_count

    @staticmethod
    async def get_page_ratings_and_attendance(
        db: AsyncSession,
        page_member_ids: Sequence[str],
    ) -> Tuple[Dict[str, List[int]], Dict[str, int], Dict[str, int], Dict[str, int]]:
        history_by_member: Dict[str, List[int]] = {}
        latest_rating_by_member: Dict[str, int] = {}
        peak_rating_by_member: Dict[str, int] = {}
        live_attendance_by_member: Dict[str, int] = {}

        if not page_member_ids:
            return history_by_member, latest_rating_by_member, peak_rating_by_member, live_attendance_by_member

        histories = await chunked_in_query(
            session=db,
            model=RatingHistory,
            column=RatingHistory.member_id,
            values=page_member_ids,
            chunk_size=100,
            order_by_col=RatingHistory.contested_at.desc(),
        )
        for h in histories:
            history_by_member.setdefault(h.member_id, []).append(h.new_rating - h.old_rating)
            if h.member_id not in latest_rating_by_member:
                latest_rating_by_member[h.member_id] = h.new_rating
            curr_peak = peak_rating_by_member.get(h.member_id, 1200)
            if h.new_rating > curr_peak:
                peak_rating_by_member[h.member_id] = h.new_rating

        sb_count_rows = await db.execute(
            select(ScoreboardEntry.member_id, func.count(ScoreboardEntry.id).label("cnt"))
            .where(ScoreboardEntry.member_id.in_(page_member_ids))
            .group_by(ScoreboardEntry.member_id)
        )
        for member_id, cnt in sb_count_rows.all():
            live_attendance_by_member[member_id] = cnt

        return history_by_member, latest_rating_by_member, peak_rating_by_member, live_attendance_by_member

    @staticmethod
    async def get_total_finished_contests(db: AsyncSession) -> int:
        return await db.scalar(
            select(func.count(OfflineContest.id)).where(OfflineContest.status.in_(["finished", "live"]))
        ) or 0

    @staticmethod
    async def get_all_active_ratings(db: AsyncSession) -> List[int]:
        from app.services.ranking_service import RankingService
        result = await db.execute(
            select(MemberProfile.rating).where(
                *RankingService.get_base_ranked_filter()
            )
        )
        return [r for (r,) in result.all() if r is not None]

    @staticmethod
    async def get_department_aggregates(db: AsyncSession) -> Sequence[Any]:
        from app.services.ranking_service import RankingService
        stmt = (
            select(
                MemberProfile.department,
                func.count(MemberProfile.id).label("total_members"),
                func.avg(MemberProfile.rating).label("avg_rating"),
                func.max(MemberProfile.rating).label("top_rating"),
            )
            .where(*RankingService.get_base_ranked_filter())
            .group_by(MemberProfile.department)
        )
        result = await db.execute(stmt)
        return result.all()

    @staticmethod
    async def get_contest_scoreboard_entries(
        db: AsyncSession,
        contest_id: str,
        division: Optional[str] = None,
        department: Optional[str] = None,
    ) -> Sequence[ScoreboardEntry]:
        stmt = select(ScoreboardEntry).where(ScoreboardEntry.contest_id == contest_id)
        if division and division != "all":
            stmt = stmt.where(ScoreboardEntry.division == division)
        if department:
            stmt = stmt.where(ScoreboardEntry.department == department)
        stmt = stmt.order_by(ScoreboardEntry.rank.asc())
        result = await db.execute(stmt)
        return result.scalars().all()
