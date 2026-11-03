"""
HCVE Control Plane FastAPI Router.
Implements HCVE-010 & API_AND_EVENT_CONTRACTS.md:
- POST /api/v1/hcve/sessions (Create session)
- GET /api/v1/hcve/sessions/{session_id} (Read status)
- DELETE /api/v1/hcve/sessions/{session_id} (Close session)
- POST /api/v1/hcve/sessions/{session_id}/interrupt (Explicit client barge-in)
- GET /api/v1/hcve/health (Process health)
- GET /api/v1/hcve/ready (Readiness probe)
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.middleware.auth import get_current_member
from app.models.db_models import MemberProfile
from app.models.interview import InterviewSession, InterviewVoiceLink

from app.services.hcve import (
    AudioTransportConfig,
    EventEnvelope,
    HCVEError,
    HCVEErrorCode,
    InMemorySessionRepository,
    SessionConfig,
    SessionRepository,
    SessionState,
    TurnState,
    VoiceRuntimeCoordinator,
)

router = APIRouter(prefix="/hcve", tags=["HCVE - Human Conversational Voice Engine"])

# Shared singleton coordinator & repo for FastAPI endpoints
_shared_repo = InMemorySessionRepository()
_shared_coordinator = VoiceRuntimeCoordinator(session_repo=_shared_repo)


def get_coordinator() -> VoiceRuntimeCoordinator:
    return _shared_coordinator


# ---------------------------------------------------------------------------
# Request & Response Schemas
# ---------------------------------------------------------------------------

class CreateSessionRequest(BaseModel):
    application_id: str = Field(default="app_demo")
    persona_id: str = Field(default="persona_default")
    language: str = Field(default="en-IN")
    transport: AudioTransportConfig = Field(default_factory=AudioTransportConfig)
    memory_mode: str = Field(default="session_only")
    interview_session_id: Optional[str] = Field(default=None, description="Optional linked interview session ID")


class CreateSessionResponse(BaseModel):
    session_id: str
    owner_id: str
    state: TurnState
    created_at: str
    transport: AudioTransportConfig


class InterruptRequest(BaseModel):
    reason: str = Field(default="client_explicit_interrupt")


class InterruptResponse(BaseModel):
    session_id: str
    interrupted: bool
    new_state: TurnState


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/health")
async def get_health() -> Dict[str, str]:
    """Process liveness probe."""
    return {"status": "ok", "service": "hcve-engine", "version": "0.2.0"}


@router.get("/ready")
async def get_ready() -> Dict[str, Any]:
    """Dependency readiness probe."""
    return {"status": "ready", "adapters": ["fake_vad", "fake_stt", "fake_llm", "fake_tts"]}


@router.post("/sessions", response_model=CreateSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    req: CreateSessionRequest,
    current_member: MemberProfile = Depends(get_current_member),
    coord: VoiceRuntimeCoordinator = Depends(get_coordinator),
    db: AsyncSession = Depends(get_db),
) -> CreateSessionResponse:
    """Create a new conversational voice session."""
    session_id = f"ses_{uuid.uuid4().hex[:12]}"

    if req.interview_session_id:
        stmt = select(InterviewSession).where(InterviewSession.id == req.interview_session_id)
        interview_session = (await db.execute(stmt)).scalars().first()
        if not interview_session:
            raise HTTPException(status_code=404, detail="Linked interview session not found.")
        if interview_session.member_id != current_member.id:
            raise HTTPException(status_code=403, detail="Access denied to interview session.")

        voice_link = InterviewVoiceLink(
            session_id=interview_session.id,
            member_id=current_member.id,
            hcve_session_id=session_id,
            status="ACTIVE",
        )
        db.add(voice_link)
        await db.commit()

    new_session = SessionState(
        session_id=session_id,
        owner_id=current_member.id,
        application_id=req.application_id,
        persona_id=req.persona_id,
        language=req.language,
        transport=req.transport,
    )
    saved = await coord.session_repo.create(new_session)
    return CreateSessionResponse(
        session_id=saved.session_id,
        owner_id=saved.owner_id,
        state=saved.state,
        created_at=saved.created_at,
        transport=saved.transport,
    )


@router.get("/sessions/{session_id}", response_model=SessionState)
async def get_session(
    session_id: str,
    current_member: MemberProfile = Depends(get_current_member),
    coord: VoiceRuntimeCoordinator = Depends(get_coordinator),
) -> SessionState:
    """Retrieve active session status."""
    session = await coord.session_repo.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    if session.owner_id != current_member.id:
        raise HTTPException(status_code=403, detail="Access denied to voice session.")
    return session


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def close_session(
    session_id: str,
    current_member: MemberProfile = Depends(get_current_member),
    coord: VoiceRuntimeCoordinator = Depends(get_coordinator),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Gracefully close and terminate a voice session."""
    session = await coord.session_repo.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.owner_id != current_member.id:
        raise HTTPException(status_code=403, detail="Access denied to voice session.")

    await coord.transition_state(session_id, TurnState.CLOSED)
    await coord.session_repo.delete(session_id)

    stmt = select(InterviewVoiceLink).where(InterviewVoiceLink.hcve_session_id == session_id)
    link = (await db.execute(stmt)).scalars().first()
    if link:
        link.status = "CLOSED"
        link.closed_at = datetime.now(timezone.utc)
        await db.commit()


@router.post("/sessions/{session_id}/interrupt", response_model=InterruptResponse)
async def interrupt_session(
    session_id: str,
    req: InterruptRequest,
    current_member: MemberProfile = Depends(get_current_member),
    coord: VoiceRuntimeCoordinator = Depends(get_coordinator),
) -> InterruptResponse:
    """Explicitly trigger client-initiated interruption."""
    session = await coord.session_repo.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.owner_id != current_member.id:
        raise HTTPException(status_code=403, detail="Access denied to voice session.")
    interrupted = await coord.cancel_active_response(session_id, reason=req.reason)
    return InterruptResponse(
        session_id=session.session_id,
        interrupted=interrupted,
        new_state=session.state,
    )
    updated = await coord.session_repo.get(session_id)
    return InterruptResponse(
        session_id=session_id,
        interrupted=interrupted,
        new_state=updated.state if updated else TurnState.CLOSED,
    )
