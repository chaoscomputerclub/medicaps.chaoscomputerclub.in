"""
Chaos Computer Club — Dynamic Contest Management & Admin API Router
Endpoints for creating, updating, cloning, configuring, and publishing campus contests.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.middleware.auth import require_admin_or_core
from app.models.db_models import MemberProfile
from app.schemas.dynamic_contest import (
    DynamicContestCreateRequest,
    DynamicContestUpdateRequest,
    ProblemCreateSchema,
    ContestCloneRequest,
    PresetContestLaunchRequest,
    ContestStatusChangeRequest,
)
from app.services.dynamic_contest_service import DynamicContestService

router = APIRouter(prefix="/admin/contests", tags=["Admin Contest Management"])


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


@router.post(
    "/{slug}/problems",
    summary="Add or update a problem challenge in the contest",
)
async def add_or_update_problem(
    slug: str,
    payload: ProblemCreateSchema,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Add a new problem or replace an existing problem by index (A-F) in both arena and assessment."""
    return await DynamicContestService.add_or_update_problem(slug, payload, db)


@router.delete(
    "/{slug}/problems/{problem_index}",
    summary="Delete a problem challenge from the contest",
)
async def delete_problem(
    slug: str,
    problem_index: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Delete a problem by its index letter (A, B, C, etc.) from arena and assessment."""
    return await DynamicContestService.delete_problem(slug, problem_index, db)


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
