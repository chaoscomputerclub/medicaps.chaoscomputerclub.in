"""
Chaos Computer Club — Medi-Caps Chapter
tests/regression/database/test_registration_acid.py — Contest Registration ACID & Concurrency Invariants

Linked Bugs: REG-0004, REG-0025
Invariant: CONTEST_REGISTRATION_MUST_BE_STRICTLY_SERIALIZABLE_WITH_CAPACITY_BOUNDS
"""

import pytest
import asyncio
from typing import Set, Dict, Any


class SimulatedContestRegistrationService:
    """
    Simulates ACID database transaction with row-level locking (SELECT ... FOR UPDATE)
    over a contest row and its registrations table.
    """
    def __init__(self, seat_capacity: int):
        self.seat_capacity = seat_capacity
        self.registrations: Set[str] = set()
        self.lock = asyncio.Lock()  # Simulates Postgres row-level lock on contest row

    async def register_member(self, member_id: str) -> Dict[str, Any]:
        async with self.lock:
            # 1. Check duplicate registration
            if member_id in self.registrations:
                return {"status": "ALREADY_REGISTERED", "member_id": member_id}

            # 2. Check capacity constraint under lock
            if len(self.registrations) >= self.seat_capacity:
                return {"status": "CAPACITY_EXCEEDED", "member_id": member_id}

            # 3. Commit registration
            self.registrations.add(member_id)
            return {"status": "SUCCESS", "member_id": member_id}


@pytest.mark.regression("REG-0004")
@pytest.mark.asyncio
async def test_concurrent_registrations_strictly_respect_seat_capacity():
    """
    REG-0004 Invariant:
    When 50 cadets concurrently attempt to register for a contest with 20 seats,
    EXACTLY 20 must succeed, and EXACTLY 30 must receive CAPACITY_EXCEEDED.
    Zero overselling allowed.
    """
    capacity = 20
    service = SimulatedContestRegistrationService(seat_capacity=capacity)
    total_candidates = 50

    async def attempt_reg(candidate_id: str):
        return await service.register_member(candidate_id)

    tasks = [attempt_reg(f"cadet_{i:03d}") for i in range(total_candidates)]
    results = await asyncio.gather(*tasks)

    successes = [r for r in results if r["status"] == "SUCCESS"]
    rejections = [r for r in results if r["status"] == "CAPACITY_EXCEEDED"]

    # Invariant assertion: Exactly capacity registrations succeed
    assert len(successes) == capacity
    assert len(rejections) == total_candidates - capacity
    assert len(service.registrations) == capacity


@pytest.mark.regression("REG-0025")
@pytest.mark.asyncio
async def test_duplicate_registration_is_idempotently_rejected():
    """
    REG-0025 Invariant:
    A student cannot register multiple times for the same contest.
    Second registration must return ALREADY_REGISTERED without consuming capacity.
    """
    service = SimulatedContestRegistrationService(seat_capacity=5)
    member = "cadet_unique_007"

    res1 = await service.register_member(member)
    assert res1["status"] == "SUCCESS"
    assert len(service.registrations) == 1

    res2 = await service.register_member(member)
    assert res2["status"] == "ALREADY_REGISTERED"
    assert len(service.registrations) == 1
