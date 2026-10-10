"""
Chaos Computer Club Medi-Caps — Practice Platform API Router
Provides endpoints for browsing practice problems, executing code in the Web IDE,
submitting solutions against the authoritative judge, and tracking 365-day coding activity.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.db import get_db
from app.middleware.auth import get_current_member, get_current_member_optional
from app.models.member import MemberProfile
from app.services.practice_service import PracticeService

router = APIRouter(prefix="/practice", tags=["Practice Platform"])


class PracticeRunRequest(BaseModel):
    code: str = Field(..., description="Source code to run")
    language: str = Field(..., description="Programming language: python, cpp, c, java, javascript, typescript")


class PracticeSubmitRequest(BaseModel):
    code: str = Field(..., description="Source code to submit")
    language: str = Field(..., description="Programming language: python, cpp, c, java, javascript, typescript")


# ─── TAXONOMY & TOPICS ────────────────────────────────────────────────────────

@router.get("/topics", summary="List canonical DSA topics with problem counts")
async def get_practice_topics(
    db: AsyncSession = Depends(get_db),
):
    """Returns canonical DSA topics and count of published problems for each topic."""
    return await PracticeService.get_topics(db=db)


# ─── PROBLEMS LISTING ─────────────────────────────────────────────────────────

@router.get("/problems", summary="Browse and filter practice challenges")
async def list_practice_problems(
    q: Optional[str] = Query(None, description="Search term for title, topic, or description"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty: EASY, MEDIUM, HARD, ALL"),
    topic: Optional[str] = Query(None, description="Filter by topic name or slug"),
    status: Optional[str] = Query(None, description="Filter by status: ALL, SOLVED, ATTEMPTED, UNSOLVED"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    sort: Optional[str] = Query(None, description="Sort order: difficulty_asc, difficulty_desc, title_asc"),
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Search and filter published practice problems with server-side pagination
    and authoritative solved state.
    """
    return await PracticeService.list_practice_problems(
        db=db,
        current_member=current_member,
        q=q,
        difficulty=difficulty,
        topic=topic,
        status=status,
        page=page,
        limit=limit,
        sort=sort,
    )


# ─── PROBLEM DETAIL ──────────────────────────────────────────────────────────

@router.get("/problems/{slug}", summary="Get practice problem statement & visible samples")
async def get_practice_problem(
    slug: str,
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves complete problem statement, constraints, visible examples, and starter code.
    Hidden testcases are cryptographically protected and never exposed.
    """
    return await PracticeService.get_practice_problem(
        db=db,
        slug_or_id=slug,
        current_member=current_member,
    )


# ─── RUN (TEST SAMPLES) ──────────────────────────────────────────────────────

@router.post("/problems/{slug}/run", summary="Run code against visible sample testcases")
async def run_practice_code(
    slug: str,
    payload: PracticeRunRequest,
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Executes user code against visible sample test cases without persisting a submission.
    """
    return await PracticeService.run_practice_code(
        db=db,
        slug_or_id=slug,
        code=payload.code,
        language=payload.language,
        current_member=current_member,
    )


# ─── SUBMIT (FULL JUDGE) ─────────────────────────────────────────────────────

@router.post("/problems/{slug}/submit", summary="Submit code against full judge test suite")
async def submit_practice_code(
    slug: str,
    payload: PracticeSubmitRequest,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """
    Submits code to the central execution router against the full judge test suite.
    Persists submission with context=PRACTICE and updates authoritative member stats.
    """
    return await PracticeService.submit_practice_code(
        db=db,
        slug_or_id=slug,
        code=payload.code,
        language=payload.language,
        current_member=current_member,
    )


# ─── SUBMISSION HISTORY ──────────────────────────────────────────────────────

@router.get("/problems/{slug}/submissions", summary="List user's submission history for problem")
async def get_practice_submissions(
    slug: str,
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Returns the authenticated cadet's historical submissions on this practice problem."""
    return await PracticeService.get_practice_submissions(
        db=db,
        slug_or_id=slug,
        current_member=current_member,
        limit=limit,
        offset=offset,
    )


@router.get("/submissions/recent", summary="Get authenticated cadet's recent submissions")
async def get_my_recent_submissions(
    limit: int = Query(10, ge=1, le=50),
    only_accepted: bool = Query(False),
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Returns authenticated cadet's most recent practice submissions."""
    return await PracticeService.get_recent_submissions(
        db=db,
        member_id=current_member.id,
        limit=limit,
        only_accepted=only_accepted,
    )


@router.get("/submissions/recent/{handle}", summary="Get student's recent submissions by handle")
async def get_student_recent_submissions(
    handle: str,
    limit: int = Query(10, ge=1, le=50),
    only_accepted: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    """Returns student cadet's most recent practice submissions by handle."""
    member = await db.scalar(
        select(MemberProfile).where(
            func.lower(MemberProfile.handle) == handle.strip().lower()
        )
    )
    if not member:
        raise HTTPException(status_code=404, detail=f"Student handle '{handle}' not found.")

    return await PracticeService.get_recent_submissions(
        db=db,
        member_id=member.id,
        limit=limit,
        only_accepted=only_accepted,
    )


# ─── CODING ACTIVITY & PROFILE STATISTICS ────────────────────────────────────

@router.get("/activity", summary="Get authenticated user's 365-day coding activity graph")
async def get_my_activity(
    year: Optional[int] = Query(None, description="Calendar year for activity graph (defaults to current year)"),
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns 365 days of authoritative coding activity, streaks, and active day counts.
    """
    return await PracticeService.get_user_activity(
        db=db,
        member_id=current_member.id,
        year=year,
    )


@router.get("/activity/{handle}", summary="Get student's 365-day coding activity graph")
async def get_student_activity(
    handle: str,
    year: Optional[int] = Query(None, description="Calendar year for activity graph"),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns public 365 days of coding activity for another student cadet by handle.
    """
    member = await db.scalar(
        select(MemberProfile).where(
            func.lower(MemberProfile.handle) == handle.strip().lower()
        )
    )
    if not member:
        raise HTTPException(status_code=404, detail=f"Student handle '{handle}' not found.")

    return await PracticeService.get_user_activity(
        db=db,
        member_id=member.id,
        year=year,
    )


@router.get("/stats", summary="Get authenticated user's canonical problem-solving stats")
async def get_my_problem_stats(
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns total solved, attempted, and difficulty distribution (easy/medium/hard).
    """
    return await PracticeService.get_user_problem_stats(
        db=db,
        member_id=current_member.id,
    )


@router.get("/stats/{handle}", summary="Get student's canonical problem-solving stats")
async def get_student_problem_stats(
    handle: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Returns public problem-solving stats and difficulty distribution for another cadet.
    """
    member = await db.scalar(
        select(MemberProfile).where(
            func.lower(MemberProfile.handle) == handle.strip().lower()
        )
    )
    if not member:
        raise HTTPException(status_code=404, detail=f"Student handle '{handle}' not found.")

    return await PracticeService.get_user_problem_stats(
        db=db,
        member_id=member.id,
    )


@router.post("/reconcile", summary="Reconcile authoritative statistics from submissions")
async def reconcile_my_stats(
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """
    Self-healing endpoint: rebuilds MemberProblemStats from raw PostgreSQL submissions.
    """
    count = await PracticeService.reconcile_member_problem_stats(
        db=db,
        member_id=current_member.id,
    )
    return {"success": True, "reconciled_problems": count}
