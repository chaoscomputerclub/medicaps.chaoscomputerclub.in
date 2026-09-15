"""
Chaos Computer Club — Offline Contest Domain Service
Encapsulates contest registration, lifecycle phases, arena access controls, and live offline contests.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.base import now_utc
from app.models.contest import (
    OfflineContest,
    ContestProblem,
    ContestSubmission,
    ScoreboardEntry,
    ContestRegistration,
)
from app.models.assessment import Assessment, AssessmentSession
from app.models.campus_pass import CampusPass
from app.models.member import MemberProfile
from app.services.contest_lifecycle_service import (
    ASSESSMENT_WINDOW_HOURS,
    FINALIST_SEATS,
    assessment_available,
    assessment_window,
)

logger = logging.getLogger(__name__)


class ContestService:
    """Core domain service for offline lab contests and arena access controls."""

    @staticmethod
    async def register_candidate(
        contest_slug: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """Register candidate for an upcoming contest and its associated Phase 1 screening."""
        c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == contest_slug))
        contest = c_res.scalars().first()
        if not contest:
            raise HTTPException(status_code=404, detail="Contest not found.")

        # Check existing registration
        reg_res = await db.execute(
            select(ContestRegistration).where(
                ContestRegistration.contest_id == contest.id,
                ContestRegistration.member_id == current_member.id,
            )
        )
        reg = reg_res.scalars().first()
        if reg:
            return {
                "registered": True,
                "message": "Candidate is already registered for this contest.",
                "contest_slug": contest.slug,
                "registered_at": reg.registered_at.isoformat(),
            }

        # Create new registration
        new_reg = ContestRegistration(
            contest_id=contest.id,
            member_id=current_member.id,
            registered_at=now_utc(),
            status="confirmed",
        )
        contest.registered_count = (contest.registered_count or 0) + 1
        db.add(new_reg)
        await db.commit()
        await db.refresh(new_reg)

        return {
            "registered": True,
            "message": "Registration confirmed. Prepare for the Phase 1 online screening assessment.",
            "contest_slug": contest.slug,
            "registered_at": new_reg.registered_at.isoformat(),
        }

    @staticmethod
    async def get_candidate_registration(
        contest_id: str,
        member_id: str,
        db: AsyncSession,
    ) -> Optional[ContestRegistration]:
        """Fetch candidate registration record."""
        res = await db.execute(
            select(ContestRegistration).where(
                ContestRegistration.contest_id == contest_id,
                ContestRegistration.member_id == member_id,
            )
        )
        return res.scalars().first()

    @staticmethod
    async def get_contest_detail_with_auth(
        contest_slug: str,
        current_member: Optional[MemberProfile],
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """Retrieve rich contest summary, problems preview, registration status, and entry window."""
        c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == contest_slug))
        contest = c_res.scalars().first()
        if not contest:
            raise HTTPException(status_code=404, detail="Contest not found.")

        # Fetch problems
        p_res = await db.execute(
            select(ContestProblem)
            .where(ContestProblem.contest_id == contest.id)
            .order_by(ContestProblem.problem_index)
        )
        problems = p_res.scalars().all()

        # Check candidate registration
        reg_info = None
        if current_member:
            reg = await ContestService.get_candidate_registration(contest.id, current_member.id, db)
            if reg:
                # Check active campus pass
                pass_res = await db.execute(
                    select(CampusPass).where(
                        CampusPass.contest_id == contest.id,
                        CampusPass.member_id == current_member.id,
                    )
                )
                c_pass = pass_res.scalars().first()

                reg_info = {
                    "registered": True,
                    "status": reg.status,
                    "registered_at": reg.registered_at.isoformat(),
                    "assessment_taken": reg.assessment_taken,
                    "assessment_score": reg.assessment_score,
                    "assessment_rank": reg.assessment_rank,
                    "is_top_30_qualified": reg.is_top_30_qualified,
                    "can_enter_live_contest": reg.is_top_30_qualified or contest.status == "live",
                    "seat_assigned": reg.seat_assigned or (c_pass.seat_number if c_pass else None),
                    "campus_pass_code": reg.campus_pass_code or (c_pass.pass_code if c_pass else None),
                    "checked_in_at": reg.checked_in_at.isoformat() if reg.checked_in_at else None,
                }

        # Check Assessment window
        window = assessment_window(contest.starts_at)
        now = now_utc()
        is_assessment_open = window.opens_at <= now <= window.closes_at
        opens_in = max(0, int((window.opens_at - now).total_seconds()))

        return {
            "contest": {
                "id": contest.id,
                "slug": contest.slug,
                "title": contest.title,
                "season": contest.season,
                "status": contest.status,
                "division": contest.division,
                "starts_at": contest.starts_at.isoformat(),
                "ends_at": contest.ends_at.isoformat(),
                "check_in_opens_at": contest.check_in_opens_at.isoformat() if contest.check_in_opens_at else contest.starts_at.isoformat(),
                "venue": contest.venue,
                "seat_capacity": contest.seat_capacity,
                "registered_count": contest.registered_count,
                "problem_count": contest.problem_count,
                "environment": contest.environment,
                "chief_proctors": contest.chief_proctors,
                "prize_pool": contest.prize_pool,
                "sponsor": contest.sponsor,
                "summary": contest.summary,
                "rules": contest.rules,
                "cadence": contest.cadence,
                "edition": contest.edition,
                "banner_url": contest.banner_url,
                "assessment_window": window.as_dict(),
                "is_assessment_open": is_assessment_open,
                "assessment_opens_in_seconds": opens_in,
            },
            "registration": reg_info,
            "problems": [
                {
                    "id": p.id,
                    "problem_index": p.problem_index,
                    "title": p.title,
                    "topic": p.topic,
                    "points": p.points,
                    "difficulty": p.difficulty,
                    "solved_count": p.solved_count,
                    "time_limit": p.time_limit,
                    "memory_limit": p.memory_limit,
                }
                for p in problems
            ],
        }
