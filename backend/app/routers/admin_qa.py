"""
Chaos Computer Club — Admin QA Testing & Observability Router
Delegates to app.controllers.admin_qa_controller.AdminQAController
"""

from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel

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
    primary_email: str = "santusht.en23@medicaps.ac.in"
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
    """
    req = payload or TournamentSimulationRequest()
    return await AdminQAController.simulate_tournament(
        cadet_count=req.cadet_count,
        contest_count=req.contest_count,
        primary_handle=req.primary_handle,
        primary_email=req.primary_email,
        primary_name=req.primary_name,
        primary_prn=req.primary_prn,
    )
