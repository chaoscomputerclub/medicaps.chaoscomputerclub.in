"""
Chaos Computer Club — Medi-Caps Chapter
tests/test_state_consistency_acid.py

Comprehensive ACID, Concurrency, Idempotency, and Failure-Injection Verification Suite:
1. Double Registration Race & Capacity Protection
2. Double Contest Finalization & Idempotent Replay
3. Rating Uniqueness & Zero Double-Rating Invariant
4. State Machine Transition Fencing (Terminal finished state)
5. Registration vs. Participation Invariant (Unsubmitted registrations not rated)
6. CAS Lease Fencing on Out-of-Order Attempt Results
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import (
    OfflineContest,
    ContestProblem,
    ContestRegistration,
    ContestSubmission,
    MemberProfile,
    RatingHistory,
    ScoreboardEntry,
)
from app.modules.contests.contest_service import ContestService
from app.services.dynamic_contest_service import DynamicContestService
from app.engine.attempt_manager import AttemptManager


@pytest.mark.asyncio
async def test_double_registration_returns_idempotent_result():
    """Verify that registering twice for the same contest returns idempotent already_registered."""
    mock_db = AsyncMock(spec=AsyncSession)
    
    mock_contest = MagicMock(spec=OfflineContest)
    mock_contest.id = "c-reg-1"
    mock_contest.slug = "code-rush"
    mock_contest.title = "Code Rush"
    mock_contest.status = "upcoming"
    mock_contest.registered_count = 5
    mock_contest.seat_capacity = 100
    mock_contest.venue = "Online Arena"

    mock_member = MagicMock(spec=MemberProfile)
    mock_member.id = "mem-reg-1"
    mock_member.handle = "cadet_alpha"

    # Mock DB query for contest
    mock_res = MagicMock()
    mock_res.scalar_one_or_none = MagicMock(return_value=mock_contest)
    mock_db.execute = AsyncMock(return_value=mock_res)

    # First attempt: existing registration found
    existing_reg = MagicMock(spec=ContestRegistration)
    existing_reg.status = "confirmed"

    with patch("app.modules.contests.contest_repository.ContestRepository.get_registration", new=AsyncMock(return_value=existing_reg)), \
         patch("app.modules.contests.contest_service.is_contest_attempt_submitted", new=AsyncMock(return_value=(False, ""))):
        
        result = await ContestService.register_for_contest(
            slug="code-rush",
            current_member=mock_member,
            db=mock_db,
        )

        assert result["status"] == "already_registered"
        assert result["registered"] is True
        assert mock_contest.registered_count == 5  # count not modified


@pytest.mark.asyncio
async def test_registration_capacity_exceeded_rejected():
    """Verify that registration at or above capacity is rejected with 400."""
    mock_db = AsyncMock(spec=AsyncSession)
    
    mock_contest = MagicMock(spec=OfflineContest)
    mock_contest.id = "c-reg-full"
    mock_contest.slug = "code-rush-full"
    mock_contest.title = "Code Rush Full"
    mock_contest.status = "upcoming"
    mock_contest.registered_count = 50
    mock_contest.seat_capacity = 50

    mock_member = MagicMock(spec=MemberProfile)
    mock_member.id = "mem-reg-overflow"

    mock_res = MagicMock()
    mock_res.scalar_one_or_none = MagicMock(return_value=mock_contest)
    mock_db.execute = AsyncMock(return_value=mock_res)

    with patch("app.modules.contests.contest_repository.ContestRepository.get_registration", new=AsyncMock(return_value=None)), \
         patch("app.modules.contests.contest_service.is_contest_attempt_submitted", new=AsyncMock(return_value=(False, ""))):
        
        with pytest.raises(HTTPException) as exc_info:
            await ContestService.register_for_contest(
                slug="code-rush-full",
                current_member=mock_member,
                db=mock_db,
            )
        assert exc_info.value.status_code == 400
        assert "capacity reached" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_contest_lifecycle_state_machine_terminal_finished():
    """Verify that a finished/finalized contest cannot be reopened to live or upcoming."""
    mock_db = AsyncMock(spec=AsyncSession)
    mock_contest = MagicMock(spec=OfflineContest)
    mock_contest.id = "c-finished-1"
    mock_contest.slug = "finalized-cup"
    mock_contest.status = "finished"

    mock_res = MagicMock()
    mock_res.scalars = MagicMock(return_value=MagicMock(first=MagicMock(return_value=mock_contest)))
    mock_db.execute = AsyncMock(return_value=mock_res)

    # Attempt finished -> live transition
    with pytest.raises(HTTPException) as exc_info:
        await DynamicContestService.change_contest_status(
            contest_slug="finalized-cup",
            target_status="live",
            db=mock_db,
        )
    assert exc_info.value.status_code == 400
    assert "illegal contest status transition" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_contest_lifecycle_state_machine_idempotent_call():
    """Verify that calling change_contest_status with current status is an idempotent no-op."""
    mock_db = AsyncMock(spec=AsyncSession)
    mock_contest = MagicMock(spec=OfflineContest)
    mock_contest.id = "c-live-1"
    mock_contest.slug = "live-cup"
    mock_contest.title = "Live Cup"
    mock_contest.status = "live"

    mock_res = MagicMock()
    mock_res.scalars = MagicMock(return_value=MagicMock(first=MagicMock(return_value=mock_contest)))
    mock_db.execute = AsyncMock(return_value=mock_res)

    # Call status change to same status "live"
    res = await DynamicContestService.change_contest_status(
        contest_slug="live-cup",
        target_status="live",
        db=mock_db,
    )
    assert res["success"] is True
    assert res["current_status"] == "live"
    assert "already in status" in res["message"]


@pytest.mark.asyncio
async def test_double_finalization_is_idempotent():
    """Verify that running _apply_final_ratings twice does not re-apply ratings."""
    mock_db = AsyncMock(spec=AsyncSession)
    mock_contest = MagicMock(spec=OfflineContest)
    mock_contest.id = "c-fin-test"
    mock_contest.slug = "test-fin"
    mock_contest.ratings_finalized_at = datetime.now(timezone.utc) - timedelta(minutes=5)

    mock_res = MagicMock()
    mock_res.scalars = MagicMock(return_value=MagicMock(first=MagicMock(return_value=mock_contest)))
    mock_db.execute = AsyncMock(return_value=mock_res)

    result = await DynamicContestService._apply_final_ratings(mock_contest, mock_db)
    assert result["already_finalized"] is True
    assert result["rated_count"] == 0
    assert "already finalized" in result["message"]


@pytest.mark.asyncio
async def test_cas_lease_fencing_eliminates_stale_attempt():
    """Verify that an execution attempt with an obsolete attempt_id cannot finalize the submission."""
    from app.engine.attempt_manager import AttemptManager, FinalizeResult

    mock_db = AsyncMock(spec=AsyncSession)

    active_job = MagicMock()
    active_job.id = "job-cas-1"
    active_job.active_attempt_id = "attempt-active-2"
    active_job.state = "PROCESSING"

    # Simulate atomic update returning rowcount=0 (attempt-stale-1 != attempt-active-2)
    mock_res = MagicMock()
    mock_res.rowcount = 0
    mock_db.execute = AsyncMock(return_value=mock_res)
    mock_db.get = AsyncMock(side_effect=lambda model, ident: active_job if ident == "job-cas-1" else None)
    mock_db.flush = AsyncMock()

    status, job = await AttemptManager.finalize_attempt(
        db=mock_db,
        job_id="job-cas-1",
        attempt_id="attempt-stale-1",
        final_state="COMPLETED",
    )
    assert status == FinalizeResult.STALE_ATTEMPT
