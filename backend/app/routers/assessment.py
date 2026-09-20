"""
Chaos Computer Club — Assessment & Code Execution Router
Powered by CodeBox Execution Engine & Decoupled Assessment Service
Delegates to app.controllers.assessment_controller.AssessmentController
"""

from typing import Optional
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.middleware.auth import get_current_member
from app.middleware.rate_limit import rate_limit
from app.middleware.assessment_guard import require_active_assessment_session
from app.engine.enums import Language
from app.models.db_models import MemberProfile
from app.controllers.assessment_controller import AssessmentController

router = APIRouter(prefix="/assessment", tags=["Assessment & Code Execution"])


# ─── Pydantic Request Models ──────────────────────────────────────────────────

class RunCodeRequest(BaseModel):
    problem_id: str
    language: Language
    code: str
    custom_stdin: Optional[str] = None


class SubmitCodeRequest(BaseModel):
    problem_id: str
    language: Language
    code: str


class TelemetryRequest(BaseModel):
    event_type: str  # "tab_switch", "window_blur", "fullscreen_exit"


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/{contest_slug}")
async def get_or_start_assessment(
    contest_slug: str,
    response: Response,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve candidate assessment status or active session.
    If the window has not opened yet, returns waiting metadata with opens_in countdown.
    If open, returns/initializes the active session with problems and starter code.
    If already submitted, returns finalized completed state.
    """
    return await AssessmentController.get_or_start_assessment(
        contest_slug=contest_slug,
        response=response,
        current_member=current_member,
        db=db,
    )


@router.post("/{contest_slug}/run")
async def run_sample_code(
    request: Request,
    contest_slug: str,
    payload: RunCodeRequest,
    active_guard: tuple = Depends(require_active_assessment_session),
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
    _rl: None = Depends(rate_limit("assessment:run", max_calls=30, window_seconds=60)),
):
    """Run code against sample testcases or custom stdin using the CodeBox engine. Blocked if already submitted."""
    return await AssessmentController.run_sample_code(
        problem_id=payload.problem_id,
        language=payload.language,
        code=payload.code,
        custom_stdin=payload.custom_stdin,
        active_guard=active_guard,
        db=db,
    )


@router.post("/{contest_slug}/submit")
async def submit_assessment_code(
    request: Request,
    contest_slug: str,
    payload: SubmitCodeRequest,
    active_guard: tuple = Depends(require_active_assessment_session),
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
    _rl: None = Depends(rate_limit("assessment:submit", max_calls=10, window_seconds=60)),
):
    """Submit code for official assessment evaluation against all testcases on CodeBox. Blocked if already submitted."""
    return await AssessmentController.submit_assessment_code(
        contest_slug=contest_slug,
        problem_id=payload.problem_id,
        language=payload.language,
        code=payload.code,
        active_guard=active_guard,
        current_member=current_member,
        db=db,
    )


@router.post("/{contest_slug}/telemetry")
async def report_anti_cheat_event(
    contest_slug: str,
    payload: TelemetryRequest,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Log tab switch / window blur event."""
    return await AssessmentController.report_anti_cheat_event(
        contest_slug=contest_slug,
        current_member=current_member,
        db=db,
    )


@router.post("/{contest_slug}/finish")
async def finish_assessment(
    contest_slug: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Candidate manually finishes the assessment."""
    return await AssessmentController.finish_assessment(
        contest_slug=contest_slug,
        current_member=current_member,
        db=db,
    )


@router.get("/{contest_slug}/leaderboard")
async def get_assessment_leaderboard(
    contest_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Round 1 ranking, served from cache.
    Sealed until the screening window closes, then published in full with the exact Top 30 cutoff.
    """
    return await AssessmentController.get_assessment_leaderboard(contest_slug=contest_slug, db=db)


@router.post("/{contest_slug}/qualify-top30")
async def qualify_top_30(
    contest_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Freezes assessment rankings, tags Top 30 qualifiers, and auto-issues Digital Campus QR Passes."""
    return await AssessmentController.qualify_top_30(contest_slug=contest_slug, db=db)


@router.post("/{contest_slug}/reset-dev-session")
async def reset_dev_assessment_session(
    contest_slug: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Development endpoint: Reset candidate's attempt for testing from scratch."""
    return await AssessmentController.reset_dev_assessment_session(
        contest_slug=contest_slug,
        current_member=current_member,
        db=db,
    )
