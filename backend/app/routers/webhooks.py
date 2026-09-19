"""
Chaos Computer Club — Medi-Caps Chapter
routers/webhooks.py

Inbound & Outbound Webhook Subsystem & OpenAPI 3.1.0 Webhook Specifications
Enables third-party, IoT turnstiles, proctor scanner terminals, and external judge systems
to trigger and receive instant real-time actions without polling.
"""

import logging
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Header, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.db_models import OfflineContest, CampusPass, MemberProfile
from app.services.pass_service import PassService
from app.services.event_broadcaster import broadcast_event, register_outbound_webhook

logger = logging.getLogger(__name__)

# Standard router for inbound API endpoints
router = APIRouter(prefix="/webhooks", tags=["Webhooks & External Integrations"])

# OpenAPI Webhooks router for documentation specification (OpenAPI 3.1.0)
webhooks_router = APIRouter()


# ─── Pydantic Schemas for Inbound Webhooks ───────────────────────────────────

class GateScanWebhookPayload(BaseModel):
    pass_code_or_qr: str = Field(..., description="Raw QR string or alphanumeric pass code")
    proctor_name: Optional[str] = Field("Hardware Gate Scanner", description="Identifier of scanner/proctor")
    contest_slug: Optional[str] = Field(None, description="Optional contest slug to validate against")


class ContestEventWebhookPayload(BaseModel):
    slug: str
    action: str = Field(..., description="action: 'start_live', 'finish', 'reset_timer', 'qualify_top30'")
    timer_minutes: Optional[int] = Field(90, description="Used if action is 'reset_timer'")


class OutboundWebhookRegisterPayload(BaseModel):
    webhook_url: str = Field(..., description="External HTTP endpoint to receive real-time JSON webhooks")


# ─── Pydantic Schemas for Outbound OpenAPI Webhook Events ────────────────────

class PassCheckedInEventPayload(BaseModel):
    event: str = "pass_checked_in"
    pass_code: str = Field(..., description="Unique issued campus pass code")
    seat_number: str = Field(..., description="Assigned lab workstation (e.g. LAB-04-PC01)")
    candidate_name: str = Field(..., description="Full name of the candidate")
    handle: str = Field(..., description="Cadet handle")
    department: Optional[str] = Field(None, description="Department (e.g. CSE)")
    checked_in_at: Optional[str] = Field(None, description="ISO timestamp of admission")
    checked_in_by: str = Field(..., description="Proctor or scanner identifier")
    status: str = Field("checked_in", description="Current pass status")


class ContestStatusChangedEventPayload(BaseModel):
    event: str = "contest_status_changed"
    contest_slug: str = Field(..., description="Unique slug of the contest")
    status: str = Field(..., description="New lifecycle state: 'upcoming', 'live', or 'finished'")
    contest_title: str = Field(..., description="Title of the contest")


class Top30QualifierItem(BaseModel):
    rank: int
    handle: str
    full_name: str
    score: float
    seat_number: str
    pass_code: str


class Top30QualifiedEventPayload(BaseModel):
    event: str = "top30_qualified"
    contest_slug: str = Field(..., description="Unique slug of the contest")
    total_candidates: int = Field(..., description="Total participants in Round 1 screening")
    qualified_count: int = Field(..., description="Number of finalists qualified (Top 30)")
    qualifiers: List[Top30QualifierItem] = Field(..., description="List of qualified finalists")


class SubmissionEvaluatedEventPayload(BaseModel):
    event: str = "submission_evaluated"
    contest_slug: str = Field(..., description="Contest slug")
    problem_id: str = Field(..., description="Evaluated problem ID")
    member_id: str = Field(..., description="Cadet member ID")
    handle: str = Field(..., description="Cadet handle")
    full_name: str = Field(..., description="Cadet full name")
    score: float = Field(..., description="Score awarded by judge")
    verdict: str = Field(..., description="Execution verdict: 'accepted', 'wrong_answer', etc.")
    total_score: float = Field(..., description="Updated total score for the session")


# ─── OpenAPI 3.1 Webhooks Declarations ────────────────────────────────────────

@webhooks_router.post("pass-checked-in")
def on_pass_checked_in(body: PassCheckedInEventPayload):
    """
    **Webhook Event**: `pass_checked_in`
    
    Dispatched when a student QR pass is verified and checked in at the air-gapped lab gate.
    Used by display boards, attendance systems, and candidate companion apps.
    """


@webhooks_router.post("contest-status-changed")
def on_contest_status_changed(body: ContestStatusChangedEventPayload):
    """
    **Webhook Event**: `contest_status_changed`
    
    Dispatched when a contest transitions lifecycle state (e.g. upcoming -> live -> finished).
    Used by arena workstations and lobby monitors to unlock problem sets automatically.
    """


@webhooks_router.post("top30-qualified")
def on_top30_qualified(body: Top30QualifiedEventPayload):
    """
    **Webhook Event**: `top30_qualified`
    
    Dispatched when the online screening window closes and the Top 30 finalists are computed
    and allocated physical lab workstation seats.
    """


@webhooks_router.post("submission-evaluated")
def on_submission_evaluated(body: SubmissionEvaluatedEventPayload):
    """
    **Webhook Event**: `submission_evaluated`
    
    Dispatched when code submitted to CodeBox finishes execution and evaluation.
    Used for live spectator scoreboards and proctor anti-cheat telemetry.
    """


# ─── Inbound Webhook Endpoints ────────────────────────────────────────────────

@router.post("/gate-scan", summary="Inbound webhook for IoT gate turnstiles or external scanners")
async def webhook_gate_scan(
    payload: GateScanWebhookPayload,
    db: AsyncSession = Depends(get_db),
):
    """
    Inbound webhook for automated gate turnstiles, laser barcode scanners, and proctor terminals.
    Verifies candidate pass, admits cadet, and broadcasts real-time SSE event to live client screens.
    """
    res = await PassService.verify_and_check_in(
        raw_input=payload.pass_code_or_qr,
        proctor_name=payload.proctor_name or "Hardware Gate Turnstile",
        contest_slug=payload.contest_slug,
        db=db,
    )

    if res.valid:
        # Broadcast real-time event to all connected clients & candidate screens
        await broadcast_event(
            event_type="pass_checked_in",
            data={
                "pass_code": res.pass_code,
                "seat_number": res.seat_number,
                "candidate_name": res.candidate_name,
                "handle": res.handle,
                "department": res.department,
                "checked_in_at": res.checked_in_at.isoformat() if res.checked_in_at else None,
                "checked_in_by": res.checked_in_by,
                "status": res.status,
            },
            contest_slug=res.contest_slug or payload.contest_slug,
        )

    return res


@router.post("/contest-event", summary="Inbound webhook for automated contest orchestration")
async def webhook_contest_event(
    payload: ContestEventWebhookPayload,
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger contest lifecycle transitions or timer resets via external webhook calls.
    """
    c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == payload.slug))
    contest = c_res.scalars().first()
    if not contest:
        raise HTTPException(status_code=404, detail=f"Contest '{payload.slug}' not found.")

    if payload.action == "start_live":
        from app.services.dynamic_contest_service import DynamicContestService
        await DynamicContestService.change_contest_status(payload.slug, "live", db)
        await broadcast_event(
            event_type="contest_status_changed",
            data={"status": "live", "contest_title": contest.title},
            contest_slug=payload.slug,
        )
        return {"success": True, "message": f"Contest {payload.slug} transitioned to LIVE."}

    elif payload.action == "finish":
        from app.services.dynamic_contest_service import DynamicContestService
        await DynamicContestService.change_contest_status(payload.slug, "finished", db)
        await broadcast_event(
            event_type="contest_status_changed",
            data={"status": "finished", "contest_title": contest.title},
            contest_slug=payload.slug,
        )
        return {"success": True, "message": f"Contest {payload.slug} marked FINISHED."}

    elif payload.action == "reset_timer":
        from datetime import datetime, timezone, timedelta
        from app.core.cache import delete_cache_pattern
        new_ends = datetime.now(timezone.utc) + timedelta(minutes=payload.timer_minutes or 90)
        contest.ends_at = new_ends
        await db.commit()
        await delete_cache_pattern("cache:contest*")

        await broadcast_event(
            event_type="arena_timer_reset",
            data={"remaining_seconds": (payload.timer_minutes or 90) * 60, "ends_at": new_ends.isoformat()},
            contest_slug=payload.slug,
        )
        return {"success": True, "message": f"Contest {payload.slug} timer reset to {payload.timer_minutes} minutes."}

    else:
        raise HTTPException(status_code=400, detail=f"Unknown action '{payload.action}'")


@router.post("/register-outbound", summary="Register an external webhook listener URL")
async def register_webhook_listener(payload: OutboundWebhookRegisterPayload):
    """
    Register an outbound webhook URL to receive all real-time events dispatched by the platform.
    """
    register_outbound_webhook(payload.webhook_url)
    return {"success": True, "message": f"Webhook '{payload.webhook_url}' registered successfully."}
