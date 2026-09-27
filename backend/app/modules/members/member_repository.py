"""
Chaos Computer Club — Medi-Caps Chapter
modules/members/member_repository.py — Member Profile & Metrics Persistence Layer
"""

from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import func, select, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.db_models import (
    CampusPass,
    ContestProblem,
    ContestSubmission,
    MemberProfile,
    OfflineContest,
    RatingHistory,
    ScoreboardEntry,
    StudentFollow,
    now_utc,
)


class MemberRepository:
    """Encapsulates all database operations for student profiles, social graphs, and performance metrics."""

    @staticmethod
    async def get_by_id(db: AsyncSession, member_id: str) -> Optional[MemberProfile]:
        stmt = select(MemberProfile).where(MemberProfile.id == member_id)
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def get_by_handle(db: AsyncSession, handle: str) -> Optional[MemberProfile]:
        clean = handle.lstrip("@").strip().lower()
        stmt = select(MemberProfile).where(func.lower(MemberProfile.handle) == clean)
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def get_by_handle_or_id(db: AsyncSession, target: str) -> Optional[MemberProfile]:
        clean = target.lstrip("@").strip()
        stmt = select(MemberProfile).where(
            or_(func.lower(MemberProfile.handle) == clean.lower(), MemberProfile.id == clean)
        )
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def get_active_campus_pass(db: AsyncSession, member_id: str) -> Optional[CampusPass]:
        stmt = (
            select(CampusPass)
            .where(CampusPass.member_id == member_id)
            .order_by(CampusPass.issued_at.desc())
        )
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def get_social_counts(db: AsyncSession, member_id: str) -> Tuple[int, int]:
        followers_count = await db.scalar(
            select(func.count(StudentFollow.id)).where(StudentFollow.following_id == member_id)
        ) or 0
        following_count = await db.scalar(
            select(func.count(StudentFollow.id)).where(StudentFollow.follower_id == member_id)
        ) or 0
        return followers_count, following_count

    @staticmethod
    async def get_attendance_and_contest_counts(db: AsyncSession, member_id: str) -> Tuple[int, int]:
        total_contests = await db.scalar(
            select(func.count(OfflineContest.id)).where(OfflineContest.status.in_(["finished", "live"]))
        ) or 1
        attended = await db.scalar(
            select(func.count(ScoreboardEntry.id)).where(ScoreboardEntry.member_id == member_id)
        ) or 0
        return attended, total_contests

    @staticmethod
    async def compute_ranks(db: AsyncSession, member: MemberProfile) -> Tuple[int, int, int]:
        rank_filter = [
            MemberProfile.is_onboarded.is_(True),
            MemberProfile.handle.isnot(None),
            ~MemberProfile.email.like("qa.%"),
            ~MemberProfile.handle.like("qa_%"),
        ]
        all_members_count = await db.scalar(select(func.count(MemberProfile.id)).where(*rank_filter)) or 1

        univ_rank = 1
        dept_rank = 1
        rating = member.rating or 1200

        higher_univ = await db.scalar(
            select(func.count(MemberProfile.id)).where(
                *rank_filter,
                MemberProfile.rating > rating,
            )
        )
        univ_rank = (higher_univ or 0) + 1

        if member.department:
            higher_dept = await db.scalar(
                select(func.count(MemberProfile.id)).where(
                    *rank_filter,
                    MemberProfile.department == member.department,
                    MemberProfile.rating > rating,
                )
            )
            dept_rank = (higher_dept or 0) + 1

        return univ_rank, dept_rank, all_members_count

    @staticmethod
    async def get_rating_history(db: AsyncSession, member_id: str) -> List[RatingHistory]:
        stmt = (
            select(RatingHistory)
            .where(RatingHistory.member_id == member_id)
            .order_by(RatingHistory.contested_at.asc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_participations(db: AsyncSession, member_id: str) -> List[Dict[str, Any]]:
        stmt = (
            select(ScoreboardEntry)
            .options(selectinload(ScoreboardEntry.contest))
            .where(ScoreboardEntry.member_id == member_id)
        )
        result = await db.execute(stmt)
        entries = result.scalars().all()
        participations = []
        for e in entries:
            contest = e.contest
            if contest:
                participations.append({
                    "contest_slug": contest.slug,
                    "contest_title": contest.title,
                    "starts_at": contest.starts_at.isoformat() if contest.starts_at else None,
                    "rank": e.rank,
                    "score": e.score,
                    "division": e.division,
                    "penalty_seconds": e.penalty_seconds,
                })
        # Sort descending by starts_at
        participations.sort(key=lambda x: x["starts_at"] or "", reverse=True)
        return participations

    @staticmethod
    async def save(db: AsyncSession, member: MemberProfile) -> MemberProfile:
        member.updated_at = now_utc()
        await db.commit()
        await db.refresh(member)
        return member

    @staticmethod
    async def delete(db: AsyncSession, member: MemberProfile) -> None:
        await db.delete(member)
        await db.commit()
