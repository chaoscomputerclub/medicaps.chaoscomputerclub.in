"""
Chaos Computer Club — Medi-Caps Chapter
modules/contests/contest_controller.py — Thin HTTP Controller for Contest & Arena Operations
"""

from typing import Any, Dict, List, Optional
from fastapi import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import MemberProfile
from app.modules.contests.contest_service import ContestService
from app.modules.contests.contest_execution_service import (
    ArenaRunRequest,
    ArenaSubmitRequest,
    ContestExecutionService,
)
from app.schemas.dynamic_contest import (
    ContestCloneRequest,
    ContestStatusChangeRequest,
    DynamicContestCreateRequest,
    DynamicContestUpdateRequest,
    PresetContestLaunchRequest,
    ProblemCreateSchema,
)
from app.services.dynamic_contest_service import DynamicContestService


class ContestController:
    """Ultra-thin HTTP Controller orchestrating candidate contests, arena workspace, and execution."""

    @staticmethod
    async def list_contests(
        response: Response,
        status: Optional[str],
        division: Optional[str],
        db: AsyncSession,
        current_member: Optional[MemberProfile],
        limit: Optional[int] = None,
        offset: Optional[int] = 0,
    ) -> List[Dict[str, Any]]:
        return await ContestService.list_contests(
            response=response,
            status=status,
            division=division,
            db=db,
            current_member=current_member,
            limit=limit,
            offset=offset,
        )

    @staticmethod
    async def get_my_participated_contests(
        response: Response,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> List[Dict[str, Any]]:
        return await ContestService.get_my_participated_contests(
            response=response,
            current_member=current_member,
            db=db,
        )

    @staticmethod
    async def get_contest_detail(
        slug: str,
        response: Response,
        db: AsyncSession,
        current_member: Optional[MemberProfile],
    ) -> Dict[str, Any]:
        return await ContestService.get_contest_detail(
            slug=slug,
            response=response,
            db=db,
            current_member=current_member,
        )

    @staticmethod
    async def get_contest_problems(
        slug: str,
        response: Response,
        db: AsyncSession,
        current_member: Optional[MemberProfile],
    ) -> List[Dict[str, Any]]:
        return await ContestService.get_contest_problems(
            slug=slug,
            response=response,
            db=db,
            current_member=current_member,
        )

    @staticmethod
    async def get_registration_status(
        slug: str,
        response: Response,
        db: AsyncSession,
        current_member: Optional[MemberProfile],
    ) -> Dict[str, Any]:
        return await ContestService.get_registration_status(
            slug=slug,
            response=response,
            db=db,
            current_member=current_member,
        )

    @staticmethod
    async def get_my_contest_submissions(
        slug: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await ContestService.get_my_contest_submissions(slug, current_member, db)

    @staticmethod
    async def register_for_contest(
        slug: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await ContestService.register_for_contest(
            slug=slug,
            current_member=current_member,
            db=db,
        )

    @staticmethod
    async def unregister_from_contest(
        slug: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await ContestService.unregister_from_contest(
            slug=slug,
            current_member=current_member,
            db=db,
        )

    @staticmethod
    async def check_in_contest(
        slug: str,
        pass_code: Optional[str],
        current_member: Optional[MemberProfile],
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await ContestService.check_in_contest(
            slug=slug,
            pass_code=pass_code,
            current_member=current_member,
            db=db,
        )

    @staticmethod
    async def reset_contest_timer(
        slug: str,
        seconds: int,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await ContestService.reset_contest_timer(
            slug=slug,
            seconds=seconds,
            db=db,
        )

    @staticmethod
    async def get_contest_arena_data(
        slug: str,
        db: AsyncSession,
        current_member: Optional[MemberProfile],
    ) -> Dict[str, Any]:
        return await ContestService.get_contest_arena_data(
            slug=slug,
            db=db,
            current_member=current_member,
        )

    @staticmethod
    async def finish_contest_attempt(
        slug: str,
        current_member: MemberProfile,
        db: AsyncSession,
        attempt_id: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        from app.modules.contests.contest_attempt_service import finalize_attempt

        return await finalize_attempt(
            slug=slug,
            member=current_member,
            db=db,
            expected_attempt_id=attempt_id,
            idempotency_key=idempotency_key,
        )

    @staticmethod
    async def run_arena_code(
        slug: str,
        payload: ArenaRunRequest,
        current_member: Optional[MemberProfile],
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await ContestExecutionService.run_arena_code(
            slug=slug,
            payload=payload,
            current_member=current_member,
            db=db,
        )

    @staticmethod
    async def submit_arena_code(
        slug: str,
        payload: ArenaSubmitRequest,
        current_member: MemberProfile,
        db: AsyncSession,
        async_mode: bool = False,
    ) -> Dict[str, Any]:
        if async_mode:
            import hashlib
            from app.core.queue import RedisQueueEngine, JobPriority
            code_hash = hashlib.sha256((payload.code or "").strip().encode()).hexdigest()[:12]
            job = await RedisQueueEngine.enqueue(
                queue_name="judge",
                job_type="EVALUATE_ARENA_SUBMISSION",
                payload={
                    "contest_slug": slug,
                    "problem_id": payload.problem_id,
                    "member_id": current_member.id,
                    "code": payload.code,
                    "language": str(payload.language),
                    "request_id": payload.request_id,
                },
                priority=JobPriority.HIGH,
                idempotency_key=f"sub:arena:{slug}:{payload.problem_id}:{current_member.id}:{code_hash}",
            )
            return {
                "success": True,
                "job_id": job.id,
                "status": "queued",
                "message": "Submission received and queued for evaluation.",
                "check_status_url": f"/api/jobs/{job.id}",
            }

        return await ContestExecutionService.submit_arena_code(
            slug=slug,
            payload=payload,
            current_member=current_member,
            db=db,
        )

    # Dynamic Contest operations mapped to DynamicContestService
    @staticmethod
    async def create_dynamic_contest(payload: DynamicContestCreateRequest, db: AsyncSession) -> Dict[str, Any]:
        return await DynamicContestService.create_contest(payload, db)

    @staticmethod
    async def launch_preset(payload: PresetContestLaunchRequest, db: AsyncSession) -> Dict[str, Any]:
        return await DynamicContestService.launch_preset(payload, db)

    @staticmethod
    async def update_contest(slug: str, payload: DynamicContestUpdateRequest, db: AsyncSession) -> Dict[str, Any]:
        return await DynamicContestService.update_contest(slug, payload, db)

    @staticmethod
    async def delete_contest(slug: str, db: AsyncSession) -> Dict[str, Any]:
        return await DynamicContestService.delete_contest(slug, db)

    @staticmethod
    async def add_or_update_problem(slug: str, payload: ProblemCreateSchema, db: AsyncSession) -> Dict[str, Any]:
        return await DynamicContestService.add_or_update_problem(slug, payload, db)

    @staticmethod
    async def delete_problem(slug: str, problem_index: str, db: AsyncSession) -> Dict[str, Any]:
        return await DynamicContestService.delete_problem(slug, problem_index, db)

    @staticmethod
    async def clone_contest(slug: str, payload: ContestCloneRequest, db: AsyncSession) -> Dict[str, Any]:
        return await DynamicContestService.clone_contest(slug, payload, db)

    @staticmethod
    async def change_contest_status(slug: str, payload: ContestStatusChangeRequest, db: AsyncSession) -> Dict[str, Any]:
        return await DynamicContestService.change_contest_status(
            slug,
            payload.status,
            db,
            auto_qualify_top_30=payload.auto_qualify_top_30,
        )
