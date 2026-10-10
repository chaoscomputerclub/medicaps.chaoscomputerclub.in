"""
Chaos Computer Club — Admin QA Testing & Observability Router
Delegates to app.controllers.admin_qa_controller.AdminQAController
"""

from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_db
from app.middleware.auth import require_admin_or_core
from app.models.db_models import MemberProfile
from app.services.qa_test_service import QAAuditReport
from app.controllers.admin_qa_controller import AdminQAController

router = APIRouter(prefix="/admin/qa", tags=["Admin QA Testing & Diagnostics"])


class QARunRequest(BaseModel):
    base_url: Optional[str] = None


class TournamentSimulationRequest(BaseModel):
    cadet_count: int = 110
    contest_count: int = 50
    primary_handle: str = "santusht"
    primary_email: Optional[str] = None
    primary_name: str = "Santusht Kotai"
    primary_prn: str = "EN23CS301927"


@router.post(
    "/run",
    response_model=QAAuditReport,
    summary="Execute comprehensive production API QA test suite on-demand",
)
async def run_qa_audit(
    payload: Optional[QARunRequest] = None,
    current_admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """
    Trigger end-to-end automated QA audit across all API endpoints.
    Evaluates expected vs actual responses, schemas, latencies, and cache headers.
    """
    target_url = payload.base_url if payload else None
    return await AdminQAController.run_qa_audit(base_url=target_url)


@router.get(
    "/report",
    response_model=QAAuditReport,
    summary="Get the most recent QA audit execution report",
)
async def get_latest_qa_report(
    current_admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Retrieve the latest cached QA audit report."""
    return await AdminQAController.get_latest_qa_report()


@router.get(
    "/report/markdown",
    summary="Get the most recent QA audit report formatted as GitHub Markdown",
)
async def get_latest_qa_markdown(
    current_admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Retrieve the latest QA audit report in Markdown format for GSD documentation."""
    return await AdminQAController.get_latest_qa_markdown()


@router.post(
    "/simulate-tournament",
    summary="Simulate full 50-contest, 110-cadet tournament lifecycle with real trends and rating history",
)
async def simulate_tournament(
    payload: Optional[TournamentSimulationRequest] = None,
    current_admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """
    Executes an end-to-end 50-contest simulation with 110 real cadets.
    STRICTLY FORBIDDEN IN PRODUCTION.
    """
    from fastapi import HTTPException
    from app.core.safety import is_production_environment

    if is_production_environment():
        raise HTTPException(
            status_code=403,
            detail="Tournament simulation and synthetic data generation is strictly forbidden in production.",
        )

    req = payload or TournamentSimulationRequest()
    return await AdminQAController.simulate_tournament(
        cadet_count=req.cadet_count,
        contest_count=req.contest_count,
        primary_handle=req.primary_handle,
        primary_email=req.primary_email or settings.ADMIN_PRIMARY_EMAIL,
        primary_name=req.primary_name,
        primary_prn=req.primary_prn,
    )


@router.post(
    "/dev-admin-token",
    summary="Generate ephemeral admin bearer token for localhost development",
)
async def generate_dev_admin_token(
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a valid administrator JWT token for the primary admin email.
    Only permitted in non-production environments or on localhost.
    """
    from fastapi import HTTPException
    from sqlalchemy import select
    from app.core.security import create_access_token
    from app.core.safety import is_production_environment

    if is_production_environment() and not (settings.HOST in ("127.0.0.1", "0.0.0.0", "localhost")):
        raise HTTPException(
            status_code=403,
            detail="Dev admin token generator is disabled in production.",
        )

    admin_email = settings.ADMIN_PRIMARY_EMAIL or "en23cs301927@medicaps.ac.in"
    res = await db.execute(select(MemberProfile).where(MemberProfile.email == admin_email))
    member = res.scalars().first()
    if not member:
        from uuid import uuid4
        member = MemberProfile(
            id=str(uuid4()),
            email=admin_email,
            handle="santusht",
            full_name="Santusht Kotai",
            name="Santusht Kotai",
            prn="EN23CS301927",
            department="Computer Science & Engineering",
            batch="2023-27",
            rating=1450,
            peak_rating=1450,
            is_core_member=True,
            is_onboarded=True,
        )
        db.add(member)
        await db.commit()
        await db.refresh(member)

    token = create_access_token({"sub": str(member.id), "email": member.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "email": member.email,
        "handle": member.handle,
        "is_core_member": member.is_core_member,
    }

