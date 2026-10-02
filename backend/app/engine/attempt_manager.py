"""
Chaos Computer Club — Attempt Manager & Result Fencing Controller
Enforces durable attempt-based execution in PostgreSQL with strict result fencing.

Execution Safety Invariant:
"No execution provider may finalize a submission unless its attempt_id is the
currently authoritative attempt for that job. Stale attempts are rejected."
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from uuid import uuid4

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import now_utc
from app.models.judge_job import JudgeJob, JudgeJobAttempt

logger = logging.getLogger("ccc.judge.attempt")


class FinalizeResult:
    SUCCESS = "SUCCESS"
    STALE_ATTEMPT = "STALE_ATTEMPT"
    DUPLICATE_RESULT = "DUPLICATE_RESULT"
    JOB_NOT_FOUND = "JOB_NOT_FOUND"


class AttemptManager:
    """
    Manages JudgeJob and JudgeJobAttempt lifecycles with strict PostgreSQL fencing.
    Prevents race conditions where a slow/orphaned attempt (e.g. laptop reconnecting)
    overwrites a newer attempt (e.g. cloud fallback).
    """

    @staticmethod
    async def create_job(
        db: AsyncSession,
        submission_id: Optional[str] = None,
        contest_id: Optional[str] = None,
        problem_id: Optional[str] = None,
        member_id: Optional[str] = None,
        provider: str = "distributed",
        deadline_at: Optional[datetime] = None,
    ) -> JudgeJob:
        """Create a new root JudgeJob."""
        job_id = str(uuid4())
        job = JudgeJob(
            id=job_id,
            submission_id=submission_id,
            contest_id=contest_id,
            problem_id=problem_id,
            member_id=member_id,
            state="QUEUED",
            provider=provider,
            attempt_number=0,
            active_attempt_id=None,
            deadline_at=deadline_at,
            created_at=now_utc(),
            queued_at=now_utc(),
        )
        db.add(job)
        await db.flush()
        return job

    @staticmethod
    async def create_attempt(
        db: AsyncSession,
        job_id: str,
        provider: str,
        node_id: Optional[str] = None,
        lease_id: Optional[str] = None,
    ) -> JudgeJobAttempt:
        """
        Create a new attempt for job_id, incrementing attempt_number and atomically
        updating JudgeJob.active_attempt_id to this new attempt.
        """
        # Fetch current job
        job = await db.get(JudgeJob, job_id)
        if not job:
            raise ValueError(f"JudgeJob '{job_id}' not found.")

        attempt_num = job.attempt_number + 1
        attempt_id = str(uuid4())
        now = now_utc()

        attempt = JudgeJobAttempt(
            id=attempt_id,
            job_id=job_id,
            attempt_number=attempt_num,
            provider=provider,
            node_id=node_id,
            lease_id=lease_id or f"lease_{job_id}_{attempt_num}_{provider}",
            state="STARTED",
            started_at=now,
            created_at=now,
        )
        db.add(attempt)

        # Atomically advance active_attempt_id and attempt_number on root job
        job.attempt_number = attempt_num
        job.active_attempt_id = attempt_id
        job.state = "PROCESSING"
        job.provider = provider
        if not job.started_at:
            job.started_at = now

        await db.flush()
        logger.info(
            "⚡ [AttemptManager] Job %s created attempt %d (%s) on %s (lease: %s)",
            job_id, attempt_num, attempt_id, provider, attempt.lease_id
        )
        return attempt

    @staticmethod
    async def finalize_attempt(
        db: AsyncSession,
        job_id: str,
        attempt_id: str,
        final_state: str,  # COMPLETED or FAILED
        failure_code: Optional[str] = None,
        execution_decision: Optional[Dict[str, Any]] = None,
        queue_time_ms: float = 0.0,
        compile_time_ms: float = 0.0,
        execution_time_ms: float = 0.0,
        total_time_ms: float = 0.0,
        result_hash: Optional[str] = None,
        result_payload: Optional[Dict[str, Any]] = None,
    ) -> Tuple[str, Optional[JudgeJob]]:
        """
        Strict conditional update fencing:
        UPDATE judge_jobs
        SET state = :final_state, active_attempt_id = NULL, completed_at = :now
        WHERE id = :job_id AND active_attempt_id = :attempt_id

        If zero rows updated:
        - Check if job was already COMPLETED -> DUPLICATE_RESULT
        - If active_attempt_id != attempt_id -> STALE_ATTEMPT
        """
        now = now_utc()

        # Execute atomic conditional update on root job
        stmt = (
            update(JudgeJob)
            .where(
                JudgeJob.id == job_id,
                JudgeJob.active_attempt_id == attempt_id,
                JudgeJob.state.in_(["QUEUED", "PROCESSING"]),
            )
            .values(
                state=final_state,
                active_attempt_id=None,
                completed_at=now,
                failure_code=failure_code,
                execution_decision=execution_decision,
                result_payload=result_payload,
            )
        )
        res = await db.execute(stmt)

        if res.rowcount == 0:
            # Conditional check failed! Let's classify why
            existing_job = await db.get(JudgeJob, job_id)
            if not existing_job:
                logger.error("Job %s not found in DB during finalization", job_id)
                return FinalizeResult.JOB_NOT_FOUND, None

            # Mark attempt as STALE in attempts table
            attempt = await db.get(JudgeJobAttempt, attempt_id)
            if attempt and attempt.state in ("STARTED", "EXPIRED"):
                attempt.state = "STALE"
                attempt.error_code = "STALE_ATTEMPT"
                attempt.completed_at = now
                await db.flush()

            if existing_job.state in ("COMPLETED", "FAILED", "TIMED_OUT"):
                logger.warning(
                    "⚠️ [Fencing] Job %s is already finalized (%s). Attempt %s rejected as duplicate/stale.",
                    job_id, existing_job.state, attempt_id
                )
                return FinalizeResult.DUPLICATE_RESULT, existing_job

            logger.warning(
                "🛑 [Fencing] Stale attempt %s for job %s rejected! Current active attempt is %s.",
                attempt_id, job_id, existing_job.active_attempt_id
            )
            return FinalizeResult.STALE_ATTEMPT, existing_job

        # Conditional update succeeded! This attempt is authoritative
        attempt = await db.get(JudgeJobAttempt, attempt_id)
        if attempt:
            attempt.state = final_state
            attempt.completed_at = now
            attempt.queue_time_ms = queue_time_ms
            attempt.compile_time_ms = compile_time_ms
            attempt.execution_time_ms = execution_time_ms
            attempt.total_time_ms = total_time_ms
            attempt.result_hash = result_hash
            attempt.error_code = failure_code

        await db.flush()
        updated_job = await db.get(JudgeJob, job_id)
        logger.info(
            "✓ [Fencing] Job %s successfully finalized by authoritative attempt %s (verdict/state: %s)",
            job_id, attempt_id, final_state
        )
        return FinalizeResult.SUCCESS, updated_job

    @staticmethod
    async def expire_attempt(
        db: AsyncSession,
        job_id: str,
        attempt_id: str,
        reason: str = "EXPIRED",
    ) -> bool:
        """Mark an active attempt as expired (e.g. node lost or lease timed out)."""
        attempt = await db.get(JudgeJobAttempt, attempt_id)
        if attempt and attempt.state == "STARTED":
            attempt.state = "EXPIRED"
            attempt.error_code = reason
            attempt.completed_at = now_utc()
            await db.flush()
            return True
        return False
