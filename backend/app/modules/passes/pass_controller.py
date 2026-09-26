"""
Chaos Computer Club — Medi-Caps Chapter
modules/passes/pass_controller.py — Thin HTTP Controller for Campus Passes & Gate Verification
"""

from typing import List, Optional
from fastapi import HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.lib.qr import parse_campus_pass_qr
from app.models.db_models import MemberProfile
from app.modules.passes.pass_repository import PassRepository
from app.schemas.campus_pass import (
    CampusPassResponse,
    ContestAttendeeItem,
    PassVerifyRequest,
    PassVerifyResponse,
)
from app.services.pass_service import PassService


class PassController:
    """Thin HTTP Controller for campus passes, gate scanner check-in, and attendee rosters."""

    @staticmethod
    async def get_my_active_pass(
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> CampusPassResponse:
        pass_data = await PassService.get_active_pass_for_member(current_member.id, None, db)
        if not pass_data:
            raise HTTPException(
                status_code=404,
                detail="No active campus pass allocated. You must qualify in the Round 1 screening assessment.",
            )
        return pass_data

    @staticmethod
    async def get_my_contest_pass(
        contest_slug: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> CampusPassResponse:
        pass_data = await PassService.get_active_pass_for_member(current_member.id, contest_slug, db)
        if not pass_data:
            raise HTTPException(
                status_code=404,
                detail=f"No campus pass allocated for contest '{contest_slug}'. Complete Round 1 screening to qualify.",
            )
        return pass_data

    @staticmethod
    async def verify_proctor_gate_pass(
        payload: PassVerifyRequest,
        current_member: Optional[MemberProfile],
        db: AsyncSession,
    ) -> PassVerifyResponse:
        proctor_name = current_member.full_name if current_member else "Chief Proctor (CCC Core)"
        return await PassService.verify_and_check_in(
            raw_input=payload.pass_code_or_qr,
            proctor_name=proctor_name,
            contest_slug=payload.contest_slug,
            db=db,
        )

    @staticmethod
    async def list_contest_attendees(
        contest_slug: str,
        db: AsyncSession,
        limit: Optional[int] = None,
        offset: Optional[int] = 0,
        response: Optional[Response] = None,
    ) -> List[ContestAttendeeItem]:
        results = await PassService.list_contest_attendees(
            contest_slug=contest_slug,
            db=db,
            limit=limit,
            offset=offset,
        )
        if response and limit is not None:
            from app.lib.pagination import normalize_pagination, inject_pagination_headers
            safe_limit, safe_offset = normalize_pagination(limit, offset, default_limit=200, max_limit=1000)
            inject_pagination_headers(response, len(results), safe_limit, safe_offset)
        return results

    @staticmethod
    async def get_pass_by_code(
        pass_code: str,
        db: AsyncSession,
    ) -> CampusPassResponse:
        clean_code, _, _ = parse_campus_pass_qr(pass_code)
        pass_obj = await PassRepository.get_by_code(db, clean_code)
        if not pass_obj:
            raise HTTPException(status_code=404, detail=f"Gate pass '{clean_code}' not found.")
        return pass_obj
