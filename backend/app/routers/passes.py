"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Campus Pass & Lab Gate Entry Router
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.models.db_models import CampusPass, MemberProfile
from app.models.schemas import CampusPassResponse
from app.middleware.auth import get_current_member

router = APIRouter(prefix="/passes", tags=["Campus Gate Passes"])


@router.get("/my-pass", response_model=CampusPassResponse)
async def get_my_active_pass(
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve active physical entry pass with workstation allocation and gate QR code."""
    stmt = (
        select(CampusPass)
        .where(CampusPass.member_id == current_member.id)
        .order_by(CampusPass.issued_at.desc())
    )
    result = await db.execute(stmt)
    pass_obj = result.scalars().first()
    if not pass_obj:
        raise HTTPException(
            status_code=404,
            detail="No active campus pass allocated. Register for an upcoming offline contest.",
        )
    return pass_obj


@router.get("/{pass_code}", response_model=CampusPassResponse)
async def get_pass_by_code(pass_code: str, db: AsyncSession = Depends(get_db)):
    """Gate proctor verification lookup by pass code."""
    stmt = select(CampusPass).where(CampusPass.pass_code == pass_code)
    result = await db.execute(stmt)
    pass_obj = result.scalars().first()
    if not pass_obj:
        raise HTTPException(status_code=404, detail=f"Gate pass '{pass_code}' not found.")
    return pass_obj
