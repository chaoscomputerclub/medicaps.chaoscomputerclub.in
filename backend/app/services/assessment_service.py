"""
Chaos Computer Club — Online Screening Assessment Service
Encapsulates all logic for Round 1 assessment window gating, anti-cheat proctoring,
CodeBox evaluation, sealed leaderboards, and Top 30 finalist qualification.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy import select, desc, delete
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.core.config import settings
from app.models.base import now_utc
from app.models.contest import OfflineContest, ContestRegistration
from app.models.assessment import Assessment, AssessmentProblem, AssessmentSession, AssessmentSubmission
from app.models.campus_pass import CampusPass
from app.models.member import MemberProfile
from app.engine.enums import Language, Verdict, ComparisonMode
from app.engine.executors.factory import get_executor
from app.engine.providers.factory import get_judge_provider
from app.engine.schemas import TestCaseSchema
from app.services.contest_lifecycle_service import (
    ASSESSMENT_WINDOW_HOURS,
    ASSESSMENT_DURATION_MINUTES,
    FINALIST_SEATS,
    assessment_available,
    assessment_window,
    session_deadline,
    remaining_seconds as session_remaining_seconds,
)
from app.services.ranking_service import (
    build_ranking,
    cached_ranking,
    invalidate_ranking,
    ranking_released,
    withheld_payload,
)
from app.services.event_broadcaster import broadcast_event

logger = logging.getLogger(__name__)


class AssessmentService:
    """Core domain service managing online screening assessment rounds."""

    @staticmethod
    def _normalize_testcase(tc: dict) -> dict:
        stdin_val = tc.get("stdin") if tc.get("stdin") is not None else tc.get("input", "")
        expected_out = tc.get("expected_output") if tc.get("expected_output") is not None else tc.get("output", "")
        if isinstance(stdin_val, str) and "\\n" in stdin_val and "\n" not in stdin_val:
            stdin_val = stdin_val.replace("\\n", "\n")
        if isinstance(expected_out, str) and "\\n" in expected_out and "\n" not in expected_out:
            expected_out = expected_out.replace("\\n", "\n")
        return {
            "stdin": stdin_val,
            "input": stdin_val,
            "expected_output": expected_out,
            "output": expected_out,
            "explanation": tc.get("explanation"),
        }

    @staticmethod
    def public_problem_data(problem: AssessmentProblem) -> dict:
        """Format problem data for public display without leaking hidden test cases."""
        return {
            "id": problem.id,
            "problem_index": problem.problem_index,
            "title": problem.title,
            "difficulty": problem.difficulty,
            "description": problem.description,
            "input_format": problem.input_format,
            "output_format": problem.output_format,
            "constraints": problem.constraints,
            "points": problem.points,
            "time_limit": problem.time_limit,
            "memory_limit": problem.memory_limit,
            "starter_codes": problem.starter_codes or {},
            "sample_testcases": [AssessmentService._normalize_testcase(s) for s in (problem.sample_testcases or [])],
        }

    @staticmethod
    async def get_or_create_assessment_for_contest(contest_slug: str, db: AsyncSession) -> Tuple[Assessment, Optional[OfflineContest]]:
        """Fetch assessment tied to contest_slug or matching assessment slug."""
        # 1. Try finding contest by slug first
        c_stmt = select(OfflineContest).where(OfflineContest.slug == contest_slug)
        c_res = await db.execute(c_stmt)
        contest = c_res.scalars().first()

        if contest:
            a_stmt = select(Assessment).where(Assessment.contest_id == contest.id)
            a_res = await db.execute(a_stmt)
            assessment = a_res.scalars().first()
            if assessment:
                return assessment, contest

        # 2. Fallback to assessment slug
        a_stmt2 = select(Assessment).where(Assessment.slug == contest_slug)
        a_res2 = await db.execute(a_stmt2)
        assessment = a_res2.scalars().first()
        if not assessment:
            raise HTTPException(status_code=404, detail=f"No assessment round found for '{contest_slug}'.")

        if assessment.contest_id and not contest:
            c_res2 = await db.execute(select(OfflineContest).where(OfflineContest.id == assessment.contest_id))
            contest = c_res2.scalars().first()

        return assessment, contest

    @staticmethod
    async def get_assessment_status(
        contest_slug: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """
        Check candidate's assessment status.
        If window is in the future, returns waiting metadata with opens_in countdown.
        If window is open or dev bypass active, returns/initializes the active session and problem challenges.
        """
        assessment, contest = await AssessmentService.get_or_create_assessment_for_contest(contest_slug, db)
        is_dev_bypass = settings.is_dev_bypass_enabled or getattr(current_member, "is_core_member", False) or contest_slug.startswith("dev-")

        # 1. Check if user is registered for the contest
        is_registered = False
        if contest:
            reg_check = await db.execute(
                select(ContestRegistration).where(
                    ContestRegistration.contest_id == contest.id,
                    ContestRegistration.member_id == current_member.id,
                )
            )
            reg = reg_check.scalars().first()
            is_registered = bool(reg)
            if not is_registered and not is_dev_bypass:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Contest registration is required before entering the Phase 1 online screening assessment.",
                )
            elif not is_registered and is_dev_bypass:
                # Auto-confirm registration in dev mode
                auto_reg = ContestRegistration(
                    contest_id=contest.id,
                    member_id=current_member.id,
                    registered_at=now_utc(),
                    status="confirmed",
                )
                db.add(auto_reg)
                await db.commit()
                is_registered = True

        # 2. Check Assessment Window
        now = now_utc()
        starts_at = assessment.starts_at if assessment.starts_at else (contest.starts_at - timedelta(hours=ASSESSMENT_WINDOW_HOURS) if contest else now)
        ends_at = assessment.ends_at if assessment.ends_at else (contest.starts_at - timedelta(hours=2) if contest else now + timedelta(hours=ASSESSMENT_WINDOW_HOURS))

        # Make aware
        if starts_at.tzinfo is None:
            starts_at = starts_at.replace(tzinfo=timezone.utc)
        if ends_at.tzinfo is None:
            ends_at = ends_at.replace(tzinfo=timezone.utc)

        is_open = (starts_at <= now <= ends_at) or is_dev_bypass
        opens_in_seconds = 0 if is_dev_bypass else max(0, int((starts_at - now).total_seconds()))
        closes_in_seconds = max(7200, int((ends_at - now).total_seconds())) if is_dev_bypass else max(0, int((ends_at - now).total_seconds()))

        # Check existing session
        s_result = await db.execute(
            select(AssessmentSession).where(
                AssessmentSession.assessment_id == assessment.id,
                AssessmentSession.member_id == current_member.id,
            )
        )
        session = s_result.scalars().first()

        # If session already completed or submitted, return clean completed state without re-entry
        if session and session.status in ("submitted", "disqualified"):
            # Ensure contest registration is in sync
            if contest:
                reg_stmt = select(ContestRegistration).where(
                    ContestRegistration.contest_id == contest.id,
                    ContestRegistration.member_id == current_member.id,
                )
                reg_res = await db.execute(reg_stmt)
                reg = reg_res.scalars().first()
                if reg and (not reg.assessment_taken or reg.assessment_score != session.total_score):
                    reg.assessment_taken = True
                    reg.assessment_score = session.total_score
                    await db.commit()

            return {
                "assessment": {
                    "id": assessment.id,
                    "slug": assessment.slug,
                    "title": assessment.title,
                    "summary": assessment.summary,
                    "duration_minutes": assessment.duration_minutes or ASSESSMENT_DURATION_MINUTES,
                    "max_violations": assessment.max_violations,
                    "starts_at": starts_at.isoformat(),
                    "ends_at": ends_at.isoformat(),
                    "is_open": False,
                    "is_completed": True,
                    "opens_in_seconds": 0,
                    "closes_in_seconds": 0,
                },
                "session": {
                    "id": session.id,
                    "status": session.status,
                    "started_at": session.started_at.isoformat(),
                    "submitted_at": session.submitted_at.isoformat() if session.submitted_at else None,
                    "remaining_seconds": 0,
                    "total_score": session.total_score,
                    "anti_cheat_violations": session.anti_cheat_violations,
                    "is_top_30_qualified": session.is_top_30_qualified,
                },
                "problems": [],
                "submissions": {},
                "message": "Assessment attempt has been finalized and submitted.",
            }

        # If window not open yet and user doesn't have an active session, return waiting state
        if not is_open and not session and opens_in_seconds > 0 and not is_dev_bypass:
            return {
                "assessment": {
                    "id": assessment.id,
                    "slug": assessment.slug,
                    "title": assessment.title,
                    "summary": assessment.summary,
                    "duration_minutes": assessment.duration_minutes or ASSESSMENT_DURATION_MINUTES,
                    "max_violations": assessment.max_violations,
                    "starts_at": starts_at.isoformat(),
                    "ends_at": ends_at.isoformat(),
                    "is_open": False,
                    "opens_in_seconds": opens_in_seconds,
                    "closes_in_seconds": closes_in_seconds,
                },
                "session": None,
                "problems": [],
                "submissions": {},
                "message": f"Assessment window opens in {opens_in_seconds // 3600}h {(opens_in_seconds % 3600) // 60}m. Please wait for the window to unlock.",
            }

        # If window ended and user never started (only when not in dev bypass)
        if closes_in_seconds <= 0 and not session and not is_dev_bypass:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The Round 1 screening assessment window has concluded.",
            )

        # 3. Create session if not present and window is open
        if not session:
            session = AssessmentSession(
                assessment_id=assessment.id,
                member_id=current_member.id,
                handle=current_member.handle or f"member_{current_member.id[:6]}",
                full_name=current_member.full_name or "Candidate",
                department=current_member.department or "CSE",
                batch=current_member.batch or "2023-27",
                started_at=now,
                status="in_progress",
            )
            db.add(session)
            await db.commit()
            await db.refresh(session)

        # 4. Compute Remaining Seconds
        started_at = session.started_at
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        expires_at = started_at + timedelta(minutes=assessment.duration_minutes or ASSESSMENT_DURATION_MINUTES)
        remaining_seconds = max(0, int((expires_at - now_utc()).total_seconds()))

        if remaining_seconds <= 0 and session.status == "in_progress":
            session.status = "submitted"
            session.submitted_at = expires_at
            if contest:
                reg_stmt = select(ContestRegistration).where(
                    ContestRegistration.contest_id == contest.id,
                    ContestRegistration.member_id == current_member.id,
                )
                reg_res = await db.execute(reg_stmt)
                reg = reg_res.scalars().first()
                if reg:
                    reg.assessment_taken = True
                    reg.assessment_score = session.total_score
            await db.commit()

        # 5. Fetch Problems
        p_result = await db.execute(
            select(AssessmentProblem)
            .where(AssessmentProblem.assessment_id == assessment.id)
            .order_by(AssessmentProblem.problem_index)
        )
        problems = p_result.scalars().all()

        # 6. Fetch Submissions
        sub_result = await db.execute(
            select(AssessmentSubmission).where(AssessmentSubmission.session_id == session.id)
        )
        submissions = sub_result.scalars().all()
        sub_map = {}
        for s in submissions:
            if s.problem_id not in sub_map or s.score > sub_map[s.problem_id]["score"]:
                sub_map[s.problem_id] = {
                    "id": s.id,
                    "language": s.language,
                    "verdict": s.verdict,
                    "score": s.score,
                    "code": s.code,
                    "submitted_at": s.submitted_at.isoformat(),
                }

        return {
            "assessment": {
                "id": assessment.id,
                "slug": assessment.slug,
                "title": assessment.title,
                "summary": assessment.summary,
                "duration_minutes": assessment.duration_minutes or ASSESSMENT_DURATION_MINUTES,
                "max_violations": assessment.max_violations,
                "starts_at": starts_at.isoformat(),
                "ends_at": ends_at.isoformat(),
                "is_open": True,
                "opens_in_seconds": 0,
                "closes_in_seconds": closes_in_seconds,
            },
            "session": {
                "id": session.id,
                "status": session.status,
                "started_at": session.started_at.isoformat(),
                "remaining_seconds": remaining_seconds,
                "total_score": session.total_score,
                "anti_cheat_violations": session.anti_cheat_violations,
                "is_top_30_qualified": session.is_top_30_qualified,
            },
            "problems": [AssessmentService.public_problem_data(p) for p in problems],
            "submissions": sub_map,
        }

    @staticmethod
    async def evaluate_and_qualify_top_30(contest_slug: str, db: AsyncSession) -> Dict[str, Any]:
        """
        Evaluates the assessment round, ranks participants by score (desc) & time (asc),
        qualifies the Top 30 candidates, updates their records, and issues digital QR passes.
        """
        assessment, contest = await AssessmentService.get_or_create_assessment_for_contest(contest_slug, db)

        # Get all valid sessions sorted by score desc, penalty asc
        s_result = await db.execute(
            select(AssessmentSession)
            .where(
                AssessmentSession.assessment_id == assessment.id,
                AssessmentSession.status != "disqualified",
            )
            .order_by(desc(AssessmentSession.total_score), AssessmentSession.total_penalty_seconds)
        )
        sessions = s_result.scalars().all()

        issued_passes = []
        target_contest_id = contest.id if contest else assessment.id
        contest_prefix = contest.slug[:8].upper() if contest else "CCC-26"

        for idx, s in enumerate(sessions, start=1):
            is_qualifier = idx <= FINALIST_SEATS
            s.is_top_30_qualified = is_qualifier
            seat_num = f"LAB-04-PC{idx:02d}" if is_qualifier else "N/A"

            # Update ContestRegistration if exists
            if contest:
                reg_stmt = select(ContestRegistration).where(
                    ContestRegistration.contest_id == contest.id,
                    ContestRegistration.member_id == s.member_id,
                )
                reg_res = await db.execute(reg_stmt)
                reg = reg_res.scalars().first()
                if reg:
                    reg.assessment_taken = True
                    reg.assessment_score = s.total_score
                    reg.assessment_rank = idx
                    reg.is_top_30_qualified = is_qualifier
                    reg.seat_assigned = seat_num if is_qualifier else None

            if is_qualifier:
                pass_code = f"CCC-{contest_prefix}-{s.handle[:4].upper()}-{idx:02d}"
                qr_payload = f"CCC-PASS:{pass_code}:{s.member_id}:{seat_num}:QUALIFIED"

                # Check if pass already exists
                p_stmt = select(CampusPass).where(
                    CampusPass.member_id == s.member_id,
                    CampusPass.contest_id == target_contest_id,
                )
                p_res = await db.execute(p_stmt)
                c_pass = p_res.scalars().first()

                if not c_pass:
                    c_pass = CampusPass(
                        member_id=s.member_id,
                        contest_id=target_contest_id,
                        pass_code=pass_code,
                        seat_number=seat_num,
                        qr_data=qr_payload,
                        check_in_status="issued",
                    )
                    db.add(c_pass)
                else:
                    c_pass.seat_number = seat_num
                    c_pass.qr_data = qr_payload
                    c_pass.pass_code = pass_code

                if contest and reg:
                    reg.campus_pass_code = pass_code

                issued_passes.append({
                    "rank": idx,
                    "handle": s.handle,
                    "full_name": s.full_name,
                    "score": s.total_score,
                    "seat_number": seat_num,
                    "pass_code": pass_code,
                })

        await db.commit()
        await invalidate_ranking(contest_slug)

        # Broadcast Top 30 qualification real-time event
        try:
            await broadcast_event(
                event_type="top30_qualified",
                data={
                    "contest_slug": contest_slug,
                    "total_candidates": len(sessions),
                    "qualified_count": len(issued_passes),
                    "qualifiers": issued_passes,
                },
                contest_slug=contest_slug,
            )
        except Exception as broadcast_err:
            logger.debug("Failed to broadcast top30_qualified: %s", broadcast_err)

        return {
            "success": True,
            "contest_slug": contest_slug,
            "total_candidates": len(sessions),
            "qualified_count": len(issued_passes),
            "qualifiers": issued_passes,
        }
