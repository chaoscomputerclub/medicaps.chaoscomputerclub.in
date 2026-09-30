"""
Chaos Computer Club — Medi-Caps Chapter
workers/judge_worker.py — Asynchronous Code Execution & Evaluation Worker
Processes both Live Contest Arena and Screening Assessment submissions in isolated pools.
"""

from __future__ import annotations

import logging
from typing import Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.queue.base_worker import BaseQueueWorker
from app.core.queue.contracts import JobContract, NonRetryableError, RetryableError

logger = logging.getLogger("ccc.worker.judge")


class JudgeWorker(BaseQueueWorker):
    queue_name = "judge"
    default_concurrency = 4
    job_timeout_seconds = 45.0

    async def process_job(self, job: JobContract, db: AsyncSession) -> Dict[str, Any]:
        job_type = job.job_type
        payload = job.payload

        if job_type == "EVALUATE_ARENA_SUBMISSION":
            try:
                return await self._evaluate_arena_submission(payload, db)
            finally:
                # Always release the per-user concurrency slot, even on failure
                if payload.get("_release_user_slot") and payload.get("member_id"):
                    from app.core.user_concurrency import release_user_job_slot
                    await release_user_job_slot(str(payload["member_id"]))
        elif job_type == "EVALUATE_ASSESSMENT_SUBMISSION":
            return await self._evaluate_assessment_submission(payload, db)

        raise NonRetryableError(f"Unknown job_type '{job_type}' for judge worker.")

    async def _evaluate_arena_submission(self, payload: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
        from app.modules.contests.contest_execution_service import ContestExecutionService
        from app.modules.contests.contest_repository import ContestRepository
        from app.models.db_models import MemberProfile
        from app.schemas.contest import ArenaSubmitRequest

        slug = payload.get("contest_slug")
        problem_id = payload.get("problem_id")
        member_id = payload.get("member_id")
        code = payload.get("code")
        language = payload.get("language")

        if not all([slug, problem_id, member_id, code, language]):
            raise NonRetryableError("Missing required arena submission fields in job payload.")

        member = await db.get(MemberProfile, member_id)
        if not member:
            raise NonRetryableError(f"Member profile {member_id} not found.")

        req_payload = ArenaSubmitRequest(
            problem_id=problem_id,
            language=language,
            code=code,
        )

        logger.info(
            "⚡ [JudgeWorker] Evaluating arena submission for member %s (contest=%s, problem=%s, lang=%s)",
            member.handle, slug, problem_id, language
        )

        try:
            result = await ContestExecutionService.submit_arena_code(
                slug=slug,
                payload=req_payload,
                current_member=member,
                db=db,
            )
            return result
        except Exception as exc:
            # Check if this is a compile/runtime error (normal domain result) or infrastructure failure
            exc_str = str(exc).lower()
            if "docker" in exc_str or "connection" in exc_str or "timed out" in exc_str:
                raise RetryableError(f"Judge provider infrastructure error: {exc}")
            raise NonRetryableError(str(exc))

    async def _evaluate_assessment_submission(self, payload: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
        from app.modules.assessments.assessment_service import AssessmentExecutionService
        from app.modules.assessments.assessment_repository import AssessmentRepository
        from app.models.db_models import MemberProfile, AssessmentSession, Assessment, OfflineContest
        from app.engine.enums import Language
        from sqlalchemy import select

        contest_slug = payload.get("contest_slug")
        problem_id = payload.get("problem_id")
        member_id = payload.get("member_id")
        code = payload.get("code")
        language_str = payload.get("language", "python")

        if not all([contest_slug, problem_id, member_id, code]):
            raise NonRetryableError("Missing required assessment submission fields in job payload.")

        member = await db.get(MemberProfile, member_id)
        if not member:
            raise NonRetryableError(f"Member profile {member_id} not found.")

        # Resolve active session and guard
        sess_res = await db.execute(
            select(AssessmentSession, Assessment, OfflineContest)
            .join(Assessment, AssessmentSession.assessment_id == Assessment.id)
            .outerjoin(OfflineContest, Assessment.contest_id == OfflineContest.id)
            .where(
                AssessmentSession.member_id == member_id,
                Assessment.slug == contest_slug,
            )
        )
        row = sess_res.first()
        if not row:
            raise NonRetryableError(f"No active assessment session found for member {member_id} on {contest_slug}.")

        session, assessment, contest = row
        active_guard = (session, assessment, contest)

        logger.info(
            "⚡ [JudgeWorker] Evaluating assessment submission for cadet %s on %s (problem=%s)",
            member.handle, contest_slug, problem_id
        )

        try:
            lang_enum = Language(language_str.lower())
        except Exception:
            lang_enum = Language.PYTHON

        try:
            result = await AssessmentExecutionService.submit_assessment_code(
                contest_slug=contest_slug,
                problem_id=problem_id,
                language=lang_enum,
                code=code,
                active_guard=active_guard,
                current_member=member,
                db=db,
            )
            return result
        except Exception as exc:
            exc_str = str(exc).lower()
            if "docker" in exc_str or "connection" in exc_str or "timed out" in exc_str:
                raise RetryableError(f"Assessment judge infrastructure error: {exc}")
            raise NonRetryableError(str(exc))
