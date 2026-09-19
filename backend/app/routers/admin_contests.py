"""
Chaos Computer Club — Dynamic Contest Management & Admin API Router
Endpoints for creating, updating, cloning, configuring, and publishing campus contests.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import get_db
from app.middleware.auth import require_admin_or_core
from app.models.db_models import MemberProfile, OfflineContest
from app.schemas.dynamic_contest import (
    DynamicContestCreateRequest,
    DynamicContestUpdateRequest,
    ProblemCreateSchema,
    ProblemSaveRequest,
    ProblemSyncRequest,
    AssessmentUpdateRequest,
    ContestAdminDetailResponse,
    ContestCloneRequest,
    PresetContestLaunchRequest,
    ContestStatusChangeRequest,
)
from app.services.dynamic_contest_service import DynamicContestService

router = APIRouter(prefix="/admin/contests", tags=["Admin Contest Management"])


@router.get(
    "",
    summary="List all contests for admin management",
)
async def list_admin_contests(
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """List all campus contests with administrative overview metrics."""
    stmt = (
        select(OfflineContest)
        .options(
            selectinload(OfflineContest.problems),
            selectinload(OfflineContest.assessment),
        )
        .order_by(OfflineContest.starts_at.desc())
    )
    result = await db.execute(stmt)
    contests = result.scalars().all()

    payload = []
    for c in contests:
        payload.append({
            "id": c.id,
            "slug": c.slug,
            "title": c.title,
            "season": c.season,
            "status": c.status,
            "division": c.division,
            "cadence": c.cadence,
            "edition": c.edition,
            "starts_at": c.starts_at.isoformat() if c.starts_at else None,
            "ends_at": c.ends_at.isoformat() if c.ends_at else None,
            "check_in_opens_at": c.check_in_opens_at.isoformat() if c.check_in_opens_at else None,
            "venue": c.venue,
            "seat_capacity": c.seat_capacity,
            "registered_count": c.registered_count,
            "problem_count": len(c.problems) if c.problems else 0,
            "has_assessment": c.assessment is not None,
            "assessment_duration": c.assessment.duration_minutes if c.assessment else None,
            "assessment_active": c.assessment.is_active if c.assessment else False,
            "environment": c.environment,
            "summary": c.summary,
            "rules": c.rules or [],
        })
    return payload


@router.get(
    "/{slug}",
    summary="Fetch complete admin dossier for a contest",
    response_model=ContestAdminDetailResponse,
)
async def get_admin_contest(
    slug: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Fetch complete administrative details: contest, assessment, arena problems, and screening problems."""
    return await DynamicContestService.get_admin_contest_detail(slug, db)


@router.post(
    "",
    summary="Create dynamic contest, screening assessment, and problems",
    status_code=status.HTTP_201_CREATED,
)
async def create_dynamic_contest(
    payload: DynamicContestCreateRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """
    Production-grade dynamic contest creator.
    Atomically creates:
    - OfflineContest entity
    - Phase 1 Online Screening Assessment
    - Full mirrored problem challenge suite (Arena & Assessment)
    - Custom starter codes and sample/hidden test cases
    """
    return await DynamicContestService.create_contest(payload, db, creator=admin)


@router.put(
    "/{slug}",
    summary="Update contest specifications",
)
async def update_contest(
    slug: str,
    payload: DynamicContestUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Dynamically update contest details, schedule, venue, rules, or capacity."""
    return await DynamicContestService.update_contest(slug, payload, db)


@router.delete(
    "/{slug}",
    summary="Delete contest permanently",
)
async def delete_contest(
    slug: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Cascade delete a contest, its problems, submissions, screening rounds, and passes."""
    return await DynamicContestService.delete_contest(slug, db)


@router.put(
    "/{slug}/assessment",
    summary="Update or configure Phase 1 screening assessment",
)
async def update_contest_assessment(
    slug: str,
    payload: AssessmentUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Update or initialize the Phase 1 screening assessment linked to this contest."""
    return await DynamicContestService.update_assessment(slug, payload, db)


@router.post(
    "/{slug}/problems",
    summary="Add or update a problem challenge in contest and/or assessment",
)
async def add_or_update_problem(
    slug: str,
    payload: ProblemCreateSchema,
    target: Optional[str] = Query(None, description="Target collection: 'contest', 'assessment', or 'both'"),
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Add a new problem or replace an existing problem by index (A-F) in arena, assessment, or both."""
    resolved_target = getattr(payload, "target", None) or target or "both"
    return await DynamicContestService.add_or_update_problem(slug, payload, db, target=resolved_target)


@router.delete(
    "/{slug}/problems/{problem_index}",
    summary="Delete a problem challenge from contest and/or assessment",
)
async def delete_problem(
    slug: str,
    problem_index: str,
    target: Optional[str] = Query("both", description="Target collection: 'contest', 'assessment', or 'both'"),
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Delete a problem by its index letter (A, B, C, etc.) from arena, assessment, or both."""
    return await DynamicContestService.delete_problem(slug, problem_index, db, target=target or "both")


@router.post(
    "/{slug}/problems/sync",
    summary="Synchronize problems between contest arena and screening assessment",
)
async def sync_contest_problems(
    slug: str,
    payload: ProblemSyncRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """One-click synchronization of problems between contest arena and screening assessment."""
    return await DynamicContestService.sync_problems(slug, payload.direction, db)


@router.post(
    "/{slug}/clone",
    summary="Clone contest into a new edition",
    status_code=status.HTTP_201_CREATED,
)
async def clone_contest(
    slug: str,
    payload: ContestCloneRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Clone an existing contest's problem set and configuration into a newly scheduled contest."""
    return await DynamicContestService.clone_contest(slug, payload, db)


@router.patch(
    "/{slug}/status",
    summary="Transition contest lifecycle status",
)
@router.post(
    "/{slug}/status",
    summary="Transition contest lifecycle status",
)
async def change_contest_status(
    slug: str,
    payload: ContestStatusChangeRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """
    Transition contest status: upcoming -> live -> finished.
    When moving to live, automatically qualifies Top 30 scorers and issues Campus QR Passes.
    """
    return await DynamicContestService.change_contest_status(
        slug,
        payload.status,
        db,
        auto_qualify_top_30=payload.auto_qualify_top_30,
    )


@router.post(
    "/preset/launch",
    summary="One-click launch for Weekly / Biweekly contest presets",
    status_code=status.HTTP_201_CREATED,
)
async def launch_preset(
    payload: PresetContestLaunchRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """One-click endpoint to deploy a complete Weekly or Biweekly contest edition with 4 curated challenges."""
    return await DynamicContestService.launch_preset(payload, db)
