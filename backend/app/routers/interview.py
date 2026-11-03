"""
Chaos Computer Club Medi-Caps — AI Interview Practice Router
Provides endpoints for creating, simulating, executing, evaluating,
and reviewing AI-driven technical and behavioral practice interviews.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.middleware.auth import get_current_member, get_current_member_optional
from app.models.member import MemberProfile
from app.schemas.interview import (
    InterviewConfigCreate,
    InterviewAnswerSubmit,
    InterviewSessionDetail,
    InterviewSessionListItem,
    InterviewCategoryInfo,
    InterviewReportDetail,
    CandidateProfileResponse,
    CandidateProfileUpdate,
    ResumeUploadResponse,
    ResumeDetailResponse,
    ResumeFactItem,
    ResumeFactUpdateRequest,
    ResumeConsentRequest,
    CompetencyGraphResponse,
    SessionPredictionsResponseSchema,
    AdaptiveNextQuestionResponse,
    CompetencyTaxonomyItem,
    InterviewTrackSummary,
    InterviewTrackDetail,
)
from app.services.interview.category_registry import get_all_categories
from app.services.interview.blueprint_registry import BlueprintRegistryService
from app.services.interview.langgraph_orchestrator import LangGraphInterviewOrchestrator as InterviewOrchestrator

router = APIRouter(prefix="/interview", tags=["AI Interview Practice"])


# ─── PUBLISHED TRACKS CATALOG (AUTHORITATIVE) ────────────────────────────────

@router.get("/tracks", response_model=List[InterviewTrackSummary], summary="List published interview tracks")
@router.get("/domains", response_model=List[InterviewTrackSummary], summary="List published interview domains")
async def list_published_tracks(
    category: Optional[str] = Query(None, description="Optional category filter (TECHNICAL, OTHER)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns all published, immutable interview tracks with public metadata.
    Database-driven: dynamically surfaces any active published blueprint in PostgreSQL.
    Internal rubrics, evaluation weights, and prompt templates are strictly omitted.
    """
    return await BlueprintRegistryService.list_published_tracks_async(category=category, db=db)


@router.get("/tracks/{slug}", response_model=InterviewTrackDetail, summary="Get published track detail")
@router.get("/domains/{slug}", response_model=InterviewTrackDetail, summary="Get published domain detail")
async def get_published_track_detail(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves detailed public metadata for a specific published interview track.
    Database-driven lookup with in-memory fallback.
    """
    track = await BlueprintRegistryService.get_track_detail_async(slug, db=db)
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interview track '{slug}' not found.",
        )
    return track


# ─── CATEGORIES & TAXONOMY ───────────────────────────────────────────────────

@router.get("/categories", response_model=List[InterviewCategoryInfo], summary="List supported interview categories")
async def list_interview_categories():
    """Returns curated interview categories with badges, capabilities, and default topics."""
    categories = get_all_categories()
    return categories


@router.get("/competencies", response_model=List[CompetencyTaxonomyItem], summary="List competency taxonomy nodes")
async def list_competency_taxonomy():
    """Returns versioned technical competency taxonomy with prerequisites and relationships."""
    return InterviewOrchestrator.list_competency_taxonomy()


@router.get("/sessions/{session_id}/competency-graph", response_model=CompetencyGraphResponse, summary="Get dynamic competency graph projection")
async def get_competency_graph(
    session_id: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves live competency graph projection with BKT mastery, uncertainty, and coordinates."""
    return await InterviewOrchestrator.get_competency_graph(
        session_id=session_id,
        member=current_member,
        db=db,
    )


@router.get("/sessions/{session_id}/predictions", response_model=SessionPredictionsResponseSchema, summary="Get calibrated performance predictions")
async def get_session_predictions(
    session_id: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves calibrated future response probability forecasts and confidence intervals."""
    return await InterviewOrchestrator.get_predictions(
        session_id=session_id,
        member=current_member,
        db=db,
    )


@router.post("/sessions/{session_id}/adaptive-next-question", response_model=AdaptiveNextQuestionResponse, summary="Select next question via adaptive policy")
async def get_adaptive_next_question(
    session_id: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Selects the highest assessment-utility question using contextual information gain and BKT uncertainty."""
    return await InterviewOrchestrator.get_adaptive_next_question(
        session_id=session_id,
        member=current_member,
        db=db,
    )


# ─── CANDIDATE PROFILE ────────────────────────────────────────────────────────

@router.get("/profile", response_model=CandidateProfileResponse, summary="Get candidate interview profile")
async def get_candidate_profile(
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves candidate profile, skills, declared projects, and context consent."""
    return await InterviewOrchestrator.get_profile(current_member, db)


@router.patch("/profile", response_model=CandidateProfileResponse, summary="Update candidate interview profile")
async def update_candidate_profile(
    payload: CandidateProfileUpdate,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Updates candidate profile skills, goals, projects, and consent settings."""
    return await InterviewOrchestrator.update_profile(current_member, payload, db)


@router.delete("/profile", summary="Delete candidate interview profile")
async def delete_candidate_profile(
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Soft-deletes candidate profile and revokes context consent."""
    return await InterviewOrchestrator.delete_profile(current_member, db)


# ─── RESUME ASSETS & FACTS ────────────────────────────────────────────────────

@router.post("/resumes", response_model=ResumeUploadResponse, status_code=status.HTTP_201_CREATED, summary="Upload resume asset")
async def upload_resume_asset(
    file: UploadFile = File(...),
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Uploads candidate resume, runs format validation, and extracts initial facts."""
    return await InterviewOrchestrator.upload_resume(current_member, file, db)


@router.get("/resumes/{asset_id}", response_model=ResumeDetailResponse, summary="Get resume asset and facts")
async def get_resume_asset(
    asset_id: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves resume asset details and provenance-extracted facts for candidate review."""
    return await InterviewOrchestrator.get_resume(asset_id, current_member, db)


@router.patch("/resumes/{asset_id}/facts", response_model=List[ResumeFactItem], summary="Review and update extracted facts")
async def update_resume_facts(
    asset_id: str,
    updates: List[ResumeFactUpdateRequest],
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Enables candidate to confirm, correct, or reject extracted resume facts."""
    return await InterviewOrchestrator.update_resume_facts(asset_id, updates, current_member, db)


@router.post("/resumes/{asset_id}/consent", summary="Grant or revoke consent for resume usage")
async def consent_resume_asset(
    asset_id: str,
    payload: ResumeConsentRequest,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Explicitly grants or revokes consent to use resume facts in interview sessions."""
    return await InterviewOrchestrator.consent_resume(asset_id, payload, current_member, db)


@router.delete("/resumes/{asset_id}", summary="Delete resume asset and facts")
async def delete_resume_asset(
    asset_id: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Permanently deletes a resume asset and cascades deletion to all extracted facts."""
    return await InterviewOrchestrator.delete_resume(asset_id, current_member, db)


# ─── SESSIONS CRUD & LIFECYCLE ────────────────────────────────────────────────

@router.post("/sessions", response_model=InterviewSessionDetail, status_code=status.HTTP_201_CREATED, summary="Create a new interview session")
async def create_interview_session(
    payload: InterviewConfigCreate,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates an interview practice session tailored to the candidate's target role,
    category, difficulty, and optional resume notes or job description.
    """
    return await InterviewOrchestrator.create_session(
        member=current_member,
        payload=payload,
        db=db,
    )


@router.get("/sessions", response_model=List[InterviewSessionListItem], summary="List member interview sessions")
async def list_member_sessions(
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves all interview sessions created by the authenticated member."""
    return await InterviewOrchestrator.list_sessions(
        member=current_member,
        limit=limit,
        offset=offset,
        db=db,
    )


@router.get("/sessions/{session_id}", response_model=InterviewSessionDetail, summary="Get interview session detail")
async def get_session_detail(
    session_id: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves session details, full question transcript, candidate answers, and evaluations."""
    return await InterviewOrchestrator.get_session_detail(
        session_id=session_id,
        member=current_member,
        db=db,
    )


@router.post("/sessions/{session_id}/start", response_model=InterviewSessionDetail, summary="Start an interview session")
async def start_interview_session(
    session_id: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """
    Transitions session to PREPARING -> ASKING.
    Generates personalized interview agenda via LLM and presents the first question.
    """
    return await InterviewOrchestrator.start_session(
        session_id=session_id,
        member=current_member,
        db=db,
    )


@router.post("/sessions/{session_id}/answer", response_model=InterviewSessionDetail, summary="Submit candidate answer")
@router.post("/sessions/{session_id}/responses", response_model=InterviewSessionDetail, summary="Submit candidate response (canonical alias)")
async def submit_candidate_answer(
    session_id: str,
    payload: InterviewAnswerSubmit,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """
    Submits candidate answer (text and/or code) for the active question.
    Enforces idempotency via idempotency_key to prevent duplicate submissions.
    Evaluates turn, delivers rubric scores, and advances or follows up adaptively.
    """
    return await InterviewOrchestrator.submit_answer(
        session_id=session_id,
        payload=payload,
        member=current_member,
        db=db,
    )


@router.post("/sessions/{session_id}/pause", response_model=InterviewSessionDetail, summary="Pause an in-progress interview")
async def pause_interview_session(
    session_id: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Pauses an ongoing interview session."""
    return await InterviewOrchestrator.pause_session(
        session_id=session_id,
        member=current_member,
        db=db,
    )


@router.post("/sessions/{session_id}/resume", response_model=InterviewSessionDetail, summary="Resume a paused interview")
async def resume_interview_session(
    session_id: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Resumes a paused interview session and restores the active question."""
    return await InterviewOrchestrator.resume_session(
        session_id=session_id,
        member=current_member,
        db=db,
    )


@router.post("/sessions/{session_id}/complete", response_model=InterviewSessionDetail, summary="Finalize and conclude interview")
async def complete_interview_session(
    session_id: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Concludes the interview early or on schedule, synthesizing the final coaching report."""
    return await InterviewOrchestrator.complete_session(
        session_id=session_id,
        member=current_member,
        db=db,
    )


@router.post("/sessions/{session_id}/abandon", response_model=InterviewSessionDetail, summary="Abandon an interview session")
async def abandon_interview_session(
    session_id: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Terminates an ongoing interview without completing it."""
    return await InterviewOrchestrator.abandon_session(
        session_id=session_id,
        member=current_member,
        db=db,
    )


@router.get("/sessions/{session_id}/report", response_model=InterviewReportDetail, summary="Get interview coaching report")
async def get_interview_report(
    session_id: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves authoritative coaching report with dimensional rubric evaluations."""
    return await InterviewOrchestrator.get_report(
        session_id=session_id,
        member=current_member,
        db=db,
    )


@router.post("/sessions/{session_id}/report/regenerate", response_model=InterviewReportDetail, summary="Regenerate interview coaching report")
async def regenerate_interview_report(
    session_id: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Creates a new version of the coaching report with updated dimensions."""
    return await InterviewOrchestrator.regenerate_report(
        session_id=session_id,
        member=current_member,
        db=db,
    )


# ─── VOICE SESSION BINDING ────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/voice-session", summary="Bind HCVE voice session to interview session")
async def bind_voice_session(
    session_id: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Links an active interview session to an HCVE voice session with owner authorization."""
    return await InterviewOrchestrator.bind_voice_session(
        session_id=session_id,
        member=current_member,
        db=db,
    )


@router.post("/sessions/{session_id}/voice-session/{voice_id}/interrupt", summary="Interrupt active voice playback")
async def interrupt_voice_session(
    session_id: str,
    voice_id: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Interrupts active voice output playback for candidate barge-in."""
    return await InterviewOrchestrator.interrupt_voice_session(
        session_id=session_id,
        voice_id=voice_id,
        member=current_member,
        db=db,
    )


@router.delete("/sessions/{session_id}/voice-session/{voice_id}", summary="Close HCVE voice session")
async def close_voice_session(
    session_id: str,
    voice_id: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Gracefully terminates voice session link."""
    return await InterviewOrchestrator.close_voice_session(
        session_id=session_id,
        voice_id=voice_id,
        member=current_member,
        db=db,
    )


@router.delete("/sessions/{session_id}", summary="Delete an interview session")
async def delete_interview_session(
    session_id: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Permanently deletes an interview session and all associated data."""
    return await InterviewOrchestrator.delete_session(
        session_id=session_id,
        member=current_member,
        db=db,
    )


# ─── CANONICAL ALIAS ROUTER (08_IMPLEMENTATION_ARCHITECTURE_AND_APIS) ────────

canonical_interview_router = APIRouter(tags=["AI Interview Practice (Canonical Aliases)"])


@canonical_interview_router.get("/interview-domains", response_model=List[InterviewTrackSummary], summary="List published domains (spec alias)")
async def alias_list_domains(
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await BlueprintRegistryService.list_published_tracks_async(category=category, db=db)


@canonical_interview_router.get("/interview-domains/{slug}", response_model=InterviewTrackDetail, summary="Get domain detail (spec alias)")
@canonical_interview_router.get("/interviews/{slug}", response_model=InterviewTrackDetail, summary="Get interview detail (spec alias)")
async def alias_get_track(slug: str, db: AsyncSession = Depends(get_db)):
    track = await BlueprintRegistryService.get_track_detail_async(slug, db=db)
    if not track:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Interview track '{slug}' not found.")
    return track


@canonical_interview_router.post("/interview-sessions", response_model=InterviewSessionDetail, status_code=status.HTTP_201_CREATED, summary="Create interview session (spec alias)")
async def alias_create_session(
    payload: InterviewConfigCreate,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    return await InterviewOrchestrator.create_session(member=current_member, payload=payload, db=db)


@canonical_interview_router.get("/interview-sessions", response_model=List[InterviewSessionListItem], summary="List member sessions (spec alias)")
async def alias_list_sessions(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    return await InterviewOrchestrator.list_sessions(member=current_member, limit=limit, offset=offset, db=db)


@canonical_interview_router.get("/interview-sessions/{session_id}", response_model=InterviewSessionDetail, summary="Get session detail (spec alias)")
async def alias_get_session(
    session_id: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    return await InterviewOrchestrator.get_session_detail(session_id=session_id, member=current_member, db=db)


@canonical_interview_router.post("/interview-sessions/{session_id}/responses", response_model=InterviewSessionDetail, summary="Submit response (spec alias)")
async def alias_submit_response(
    session_id: str,
    payload: InterviewAnswerSubmit,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    return await InterviewOrchestrator.submit_answer(session_id=session_id, payload=payload, member=current_member, db=db)


@canonical_interview_router.get("/interview-sessions/{session_id}/report", response_model=InterviewReportDetail, summary="Get session report (spec alias)")
async def alias_get_report(
    session_id: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    return await InterviewOrchestrator.get_report(session_id=session_id, member=current_member, db=db)
