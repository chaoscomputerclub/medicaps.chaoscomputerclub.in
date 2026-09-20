"""
Chaos Computer Club India — Medi-Caps Chapter Backend
routers/contests.py — Thin HTTP Router for Offline Contests & Arena Management
Delegates to app.controllers.contest_controller.ContestController
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.db_models import MemberProfile
from app.models.schemas import (
    ContestArenaResponse,
    ContestProblemResponse,
    OfflineContestResponse,
)
from app.middleware.auth import (
    get_current_member,
    get_current_member_optional,
    require_admin_or_core,
)
from app.schemas.dynamic_contest import (
    ContestCloneRequest,
    ContestStatusChangeRequest,
    DynamicContestCreateRequest,
    DynamicContestUpdateRequest,
    PresetContestLaunchRequest,
    ProblemCreateSchema,
)
from app.controllers.contest_controller import (
    ArenaRunRequest,
    ArenaSubmitRequest,
    ContestController,
)

router = APIRouter(prefix="/contests", tags=["Offline Contests"])


@router.get("", response_model=List[OfflineContestResponse])
async def list_contests(
    response: Response,
    status: Optional[str] = Query(None, description="Filter by: live, upcoming, finished"),
    division: Optional[str] = Query(None, description="Filter by: division_1, division_2, division_3, open"),
    limit: Optional[int] = Query(None, ge=1, le=100, description="Max contests to return"),
    offset: Optional[int] = Query(0, ge=0, description="Offset for pagination"),
    db: AsyncSession = Depends(get_db),
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
):
    """
    List offline campus contests.
    Publicly lists all campus contests (upcoming, live, and finished) with division metadata.
    Protected by 30s Redis Cache-Aside.
    """
    return await ContestController.list_contests(
        response=response,
        status=status,
        division=division,
        db=db,
        current_member=current_member,
        limit=limit,
        offset=offset,
    )



@router.get("/my/participated", summary="List all contests the current member has registered for or participated in")
async def get_my_participated_contests(
    response: Response,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """
    Return all contests the current member has registered for or participated in,
    including upcoming registered contests, active online screening attempts,
    and verified on-campus scoreboard finishes.
    """
    return await ContestController.get_my_participated_contests(
        response=response,
        current_member=current_member,
        db=db,
    )


@router.get("/{slug}", response_model=OfflineContestResponse)
async def get_contest_detail(
    slug: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
):
    """Fetch complete specifications, venue, rules, and proctor details for an offline contest. Protected by 60s Redis Cache."""
    return await ContestController.get_contest_detail(
        slug=slug,
        response=response,
        db=db,
        current_member=current_member,
    )


@router.get("/{slug}/problems", response_model=List[ContestProblemResponse])
async def get_contest_problems(
    slug: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
):
    """Fetch problem set papers (A-F), first-solve times, and editorial summaries. Protected by 60s Redis Cache."""
    return await ContestController.get_contest_problems(
        slug=slug,
        response=response,
        db=db,
        current_member=current_member,
    )


@router.get("/{slug}/registration-status")
async def get_registration_status(
    slug: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
):
    """Check candidate registration, screening assessment ranking, and Top 30 live final eligibility."""
    return await ContestController.get_registration_status(
        slug=slug,
        response=response,
        db=db,
        current_member=current_member,
    )


@router.post("/{slug}/register")
async def register_for_contest(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_member: MemberProfile = Depends(get_current_member),
):
    """Reserve physical workstation seat and unlock Phase 1 Online Assessment for the contest."""
    return await ContestController.register_for_contest(
        slug=slug,
        current_member=current_member,
        db=db,
    )


@router.post("/{slug}/check-in")
async def check_in_contest(
    slug: str,
    pass_code: Optional[str] = Query(None, description="Campus Pass verification code"),
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
    db: AsyncSession = Depends(get_db),
):
    """Verify physical on-premise attendance at the lab gate check-in."""
    return await ContestController.check_in_contest(
        slug=slug,
        pass_code=pass_code,
        current_member=current_member,
        db=db,
    )


@router.post("/{slug}/reset-timer")
async def reset_contest_timer(
    slug: str,
    seconds: int = Query(10, description="Countdown duration in seconds"),
    db: AsyncSession = Depends(get_db),
):
    """Reset contest and assessment starts_at to N seconds in the future for demo countdown."""
    return await ContestController.reset_contest_timer(slug=slug, seconds=seconds, db=db)


@router.get("/{slug}/arena", response_model=ContestArenaResponse)
async def get_contest_arena_data(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
):
    """Retrieve full arena workspace data, assigned workstation seat, chief proctors, and problem statements."""
    return await ContestController.get_contest_arena_data(
        slug=slug,
        db=db,
        current_member=current_member,
    )


@router.post("/{slug}/arena/run")
async def run_contest_arena_code(
    slug: str,
    payload: ArenaRunRequest,
    current_member: Optional[MemberProfile] = Depends(get_current_member_optional),
    db: AsyncSession = Depends(get_db),
):
    """Run code against sample test cases or custom stdin in the live contest arena."""
    return await ContestController.run_arena_code(
        slug=slug,
        payload=payload,
        current_member=current_member,
        db=db,
    )


@router.post("/{slug}/arena/submit")
async def submit_contest_arena_code(
    slug: str,
    payload: ArenaSubmitRequest,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Submit solution in live contest arena against full judge test suite & update live scoreboard."""
    return await ContestController.submit_arena_code(
        slug=slug,
        payload=payload,
        current_member=current_member,
        db=db,
    )


# ─── Dynamic Contest Management Endpoints ────────────────────────────────────

@router.post("/dynamic", summary="Dynamically create contest, screening assessment, and problems", status_code=201)
async def create_dynamic_contest_endpoint(
    payload: DynamicContestCreateRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Create a complete campus contest dynamically via API."""
    return await ContestController.create_dynamic_contest(payload=payload, db=db, admin=admin)


@router.post("/preset/launch", summary="One-click launch for Weekly or Biweekly contest presets", status_code=201)
async def launch_preset_endpoint(
    payload: PresetContestLaunchRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """One-click API to deploy a complete Weekly or Biweekly contest edition with 4 curated challenges."""
    return await ContestController.launch_preset(payload=payload, db=db)


@router.put("/{slug}", summary="Update contest specifications dynamically")
async def update_contest_endpoint(
    slug: str,
    payload: DynamicContestUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Dynamically update contest details, schedule, venue, rules, or capacity."""
    return await ContestController.update_contest(slug=slug, payload=payload, db=db)


@router.delete("/{slug}", summary="Delete contest permanently")
async def delete_contest_endpoint(
    slug: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Cascade delete a contest, its problems, submissions, screening rounds, and passes."""
    return await ContestController.delete_contest(slug=slug, db=db)


@router.post("/{slug}/problems", summary="Add or update a problem challenge in the contest")
async def add_or_update_problem_endpoint(
    slug: str,
    payload: ProblemCreateSchema,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Add a new problem or replace an existing problem by index (A-F) in both arena and assessment."""
    return await ContestController.add_or_update_problem(slug=slug, payload=payload, db=db)


@router.delete("/{slug}/problems/{problem_index}", summary="Delete a problem challenge from the contest")
async def delete_problem_endpoint(
    slug: str,
    problem_index: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Delete a problem by its index letter (A, B, C, etc.) from arena and assessment."""
    return await ContestController.delete_problem(slug=slug, problem_index=problem_index, db=db)


@router.post("/{slug}/clone", summary="Clone contest into a new edition", status_code=201)
async def clone_contest_endpoint(
    slug: str,
    payload: ContestCloneRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Clone an existing contest's problem set and configuration into a newly scheduled contest."""
    return await ContestController.clone_contest(slug=slug, payload=payload, db=db)


@router.patch("/{slug}/status", summary="Transition contest lifecycle status")
async def change_contest_status_endpoint(
    slug: str,
    payload: ContestStatusChangeRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Transition contest status: upcoming -> live -> finished."""
    return await ContestController.change_contest_status(slug=slug, payload=payload, db=db)
