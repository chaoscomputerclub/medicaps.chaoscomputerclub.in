"""
Chaos Computer Club — Admin QA Testing & Observability Router
Exposes on-demand production API QA testing suites, regression runners,
and audit report retrieval for DevOps pipelines and admin dashboards.
"""

from __future__ import annotations

import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.middleware.auth import require_admin_or_core
from app.models.db_models import MemberProfile
from app.services.qa_test_service import ProductionQAService, QAAuditReport

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/qa", tags=["Admin QA Testing & Diagnostics"])

# In-memory latest report cache
_LATEST_QA_REPORT: Optional[QAAuditReport] = None


class QARunRequest(BaseModel):
    base_url: Optional[str] = None


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
    Requires Admin or Core Team authorization.
    """
    global _LATEST_QA_REPORT
    target_url = payload.base_url if payload else None

    logger.info(f"⚡ Initiating on-demand QA audit run (Target: {target_url or 'In-Process'})...")
    report = await ProductionQAService.run_full_qa_audit(base_url=target_url)
    _LATEST_QA_REPORT = report

    return report


@router.get(
    "/report",
    response_model=QAAuditReport,
    summary="Get the most recent QA audit execution report",
)
async def get_latest_qa_report(
    current_admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Retrieve the latest cached QA audit report."""
    global _LATEST_QA_REPORT
    if not _LATEST_QA_REPORT:
        # Run automatically if no report exists yet
        _LATEST_QA_REPORT = await ProductionQAService.run_full_qa_audit()
    return _LATEST_QA_REPORT


@router.get(
    "/report/markdown",
    summary="Get the most recent QA audit report formatted as GitHub Markdown",
)
async def get_latest_qa_markdown(
    current_admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Retrieve the latest QA audit report in Markdown format for GSD documentation."""
    global _LATEST_QA_REPORT
    if not _LATEST_QA_REPORT:
        _LATEST_QA_REPORT = await ProductionQAService.run_full_qa_audit()
    
    md_content = ProductionQAService.generate_markdown_report(_LATEST_QA_REPORT)
    return {"audit_id": _LATEST_QA_REPORT.audit_id, "markdown": md_content}


class TournamentSimulationRequest(BaseModel):
    cadet_count: int = 110
    contest_count: int = 50
    primary_handle: str = "santusht"
    primary_email: str = "santusht.en23@medicaps.ac.in"
    primary_name: str = "Santusht Kotai"
    primary_prn: str = "EN23CS301927"


@router.post(
    "/simulate-tournament",
    summary="Simulate full 50-contest, 110-cadet tournament lifecycle with real trends and rating history",
)
async def simulate_tournament(
    payload: Optional[TournamentSimulationRequest] = None,
    current_admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """
    Executes an end-to-end 50-contest simulation with 110 real cadets:
    - Phase 1 Online Screening Assessments
    - Top 30 Finalist Selection
    - QR Pass & Workstation Seat Allocation
    - Live Arena Submissions & Scoreboard Placements
    - Historical Elo Rating Trajectories (Rating Graph)
    - Full Badges & Achievements
    """
    from app.core.db import AsyncSessionLocal
    from app.services.tournament_qa_service import TournamentQAService

    req = payload or TournamentSimulationRequest()
    logger.info("⚡ [QA ADMIN] Executing 50-contest tournament simulation...")

    async with AsyncSessionLocal() as db:
        result = await TournamentQAService.simulate_50_contests(
            db=db,
            cadet_count=req.cadet_count,
            contest_count=req.contest_count,
            primary_handle=req.primary_handle,
            primary_email=req.primary_email,
            primary_name=req.primary_name,
            primary_prn=req.primary_prn,
        )
    return result

