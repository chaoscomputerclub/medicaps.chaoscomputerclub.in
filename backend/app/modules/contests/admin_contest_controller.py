"""
Chaos Computer Club — Medi-Caps Chapter
modules/contests/admin_contest_controller.py — Thin HTTP Controller for Admin Contest Operations
"""

from typing import Any, Dict, List, Optional
from fastapi import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import MemberProfile
from app.modules.contests.admin_contest_service import AdminContestService
from app.schemas.campus_pass import ContestAttendeeItem
from app.schemas.dynamic_contest import (
    AssessmentUpdateRequest,
    ContestAdminDetailResponse,
    ContestCloneRequest,
    ContestStatusChangeRequest,
    DynamicContestCreateRequest,
    DynamicContestUpdateRequest,
    PresetContestLaunchRequest,
    ProblemSaveRequest,
    ProblemSyncRequest,
)
from app.services.dynamic_contest_service import DynamicContestService
from app.services.pass_service import PassService


class AdminContestController:
    """Thin HTTP Controller for proctor/admin contest lifecycle, problem sets, and attendee rosters."""

    @staticmethod
    async def list_admin_contests(
        db: AsyncSession,
        limit: Optional[int] = None,
        offset: Optional[int] = 0,
        response: Optional[Response] = None,
    ) -> List[Dict[str, Any]]:
        return await AdminContestService.list_admin_contests(
            db=db,
            limit=limit,
            offset=offset,
            response=response,
        )

    @staticmethod
    async def get_admin_contest(slug: str, db: AsyncSession) -> ContestAdminDetailResponse:
        return await DynamicContestService.get_admin_contest_detail(slug, db)

    @staticmethod
    async def create_dynamic_contest(
        payload: DynamicContestCreateRequest,
        admin: Optional[MemberProfile],
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await DynamicContestService.create_contest(payload, db, creator=admin)

    @staticmethod
    async def update_contest(
        slug: str,
        payload: DynamicContestUpdateRequest,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await DynamicContestService.update_contest(slug, payload, db)

    @staticmethod
    async def delete_contest(slug: str, db: AsyncSession) -> Dict[str, Any]:
        return await DynamicContestService.delete_contest(slug, db)

    @staticmethod
    async def update_contest_assessment(
        slug: str,
        payload: AssessmentUpdateRequest,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await DynamicContestService.update_assessment(slug, payload, db)

    @staticmethod
    async def list_admin_contest_problems(slug: str, db: AsyncSession) -> List[Any]:
        return await AdminContestService.list_admin_contest_problems(slug, db)

    @staticmethod
    async def add_or_update_problem(
        slug: str,
        payload: ProblemSaveRequest,
        target: Optional[str],
        db: AsyncSession,
    ) -> Dict[str, Any]:
        resolved_target = target or payload.target or "both"
        return await DynamicContestService.add_or_update_problem(slug, payload, db, target=resolved_target)

    @staticmethod
    async def delete_problem(
        slug: str,
        problem_index: str,
        target: Optional[str],
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await DynamicContestService.delete_problem(slug, problem_index, db, target=target or "both")

    @staticmethod
    async def sync_contest_problems(
        slug: str,
        payload: ProblemSyncRequest,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await DynamicContestService.sync_problems(slug, payload.direction, db)

    @staticmethod
    async def clone_contest(
        slug: str,
        payload: ContestCloneRequest,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await DynamicContestService.clone_contest(slug, payload, db)

    @staticmethod
    async def change_contest_status(
        slug: str,
        payload: ContestStatusChangeRequest,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await DynamicContestService.change_contest_status(
            slug,
            payload.status,
            db,
            auto_qualify_top_30=payload.auto_qualify_top_30,
        )

    @staticmethod
    async def launch_preset(
        payload: PresetContestLaunchRequest,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await DynamicContestService.launch_preset(payload, db)

    @staticmethod
    async def list_admin_contest_participants(slug: str, db: AsyncSession) -> List[ContestAttendeeItem]:
        return await PassService.list_contest_attendees(slug, db)

    @staticmethod
    async def admin_register_participant(
        slug: str,
        payload: Dict[str, Any],
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await AdminContestService.admin_register_participant(slug, payload, db)

    @staticmethod
    async def seed_demo_participants(slug: str, db: AsyncSession) -> Dict[str, Any]:
        return await AdminContestService.seed_demo_participants(slug, db)

    @staticmethod
    async def simulate_100_cadets(slug: str, db: AsyncSession) -> Dict[str, Any]:
        return await AdminContestService.simulate_100_cadets(slug, db)
