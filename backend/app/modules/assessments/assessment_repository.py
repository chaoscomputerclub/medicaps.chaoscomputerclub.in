"""
Chaos Computer Club — Medi-Caps Chapter
modules/assessments/assessment_repository.py — Data Persistence Repository for Screening Assessments
"""

import logging
from typing import Any, Dict, List, Optional, Sequence, Tuple
from sqlalchemy import delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import (
    Assessment,
    AssessmentProblem,
    AssessmentSession,
    AssessmentSubmission,
    ContestRegistration,
    ContestSubmission,
    MemberProfile,
    OfflineContest,
    ScoreboardEntry,
    now_utc,
)

logger = logging.getLogger(__name__)


class AssessmentRepository:
    """Encapsulates database access for assessments, problems, candidate sessions, and submissions."""

    @staticmethod
    async def get_problem(db: AsyncSession, problem_id: str) -> Optional[AssessmentProblem]:
        res = await db.execute(select(AssessmentProblem).where(AssessmentProblem.id == problem_id))
        return res.scalars().first()

    @staticmethod
    async def get_session(
        db: AsyncSession,
        assessment_id: str,
        member_id: str,
    ) -> Optional[AssessmentSession]:
        res = await db.execute(
            select(AssessmentSession).where(
                AssessmentSession.assessment_id == assessment_id,
                AssessmentSession.member_id == member_id,
            )
        )
        return res.scalars().first()

    @staticmethod
    async def get_all_session_submissions(
        db: AsyncSession,
        session_id: str,
    ) -> Sequence[AssessmentSubmission]:
        res = await db.execute(
            select(AssessmentSubmission).where(AssessmentSubmission.session_id == session_id)
        )
        return res.scalars().all()

    @staticmethod
    async def get_best_problem_scores_for_contest(
        db: AsyncSession,
        contest_id: str,
        member_id: str,
    ) -> float:
        cs_res = await db.execute(
            select(ContestSubmission.problem_id, func.max(ContestSubmission.points_awarded))
            .where(
                ContestSubmission.contest_id == contest_id,
                ContestSubmission.member_id == member_id,
            )
            .group_by(ContestSubmission.problem_id)
        )
        cs_scores = cs_res.all()
        if cs_scores:
            return float(sum(s[1] for s in cs_scores if s[1]))
        return 0.0

    @staticmethod
    async def get_best_session_scores(
        db: AsyncSession,
        session_id: str,
    ) -> float:
        subs_res = await db.execute(
            select(AssessmentSubmission.problem_id, func.max(AssessmentSubmission.score))
            .where(AssessmentSubmission.session_id == session_id)
            .group_by(AssessmentSubmission.problem_id)
        )
        subs_scores = subs_res.all()
        if subs_scores:
            return round(sum(s[1] for s in subs_scores if s[1]), 2)
        return 0.0

    @staticmethod
    async def get_active_sessions_for_ranking(
        db: AsyncSession,
        assessment_id: str,
    ) -> Sequence[AssessmentSession]:
        res = await db.execute(
            select(AssessmentSession).where(
                AssessmentSession.assessment_id == assessment_id,
                AssessmentSession.status.in_(["in_progress", "submitted"]),
            )
        )
        return res.scalars().all()

    @staticmethod
    async def reset_session(
        db: AsyncSession,
        assessment_id: str,
        member_id: str,
        contest_id: Optional[str] = None,
    ) -> None:
        s_result = await db.execute(
            select(AssessmentSession).where(
                AssessmentSession.assessment_id == assessment_id,
                AssessmentSession.member_id == member_id,
            )
        )
        session = s_result.scalars().first()
        if session:
            await db.execute(
                delete(AssessmentSubmission).where(AssessmentSubmission.session_id == session.id)
            )
            await db.delete(session)

        if contest_id:
            reg_stmt = select(ContestRegistration).where(
                ContestRegistration.contest_id == contest_id,
                ContestRegistration.member_id == member_id,
            )
            reg_res = await db.execute(reg_stmt)
            reg = reg_res.scalars().first()
            if reg:
                reg.assessment_taken = False
                reg.assessment_score = 0.0
                reg.assessment_rank = None
                reg.is_top_30_qualified = False
