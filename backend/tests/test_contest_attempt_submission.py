"""
Unit Tests for Pure Online Contest Attempt Submission (LeetCode-style)
Ensures candidate attempts are NOT auto-submitted without explicit user consent.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.models.db_models import ContestRegistration, OfflineContest, MemberProfile
from app.services.contest_eligibility_service import is_contest_attempt_submitted, is_member_eligible_for_live_contest
from app.modules.contests.contest_repository import ContestRepository


@pytest.mark.asyncio
async def test_live_contest_registered_candidate_is_eligible():
    """
    When contest is LIVE, registered cadets with confirmed status are eligible to enter.
    """
    member = MemberProfile(id="cadet-123", email="cadet@medicaps.ac.in", full_name="Cadet One")
    live_contest = OfflineContest(id="contest-live-1", slug="weekly-3", status="live")

    mock_db = AsyncMock()
    reg = ContestRegistration(
        contest_id="contest-live-1",
        member_id="cadet-123",
        status="confirmed",
    )
    reg_res = MagicMock()
    reg_res.scalars.return_value.first.return_value = reg
    mock_db.execute.return_value = reg_res

    is_sub, reason = await is_contest_attempt_submitted(member, live_contest, mock_db)
    assert is_sub is False
    assert reason == ""

    is_eligible, elig_reason = await is_member_eligible_for_live_contest(member, live_contest, mock_db)
    assert is_eligible is True


@pytest.mark.asyncio
async def test_live_contest_explicit_submitted_status_locks_attempt():
    """
    When candidate explicitly submits their live contest attempt (status='submitted'),
    is_contest_attempt_submitted returns True and live arena access is denied.
    """
    member = MemberProfile(id="cadet-123", email="cadet@medicaps.ac.in", full_name="Cadet One")
    live_contest = OfflineContest(id="contest-live-1", slug="weekly-3", status="live")

    mock_db = AsyncMock()
    reg = ContestRegistration(
        contest_id="contest-live-1",
        member_id="cadet-123",
        status="submitted",
    )
    reg_res = MagicMock()
    reg_res.scalars.return_value.first.return_value = reg
    mock_db.execute.return_value = reg_res

    is_sub, reason = await is_contest_attempt_submitted(member, live_contest, mock_db)
    assert is_sub is True
    assert "already been submitted" in reason

    is_eligible, elig_reason = await is_member_eligible_for_live_contest(member, live_contest, mock_db)
    assert is_eligible is False
    assert "already been submitted" in elig_reason


@pytest.mark.asyncio
async def test_repository_user_registrations_and_submissions():
    """
    Verify ContestRepository.get_user_registrations_and_submissions accurately classifies
    registered vs explicitly submitted contest attempts.
    """
    mock_db = AsyncMock()

    mock_regs_result = MagicMock()
    mock_regs_result.all.return_value = [
        ("contest-live-1", "confirmed"),
        ("contest-live-2", "submitted"),
        ("contest-upcoming-1", "registered"),
    ]

    mock_db.execute.return_value = mock_regs_result

    registered_ids, submitted_ids = await ContestRepository.get_user_registrations_and_submissions(
        mock_db, "cadet-123"
    )

    assert "contest-live-1" in registered_ids
    assert "contest-live-1" not in submitted_ids  # Confirmed status is NOT submitted
    assert "contest-live-2" in submitted_ids      # Submitted status IS submitted
    assert "contest-upcoming-1" in registered_ids
    assert "contest-upcoming-1" not in submitted_ids
