"""
Chaos Computer Club — Medi-Caps Chapter
tests/regression/distributed/test_node_agent_coordination.py — Distributed Judge Lease & Fencing Invariants

Linked Bugs: REG-0014, REG-0016
Invariant: DISTRIBUTED_EXECUTION_MUST_PRESERVE_HEARTBEATS_AND_LEASE_FENCING
"""

import pytest
import time
from typing import Dict, Optional, Any


class DistributedJudgeCoordinator:
    """
    Simulates distributed job leasing with heartbeats and lease fencing token.
    """
    def __init__(self, lease_ttl_seconds: float = 0.5):
        self.lease_ttl = lease_ttl_seconds
        self.job_leases: Dict[str, Dict[str, Any]] = {}  # job_id -> lease info
        self.lease_counter = 0

    def acquire_job_lease(self, job_id: str, node_id: str) -> Optional[int]:
        now = time.time()
        current_lease = self.job_leases.get(job_id)

        # Check if already leased and unexpired
        if current_lease and (now - current_lease["acquired_at"]) < self.lease_ttl:
            return None  # Lease busy

        self.lease_counter += 1
        fencing_token = self.lease_counter
        self.job_leases[job_id] = {
            "node_id": node_id,
            "fencing_token": fencing_token,
            "acquired_at": now,
            "completed": False,
        }
        return fencing_token

    def submit_job_result(self, job_id: str, fencing_token: int, result: Dict[str, Any]) -> bool:
        lease = self.job_leases.get(job_id)
        if not lease:
            return False

        # Invariant: Fencing token check — reject zombie workers whose lease expired and was reassigned
        if lease["fencing_token"] != fencing_token:
            return False  # Zombie rejected

        lease["completed"] = True
        lease["result"] = result
        return True


@pytest.mark.regression("REG-0014")
def test_expired_lease_allows_reclaim_by_healthy_node():
    """
    REG-0014 Invariant:
    If Worker Node 1 crashes or stalls past lease TTL, Worker Node 2 must be
    permitted to reclaim the uncompleted job.
    """
    coordinator = DistributedJudgeCoordinator(lease_ttl_seconds=0.05)
    job_id = "job-eval-sub-404"

    # Node 1 acquires lease
    token1 = coordinator.acquire_job_lease(job_id, "judge-node-1")
    assert token1 is not None

    # Node 2 immediately tries to acquire -> rejected (busy)
    assert coordinator.acquire_job_lease(job_id, "judge-node-2") is None

    # Wait for TTL expiry
    time.sleep(0.06)

    # Node 2 tries again -> acquires new lease with higher fencing token
    token2 = coordinator.acquire_job_lease(job_id, "judge-node-2")
    assert token2 is not None
    assert token2 > token1


@pytest.mark.regression("REG-0016")
def test_zombie_node_result_is_fenced_and_rejected():
    """
    REG-0016 Invariant:
    If Node 1 awakens from a stop-the-world GC pause after its lease expired and
    attempts to write results, it must be rejected by the fencing token.
    """
    coordinator = DistributedJudgeCoordinator(lease_ttl_seconds=0.05)
    job_id = "job-eval-sub-500"

    # Node 1 leases job
    token1 = coordinator.acquire_job_lease(job_id, "judge-node-1")

    # TTL expires
    time.sleep(0.06)

    # Node 2 reclaims and completes job
    token2 = coordinator.acquire_job_lease(job_id, "judge-node-2")
    res2_accepted = coordinator.submit_job_result(job_id, token2, {"verdict": "ACCEPTED"})
    assert res2_accepted is True

    # Zombie Node 1 attempts to submit late result
    res1_accepted = coordinator.submit_job_result(job_id, token1, {"verdict": "WRONG_ANSWER"})

    # Invariant assertion: Zombie submission MUST BE REJECTED
    assert res1_accepted is False
    # Authoritative verdict remains Node 2's ACCEPTED
    assert coordinator.job_leases[job_id]["result"]["verdict"] == "ACCEPTED"
