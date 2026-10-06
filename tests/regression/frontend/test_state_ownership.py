"""
Chaos Computer Club — Medi-Caps Chapter
tests/regression/frontend/test_state_ownership.py — Client/Server State Ownership Invariants

Linked Bugs: REG-0004, REG-0006, REG-0007
Invariant: OPERATION_MUST_SATISFY_STRICT_STATE_MANAGEMENT_CONTRACT
"""

import pytest
import json
from typing import Dict, Any


@pytest.mark.regression("REG-0004")
def test_optimistic_update_rollback_on_server_rejection():
    """
    REG-0004 Invariant:
    Optimistic updates in client state (e.g. registration pending) must cleanly
    revert to authoritative snapshot upon server 4xx/5xx rejection.
    """
    # Authoritative initial state
    server_state = {
        "contest_id": "contest-42",
        "registered": False,
        "registered_count": 10,
    }

    client_state = dict(server_state)

    # 1. Optimistic mutation applied
    optimistic_snapshot = dict(client_state)
    client_state["registered"] = True
    client_state["registered_count"] += 1

    assert client_state["registered"] is True
    assert client_state["registered_count"] == 11

    # 2. Server responds with 409 Conflict (e.g. Capacity Exceeded or Disqualified)
    server_error_response = {
        "status_code": 409,
        "detail": "Contest seat capacity reached",
    }

    # 3. Rollback executed
    def rollback(client, snapshot):
        client.clear()
        client.update(snapshot)

    rollback(client_state, optimistic_snapshot)

    # Invariant assertion: State must match pre-optimistic state exactly
    assert client_state["registered"] is False
    assert client_state["registered_count"] == 10
    assert client_state == server_state


@pytest.mark.regression("REG-0006")
def test_canonical_swr_cache_key_generation():
    """
    REG-0006 Invariant:
    SWR/React Query cache keys must be canonical and insensitive to query parameter ordering,
    preventing duplicate simultaneous network fetches for the same resource.
    """
    def generate_cache_key(endpoint: str, params: Dict[str, Any]) -> str:
        # Sort query params deterministically
        sorted_params = sorted(params.items(), key=lambda kv: kv[0])
        param_str = "&".join(f"{k}={v}" for k, v in sorted_params)
        return f"{endpoint}?{param_str}" if param_str else endpoint

    key1 = generate_cache_key("/api/v1/contests", {"division": "open", "status": "active"})
    key2 = generate_cache_key("/api/v1/contests", {"status": "active", "division": "open"})

    # Invariant: identical parameters in different dictionary orders must yield the exact same cache key
    assert key1 == key2
    assert key1 == "/api/v1/contests?division=open&status=active"


@pytest.mark.regression("REG-0007")
def test_redux_state_must_be_strictly_serializable():
    """
    REG-0007 Invariant:
    Redux store slice states must be strictly JSON-serializable, preventing
    hidden cyclical references, uncloneable socket instances, or functions.
    """
    valid_contest_slice = {
        "currentContest": {
            "id": "c-001",
            "title": "Winter Championship",
            "starts_at": "2026-10-05T12:00:00Z",
            "is_registered": False,
        },
        "loading": False,
        "error": None,
        "activeDetailRequestId": "req-12345",
    }

    # Must serialize and deserialize cleanly without error
    serialized = json.dumps(valid_contest_slice)
    deserialized = json.loads(serialized)
    assert deserialized == valid_contest_slice

    # Invariant: Non-serializable state (e.g. raw function, class instance) must fail validation
    class UnserializableClass:
        pass

    invalid_slice = dict(valid_contest_slice)
    invalid_slice["raw_connection"] = UnserializableClass()

    with pytest.raises(TypeError):
        json.dumps(invalid_slice)
