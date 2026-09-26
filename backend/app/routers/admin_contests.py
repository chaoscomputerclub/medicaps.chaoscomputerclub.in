"""
Chaos Computer Club — Dynamic Contest Management & Admin API Router
Delegates to app.controllers.admin_contest_controller.AdminContestController
"""

from typing import Any, Dict, List, Literal, Optional
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.middleware.auth import require_admin_or_core
from app.models.db_models import MemberProfile
from app.schemas.campus_pass import ContestAttendeeItem
from app.schemas.dynamic_contest import (
    DynamicContestCreateRequest,
    DynamicContestUpdateRequest,
    ProblemSaveRequest,
    ProblemSyncRequest,
    AssessmentUpdateRequest,
    ContestAdminDetailResponse,
    ContestCloneRequest,
    PresetContestLaunchRequest,
    ContestStatusChangeRequest,
)
from app.controllers.admin_contest_controller import AdminContestController

router = APIRouter(prefix="/admin/contests", tags=["Admin Contest Management"])


@router.get("", summary="List all contests for admin management")
async def list_admin_contests(
    response: Response,
    limit: Optional[int] = Query(None, ge=1, le=500, description="Max contests to return"),
    offset: Optional[int] = Query(0, ge=0, description="Offset for pagination"),
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """List all campus contests with administrative overview metrics."""
    return await AdminContestController.list_admin_contests(
        db=db,
        limit=limit,
        offset=offset,
        response=response,
    )



@router.get("/{slug}", summary="Fetch complete admin dossier for a contest", response_model=ContestAdminDetailResponse)
async def get_admin_contest(
    slug: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Fetch complete administrative details: contest, assessment, arena problems, and screening problems."""
    return await AdminContestController.get_admin_contest(slug=slug, db=db)


@router.post("", summary="Create dynamic contest, screening assessment, and problems", status_code=status.HTTP_201_CREATED)
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
    return await AdminContestController.create_dynamic_contest(payload=payload, admin=admin, db=db)


@router.put("/{slug}", summary="Update contest specifications")
async def update_contest(
    slug: str,
    payload: DynamicContestUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Dynamically update contest details, schedule, venue, rules, or capacity."""
    return await AdminContestController.update_contest(slug=slug, payload=payload, db=db)


@router.delete("/{slug}", summary="Delete contest permanently")
async def delete_contest(
    slug: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Cascade delete a contest, its problems, submissions, screening rounds, and passes."""
    return await AdminContestController.delete_contest(slug=slug, db=db)


@router.put("/{slug}/assessment", summary="Update or configure Phase 1 screening assessment")
async def update_contest_assessment(
    slug: str,
    payload: AssessmentUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Update or initialize the Phase 1 screening assessment linked to this contest."""
    return await AdminContestController.update_contest_assessment(slug=slug, payload=payload, db=db)


@router.get("/{slug}/problems", summary="List all arena problems for a contest (admin view, no eligibility gate)")
async def list_admin_contest_problems(
    slug: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Return all ContestProblem records for a contest, bypassing live-contest eligibility check."""
    return await AdminContestController.list_admin_contest_problems(slug=slug, db=db)


@router.post("/{slug}/problems", summary="Add or update a problem challenge in contest and/or assessment")
async def add_or_update_problem(
    slug: str,
    payload: ProblemSaveRequest,
    target: Optional[Literal["contest", "assessment", "both"]] = Query(
        None,
        description="Target collection: 'contest', 'assessment', or 'both'",
    ),
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Add a new problem or replace an existing problem by index (A-F) in arena, assessment, or both."""
    return await AdminContestController.add_or_update_problem(slug=slug, payload=payload, target=target, db=db)


@router.delete("/{slug}/problems/{problem_index}", summary="Delete a problem challenge from contest and/or assessment")
async def delete_problem(
    slug: str,
    problem_index: str,
    target: Literal["contest", "assessment", "both"] = Query(
        "both",
        description="Target collection: 'contest', 'assessment', or 'both'",
    ),
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Delete a problem by its index letter (A, B, C, etc.) from arena, assessment, or both."""
    return await AdminContestController.delete_problem(slug=slug, problem_index=problem_index, target=target, db=db)


@router.post("/{slug}/problems/sync", summary="Synchronize problems between contest arena and screening assessment")
async def sync_contest_problems(
    slug: str,
    payload: ProblemSyncRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """One-click synchronization of problems between contest arena and screening assessment."""
    return await AdminContestController.sync_contest_problems(slug=slug, payload=payload, db=db)


@router.post("/{slug}/clone", summary="Clone contest into a new edition", status_code=status.HTTP_201_CREATED)
async def clone_contest(
    slug: str,
    payload: ContestCloneRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Clone an existing contest's problem set and configuration into a newly scheduled contest."""
    return await AdminContestController.clone_contest(slug=slug, payload=payload, db=db)


@router.patch("/{slug}/status", summary="Transition contest lifecycle status")
@router.post("/{slug}/status", summary="Transition contest lifecycle status")
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
    return await AdminContestController.change_contest_status(slug=slug, payload=payload, db=db)


@router.post("/preset/launch", summary="One-click launch for Weekly / Biweekly contest presets", status_code=status.HTTP_201_CREATED)
async def launch_preset(
    payload: PresetContestLaunchRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """One-click endpoint to deploy a complete Weekly or Biweekly contest edition with 4 curated challenges."""
    return await AdminContestController.launch_preset(payload=payload, db=db)


@router.get("/{slug}/participants", summary="List all registered participants and dossier details for contest", response_model=List[ContestAttendeeItem])
async def list_admin_contest_participants(
    slug: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Retrieve full registered participant dossier, screening scores, and pass statuses."""
    return await AdminContestController.list_admin_contest_participants(slug=slug, db=db)


@router.post("/{slug}/participants/register", summary="Manually register an enrolled cadet for contest")
async def admin_register_participant(
    slug: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Admin endpoint to manually register a student by handle, PRN, or email."""
    return await AdminContestController.admin_register_participant(slug=slug, payload=payload, db=db)


@router.post("/{slug}/seed-demo-participants", summary="Seed mock Medi-Caps participants for instant testing")
async def seed_demo_participants(
    slug: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Seed 10 realistic Medi-Caps student participants with screening scores and PRNs."""
    return await AdminContestController.seed_demo_participants(slug=slug, db=db)


@router.post("/{slug}/simulate-100-cadets", summary="Production deep dive simulation: 100 cadets, Phase 1 screening, Top 30 QR issuance, and 70 eliminated")
async def simulate_100_cadets(
    slug: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """
    Automated deep dive simulation:
    1. Generates 100 realistic Medi-Caps student users with Indian names, PRNs, emails, and ratings.
    2. Registers all 100 for the contest.
    3. Completes Phase 1 screening assessment for all 100 cadets with deterministic score & penalty distributions.
    4. Evaluates Top 30 finalists: exactly 30 receive is_top_30_qualified=True and CampusPass records with seats LAB-04-PC01 to LAB-04-PC30.
    5. The remaining 70 cadets are marked is_top_30_qualified=False with ZERO passes.
    """
    return await AdminContestController.simulate_100_cadets(slug=slug, db=db)
