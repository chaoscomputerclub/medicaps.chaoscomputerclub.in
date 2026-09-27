"""
Chaos Computer Club — Admin Problem Authoring & Function Execution Contract Router
Provides endpoints for creating, updating, validating, publishing, and versioning
LeetCode-style algorithmic challenges and managing the hidden testcase vault.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.middleware.auth import require_admin_or_core
from app.models.db_models import MemberProfile
from app.schemas.problem import (
    ProblemCreateRequest,
    ProblemUpdateRequest,
    TestCaseInputSchema,
    TestCaseUpdateSchema,
    ProblemDetailResponse,
    ProblemSummaryResponse,
    ProblemVersionResponse,
)
from app.services.problem_service import ProblemService
from app.services.problem_validator import ValidationReport

router = APIRouter(prefix="/admin/problems", tags=["Admin Problem Authoring"])


@router.post("", summary="Create a new algorithmic challenge draft", status_code=status.HTTP_201_CREATED)
async def create_problem(
    payload: ProblemCreateRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """
    Creates a new problem with function contract, parameters, starter code templates,
    and initial sample/hidden testcases.
    """
    admin_id = admin.id if admin else None
    return await ProblemService.create_problem(payload=payload, admin_id=admin_id, db=db)


@router.get("", summary="List all authored problems")
async def list_problems(
    status: Optional[str] = Query(None, description="Filter by status: DRAFT, VALIDATED, PUBLISHED, ARCHIVED"),
    topic: Optional[str] = Query(None, description="Filter by topic"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty: EASY, MEDIUM, HARD"),
    query: Optional[str] = Query(None, description="Search query across title, slug, topic"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """List problems with optional search and filters."""
    return await ProblemService.list_problems(
        status=status,
        topic=topic,
        difficulty=difficulty,
        query=query,
        limit=limit,
        offset=offset,
        db=db,
    )


@router.get("/{problem_id}", summary="Get complete problem dossier with hidden testcases")
async def get_problem(
    problem_id: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """
    Returns full problem definition including visible examples, hidden testcase vault,
    and reference solutions for authorized administrators and proctors.
    """
    return await ProblemService.get_problem_detail(
        id_or_slug=problem_id,
        include_hidden=True,
        db=db,
    )


@router.patch("/{problem_id}", summary="Update problem specifications or function contract")
async def update_problem(
    problem_id: str,
    payload: ProblemUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Update fields on an un-locked problem. Resets status to DRAFT for re-validation."""
    admin_id = admin.id if admin else None
    return await ProblemService.update_problem(
        problem_id=problem_id,
        payload=payload,
        admin_id=admin_id,
        db=db,
    )


@router.post("/{problem_id}/validate", summary="Run automated pre-publish validation checks", response_model=ValidationReport)
async def validate_problem(
    problem_id: str,
    run_reference_solution: bool = Query(False, description="Whether to execute reference solution in sandbox"),
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Automated pre-publish validation suite testing signature, testcase schema, and sandbox bounds."""
    return await ProblemService.validate_problem(
        problem_id=problem_id,
        run_reference_solution=run_reference_solution,
        db=db,
    )


@router.post("/{problem_id}/publish", summary="Publish problem and freeze immutable version snapshot")
async def publish_problem(
    problem_id: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Validates problem and transitions status to PUBLISHED with an immutable version snapshot."""
    admin_id = admin.id if admin else None
    return await ProblemService.publish_problem(
        problem_id=problem_id,
        admin_id=admin_id,
        db=db,
    )


@router.post("/{problem_id}/archive", summary="Archive a problem challenge")
async def archive_problem(
    problem_id: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Mark problem as ARCHIVED."""
    admin_id = admin.id if admin else None
    return await ProblemService.archive_problem(
        problem_id=problem_id,
        admin_id=admin_id,
        db=db,
    )


@router.delete("/{problem_id}", summary="Delete an un-locked problem challenge")
async def delete_problem(
    problem_id: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Delete an un-locked problem. Returns 400 if problem is locked or linked to contest."""
    admin_id = admin.id if admin else None
    return await ProblemService.delete_problem(
        problem_id=problem_id,
        admin_id=admin_id,
        db=db,
    )


@router.post("/{problem_id}/testcases", summary="Add a testcase to visible suite or hidden vault", status_code=status.HTTP_201_CREATED)
async def add_testcase(
    problem_id: str,
    payload: TestCaseInputSchema,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Add a structured visible sample or hidden testcase."""
    return await ProblemService.add_testcase(
        problem_id=problem_id,
        tc_payload=payload,
        db=db,
    )


@router.patch("/{problem_id}/testcases/{testcase_id}", summary="Update a testcase in problem vault")
async def update_testcase(
    problem_id: str,
    testcase_id: str,
    payload: TestCaseUpdateSchema,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Update an individual testcase in the vault."""
    return await ProblemService.update_testcase(
        problem_id=problem_id,
        testcase_id=testcase_id,
        tc_payload=payload,
        db=db,
    )


@router.delete("/{problem_id}/testcases/{testcase_id}", summary="Delete a testcase from problem vault")
async def delete_testcase(
    problem_id: str,
    testcase_id: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Delete a testcase by testcase_id or UUID."""
    return await ProblemService.delete_testcase(
        problem_id=problem_id,
        testcase_id=testcase_id,
        db=db,
    )


@router.post("/{problem_id}/versions", summary="Fork a new draft version from current problem", status_code=status.HTTP_201_CREATED)
async def create_new_version(
    problem_id: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Advances version number to v(N+1) in DRAFT state, copying testcases for safe isolated iteration."""
    admin_id = admin.id if admin else None
    return await ProblemService.create_new_version(
        problem_id=problem_id,
        admin_id=admin_id,
        db=db,
    )


@router.get("/{problem_id}/versions", summary="List immutable version history for problem")
async def list_versions(
    problem_id: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """List all frozen version snapshots of this challenge."""
    return await ProblemService.list_versions(problem_id=problem_id, db=db)
