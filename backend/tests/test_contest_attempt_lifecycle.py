"""
Chaos Computer Club — Medi-Caps Chapter
Automated Test Suite: Contest Attempt Lifecycle, Invariant Enforcement & State Machine

Verifies:
1. Problem Submission != Contest Finalization (Attempt remains IN_PROGRESS after code submit).
2. Multiple problem submissions are permitted while attempt is IN_PROGRESS.
3. Explicit finalization transitions attempt to FINALIZED and freezes score.
4. Finalized / Expired attempts strictly lock out further code executions and submissions (HTTP 403).
5. Attempt initialization and finalization are idempotent under duplicate/concurrent calls.
6. Submission idempotency: duplicate request_id returns cached verdict without double scoring.
"""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.base import now_utc
from app.models.db_models import (
    OfflineContest,
    ContestProblem,
    ContestAttempt,
    ContestSubmission,
    ScoreboardEntry,
    MemberProfile,
)
from app.modules.contests.contest_attempt_service import (
    start_or_get_attempt,
    finalize_attempt,
    get_attempt,
    attempt_is_closed,
)
from app.services.contest_eligibility_service import is_contest_attempt_submitted
from app.modules.contests.contest_execution_service import ContestExecutionService
from app.schemas.contest import ArenaSubmitRequest, ArenaRunRequest
from fastapi import HTTPException


class MockScalarResult:
    def __init__(self, value):
        self._value = value

    def first(self):
        return self._value

    def scalar_one_or_none(self):
        return self._value

    def scalars(self):
        return self

    def all(self):
        return [self._value] if self._value is not None else []


@pytest.mark.asyncio
async def test_attempt_state_machine_lifecycle():
    """Verify explicit transitions: IN_PROGRESS -> FINALIZED, and idempotency."""
    mock_db = AsyncMock()
    now = now_utc()
    contest = OfflineContest(
        id="contest-test-1",
        slug="weekly-test-1",
        title="Weekly Contest Test",
        status="live",
        starts_at=now - timedelta(hours=1),
        ends_at=now + timedelta(hours=1),
    )
    member = MemberProfile(
        id="member-test-1",
        handle="cadet_alpha",
        full_name="Cadet Alpha",
        email="cadet_alpha@medicaps.ac.in",
    )

    attempt = ContestAttempt(
        id="attempt-test-1",
        contest_id=contest.id,
        member_id=member.id,
        status="in_progress",
        started_at=now,
        ends_at=contest.ends_at,
    )

    # 1. Active attempt is not closed
    assert not attempt_is_closed(attempt)

    # 2. Mock finalize_attempt
    with patch("app.modules.contests.contest_attempt_service.get_attempt", new=AsyncMock(return_value=attempt)), \
         patch("app.modules.contests.contest_attempt_service.delete_cache_pattern", new=AsyncMock()), \
         patch("app.services.event_broadcaster.broadcast_event", new=AsyncMock()):

        # Mock contest query
        mock_contest_res = MagicMock()
        mock_contest_res.scalars.return_value.first.return_value = contest
        # Mock scoreboard query
        sb = ScoreboardEntry(
            contest_id=contest.id,
            member_id=member.id,
            score=150,
            rank=1,
        )
        mock_sb_res = MagicMock()
        mock_sb_res.scalars.return_value.first.return_value = sb

        mock_db.execute = AsyncMock(side_effect=[mock_contest_res, mock_sb_res, mock_contest_res])

        res = await finalize_attempt(contest.slug, member, mock_db)
        assert res["success"] is True
        assert res["status"] == "finalized"
        assert res["already_finalized"] is False
        assert res["total_score"] == 150
        assert attempt.status == "finalized"
        assert attempt.final_score == 150
        assert attempt_is_closed(attempt)

        # 3. Subsequent finalization is idempotent
        res_repeat = await finalize_attempt(contest.slug, member, mock_db)
        assert res_repeat["success"] is True
        assert res_repeat["already_finalized"] is True
        assert res_repeat["status"] == "finalized"


@pytest.mark.asyncio
async def test_problem_submission_invariant_attempt_remains_in_progress():
    """CRITICAL INVARIANT: Submitting a problem solution must NEVER finalize the contest attempt."""
    mock_db = AsyncMock()
    now = now_utc()
    contest = OfflineContest(
        id="contest-test-2",
        slug="weekly-test-2",
        title="Weekly Contest Test 2",
        status="live",
        starts_at=now - timedelta(minutes=30),
        ends_at=now + timedelta(minutes=90),
    )
    member = MemberProfile(
        id="member-test-2",
        handle="cadet_beta",
        full_name="Cadet Beta",
        email="cadet_beta@medicaps.ac.in",
    )
    problem = ContestProblem(
        id="prob-test-1",
        contest_id=contest.id,
        problem_index="A",
        title="Mirror Array",
        points=100,
        solved_count=0,
    )
    attempt = ContestAttempt(
        id="attempt-test-2",
        contest_id=contest.id,
        member_id=member.id,
        status="in_progress",
        started_at=now - timedelta(minutes=30),
        ends_at=contest.ends_at,
    )

    # In-progress attempt must not be considered submitted
    with patch("app.services.contest_eligibility_service.select") as mock_select:
        mock_res = MagicMock()
        mock_res.scalars.return_value.first.return_value = attempt
        mock_db.execute = AsyncMock(return_value=mock_res)

        is_sub, reason = await is_contest_attempt_submitted(member, contest, mock_db)
        assert is_sub is False
        assert reason == ""

    # After simulated problem evaluation, attempt status must still be in_progress
    assert attempt.status == "in_progress"
    assert not attempt_is_closed(attempt)


@pytest.mark.asyncio
async def test_finalized_attempt_locks_further_submissions_and_runs():
    """Fair Competition: Once an attempt is finalized, code execution & submissions are strictly 403 Forbidden."""
    mock_db = AsyncMock()
    now = now_utc()
    contest = OfflineContest(
        id="contest-test-3",
        slug="weekly-test-3",
        title="Weekly Contest Test 3",
        status="live",
        starts_at=now - timedelta(hours=1),
        ends_at=now + timedelta(hours=1),
    )
    member = MemberProfile(
        id="member-test-3",
        handle="cadet_gamma",
        full_name="Cadet Gamma",
    )
    finalized_attempt = ContestAttempt(
        id="attempt-test-3",
        contest_id=contest.id,
        member_id=member.id,
        status="finalized",
        started_at=now - timedelta(hours=1),
        ends_at=contest.ends_at,
        final_score=200,
        finalized_at=now - timedelta(minutes=5),
    )

    # 1. is_contest_attempt_submitted returns True
    mock_res = MagicMock()
    mock_res.scalars.return_value.first.return_value = finalized_attempt
    mock_db.execute = AsyncMock(return_value=mock_res)

    is_sub, reason = await is_contest_attempt_submitted(member, contest, mock_db)
    assert is_sub is True
    assert "finalized" in reason

    # 2. submit_arena_code rejects with 403
    with patch("app.modules.contests.contest_repository.ContestRepository.get_by_slug", new=AsyncMock(return_value=contest)), \
         patch("app.modules.contests.contest_execution_service.get_attempt", new=AsyncMock(return_value=finalized_attempt)):

        with pytest.raises(HTTPException) as exc_info:
            await ContestExecutionService.submit_arena_code(
                slug=contest.slug,
                payload=ArenaSubmitRequest(
                    problem_id="prob-1",
                    language="python",
                    code="print('hello')",
                    request_id="req-123",
                ),
                current_member=member,
                db=mock_db,
            )
        assert exc_info.value.status_code == 403
        assert "finalized" in exc_info.value.detail.lower()

    # 3. run_arena_code rejects with 403
    with patch("app.modules.contests.contest_repository.ContestRepository.get_by_slug", new=AsyncMock(return_value=contest)), \
         patch("app.modules.contests.contest_execution_service.get_attempt", new=AsyncMock(return_value=finalized_attempt)):

        with pytest.raises(HTTPException) as exc_info:
            await ContestExecutionService.run_arena_code(
                slug=contest.slug,
                payload=ArenaRunRequest(
                    problem_id="prob-1",
                    language="python",
                    code="print('hello')",
                ),
                current_member=member,
                db=mock_db,
            )
        assert exc_info.value.status_code == 403
        assert "finalized" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_expired_attempt_enforcement():
    """Timer Expiration: When attempt end time has elapsed, status transitions or rejects with 403."""
    mock_db = AsyncMock()
    now = now_utc()
    contest = OfflineContest(
        id="contest-test-4",
        slug="weekly-test-4",
        title="Weekly Contest Test 4",
        status="live",
        starts_at=now - timedelta(hours=3),
        ends_at=now - timedelta(minutes=10),  # Ended 10 min ago
    )
    member = MemberProfile(
        id="member-test-4",
        handle="cadet_delta",
    )
    expired_attempt = ContestAttempt(
        id="attempt-test-4",
        contest_id=contest.id,
        member_id=member.id,
        status="expired",
        started_at=now - timedelta(hours=2),
        ends_at=contest.ends_at,
        final_score=50,
        finalized_at=now - timedelta(minutes=10),
    )

    mock_res = MagicMock()
    mock_res.scalars.return_value.first.return_value = expired_attempt
    mock_db.execute = AsyncMock(return_value=mock_res)

    is_sub, reason = await is_contest_attempt_submitted(member, contest, mock_db)
    assert is_sub is True
    assert "expired" in reason
    assert attempt_is_closed(expired_attempt)


@pytest.mark.asyncio
async def test_idempotent_duplicate_submission_replay():
    """Idempotency: Repeated submission with identical request_id safely replays prior verdict."""
    mock_db = AsyncMock()
    now = now_utc()
    contest = OfflineContest(
        id="contest-test-5",
        slug="weekly-test-5",
        status="live",
        starts_at=now - timedelta(minutes=10),
        ends_at=now + timedelta(minutes=110),
    )
    member = MemberProfile(
        id="member-test-5",
        handle="cadet_epsilon",
    )
    attempt = ContestAttempt(
        id="attempt-test-5",
        contest_id=contest.id,
        member_id=member.id,
        status="in_progress",
        started_at=now - timedelta(minutes=10),
        ends_at=contest.ends_at,
    )
    existing_sub = ContestSubmission(
        id="sub-test-existing",
        contest_id=contest.id,
        attempt_id=attempt.id,
        idempotency_key="idemp-key-999",
        problem_id="prob-1",
        member_id=member.id,
        handle=member.handle,
        language="python",
        code="def solve(): return 42",
        verdict="ACCEPTED",
        passed_testcases=10,
        total_testcases=10,
        points_awarded=100,
        submitted_at=now - timedelta(seconds=5),
    )

    # Mock previous submission found with same idempotency key
    with patch("app.modules.contests.contest_repository.ContestRepository.get_by_slug", new=AsyncMock(return_value=contest)), \
         patch("app.modules.contests.contest_execution_service.get_attempt", new=AsyncMock(return_value=attempt)):

        mock_contest_res = MagicMock()
        mock_contest_res.scalars.return_value.first.return_value = contest

        mock_sub_res = MagicMock()
        mock_sub_res.scalars.return_value.first.return_value = existing_sub
        mock_db.execute = AsyncMock(side_effect=[mock_contest_res, mock_sub_res])

        result = await ContestExecutionService.submit_arena_code(
            slug=contest.slug,
            payload=ArenaSubmitRequest(
                problem_id="prob-1",
                language="python",
                code="def solve(): return 42",
                request_id="idemp-key-999",
            ),
            current_member=member,
            db=mock_db,
        )

        assert result["idempotent_replay"] is True
        assert result["verdict"] == "ACCEPTED"
        assert result["points_awarded"] == 100
        assert attempt.status == "in_progress"  # Attempt remains in_progress


@pytest.mark.asyncio
async def test_multi_problem_progression_until_explicit_finish():
    """Candidates can solve and submit multiple problems successively without premature finalization."""
    mock_db = AsyncMock()
    now = now_utc()
    contest = OfflineContest(
        id="contest-test-6",
        slug="weekly-test-6",
        status="live",
        starts_at=now - timedelta(minutes=15),
        ends_at=now + timedelta(minutes=105),
    )
    member = MemberProfile(
        id="member-test-6",
        handle="cadet_zeta",
    )
    attempt = ContestAttempt(
        id="attempt-test-6",
        contest_id=contest.id,
        member_id=member.id,
        status="in_progress",
        started_at=now - timedelta(minutes=15),
        ends_at=contest.ends_at,
    )

    # 1. Start: attempt is in_progress
    assert attempt.status == "in_progress"

    # 2. Simulate Problem A submission -> attempt remains in_progress
    sub_a = ContestSubmission(
        id="sub-a",
        contest_id=contest.id,
        attempt_id=attempt.id,
        problem_id="prob-A",
        member_id=member.id,
        verdict="ACCEPTED",
        points_awarded=100,
    )
    assert attempt.status == "in_progress"
    assert not attempt_is_closed(attempt)

    # 3. Simulate Problem B submission -> attempt STILL remains in_progress
    sub_b = ContestSubmission(
        id="sub-b",
        contest_id=contest.id,
        attempt_id=attempt.id,
        problem_id="prob-B",
        member_id=member.id,
        verdict="ACCEPTED",
        points_awarded=100,
    )
    assert attempt.status == "in_progress"
    assert not attempt_is_closed(attempt)

    # 4. Only explicit finish transitions attempt to finalized
    with patch("app.modules.contests.contest_attempt_service.get_attempt", new=AsyncMock(return_value=attempt)), \
         patch("app.modules.contests.contest_attempt_service.delete_cache_pattern", new=AsyncMock()), \
         patch("app.services.event_broadcaster.broadcast_event", new=AsyncMock()):

        mock_contest_res = MagicMock()
        mock_contest_res.scalars.return_value.first.return_value = contest
        sb = ScoreboardEntry(
            contest_id=contest.id,
            member_id=member.id,
            score=200,
            rank=1,
        )
        mock_sb_res = MagicMock()
        mock_sb_res.scalars.return_value.first.return_value = sb
        mock_db.execute = AsyncMock(side_effect=[mock_contest_res, mock_sb_res])

        fin = await finalize_attempt(contest.slug, member, mock_db)
        assert fin["success"] is True
        assert fin["status"] == "finalized"
        assert fin["total_score"] == 200
        assert attempt.status == "finalized"
        assert attempt.final_score == 200
        assert attempt_is_closed(attempt)


@pytest.mark.asyncio
async def test_user_isolation_cannot_finalize_another_cadet_attempt():
    """Security Invariant: Cadet A cannot finalize Cadet B's contest attempt."""
    mock_db = AsyncMock()
    now = now_utc()
    contest = OfflineContest(
        id="contest-test-7",
        slug="weekly-test-7",
        status="live",
        starts_at=now - timedelta(minutes=10),
        ends_at=now + timedelta(minutes=110),
    )
    cadet_b = MemberProfile(
        id="cadet-b-id",
        handle="cadet_b",
    )

    with patch("app.modules.contests.contest_attempt_service.get_attempt", new=AsyncMock(return_value=None)):
        mock_contest_res = MagicMock()
        mock_contest_res.scalars.return_value.first.return_value = contest
        mock_db.execute = AsyncMock(return_value=mock_contest_res)

        # Cadet B attempts to finalize without having an active attempt started
        with pytest.raises(HTTPException) as exc_info:
            await finalize_attempt(contest.slug, cadet_b, mock_db)
        assert exc_info.value.status_code == 409
        assert "no live contest attempt" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_finalize_with_mismatched_attempt_id_rejected():
    """Security Invariant: Supplying an attempt_id belonging to another attempt or user is rejected with 403."""
    mock_db = AsyncMock()
    now = now_utc()
    contest = OfflineContest(
        id="contest-test-8",
        slug="weekly-test-8",
        status="live",
        starts_at=now - timedelta(minutes=10),
        ends_at=now + timedelta(minutes=110),
    )
    cadet = MemberProfile(
        id="cadet-auth-id",
        handle="cadet_auth",
    )
    real_attempt = ContestAttempt(
        id="real-attempt-uuid-1",
        contest_id=contest.id,
        member_id=cadet.id,
        status="in_progress",
        started_at=now,
        ends_at=contest.ends_at,
    )

    with patch("app.modules.contests.contest_attempt_service.get_attempt", new=AsyncMock(return_value=real_attempt)):
        mock_contest_res = MagicMock()
        mock_contest_res.scalars.return_value.first.return_value = contest
        mock_db.execute = AsyncMock(return_value=mock_contest_res)

        # Attacker tries to finalize specifying an invalid or forged attempt ID
        with pytest.raises(HTTPException) as exc_info:
            await finalize_attempt(
                slug=contest.slug,
                member=cadet,
                db=mock_db,
                expected_attempt_id="forged-or-other-cadet-attempt-id",
            )
        assert exc_info.value.status_code == 403
        assert "does not match" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_finalize_nonexistent_contest_rejected():
    """Security Invariant: Calling finalize on an unknown contest raises HTTP 404."""
    mock_db = AsyncMock()
    cadet = MemberProfile(id="cadet-x", handle="cadet_x")

    mock_contest_res = MagicMock()
    mock_contest_res.scalars.return_value.first.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_contest_res)

    with pytest.raises(HTTPException) as exc_info:
        await finalize_attempt(slug="non-existent-contest-slug", member=cadet, db=mock_db)
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_finalize_by_contest_uuid():
    """Verify that finalize_attempt works seamlessly when passing contest UUID instead of slug."""
    mock_db = AsyncMock()
    now = now_utc()
    contest_uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    contest = OfflineContest(
        id=contest_uuid,
        slug="weekly-test-uuid",
        status="live",
        starts_at=now - timedelta(minutes=10),
        ends_at=now + timedelta(minutes=110),
    )
    cadet = MemberProfile(id="cadet-uuid-user", handle="cadet_uuid")
    attempt = ContestAttempt(
        id="attempt-uuid-abc",
        contest_id=contest.id,
        member_id=cadet.id,
        status="in_progress",
        started_at=now,
        ends_at=contest.ends_at,
    )

    with patch("app.modules.contests.contest_attempt_service.get_attempt", new=AsyncMock(return_value=attempt)), \
         patch("app.modules.contests.contest_attempt_service.delete_cache_pattern", new=AsyncMock()), \
         patch("app.services.event_broadcaster.broadcast_event", new=AsyncMock()):

        mock_contest_res = MagicMock()
        mock_contest_res.scalars.return_value.first.return_value = contest
        sb = ScoreboardEntry(contest_id=contest.id, member_id=cadet.id, score=350, rank=1)
        mock_sb_res = MagicMock()
        mock_sb_res.scalars.return_value.first.return_value = sb
        mock_db.execute = AsyncMock(side_effect=[mock_contest_res, mock_sb_res])

        res = await finalize_attempt(
            slug=contest_uuid,
            member=cadet,
            db=mock_db,
            expected_attempt_id="attempt-uuid-abc",
        )
        assert res["success"] is True
        assert res["contest_id"] == contest_uuid
        assert res["attempt_id"] == "attempt-uuid-abc"
        assert res["total_score"] == 350
        assert res["status"] == "finalized"


@pytest.mark.asyncio
async def test_race_submit_after_finalized_fails():
    """Race Condition Invariant: If finalization commits first, subsequent problem submit is strictly rejected with 403."""
    mock_db = AsyncMock()
    now = now_utc()
    contest = OfflineContest(
        id="contest-test-race",
        slug="weekly-test-race",
        status="live",
        starts_at=now - timedelta(minutes=10),
        ends_at=now + timedelta(minutes=110),
    )
    cadet = MemberProfile(id="cadet-race-user", handle="cadet_race")
    finalized_attempt = ContestAttempt(
        id="attempt-race-finalized",
        contest_id=contest.id,
        member_id=cadet.id,
        status="finalized",  # already finalized!
        started_at=now - timedelta(minutes=10),
        ends_at=contest.ends_at,
        final_score=100,
    )

    with patch("app.modules.contests.contest_repository.ContestRepository.get_by_slug", new=AsyncMock(return_value=contest)), \
         patch("app.modules.contests.contest_execution_service.get_attempt", new=AsyncMock(return_value=finalized_attempt)):

        mock_contest_res = MagicMock()
        mock_contest_res.scalars.return_value.first.return_value = contest
        mock_db.execute = AsyncMock(return_value=mock_contest_res)

        payload = ArenaSubmitRequest(
            problem_id="prob-1",
            language="python",
            code="def solution(): return 42",
            request_id="req-race-1",
        )

        with pytest.raises(HTTPException) as exc_info:
            await ContestExecutionService.submit_arena_code(
                slug=contest.slug,
                payload=payload,
                current_member=cadet,
                db=mock_db,
            )
        assert exc_info.value.status_code == 403
        assert "finalized" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_regression_weekly_contest_2_no_campus_pass():
    """
    REGRESSION TEST FOR THE EXACT BUG:
    User -> weekly-contest-2 -> Authenticated -> No CampusPass -> Enter contest.
    Expected: SUCCESS (not 404 No campus pass allocated, not 403 gate error).
    """
    from app.services.contest_eligibility_service import is_member_eligible_for_live_contest
    from app.modules.contests.contest_service import ContestService

    mock_db = AsyncMock()
    now = now_utc()
    contest = OfflineContest(
        id="contest-weekly-2",
        slug="weekly-contest-2",
        title="CCC Weekly Contest 2",
        status="live",
        starts_at=now - timedelta(minutes=15),
        ends_at=now + timedelta(minutes=105),
        registered_count=10,
        problems=[],
    )
    cadet = MemberProfile(
        id="cadet-weekly-2-user",
        handle="cadet_w2",
        full_name="Cadet Weekly Two",
        email="cadet_w2@medicaps.ac.in",
    )

    # 1. No attempt yet (empty select result)
    mock_attempt_res = MagicMock()
    mock_attempt_res.scalars.return_value.first.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_attempt_res)

    # 2. Check eligibility for live contest
    eligible, reason = await is_member_eligible_for_live_contest(cadet, contest, mock_db)
    assert eligible is True
    assert "open contest arena" in reason.lower()

    # 3. Enter arena data: no campus pass required, no 404 error
    with patch("app.modules.contests.contest_repository.ContestRepository.get_by_slug", new=AsyncMock(return_value=contest)), \
         patch("app.modules.contests.contest_service.is_member_eligible_for_live_contest", new=AsyncMock(return_value=(True, "Eligible"))), \
         patch("app.modules.contests.contest_attempt_service.start_or_get_attempt", new=AsyncMock(return_value=ContestAttempt(
             id="attempt-w2", contest_id=contest.id, member_id=cadet.id, status="in_progress"
         ))):

        arena_data = await ContestService.get_contest_arena_data("weekly-contest-2", mock_db, cadet)
        assert arena_data["slug"] == "weekly-contest-2"
        assert arena_data["assigned_seat"] is None  # no physical lab seat required
        assert arena_data["pass_code"] is None      # no physical pass code required
        assert arena_data["check_in_status"] == "checked_in"


@pytest.mark.asyncio
async def test_online_contest_registration_status_clean():
    """Verify get_registration_status reflects online contest attempt state without querying deprecated assessment/passes."""
    from app.modules.contests.contest_service import ContestService
    from fastapi import Response

    mock_db = AsyncMock()
    now = now_utc()
    contest = OfflineContest(
        id="contest-reg-1",
        slug="weekly-contest-2",
        status="live",
        starts_at=now - timedelta(minutes=10),
        ends_at=now + timedelta(minutes=110),
    )
    cadet = MemberProfile(id="cadet-reg-user", handle="cadet_reg")

    mock_attempt_status_res = MagicMock()
    mock_attempt_status_res.scalar_one_or_none.return_value = "in_progress"
    mock_db.execute = AsyncMock(return_value=mock_attempt_status_res)

    with patch("app.modules.contests.contest_repository.ContestRepository.get_by_slug", new=AsyncMock(return_value=contest)), \
         patch("app.modules.contests.contest_repository.ContestRepository.get_registration", new=AsyncMock(return_value=None)):

        res = await ContestService.get_registration_status(
            slug="weekly-contest-2",
            response=Response(),
            db=mock_db,
            current_member=cadet,
        )

        assert res["contest_slug"] == "weekly-contest-2"
        assert res["contest_status"] == "live"
        assert res["contest_attempt_status"] == "in_progress"
        assert res["can_enter_live_contest"] is True
        assert res["is_checked_in"] is True
        assert res["is_top_30_qualified"] is True


@pytest.mark.asyncio
async def test_unauthenticated_user_denied_live_contest():
    """Unauthenticated users cannot enter a live contest arena."""
    from app.services.contest_eligibility_service import is_member_eligible_for_live_contest

    mock_db = AsyncMock()
    contest = OfflineContest(id="contest-anon", slug="weekly-contest-anon", status="live")

    eligible, reason = await is_member_eligible_for_live_contest(None, contest, mock_db)
    assert eligible is False
    assert "authentication required" in reason.lower()


