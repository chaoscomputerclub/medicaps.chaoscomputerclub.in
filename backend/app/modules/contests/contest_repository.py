"""
Chaos Computer Club — Medi-Caps Chapter
modules/contests/contest_repository.py — Data Persistence & Query Repository for Contests
"""

import logging
from typing import Any, Dict, List, Optional, Sequence, Tuple
from sqlalchemy import delete, desc, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.db_models import (
    Assessment,
    AssessmentSession,
    CampusPass,
    ContestProblem,
    ContestRegistration,
    ContestSubmission,
    MemberProfile,
    OfflineContest,
    ScoreboardEntry,
    now_utc,
)

logger = logging.getLogger(__name__)


class ContestRepository:
    """Encapsulates all SQL persistence and data querying for the Contests domain."""

    @staticmethod
    async def get_by_slug(
        db: AsyncSession,
        slug: str,
        with_problems: bool = False,
        with_assessment: bool = False,
    ) -> Optional[OfflineContest]:
        raw_slug = slug.strip()
        slug_norm = raw_slug.lower().replace(" ", "-")
        slug_title = raw_slug.lower().replace("-", " ")
        stmt = select(OfflineContest).where(
            or_(
                OfflineContest.slug == raw_slug,
                OfflineContest.slug == slug_norm,
                func.lower(OfflineContest.title) == raw_slug.lower(),
                func.lower(OfflineContest.title) == slug_title,
                OfflineContest.slug.ilike(slug_norm),
            )
        )
        if with_problems:
            stmt = stmt.options(selectinload(OfflineContest.problems))
        if with_assessment:
            stmt = stmt.options(selectinload(OfflineContest.assessment))
        res = await db.execute(stmt)
        return res.scalars().first()

    @staticmethod
    async def get_by_id(db: AsyncSession, contest_id: str) -> Optional[OfflineContest]:
        return await db.get(OfflineContest, contest_id)

    @staticmethod
    async def list_contests(
        db: AsyncSession,
        status: Optional[str] = None,
        division: Optional[str] = None,
    ) -> Sequence[OfflineContest]:
        stmt = (
            select(OfflineContest)
            .options(
                selectinload(OfflineContest.problems),
                selectinload(OfflineContest.assessment),
            )
            .order_by(OfflineContest.starts_at.desc())
        )
        if status:
            stmt = stmt.where(OfflineContest.status == status)
        if division:
            stmt = stmt.where(OfflineContest.division == division)
        res = await db.execute(stmt)
        return res.scalars().all()

    @staticmethod
    async def list_admin_contests(
        db: AsyncSession,
        limit: Optional[int] = None,
        offset: Optional[int] = 0,
    ) -> Tuple[Sequence[OfflineContest], int]:
        total_count = await db.scalar(select(func.count(OfflineContest.id))) or 0
        stmt = (
            select(OfflineContest)
            .options(
                selectinload(OfflineContest.problems),
                selectinload(OfflineContest.assessment),
            )
            .order_by(OfflineContest.starts_at.desc())
        )
        if limit is not None:
            stmt = stmt.limit(limit).offset(offset or 0)
        res = await db.execute(stmt)
        return res.scalars().all(), total_count

    @staticmethod
    async def get_user_registrations_and_submissions(
        db: AsyncSession,
        member_id: str,
    ) -> Tuple[set, set]:
        registered_contest_ids = set()
        submitted_contest_ids = set()

        user_regs = await db.execute(
            select(
                ContestRegistration.contest_id,
                ContestRegistration.status,
                ContestRegistration.assessment_taken,
            ).where(ContestRegistration.member_id == member_id)
        )
        for cid, r_stat, a_taken in user_regs.all():
            registered_contest_ids.add(cid)
            if r_stat in ("submitted", "completed") or a_taken:
                submitted_contest_ids.add(cid)

        sess_stmt = (
            select(Assessment.contest_id)
            .join(AssessmentSession, AssessmentSession.assessment_id == Assessment.id)
            .where(
                AssessmentSession.member_id == member_id,
                AssessmentSession.status.in_(["submitted", "completed", "expired", "disqualified"]),
            )
        )
        sess_res = await db.execute(sess_stmt)
        for (cid,) in sess_res.all():
            if cid:
                submitted_contest_ids.add(cid)

        return registered_contest_ids, submitted_contest_ids

    @staticmethod
    async def get_registration(
        db: AsyncSession,
        contest_id: str,
        member_id: str,
    ) -> Optional[ContestRegistration]:
        stmt = select(ContestRegistration).where(
            ContestRegistration.contest_id == contest_id,
            ContestRegistration.member_id == member_id,
        )
        res = await db.execute(stmt)
        return res.scalars().first()

    @staticmethod
    async def get_my_participations(
        db: AsyncSession,
        member_id: str,
    ) -> Tuple[Sequence[Tuple[ContestRegistration, OfflineContest]], Dict[str, ScoreboardEntry], Sequence[Tuple[AssessmentSession, Assessment]]]:
        reg_query = (
            select(ContestRegistration, OfflineContest)
            .join(OfflineContest, ContestRegistration.contest_id == OfflineContest.id)
            .where(ContestRegistration.member_id == member_id)
            .order_by(ContestRegistration.registered_at.desc())
        )
        reg_res = await db.execute(reg_query)
        registrations = reg_res.all()

        sb_query = (
            select(ScoreboardEntry, OfflineContest)
            .join(OfflineContest, ScoreboardEntry.contest_id == OfflineContest.id)
            .where(ScoreboardEntry.member_id == member_id)
        )
        sb_res = await db.execute(sb_query)
        scoreboards = {row[1].id: row[0] for row in sb_res.all()}

        sess_query = (
            select(AssessmentSession, Assessment)
            .join(Assessment, AssessmentSession.assessment_id == Assessment.id)
            .where(AssessmentSession.member_id == member_id)
        )
        sess_res = await db.execute(sess_query)
        sessions = sess_res.all()

        return registrations, scoreboards, sessions

    @staticmethod
    async def get_contest_problems(
        db: AsyncSession,
        contest_id: str,
    ) -> Sequence[ContestProblem]:
        stmt = (
            select(ContestProblem)
            .where(ContestProblem.contest_id == contest_id)
            .order_by(ContestProblem.problem_index.asc())
        )
        res = await db.execute(stmt)
        return res.scalars().all()

    @staticmethod
    async def get_problem_by_id(
        db: AsyncSession,
        problem_id: str,
    ) -> Optional[ContestProblem]:
        res = await db.execute(
            select(ContestProblem).where(ContestProblem.id == problem_id)
        )
        return res.scalars().first()

    @staticmethod
    async def get_campus_pass(
        db: AsyncSession,
        contest_id: str,
        member_id: str,
    ) -> Optional[CampusPass]:
        stmt = select(CampusPass).where(
            CampusPass.contest_id == contest_id,
            CampusPass.member_id == member_id,
        )
        res = await db.execute(stmt)
        return res.scalars().first()

    @staticmethod
    async def count_campus_passes(db: AsyncSession, contest_id: str) -> int:
        return await db.scalar(
            select(func.count(CampusPass.id)).where(CampusPass.contest_id == contest_id)
        ) or 0

    @staticmethod
    async def get_scoreboard_entry(
        db: AsyncSession,
        contest_id: str,
        member_id: str,
        for_update: bool = False,
    ) -> Optional[ScoreboardEntry]:
        stmt = select(ScoreboardEntry).where(
            ScoreboardEntry.contest_id == contest_id,
            ScoreboardEntry.member_id == member_id,
        )
        if for_update:
            stmt = stmt.with_for_update()
        res = await db.execute(stmt)
        return res.scalars().first()

    @staticmethod
    async def re_rank_scoreboard(db: AsyncSession, contest_id: str) -> None:
        """
        Atomic set-based re-ranking using PostgreSQL window function.
        Updates only rows whose rank has actually shifted; zero ORM object iteration.
        """
        await db.execute(
            text("""
                WITH ranked AS (
                    SELECT id, ROW_NUMBER() OVER (
                        ORDER BY score DESC, penalty_seconds ASC, id ASC
                    ) AS new_rank
                    FROM scoreboard_entries
                    WHERE contest_id = :contest_id
                )
                UPDATE scoreboard_entries se
                SET rank = ranked.new_rank
                FROM ranked
                WHERE se.id = ranked.id AND se.rank IS DISTINCT FROM ranked.new_rank;
            """),
            {"contest_id": contest_id},
        )
