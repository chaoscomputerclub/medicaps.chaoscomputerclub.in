"""
Chaos Computer Club — Medi-Caps Chapter
routers/admin_loadtest.py — Admin Load Test & Distributed Judge Certification Router
Explicitly enforces safety rules and administrator ACK gate.
"""

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.middleware.auth import require_admin_or_core
from app.models.member import MemberProfile
from app.schemas.admin_loadtest import (
    LoadTestAbortResponse,
    LoadTestAckRequest,
    LoadTestAckResponse,
    LoadTestPrepareRequest,
    LoadTestPrepareResponse,
    LoadTestStartRequest,
    LoadTestStartResponse,
    LoadTestStatusResponse,
)
from app.services.admin_loadtest_service import AdminLoadTestService

logger = logging.getLogger("ccc.routers.admin_loadtest")

router = APIRouter(prefix="/admin/loadtest", tags=["Admin Load Test & Certification"])


@router.post(
    "/{contest_id}/prepare",
    response_model=LoadTestPrepareResponse,
    summary="Validate contest readiness and prepare virtual-user test cohort (FSM: PREPARING -> READY_FOR_ACK)",
)
async def prepare_load_test(
    contest_id: str,
    payload: Optional[LoadTestPrepareRequest] = None,
    current_admin: MemberProfile = Depends(require_admin_or_core),
    db: AsyncSession = Depends(get_db),
):
    """
    Validates contest existence, problems, hidden testcase counts, supported languages,
    and virtual user registration pool.
    Transitions to READY_FOR_ACK if all invariants pass.
    Does NOT modify contest, problems, or hidden testcases.
    """
    req = payload or LoadTestPrepareRequest()
    return await AdminLoadTestService.prepare(contest_id=contest_id, payload=req, db=db)


@router.post(
    "/{contest_id}/ack",
    response_model=LoadTestAckResponse,
    summary="Explicit administrator acknowledgement gate (FSM: READY_FOR_ACK -> ADMIN_ACKNOWLEDGED -> ARMED)",
)
async def acknowledge_load_test(
    contest_id: str,
    payload: LoadTestAckRequest,
    current_admin: MemberProfile = Depends(require_admin_or_core),
):
    """
    Requires an explicit administrator signature and ACK confirmation.
    Transitions contest load-test state to ARMED.
    Without this call, no virtual-user simulation or mass submissions can be launched.
    """
    return await AdminLoadTestService.acknowledge(
        contest_id=contest_id,
        admin=current_admin,
        payload=payload,
    )


@router.post(
    "/{contest_id}/start",
    response_model=LoadTestStartResponse,
    summary="Start armed virtual-user simulation against production judge pipeline (FSM: ARMED -> RUNNING)",
)
async def start_load_test(
    contest_id: str,
    payload: Optional[LoadTestStartRequest] = None,
    current_admin: MemberProfile = Depends(require_admin_or_core),
):
    """
    Triggers the virtual-user contest simulation.
    Only executable when state is ARMED.
    """
    req = payload or LoadTestStartRequest()
    return await AdminLoadTestService.start(contest_id=contest_id, payload=req)


@router.post(
    "/{contest_id}/abort",
    response_model=LoadTestAbortResponse,
    summary="Emergency abort virtual-user simulation (FSM: RUNNING -> DRAINING -> ABORTED)",
)
async def abort_load_test(
    contest_id: str,
    current_admin: MemberProfile = Depends(require_admin_or_core),
):
    """
    Emergency abort stops generation of NEW submissions immediately.
    Allows currently in-flight jobs to converge cleanly without DB corruption.
    """
    return await AdminLoadTestService.abort(contest_id=contest_id)


@router.get(
    "/{contest_id}/status",
    response_model=LoadTestStatusResponse,
    summary="Get live FSM state and progress metrics for a contest load test",
)
async def get_load_test_status(
    contest_id: str,
    current_admin: MemberProfile = Depends(require_admin_or_core),
):
    """Query live execution telemetry, queue depth, and progress."""
    return await AdminLoadTestService.get_status(contest_id=contest_id)


@router.get(
    "/{contest_id}/report",
    summary="Get machine-readable JSON certification report",
)
async def get_load_test_report(
    contest_id: str,
    current_admin: MemberProfile = Depends(require_admin_or_core),
):
    """Fetch complete certification report with 30-point invariant table."""
    return await AdminLoadTestService.get_report(contest_id=contest_id)


@router.get(
    "/{contest_id}/report/markdown",
    summary="Get human-readable Markdown certification report",
)
async def get_load_test_markdown_report(
    contest_id: str,
    current_admin: MemberProfile = Depends(require_admin_or_core),
):
    """Download Markdown report."""
    rep = await AdminLoadTestService.get_report(contest_id=contest_id)
    md = rep.get("markdown_report")
    if not md:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Markdown report is not ready yet.",
        )
    return Response(content=md, media_type="text/markdown")
