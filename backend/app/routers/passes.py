"""
Chaos Computer Club India — Medi-Caps Chapter Backend
routers/passes.py — Thin HTTP Router for Campus Pass & Lab Gate Entry
Delegates to app.controllers.pass_controller.PassController
"""

from typing import Optional, List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.db_models import MemberProfile
from app.schemas.campus_pass import (
    CampusPassResponse,
    PassVerifyRequest,
    PassVerifyResponse,
    ContestAttendeeItem,
)
from app.middleware.auth import get_current_member, get_current_member_optional
from app.controllers.pass_controller import PassController

router = APIRouter(prefix="/passes", tags=["Campus Gate Passes & Proctor Verification"])


@router.get("/my-pass", response_model=CampusPassResponse)
async def get_my_active_pass(
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve active physical entry pass with workstation allocation and gate QR code."""
    return await PassController.get_my_active_pass(current_member=current_member, db=db)


@router.get("/contest/{contest_slug}/my-pass", response_model=CampusPassResponse)
async def get_my_contest_pass(
    contest_slug: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve active campus pass for a specific contest edition."""
    return await PassController.get_my_contest_pass(contest_slug=contest_slug, current_member=current_member, db=db)


@router.post("/verify", response_model=PassVerifyResponse)
async def verify_proctor_gate_pass(
    payload: PassVerifyRequest,
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Proctor Gate Entrance Scanner:
    Scans candidate QR Pass, verifies Top 30 qualification status, marks timestamp,
    and returns workstation seat allocation.
    """
    return await PassController.verify_proctor_gate_pass(payload=payload, current_member=current_member, db=db)


@router.get("/contest/{contest_slug}/attendees", response_model=List[ContestAttendeeItem])
async def list_contest_attendees(
    contest_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve live attendee list with seat numbers and check-in statuses for proctor view."""
    return await PassController.list_contest_attendees(contest_slug=contest_slug, db=db)


@router.get("/{pass_code}", response_model=CampusPassResponse)
async def get_pass_by_code(pass_code: str, db: AsyncSession = Depends(get_db)):
    """Gate proctor verification lookup by pass code."""
    return await PassController.get_pass_by_code(pass_code=pass_code, db=db)
