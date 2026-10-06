"""
Chaos Computer Club — Medi-Caps Chapter
tests/regression/backend/test_sse_ordering.py — SSE Monotonic Sequence & Ordering Invariants

Linked Bugs: REG-0004, REG-0021
Invariant: REALTIME_EVENTS_MUST_MAINTAIN_MONOTONIC_ORDERING_AND_FENCE_STALE_PACKETS
"""

import pytest
from typing import Dict, Any, Optional


class RealtimeSSEDispatcher:
    """
    Manages incoming SSE packets and ensures strict monotonic sequence/timestamp
    ordering per entity channel, discarding stale packets.
    """
    def __init__(self):
        self.entity_versions: Dict[str, int] = {}
        self.entity_states: Dict[str, Any] = {}

    def process_event(self, entity_id: str, version: int, payload: Dict[str, Any]) -> bool:
        current_version = self.entity_versions.get(entity_id, -1)
        
        # Invariant: Discard any packet that is older than or equal to current seen version
        if version <= current_version:
            return False  # Discarded stale or duplicate packet

        self.entity_versions[entity_id] = version
        self.entity_states[entity_id] = payload
        return True


@pytest.mark.regression("REG-0004")
def test_out_of_order_sse_events_do_not_revert_state():
    """
    REG-0004 Invariant:
    If an SSE packet with version 2 arrives, and subsequently a delayed
    SSE packet with version 1 arrives, version 1 must be rejected and not revert state.
    """
    dispatcher = RealtimeSSEDispatcher()
    contest_id = "contest-live-42"

    # Event 1: Registration count is 20 (v1)
    # Event 2: Registration count is 21 (v2)
    # Event 2 arrives first over WebSocket/SSE
    accepted_v2 = dispatcher.process_event(
        contest_id,
        version=2,
        payload={"registered_count": 21, "status": "live"}
    )
    assert accepted_v2 is True
    assert dispatcher.entity_states[contest_id]["registered_count"] == 21

    # Delayed Event 1 arrives later (network hiccup)
    accepted_v1 = dispatcher.process_event(
        contest_id,
        version=1,
        payload={"registered_count": 20, "status": "upcoming"}
    )

    # Invariant: Stale event v1 MUST be rejected
    assert accepted_v1 is False
    # Authoritative state remains v2
    assert dispatcher.entity_states[contest_id]["registered_count"] == 21
    assert dispatcher.entity_states[contest_id]["status"] == "live"


@pytest.mark.regression("REG-0021")
def test_duplicate_sse_event_deduplication():
    """
    REG-0021 Invariant:
    Identical duplicate SSE event deliveries (e.g. at-least-once pubsub re-deliveries)
    must be cleanly rejected to prevent duplicate incrementing or double-processing.
    """
    dispatcher = RealtimeSSEDispatcher()
    submission_id = "sub-stream-999"

    # First delivery: Submission evaluated (AC)
    first_delivery = dispatcher.process_event(
        submission_id,
        version=100,
        payload={"verdict": "ACCEPTED", "score": 100}
    )
    assert first_delivery is True

    # Duplicate delivery with same version
    dup_delivery = dispatcher.process_event(
        submission_id,
        version=100,
        payload={"verdict": "ACCEPTED", "score": 100}
    )

    # Invariant: Duplicate version must be discarded as non-new
    assert dup_delivery is False
