"""
Chaos Computer Club — Medi-Caps Chapter
routers/webhooks.py — Inbound Webhooks & OpenAPI 3.1 Webhooks Router
Delegates inbound business orchestration to app.controllers.webhook_controller.WebhookController
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.controllers.webhook_controller import WebhookController

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
    """


@webhooks_router.post("contest-status-changed")
def on_contest_status_changed(body: ContestStatusChangedEventPayload):
    """
    **Webhook Event**: `contest_status_changed`
    Dispatched when a contest transitions lifecycle state (e.g. upcoming -> live -> finished).
    """


@webhooks_router.post("top30-qualified")
def on_top30_qualified(body: Top30QualifiedEventPayload):
    """
    **Webhook Event**: `top30_qualified`
    Dispatched when the online screening window closes and the Top 30 finalists are computed.
    """


@webhooks_router.post("submission-evaluated")
def on_submission_evaluated(body: SubmissionEvaluatedEventPayload):
    """
    **Webhook Event**: `submission_evaluated`
    Dispatched when code submitted to CodeBox finishes execution and evaluation.
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
    return await WebhookController.handle_gate_scan(
        pass_code_or_qr=payload.pass_code_or_qr,
        proctor_name=payload.proctor_name,
        contest_slug=payload.contest_slug,
        db=db,
    )


@router.post("/contest-event", summary="Inbound webhook for automated contest orchestration")
async def webhook_contest_event(
    payload: ContestEventWebhookPayload,
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger contest lifecycle transitions or timer resets via external webhook calls.
    """
    return await WebhookController.handle_contest_event(
        slug=payload.slug,
        action=payload.action,
        timer_minutes=payload.timer_minutes or 90,
        db=db,
    )


@router.post("/register-outbound", summary="Register an external webhook listener URL")
async def register_webhook_listener(payload: OutboundWebhookRegisterPayload):
    """
    Register an outbound webhook URL to receive all real-time events dispatched by the platform.
    """
    return WebhookController.register_outbound(payload.webhook_url)
