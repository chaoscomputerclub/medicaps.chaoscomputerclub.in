"""
Chaos Computer Club — Medi-Caps Chapter
modules/assessments/assessment_controller.py — Thin HTTP Controller for Online Screening Assessments
"""

from typing import Any, Dict, Optional
from fastapi import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.engine.enums import Language
from app.models.db_models import MemberProfile
from app.modules.assessments.assessment_service import AssessmentExecutionService
from app.services.assessment_service import AssessmentService as CoreAssessmentService


class AssessmentController:
    """Thin HTTP Controller for Phase 1 screening assessment, code execution, anti-cheat, and cutoffs."""

    @staticmethod
    async def get_or_start_assessment(
        contest_slug: str,
        response: Response,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return await CoreAssessmentService.get_assessment_status(contest_slug, current_member, db)

    @staticmethod
    async def run_sample_code(
        problem_id: str,
        language: Language,
        code: str,
        custom_stdin: Optional[str],
        active_guard: tuple,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await AssessmentExecutionService.run_sample_code(
            problem_id=problem_id,
            language=language,
            code=code,
            custom_stdin=custom_stdin,
            active_guard=active_guard,
            db=db,
        )

    @staticmethod
    async def submit_assessment_code(
        contest_slug: str,
        problem_id: str,
        language: Language,
        code: str,
        active_guard: tuple,
        current_member: MemberProfile,
        db: AsyncSession,
        async_mode: bool = False,
    ) -> Dict[str, Any]:
        if async_mode:
            from app.core.queue import RedisQueueEngine, JobPriority
            job = await RedisQueueEngine.enqueue(
                queue_name="judge",
                job_type="EVALUATE_ASSESSMENT_SUBMISSION",
                payload={
                    "contest_slug": contest_slug,
                    "problem_id": problem_id,
                    "member_id": current_member.id,
                    "code": code,
                    "language": language.value if hasattr(language, "value") else str(language),
                },
                priority=JobPriority.HIGH,
                idempotency_key=f"sub:assess:{contest_slug}:{problem_id}:{current_member.id}",
            )
            return {
                "success": True,
                "job_id": job.id,
                "status": "queued",
                "message": "Assessment submission received and queued for evaluation.",
                "check_status_url": f"/api/jobs/{job.id}",
            }

        return await AssessmentExecutionService.submit_assessment_code(
            contest_slug=contest_slug,
            problem_id=problem_id,
            language=language,
            code=code,
            active_guard=active_guard,
            current_member=current_member,
            db=db,
        )

    @staticmethod
    async def report_anti_cheat_event(
        contest_slug: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await AssessmentExecutionService.report_anti_cheat_event(
            contest_slug=contest_slug,
            current_member=current_member,
            db=db,
        )

    @staticmethod
    async def finish_assessment(
        contest_slug: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await AssessmentExecutionService.finish_assessment(
            contest_slug=contest_slug,
            current_member=current_member,
            db=db,
        )

    @staticmethod
    async def get_assessment_leaderboard(
        contest_slug: str,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await AssessmentExecutionService.get_assessment_leaderboard(
            contest_slug=contest_slug,
            db=db,
        )

    @staticmethod
    async def qualify_top_30(
        contest_slug: str,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await CoreAssessmentService.evaluate_and_qualify_top_30(contest_slug, db)

    @staticmethod
    async def reset_dev_assessment_session(
        contest_slug: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await AssessmentExecutionService.reset_dev_assessment_session(
            contest_slug=contest_slug,
            current_member=current_member,
            db=db,
        )
