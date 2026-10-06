"""
Chaos Computer Club — Medi-Caps Chapter
tests/regression/database/test_transaction_rollback.py — ACID Rollback & Outbox Atomicity Invariants

Linked Bugs: REG-0004, REG-0033
Invariant: TRANSACTIONS_MUST_ROLLBACK_COMPLETELY_ON_EXCEPTION_LEAVING_ZERO_PARTIAL_WRITES
"""

import pytest
from typing import List, Dict, Any


class SimulatedDatabaseTransaction:
    """
    Simulates transactional atomicity with rollback support and transactional outbox.
    """
    def __init__(self):
        self.committed_registrations: List[str] = []
        self.committed_outbox: List[Dict[str, Any]] = []
        self.contest_counts: Dict[str, int] = {"contest-1": 10}

    def execute_registration_with_outbox(
        self,
        contest_id: str,
        member_id: str,
        fail_at_step: int = -1
    ):
        # Staging / Pending buffers
        pending_reg = None
        pending_outbox = None
        pending_count_delta = 0

        try:
            # Step 1: Update count
            pending_count_delta = +1
            if fail_at_step == 1:
                raise RuntimeError("Database IO failure at Step 1")

            # Step 2: Insert registration
            pending_reg = f"{contest_id}:{member_id}"
            if fail_at_step == 2:
                raise RuntimeError("Database foreign key failure at Step 2")

            # Step 3: Insert transactional outbox event
            pending_outbox = {
                "event": "CONTEST_REGISTERED",
                "contest_id": contest_id,
                "member_id": member_id,
            }
            if fail_at_step == 3:
                raise RuntimeError("Outbox table lock timeout at Step 3")

            # Step 4: Commit atomically
            self.contest_counts[contest_id] += pending_count_delta
            self.committed_registrations.append(pending_reg)
            self.committed_outbox.append(pending_outbox)
            return True

        except Exception:
            # Rollback: Discard all pending mutations
            return False


@pytest.mark.regression("REG-0004")
def test_transaction_rolls_back_cleanly_on_intermediate_failure():
    """
    REG-0004 / REG-0033 Invariant:
    If an error occurs after count update but before outbox write,
    the entire transaction must abort without leaving partial writes.
    """
    db = SimulatedDatabaseTransaction()
    initial_count = db.contest_counts["contest-1"]

    # Trigger failure at Step 3 (outbox insert)
    success = db.execute_registration_with_outbox(
        contest_id="contest-1",
        member_id="cadet_alpha",
        fail_at_step=3
    )

    # Invariant assertion: Operation failed
    assert success is False
    # Count must remain unchanged (no partial increment)
    assert db.contest_counts["contest-1"] == initial_count
    # Registration table must remain clean
    assert "contest-1:cadet_alpha" not in db.committed_registrations
    # Outbox must have zero orphaned messages
    assert len(db.committed_outbox) == 0


@pytest.mark.regression("REG-0033")
def test_successful_transaction_commits_atomically_with_outbox():
    """
    REG-0033 Invariant:
    When the transaction succeeds, the registration row and outbox message
    are committed together in lockstep.
    """
    db = SimulatedDatabaseTransaction()
    initial_count = db.contest_counts["contest-1"]

    success = db.execute_registration_with_outbox(
        contest_id="contest-1",
        member_id="cadet_alpha",
        fail_at_step=-1
    )

    assert success is True
    assert db.contest_counts["contest-1"] == initial_count + 1
    assert "contest-1:cadet_alpha" in db.committed_registrations
    assert len(db.committed_outbox) == 1
    assert db.committed_outbox[0]["member_id"] == "cadet_alpha"
