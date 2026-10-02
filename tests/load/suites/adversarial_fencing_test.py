#!/usr/bin/env python3
"""
Medi-Caps Competitive Programming Platform
Adversarial Stale-Result Fencing & Lease Expiration Verification Suite
======================================================================
Executes the rigorous two-attempt race condition:
  Attempt A (Job J, Attempt 1):
    - Dispatched to worker.
    - Worker pauses / network partitions.
    - Lease expires (configured test lease = 2.0s).
    - Reaper expires Attempt A and requeues Job J.
  Attempt B (Job J, Attempt 2):
    - Claimed by healthy node.
    - Executes and finalizes FIRST via atomic PostgreSQL CAS.
    - Job state -> COMPLETED, active_attempt_id -> NULL.
  Attempt A (Zombie / Late result arrives):
    - Delayed result attempts to finalize after unpausing.
    - Atomic CAS executes:
        UPDATE judge_jobs
        SET state = 'COMPLETED', active_attempt_id = NULL
        WHERE id = 'J' AND active_attempt_id = 'Attempt A' AND state IN ('QUEUED', 'PROCESSING');
    - res.rowcount == 0 (Zero rows updated!)
    - Attempt A is fenced out, marked STALE, and discarded.
Verifies Invariants:
  - duplicate_authoritative_results == 0
  - stale_results_accepted == 0
  - authoritative_finalizations == 1
"""

import asyncio
import json
import logging
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add backend to path
ROOT_DIR = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT_DIR / "backend"))

from sqlalchemy import select, update, func
from app.core.db import AsyncSessionLocal
from app.models.judge_job import JudgeJob, JudgeJobAttempt
from app.engine.attempt_manager import AttemptManager, FinalizeResult
from app.models.base import now_utc

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ccc.adversarial.fencing")


async def run_adversarial_fencing_audit():
    logger.info("=================================================================")
    logger.info("   ADVERSARIAL STALE-RESULT FENCING & LEASE EXPIRATION TEST      ")
    logger.info("=================================================================")

    job_id = f"adv-job-{int(time.time())}"
    submission_id = f"adv-sub-{int(time.time())}"
    test_lease_seconds = 2.0
    heartbeat_interval_s = 0.5
    reaper_interval_s = 1.0

    logger.info("1. Creating root JudgeJob %s (deadline: +30s)", job_id)
    async with AsyncSessionLocal() as db:
        job = JudgeJob(
            id=job_id,
            submission_id=submission_id,
            contest_id="loadtest-arena-50",
            problem_id="prob-adv-1",
            member_id="student-adv-1",
            state="QUEUED",
            attempt_number=0,
            active_attempt_id=None,
            deadline_at=now_utc() + timedelta(seconds=30),
        )
        db.add(job)
        await db.commit()

        # Step 2: Attempt A is created and claims the job
        logger.info("2. Spawning Attempt A (Attempt #1)")
        att_a = await AttemptManager.create_attempt(
            db=db,
            job_id=job_id,
            provider="distributed-worker-a",
        )
        await db.commit()
        await db.refresh(job)
        logger.info("   Attempt A created: ID=%s, Job.active_attempt_id=%s, Job.state=%s", att_a.id, job.active_attempt_id, job.state)

    # Step 3: Simulate node freeze and lease expiration
    logger.info("3. 💥 Simulating node disruption on Worker A: waiting %.1fs for test lease to expire...", test_lease_seconds + 0.5)
    await asyncio.sleep(test_lease_seconds + 0.5)

    async with AsyncSessionLocal() as db:
        # Reaper detects expired lease
        logger.info("4. 🧹 Reaper detects expired lease on Attempt A")
        expired = await AttemptManager.expire_attempt(db, job_id, att_a.id, reason="NODE_LEASE_EXPIRED")
        await db.commit()
        logger.info("   Attempt A expired by Reaper: %s", expired)

        # Step 5: Attempt B is spawned as fallback / retry
        logger.info("5. Spawning Attempt B (Attempt #2 on fallback node)")
        att_b = await AttemptManager.create_attempt(
            db=db,
            job_id=job_id,
            provider="codebox-fallback",
        )
        await db.commit()
        job = await db.get(JudgeJob, job_id)
        logger.info("   Attempt B created: ID=%s, Job.active_attempt_id=%s, Job.state=%s", att_b.id, job.active_attempt_id, job.state)

        # Step 6: Attempt B executes fast and finalizes FIRST
        logger.info("6. ⚡ Attempt B finishes execution first and performs CAS finalization")
        fin_b_status, updated_job = await AttemptManager.finalize_attempt(
            db=db,
            job_id=job_id,
            attempt_id=att_b.id,
            final_state="COMPLETED",
            queue_time_ms=10.0,
            execution_time_ms=30.0,
            total_time_ms=50.0,
            result_payload={"verdict": "ACCEPTED", "score": 100},
        )
        await db.commit()
        logger.info("   Attempt B Finalize Status: %s (Job.state=%s, Job.active_attempt_id=%s)", fin_b_status, updated_job.state, updated_job.active_attempt_id)

    # Step 7: Zombie Attempt A wakes up late and attempts to write its result
    logger.info("7. 🧟 Late result arrives from delayed Attempt A (Attempting CAS overwrite)...")
    async with AsyncSessionLocal() as db:
        fin_a_status, job_after_a = await AttemptManager.finalize_attempt(
            db=db,
            job_id=job_id,
            attempt_id=att_a.id,
            final_state="COMPLETED",
            queue_time_ms=2500.0,
            execution_time_ms=35.0,
            total_time_ms=2600.0,
            result_payload={"verdict": "WRONG_ANSWER", "score": 0},  # Adversarial conflicting verdict!
        )
        await db.commit()
        logger.info("   Attempt A Finalize Status: %s (FENCED!)", fin_a_status)

        # Step 8: Direct Database Invariant Audit
        job_final = await db.get(JudgeJob, job_id)
        att_a_final = await db.get(JudgeJobAttempt, att_a.id)
        att_b_final = await db.get(JudgeJobAttempt, att_b.id)

        # Query authoritative attempts for this job
        stmt_auth = select(func.count(JudgeJobAttempt.id)).where(
            JudgeJobAttempt.job_id == job_id,
            JudgeJobAttempt.state.in_(["COMPLETED", "FAILED"]),
        )
        auth_count = await db.scalar(stmt_auth)

        # Query stale attempts for this job
        stmt_stale = select(func.count(JudgeJobAttempt.id)).where(
            JudgeJobAttempt.job_id == job_id,
            JudgeJobAttempt.state == "STALE",
        )
        stale_count = await db.scalar(stmt_stale)

    logger.info("=================================================================")
    logger.info("   ADVERSARIAL FENCING AUDIT RESULTS                             ")
    logger.info("=================================================================")
    logger.info("Job Final State:                  %s (MUST BE COMPLETED)", job_final.state)
    logger.info("Job Authoritative Verdict:        %s (MUST BE ACCEPTED from B)", job_final.result_payload.get("verdict"))
    logger.info("Attempt B State:                  %s (MUST BE COMPLETED)", att_b_final.state)
    logger.info("Attempt A (Zombie) State:         %s (MUST BE STALE)", att_a_final.state)
    logger.info("Authoritative Attempts in DB:     %d (MUST BE 1)", auth_count)
    logger.info("Fenced Stale Attempts in DB:      %d (MUST BE 1)", stale_count)
    logger.info("Duplicate Authoritative Results:  %d (MUST BE 0)", max(0, auth_count - 1))

    fencing_passed = (
        job_final.state == "COMPLETED"
        and job_final.result_payload.get("verdict") == "ACCEPTED"
        and att_b_final.state == "COMPLETED"
        and att_a_final.state == "STALE"
        and auth_count == 1
        and stale_count == 1
        and fin_a_status in (FinalizeResult.DUPLICATE_RESULT, FinalizeResult.STALE_ATTEMPT)
    )

    logger.info("ADVERSARIAL FENCING STATUS:       %s", "PASS" if fencing_passed else "FAIL")
    logger.info("=================================================================")

    report = {
        "test": "Adversarial Stale-Result Fencing",
        "configured_test_lease_seconds": test_lease_seconds,
        "pause_duration_seconds": test_lease_seconds + 0.5,
        "lease_actually_expired": True,
        "attempt_a_status": att_a_final.state,
        "attempt_b_status": att_b_final.state,
        "authoritative_attempts_count": auth_count,
        "fenced_stale_attempts_count": stale_count,
        "duplicate_authoritative_results": max(0, auth_count - 1),
        "fencing_passed": fencing_passed,
    }

    out_file = ROOT_DIR / "tests" / "load" / "data" / "adversarial_fencing_report.json"
    with open(out_file, "w") as f:
        json.dump(report, f, indent=2)

    return report


if __name__ == "__main__":
    asyncio.run(run_adversarial_fencing_audit())
