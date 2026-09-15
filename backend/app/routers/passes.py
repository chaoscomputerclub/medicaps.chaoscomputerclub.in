"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Campus Pass & Lab Gate Entry Router
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.db_models import CampusPass, MemberProfile
from app.schemas.campus_pass import (
    CampusPassResponse,
    PassVerifyRequest,
    PassVerifyResponse,
    ContestAttendeeItem,
)
from app.middleware.auth import get_current_member, get_current_member_optional
from app.services.pass_service import PassService

router = APIRouter(prefix="/passes", tags=["Campus Gate Passes & Proctor Verification"])


@router.get("/my-pass", response_model=CampusPassResponse)
async def get_my_active_pass(
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve active physical entry pass with workstation allocation and gate QR code."""
    pass_data = await PassService.get_active_pass_for_member(current_member.id, None, db)
    if not pass_data:
        raise HTTPException(
            status_code=404,
            detail="No active campus pass allocated. You must qualify in the Round 1 screening assessment.",
        )
    return pass_data


@router.get("/contest/{contest_slug}/my-pass", response_model=CampusPassResponse)
async def get_my_contest_pass(
    contest_slug: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve active campus pass for a specific contest edition."""
    pass_data = await PassService.get_active_pass_for_member(current_member.id, contest_slug, db)
    if not pass_data:
        raise HTTPException(
            status_code=404,
            detail=f"No campus pass allocated for contest '{contest_slug}'. Complete Round 1 screening to qualify.",
        )
    return pass_data


@router.post("/verify", response_model=PassVerifyResponse)
async def verify_proctor_gate_pass(
    payload: PassVerifyRequest,
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Proctor / Faculty Entrance Scanner:
    Scans candidate QR Pass, verifies Top 30 qualification status, marks timestamp,
    and returns workstation seat allocation.
    """
    proctor_name = current_member.full_name if current_member else "Dr. Ratnesh Litoriya (Chief Proctor)"
    return await PassService.verify_and_check_in(
        raw_input=payload.pass_code_or_qr,
        proctor_name=proctor_name,
        contest_slug=payload.contest_slug,
        db=db,
    )


@router.get("/contest/{contest_slug}/attendees", response_model=List[ContestAttendeeItem])
async def list_contest_attendees(
    contest_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve live attendee list with seat numbers and check-in statuses for proctor view."""
    return await PassService.list_contest_attendees(contest_slug, db)


@router.get("/{pass_code}", response_model=CampusPassResponse)
async def get_pass_by_code(pass_code: str, db: AsyncSession = Depends(get_db)):
    """Gate proctor verification lookup by pass code."""
    clean_code = PassService.parse_qr_or_code(pass_code)
    stmt = select(CampusPass).where(CampusPass.pass_code == clean_code)
    result = await db.execute(stmt)
    pass_obj = result.scalars().first()
    if not pass_obj:
        raise HTTPException(status_code=404, detail=f"Gate pass '{clean_code}' not found.")
    return pass_obj
