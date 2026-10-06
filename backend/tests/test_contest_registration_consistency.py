"""
Chaos Computer Club — Medi-Caps Chapter
tests/test_contest_registration_consistency.py

Regression Test Suite for Global Registration State & Real-Time Sync Consistency:
- REG-STATE-001: Comprehensive cache invalidation on registration
- REG-STATE-002: Canonical Outbox event creation & immediate relay on registration
- REG-STATE-003: Comprehensive cache invalidation & outbox relay on unregistration
- REG-STATE-004: Idempotent double registration returns canonical projection
- REG-STATE-005: Single publisher invariant in admin contest registration
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import (
    OfflineContest,
    ContestRegistration,
    MemberProfile,
)
from app.modules.contests.contest_service import ContestService
from app.modules.contests.admin_contest_service import AdminContestService


@pytest.mark.asyncio
async def test_reg_state_001_cache_invalidation_on_registration():
    """
    REG-STATE-001: Verify all registration-status and contest detail cache keys
    are invalidated upon successful registration so navigation from list to detail
    never serves stale registered=false data.
    """
    mock_db = AsyncMock(spec=AsyncSession)

    mock_contest = MagicMock(spec=OfflineContest)
    mock_contest.id = "c-reg-101"
    mock_contest.slug = "ccc-weekly-2"
    mock_contest.title = "CCC Weekly 2"
    mock_contest.status = "upcoming"
    mock_contest.registered_count = 10
    mock_contest.seat_capacity = 100
    mock_contest.venue = "Online Arena"

    mock_member = MagicMock(spec=MemberProfile)
    mock_member.id = "mem-reg-404"
    mock_member.handle = "test_cadet"
    mock_member.full_name = "Test Cadet"

    mock_res = MagicMock()
    mock_res.scalar_one_or_none = MagicMock(return_value=mock_contest)
    mock_db.execute = AsyncMock(return_value=mock_res)

    deleted_keys = []
    deleted_patterns = []

    async def mock_delete_cache(key: str):
        deleted_keys.append(key)
        return True

    async def mock_delete_pattern(pattern: str):
        deleted_patterns.append(pattern)
        return 1

    with patch("app.modules.contests.contest_repository.ContestRepository.get_registration", new=AsyncMock(return_value=None)), \
         patch("app.modules.contests.contest_service.is_contest_attempt_submitted", new=AsyncMock(return_value=(False, ""))), \
         patch("app.modules.contests.contest_service.record_outbox_event", new=AsyncMock()) as mock_outbox, \
         patch("app.modules.contests.contest_service.relay_outbox_events", new=AsyncMock()) as mock_relay, \
         patch("app.modules.contests.contest_service.delete_cache", side_effect=mock_delete_cache), \
         patch("app.modules.contests.contest_service.delete_cache_pattern", side_effect=mock_delete_pattern):

        result = await ContestService.register_for_contest(
            slug="ccc-weekly-2",
            current_member=mock_member,
            db=mock_db,
        )

        assert result["status"] == "confirmed"
        assert result["registered"] is True
        assert result["contest_id"] == "c-reg-101"
        assert result["contest_slug"] == "ccc-weekly-2"
        assert result["member_id"] == "mem-reg-404"

        # Explicit single-key deletions
        assert f"cache:reg_status:c-reg-101:mem-reg-404" in deleted_keys
        assert f"cache:contest:detail:ccc-weekly-2:mem-reg-404" in deleted_keys

        # Pattern deletions
        assert f"cache:reg_status:c-reg-101*" in deleted_patterns
        assert f"cache:reg_status:ccc-weekly-2*" in deleted_patterns
        assert f"cache:contest:detail:ccc-weekly-2*" in deleted_patterns
        assert f"cache:*:mem-reg-404*" in deleted_patterns

        # Immediate outbox relay called
        mock_relay.assert_awaited_once_with(mock_db, batch_size=10)


@pytest.mark.asyncio
async def test_reg_state_002_outbox_canonical_payload_and_relay():
    """
    REG-STATE-002: Verify outbox event contains canonical registration projection
    including contest_id, member_id, registered=True, and version.
    """
    mock_db = AsyncMock(spec=AsyncSession)

    mock_contest = MagicMock(spec=OfflineContest)
    mock_contest.id = "c-reg-202"
    mock_contest.slug = "ccc-weekly-3"
    mock_contest.title = "CCC Weekly 3"
    mock_contest.status = "upcoming"
    mock_contest.registered_count = 15
    mock_contest.seat_capacity = 50
    mock_contest.venue = "Online Arena"

    mock_member = MagicMock(spec=MemberProfile)
    mock_member.id = "mem-reg-505"
    mock_member.handle = "star_cadet"
    mock_member.full_name = "Star Cadet"

    mock_res = MagicMock()
    mock_res.scalar_one_or_none = MagicMock(return_value=mock_contest)
    mock_db.execute = AsyncMock(return_value=mock_res)

    outbox_calls = []

    async def mock_record_outbox(**kwargs):
        outbox_calls.append(kwargs)

    with patch("app.modules.contests.contest_repository.ContestRepository.get_registration", new=AsyncMock(return_value=None)), \
         patch("app.modules.contests.contest_service.is_contest_attempt_submitted", new=AsyncMock(return_value=(False, ""))), \
         patch("app.modules.contests.contest_service.record_outbox_event", side_effect=mock_record_outbox), \
         patch("app.modules.contests.contest_service.relay_outbox_events", new=AsyncMock()), \
         patch("app.modules.contests.contest_service.delete_cache", new=AsyncMock()), \
         patch("app.modules.contests.contest_service.delete_cache_pattern", new=AsyncMock()):

        await ContestService.register_for_contest(
            slug="ccc-weekly-3",
            current_member=mock_member,
            db=mock_db,
        )

        assert len(outbox_calls) == 1
        event = outbox_calls[0]
        assert event["event_type"] == "contest_registered"
        assert event["queue_name"] == "realtime"
        payload = event["payload"]
        assert payload["event"] == "contest_registered"
        assert payload["registered"] is True
        assert payload["contest_id"] == "c-reg-202"
        assert payload["contest_slug"] == "ccc-weekly-3"
        assert payload["member_id"] == "mem-reg-505"
        assert payload["status"] == "confirmed"
        assert payload["version"] == 16  # 15 + 1


@pytest.mark.asyncio
async def test_reg_state_003_unregistration_cache_invalidation_and_outbox():
    """
    REG-STATE-003: Verify unregistration properly clears cache and relays outbox event.
    """
    mock_db = AsyncMock(spec=AsyncSession)

    mock_contest = MagicMock(spec=OfflineContest)
    mock_contest.id = "c-reg-303"
    mock_contest.slug = "ccc-weekly-4"
    mock_contest.title = "CCC Weekly 4"
    mock_contest.status = "upcoming"
    mock_contest.registered_count = 5
    mock_contest.seat_capacity = 100
    mock_contest.venue = "Online Arena"

    mock_member = MagicMock(spec=MemberProfile)
    mock_member.id = "mem-reg-606"
    mock_member.handle = "leaving_cadet"

    mock_reg = MagicMock(spec=ContestRegistration)
    mock_reg.status = "confirmed"
    mock_reg.assessment_taken = False

    mock_res = MagicMock()
    mock_res.scalar_one_or_none = MagicMock(return_value=mock_contest)
    mock_db.execute = AsyncMock(return_value=mock_res)

    deleted_keys = []
    deleted_patterns = []

    async def mock_delete_cache(key: str):
        deleted_keys.append(key)
        return True

    async def mock_delete_pattern(pattern: str):
        deleted_patterns.append(pattern)
        return 1

    outbox_calls = []

    async def mock_record_outbox(**kwargs):
        outbox_calls.append(kwargs)

    with patch("app.modules.contests.contest_repository.ContestRepository.get_registration", new=AsyncMock(return_value=mock_reg)), \
         patch("app.modules.contests.contest_service.is_contest_attempt_submitted", new=AsyncMock(return_value=(False, ""))), \
         patch("app.modules.contests.contest_service.record_outbox_event", side_effect=mock_record_outbox), \
         patch("app.modules.contests.contest_service.relay_outbox_events", new=AsyncMock()) as mock_relay, \
         patch("app.modules.contests.contest_service.delete_cache", side_effect=mock_delete_cache), \
         patch("app.modules.contests.contest_service.delete_cache_pattern", side_effect=mock_delete_pattern):

        result = await ContestService.unregister_from_contest(
            slug="ccc-weekly-4",
            current_member=mock_member,
            db=mock_db,
        )

        assert result["status"] == "unregistered"
        assert result["registered"] is False
        assert result["contest_id"] == "c-reg-303"
        assert result["member_id"] == "mem-reg-606"

        assert f"cache:reg_status:c-reg-303:mem-reg-606" in deleted_keys
        assert f"cache:reg_status:c-reg-303*" in deleted_patterns
        assert len(outbox_calls) == 1
        assert outbox_calls[0]["payload"]["registered"] is False
        assert outbox_calls[0]["payload"]["status"] == "unregistered"

        mock_relay.assert_awaited_once_with(mock_db, batch_size=10)


@pytest.mark.asyncio
async def test_reg_state_004_double_registration_idempotency():
    """
    REG-STATE-004: Verify registering twice returns idempotent authoritative confirmation
    with full identity metadata.
    """
    mock_db = AsyncMock(spec=AsyncSession)

    mock_contest = MagicMock(spec=OfflineContest)
    mock_contest.id = "c-reg-404"
    mock_contest.slug = "ccc-weekly-5"
    mock_contest.title = "CCC Weekly 5"
    mock_contest.status = "upcoming"
    mock_contest.registered_count = 20
    mock_contest.seat_capacity = 100
    mock_contest.venue = "Online Arena"

    mock_member = MagicMock(spec=MemberProfile)
    mock_member.id = "mem-reg-707"
    mock_member.handle = "repeat_cadet"

    mock_res = MagicMock()
    mock_res.scalar_one_or_none = MagicMock(return_value=mock_contest)
    mock_db.execute = AsyncMock(return_value=mock_res)

    existing_reg = MagicMock(spec=ContestRegistration)
    existing_reg.status = "confirmed"
    existing_reg.registered_at = None

    with patch("app.modules.contests.contest_repository.ContestRepository.get_registration", new=AsyncMock(return_value=existing_reg)), \
         patch("app.modules.contests.contest_service.is_contest_attempt_submitted", new=AsyncMock(return_value=(False, ""))):

        result = await ContestService.register_for_contest(
            slug="ccc-weekly-5",
            current_member=mock_member,
            db=mock_db,
        )

        assert result["status"] == "already_registered"
        assert result["registered"] is True
        assert result["contest_id"] == "c-reg-404"
        assert result["contest_slug"] == "ccc-weekly-5"
        assert result["member_id"] == "mem-reg-707"


@pytest.mark.asyncio
async def test_reg_state_005_admin_registration_single_publisher():
    """
    REG-STATE-005: Verify admin registration uses transactional outbox and relay_outbox_events,
    adhering strictly to the Single Publisher Invariant.
    """
    mock_db = AsyncMock(spec=AsyncSession)

    mock_contest = MagicMock(spec=OfflineContest)
    mock_contest.id = "c-reg-505"
    mock_contest.slug = "ccc-weekly-6"
    mock_contest.title = "CCC Weekly 6"
    mock_contest.status = "upcoming"
    mock_contest.registered_count = 1
    mock_contest.seat_capacity = 50

    mock_member = MagicMock(spec=MemberProfile)
    mock_member.id = "mem-reg-808"
    mock_member.handle = "admin_enrolled_cadet"
    mock_member.full_name = "Admin Enrolled Cadet"

    mock_member_res = MagicMock()
    mock_member_res.scalars = MagicMock(return_value=MagicMock(first=MagicMock(return_value=mock_member)))
    mock_db.execute = AsyncMock(return_value=mock_member_res)

    deleted_keys = []

    async def mock_delete_cache(key: str):
        deleted_keys.append(key)
        return True

    with patch("app.modules.contests.contest_repository.ContestRepository.get_by_slug", new=AsyncMock(return_value=mock_contest)), \
         patch("app.modules.contests.contest_repository.ContestRepository.get_registration", new=AsyncMock(return_value=None)), \
         patch("app.modules.contests.admin_contest_service.record_outbox_event", new=AsyncMock()) as mock_outbox, \
         patch("app.modules.contests.admin_contest_service.relay_outbox_events", new=AsyncMock()) as mock_relay, \
         patch("app.modules.contests.admin_contest_service.delete_cache", side_effect=mock_delete_cache), \
         patch("app.modules.contests.admin_contest_service.delete_cache_pattern", new=AsyncMock()):

        result = await AdminContestService.admin_register_participant(
            slug="ccc-weekly-6",
            payload={"identifier": "admin_enrolled_cadet"},
            db=mock_db,
        )

        assert result["status"] == "confirmed"
        assert result["member_id"] == "mem-reg-808"

        # Verified single publisher outbox record and relay
        mock_outbox.assert_awaited_once()
        mock_relay.assert_awaited_once_with(mock_db, batch_size=10)

        # Verified registration status cache was invalidated for this member
        assert f"cache:reg_status:c-reg-505:mem-reg-808" in deleted_keys
