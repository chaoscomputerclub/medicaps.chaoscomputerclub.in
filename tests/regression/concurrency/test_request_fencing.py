"""
Chaos Computer Club — Medi-Caps Chapter
tests/regression/concurrency/test_request_fencing.py — Async Request Race & Fencing Invariants

Linked Bugs: REG-0004, REG-0009, REG-0041, REG-0092
Invariant: OLDER_ASYNC_RESPONSE_MUST_NEVER_OVERWRITE_NEWER_STATE
"""

import pytest
import asyncio
from typing import Dict, Any, Optional


class RequestFencedStore:
    """
    Simulates frontend / API client request generation fencing mechanism
    (e.g., activeDetailRequestId in Redux / SWR).
    """
    def __init__(self):
        self.state: Dict[str, Any] = {}
        self.active_request_id: Optional[str] = None
        self.request_generation: int = 0

    def start_request(self, request_id: str) -> int:
        self.active_request_id = request_id
        self.request_generation += 1
        return self.request_generation

    def apply_response(self, request_id: str, generation: int, data: Dict[str, Any]) -> bool:
        # Invariant: Discard stale responses if newer request has already superseded it
        if request_id != self.active_request_id or generation < self.request_generation:
            # Fenced / Discarded stale response
            return False
        self.state = data
        return True


@pytest.mark.regression("REG-0004")
def test_out_of_order_responses_do_not_overwrite_newer_state():
    """
    REG-0004 / REG-0041 Invariant:
    If Request 1 (slow) resolves after Request 2 (fast), Request 1's payload
    must be discarded, preserving Request 2's authoritative state.
    """
    store = RequestFencedStore()

    # Request 1 starts (e.g. user clicked Contest A)
    req1_id = "req-contest-A-t0"
    gen1 = store.start_request(req1_id)

    # User immediately clicks Contest B (Request 2 starts)
    req2_id = "req-contest-B-t1"
    gen2 = store.start_request(req2_id)

    # Request 2 completes first (fast network response)
    accepted2 = store.apply_response(req2_id, gen2, {"contest_id": "contest-B", "title": "Contest B"})
    assert accepted2 is True
    assert store.state["contest_id"] == "contest-B"

    # Request 1 completes later (slow network response)
    accepted1 = store.apply_response(req1_id, gen1, {"contest_id": "contest-A", "title": "Contest A"})
    
    # Invariant assertion: Request 1 MUST BE REJECTED
    assert accepted1 is False
    # Authoritative state remains Contest B
    assert store.state["contest_id"] == "contest-B"


@pytest.mark.regression("REG-0041")
@pytest.mark.asyncio
async def test_concurrent_async_network_race_fencing():
    """
    Simulates high-concurrency race condition with asyncio.gather
    where a delayed response attempts to corrupt final store state.
    """
    store = RequestFencedStore()

    async def fetch_contest_data(contest_id: str, delay: float, req_id: str):
        gen = store.start_request(req_id)
        await asyncio.sleep(delay)
        store.apply_response(req_id, gen, {"contest_id": contest_id})

    # Task A starts earlier with a long delay (100ms)
    # Task B starts slightly later with a very short delay (10ms)
    async def run_scenario():
        t1 = asyncio.create_task(fetch_contest_data("contest-slow-A", 0.08, "req-1"))
        await asyncio.sleep(0.01)
        t2 = asyncio.create_task(fetch_contest_data("contest-fast-B", 0.01, "req-2"))
        await asyncio.gather(t1, t2)

    await run_scenario()

    # The store must hold fast-B because req-2 was initiated after req-1
    assert store.state["contest_id"] == "contest-fast-B"
