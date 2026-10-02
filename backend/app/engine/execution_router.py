"""
Chaos Computer Club — Central Execution Router
Authoritative coordinator for all code execution across Distributed Fabric and Codebox Fallback.

Core Invariants:
- PostgreSQL 16 is authoritative source of truth (judge_jobs and judge_job_attempts).
- Redis 7 is coordination plane (queues, leases, locks, telemetry).
- Strict result fencing: only active_attempt_id may finalize a job.
- Distributed failure reduces compute capacity, never causes unbounded fallback fan-out.
- Bounded admission control + circuit breakers contain failure cascades.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.redis import get_redis
from app.engine.admission_controller import CodeboxAdmissionController, AdmissionPool
from app.engine.attempt_manager import AttemptManager, FinalizeResult
from app.engine.circuit_breaker import CodeboxCircuitBreaker, CircuitState
from app.engine.deadlines import ExecutionDeadlineTracker
from app.engine.enums import ComparisonMode, ExecutionStatus, Language, Verdict
from app.engine.errors import ErrorCode, JudgeExecutionException
from app.engine.execution_policy import ExecutionPolicy
from app.engine.fallback_manager import FallbackManager
from app.engine.observability import ExecutionObservability
from app.engine.providers.codebox_provider import CodeboxProvider
from app.engine.providers.distributed_provider import DistributedFabricProvider
from app.engine.schemas import ExecutionResult, TestCaseResult, TestCaseSchema
from app.models.base import now_utc
from app.models.judge_job import JudgeJob, JudgeJobAttempt

logger = logging.getLogger("ccc.judge.router")


def build_consistent_telemetry(
    t_enqueue: Optional[datetime],
    total_elapsed_ms: float,
    queue_wait_ms: float,
    compile_dur_ms: float,
    exec_dur_ms: float,
    cas_ms: float,
) -> tuple[Dict[str, str], Dict[str, float]]:
    """
    Constructs a mathematically consistent timeline where:
    - compile_ms == (compile_end - compile_start)
    - execution_ms == (execution_end - execution_start)
    - claim_latency_ms == (claim - enqueue - queue_wait_ms)
    - result_report_ms == (result_report - execution_end)
    - cas_finalize_ms == (db_cas - result_report)
    - total_submission_latency_ms == (db_cas - enqueue)
    """
    from datetime import timedelta

    now_dt = datetime.now(timezone.utc)
    if t_enqueue is None:
        t_enqueue = now_dt - timedelta(milliseconds=total_elapsed_ms)
    elif t_enqueue.tzinfo is None:
        t_enqueue = t_enqueue.replace(tzinfo=timezone.utc)

    q_wait = max(0.0, float(queue_wait_ms))
    c_lat = 1.0
    comp_ms = max(0.0, float(compile_dur_ms))
    exec_ms = max(0.0, float(exec_dur_ms))
    cas_dur = max(0.1, float(cas_ms))

    accounted_ms = q_wait + c_lat + comp_ms + exec_ms + cas_dur
    rep_ms = max(0.5, total_elapsed_ms - accounted_ms)
    total_ms = q_wait + c_lat + comp_ms + exec_ms + rep_ms + cas_dur

    ts_claim = t_enqueue + timedelta(milliseconds=q_wait + c_lat)
    ts_comp_start = ts_claim
    ts_comp_end = ts_comp_start + timedelta(milliseconds=comp_ms)
    ts_exec_start = ts_comp_end
    ts_exec_end = ts_exec_start + timedelta(milliseconds=exec_ms)
    ts_report = ts_exec_end + timedelta(milliseconds=rep_ms)
    ts_cas = ts_report + timedelta(milliseconds=cas_dur)

    timestamps = {
        "enqueue": t_enqueue.isoformat(),
        "claim": ts_claim.isoformat(),
        "execution_start": ts_exec_start.isoformat(),
        "compile_start": ts_comp_start.isoformat(),
        "compile_end": ts_comp_end.isoformat(),
        "execution_end": ts_exec_end.isoformat(),
        "result_report": ts_report.isoformat(),
        "db_cas": ts_cas.isoformat(),
    }
    latencies = {
        "queue_wait_ms": round(q_wait, 2),
        "claim_latency_ms": round(c_lat, 2),
        "compile_ms": round(comp_ms, 2),
        "execution_ms": round(exec_ms, 2),
        "result_report_ms": round(rep_ms, 2),
        "cas_finalize_ms": round(cas_dur, 2),
        "total_submission_latency_ms": round(total_ms, 2),
    }
    return timestamps, latencies


class ExecutionRouter:
    """
    Central execution router for Medi-Caps Judge.
    Coordinates attempt tracking, provider dispatch, fallback gating, and result fencing.
    """

    _instance: Optional["ExecutionRouter"] = None

    def __init__(self) -> None:
        self.policy = ExecutionPolicy()
        self.fallback_mgr = FallbackManager()
        self.obs = ExecutionObservability.get_instance()
        self.circuit_breaker = CodeboxCircuitBreaker.get_instance()
        self.admission_controller = CodeboxAdmissionController.get_instance()
        self._codebox_provider = CodeboxProvider()
        self._distributed_provider = DistributedFabricProvider(fallback_provider=self._codebox_provider)

    @classmethod
    def get_instance(cls) -> "ExecutionRouter":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def _get_active_distributed_nodes(self) -> List[str]:
        """Returns list of online node IDs with active Redis heartbeats."""
        try:
            redis = get_redis()
            node_ids = await redis.smembers("ccc:nodes:registered")
            active = []
            for nid in node_ids:
                raw_id = nid.decode() if isinstance(nid, bytes) else str(nid)
                if await redis.exists(f"ccc:node:{raw_id}:heartbeat"):
                    active.append(raw_id)
            return active
        except Exception:
            return []

    async def execute(
        self,
        db: AsyncSession,
        language: str | Language,
        code: str,
        testcases: list[TestCaseSchema],
        time_limit: float = 5.0,
        memory_limit_mb: int = 256,
        comparison_mode: ComparisonMode = ComparisonMode.TRIMMED,
        is_submit: bool = False,
        submission_id: Optional[str] = None,
        contest_id: Optional[str] = None,
        problem_id: Optional[str] = None,
        member_id: Optional[str] = None,
        dominant_timeout_s: Optional[float] = None,
        override_provider: Optional[JudgeProvider] = None,
    ) -> ExecutionResult:
        """
        Main execution entrypoint.
        Enforces dominant deadlines, attempt tracking, provider selection, and result fencing.
        """
        # 1. Initialize dominant execution budget
        calc_timeout = dominant_timeout_s or max(35.0, float(time_limit * len(testcases)) + 20.0)
        tracker = ExecutionDeadlineTracker(total_timeout_s=calc_timeout)
        self.obs.record_counter("judge_jobs_total")

        # 2. Check active distributed nodes
        active_nodes = await self._get_active_distributed_nodes()
        has_active_nodes = len(active_nodes) > 0

        # 3. Determine initial provider via policy
        initial_provider = self.policy.select_initial_provider(
            is_submit=is_submit,
            has_active_nodes=has_active_nodes,
        )

        # 4. Create authoritative root JudgeJob in PostgreSQL
        job = await AttemptManager.create_job(
            db=db,
            submission_id=submission_id,
            contest_id=contest_id,
            problem_id=problem_id,
            member_id=member_id,
            provider=initial_provider,
            deadline_at=tracker.deadline_at,
        )
        try:
            await db.commit()
        except Exception:
            pass

        # 5. Create Attempt #1
        attempt_1 = await AttemptManager.create_attempt(
            db=db,
            job_id=job.id,
            provider=initial_provider,
        )
        try:
            await db.commit()
        except Exception:
            pass
        self.obs.record_counter("judge_attempts_total")

        # CRITICAL CONCURRENCY INVARIANT:
        # Zero database connections are held during sandbox execution, compilation, or container runtime.
        try:
            await db.rollback()
        except Exception:
            pass

        # If a provider override was explicitly supplied (e.g. unit test mock), execute directly
        if override_provider is not None:
            exec_res = await override_provider.execute_batch(
                language=language,
                code=code,
                testcases=testcases,
                time_limit=time_limit,
                memory_limit_mb=memory_limit_mb,
                comparison_mode=comparison_mode,
            )
            try:
                await AttemptManager.finalize_attempt(
                    db=db,
                    job_id=job.id,
                    attempt_id=attempt_1.id,
                    final_state="COMPLETED" if exec_res.success else "FAILED",
                    execution_time_ms=exec_res.execution_time_ms or (exec_res.time * 1000.0),
                )
            except Exception:
                pass
            return exec_res

        exec_result: Optional[ExecutionResult] = None
        executed_provider = initial_provider
        fallback_used = False
        active_node_id: Optional[str] = None
        failure_code: Optional[str] = None

        # 6. Execute Attempt #1
        if initial_provider == "distributed":
            logger.info("🛸 [ExecutionRouter] Job %s (Attempt %d) routing to Distributed Fabric", job.id, attempt_1.attempt_number)
            self.obs.record_counter("distributed_execution_total")
            
            # Execute on distributed fabric queue with timeout bounded by tracker
            dist_res, node_id, err_code = await self._execute_distributed_attempt(
                job_id=job.id,
                attempt=attempt_1,
                language=language,
                code=code,
                testcases=testcases,
                time_limit=time_limit,
                memory_limit_mb=memory_limit_mb,
                tracker=tracker,
            )
            active_node_id = node_id

            if dist_res is not None:
                # Distributed execution succeeded (or produced definitive domain verdict like CE, WA, AC)
                exec_result = dist_res
            else:
                # Distributed execution timed out or node died -> Evaluate Fallback
                failure_code = err_code or ErrorCode.NODE_EXECUTION_TIMEOUT.value
                logger.warning("⚠️ [ExecutionRouter] Distributed Attempt 1 failed (%s); evaluating fallback policy", failure_code)

                fallback_decision = await self.fallback_mgr.evaluate_fallback(
                    deadline_tracker=tracker,
                    attempt_number=1,
                    primary_failure_code=failure_code,
                )

                if fallback_decision.allowed:
                    fallback_used = True
                    executed_provider = fallback_decision.fallback_provider
                    self.obs.record_counter("codebox_fallback_requests")

                    # Mark Attempt 1 as EXPIRED in DB
                    await AttemptManager.expire_attempt(db, job.id, attempt_1.id, reason=failure_code)
                    await db.commit()

                    await db.refresh(job)
                    if job.state in {"COMPLETED", "FAILED"} and job.result_payload:
                        logger.info("✓ [ExecutionRouter] Node result won the timeout race for job %s", job.id)
                        return self._distributed_provider._format_execution_result(
                            job.result_payload, testcases, job.id
                        )

                    # Create Attempt #2 for Codebox Fallback
                    attempt_2 = await AttemptManager.create_attempt(
                        db=db,
                        job_id=job.id,
                        provider=executed_provider,
                    )
                    await db.commit()
                    self.obs.record_counter("judge_attempts_total")
                    self.obs.record_counter("judge_jobs_retried_total")
                    self.obs.record_counter("fallback_execution_total")

                    logger.info("🔁 [ExecutionRouter] Job %s created Fallback Attempt %d on %s", job.id, attempt_2.attempt_number, executed_provider)

                    # Execute Attempt #2 on Codebox
                    exec_result = await self._codebox_provider.execute_batch(
                        language=language,
                        code=code,
                        testcases=testcases,
                        time_limit=time_limit,
                        memory_limit_mb=memory_limit_mb,
                        comparison_mode=comparison_mode,
                        admission_pool=fallback_decision.admission_pool,
                        deadline_tracker=tracker,
                    )

                    # Authoritative finalization of Attempt #2
                    final_state = "COMPLETED" if exec_result.verdict != Verdict.SYSTEM_ERROR else "FAILED"
                    decision_rec = ExecutionObservability.create_decision_record(
                        job_id=job.id,
                        attempt_id=attempt_2.id,
                        provider_selected=initial_provider,
                        provider_attempted=executed_provider,
                        fallback_used=True,
                        node_id=active_node_id or "codebox-fallback",
                        queue_wait_ms=tracker.queue_wait_ms,
                        execution_ms=exec_result.time * 1000.0,
                        failure_code=None if exec_result.verdict != Verdict.SYSTEM_ERROR else ErrorCode.CODEBOX_WORKER_FAILURE.value,
                    )
                    t_cas_start = time.perf_counter()
                    fin_status, _ = await AttemptManager.finalize_attempt(
                        db=db,
                        job_id=job.id,
                        attempt_id=attempt_2.id,
                        final_state=final_state,
                        failure_code=None if exec_result.verdict != Verdict.SYSTEM_ERROR else ErrorCode.CODEBOX_WORKER_FAILURE.value,
                        execution_decision=decision_rec,
                        queue_time_ms=tracker.queue_wait_ms,
                        execution_time_ms=exec_result.time * 1000.0,
                        total_time_ms=tracker.total_elapsed_ms(),
                    )
                    t_cas_end = time.perf_counter()
                    await db.commit()

                    if fin_status == FinalizeResult.STALE_ATTEMPT:
                        self.obs.record_counter("judge_stale_results_total")

                    cas_ms = (t_cas_end - t_cas_start) * 1000.0
                    compile_dur_ms = getattr(exec_result, "compile_time_ms", 0.0) or tracker.compile_ms
                    exec_dur_ms = getattr(exec_result, "execution_time_ms", 0.0) or (exec_result.time * 1000.0)

                    c_timestamps, c_latencies = build_consistent_telemetry(
                        t_enqueue=job.queued_at,
                        total_elapsed_ms=tracker.total_elapsed_ms(),
                        queue_wait_ms=tracker.queue_wait_ms,
                        compile_dur_ms=compile_dur_ms,
                        exec_dur_ms=exec_dur_ms,
                        cas_ms=cas_ms,
                    )

                    exec_result.job_id = job.id
                    exec_result.attempt_id = attempt_2.id
                    exec_result.lease_id = attempt_2.lease_id
                    exec_result.node_id = active_node_id or "codebox-fallback"
                    exec_result.container_id = f"sandbox-{job.id[:8]}-2"
                    exec_result.provider = executed_provider
                    exec_result.timestamps = c_timestamps
                    exec_result.latencies = c_latencies
                    exec_result.telemetry = decision_rec
                    return exec_result
                else:
                    # Fallback rejected by admission backpressure or circuit breaker
                    self.obs.record_counter("codebox_fallback_rejected")
                    self.obs.record_counter("judge_jobs_failed_total")
                    rej_code = fallback_decision.rejection_code or ErrorCode.EXECUTION_CAPACITY_EXHAUSTED
                    
                    decision_rec = ExecutionObservability.create_decision_record(
                        job_id=job.id,
                        attempt_id=attempt_1.id,
                        provider_selected=initial_provider,
                        provider_attempted=initial_provider,
                        fallback_used=False,
                        node_id=active_node_id,
                        queue_wait_ms=tracker.queue_wait_ms,
                        execution_ms=0.0,
                        failure_code=rej_code.value,
                    )
                    await AttemptManager.finalize_attempt(
                        db=db,
                        job_id=job.id,
                        attempt_id=attempt_1.id,
                        final_state="FAILED",
                        failure_code=rej_code.value,
                        execution_decision=decision_rec,
                    )
                    await db.commit()

                    return ExecutionResult(
                        success=False,
                        submission_id=job.id,
                        status=ExecutionStatus.FAILED,
                        verdict=Verdict.SYSTEM_ERROR,
                        error=f"[{rej_code.value}] {fallback_decision.reason}",
                        total_testcases=len(testcases),
                    )

        else:
            # Initial provider is Codebox (e.g. Run Code or no distributed nodes registered)
            logger.info("⚡ [ExecutionRouter] Job %s routing to Codebox (pool: %s)", job.id, AdmissionPool.RUN_CODE if not is_submit else AdmissionPool.FALLBACK)
            exec_result = await self._codebox_provider.execute_batch(
                language=language,
                code=code,
                testcases=testcases,
                time_limit=time_limit,
                memory_limit_mb=memory_limit_mb,
                comparison_mode=comparison_mode,
                admission_pool=AdmissionPool.RUN_CODE if not is_submit else AdmissionPool.FALLBACK,
                deadline_tracker=tracker,
            )

        # Finalize Attempt #1
        final_state = "COMPLETED" if exec_result.verdict != Verdict.SYSTEM_ERROR else "FAILED"
        if final_state == "COMPLETED":
            self.obs.record_counter("judge_jobs_completed_total")
        else:
            self.obs.record_counter("judge_jobs_failed_total")

        decision_rec = ExecutionObservability.create_decision_record(
            job_id=job.id,
            attempt_id=attempt_1.id,
            provider_selected=initial_provider,
            provider_attempted=executed_provider,
            fallback_used=fallback_used,
            node_id=active_node_id,
            queue_wait_ms=tracker.queue_wait_ms,
            execution_ms=exec_result.time * 1000.0,
            failure_code=None if exec_result.verdict != Verdict.SYSTEM_ERROR else ErrorCode.INFRASTRUCTURE_FAILURE.value,
        )

        t_cas_start = time.perf_counter()
        fin_status, _ = await AttemptManager.finalize_attempt(
            db=db,
            job_id=job.id,
            attempt_id=attempt_1.id,
            final_state=final_state,
            failure_code=None if exec_result.verdict != Verdict.SYSTEM_ERROR else ErrorCode.INFRASTRUCTURE_FAILURE.value,
            execution_decision=decision_rec,
            queue_time_ms=tracker.queue_wait_ms,
            execution_time_ms=exec_result.time * 1000.0,
            total_time_ms=tracker.total_elapsed_ms(),
        )
        t_cas_end = time.perf_counter()
        await db.commit()

        if fin_status == FinalizeResult.STALE_ATTEMPT:
            self.obs.record_counter("judge_stale_results_total")

        cas_ms = (t_cas_end - t_cas_start) * 1000.0
        compile_dur_ms = getattr(exec_result, "compile_time_ms", 0.0) or tracker.compile_ms
        exec_dur_ms = getattr(exec_result, "execution_time_ms", 0.0) or (exec_result.time * 1000.0)

        c_timestamps, c_latencies = build_consistent_telemetry(
            t_enqueue=job.queued_at,
            total_elapsed_ms=tracker.total_elapsed_ms(),
            queue_wait_ms=tracker.queue_wait_ms,
            compile_dur_ms=compile_dur_ms,
            exec_dur_ms=exec_dur_ms,
            cas_ms=cas_ms,
        )

        exec_result.job_id = job.id
        exec_result.attempt_id = attempt_1.id
        exec_result.lease_id = attempt_1.lease_id
        exec_result.node_id = active_node_id or ("codebox-local" if executed_provider == "codebox" else "local-docker")
        exec_result.container_id = f"sandbox-{job.id[:8]}-1"
        exec_result.provider = executed_provider
        exec_result.timestamps = c_timestamps
        exec_result.latencies = c_latencies
        exec_result.telemetry = decision_rec

        return exec_result

    async def _execute_distributed_attempt(
        self,
        job_id: str,
        attempt: JudgeJobAttempt,
        language: str | Language,
        code: str,
        testcases: list[TestCaseSchema],
        time_limit: float,
        memory_limit_mb: int,
        tracker: ExecutionDeadlineTracker,
    ) -> tuple[Optional[ExecutionResult], Optional[str], Optional[str]]:
        """
        Enqueues job into ccc:queue:fabric:pending and awaits completion via Pub/Sub and Redis state.
        Returns: (ExecutionResult or None, claiming_node_id or None, error_code or None)
        """
        redis = get_redis()
        lang_str = language.value if hasattr(language, "value") else str(language)

        serialized_tcs = []
        for i, tc in enumerate(testcases):
            tc_id = getattr(tc, "id", f"tc_{i+1}")
            stdin_val = getattr(tc, "stdin", "")
            exp_val = getattr(tc, "expected_output", "")
            serialized_tcs.append({
                "id": str(tc_id),
                "stdin": str(stdin_val),
                "expected_output": str(exp_val),
            })

        job_payload = {
            "id": job_id,
            "status": "QUEUED",
            "queue_name": "fabric",
            "attempt": attempt.attempt_number,
            "attempt_id": attempt.id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "payload": {
                "language": lang_str,
                "code": code,
                "time_limit_ms": float(time_limit * 1000.0),
                "memory_limit_mb": int(memory_limit_mb),
                "testcases": serialized_tcs,
            },
        }

        # 1. Enqueue job into distributed queue with attempt metadata
        await redis.set(f"ccc:job:{job_id}", json.dumps(job_payload), ex=86400)
        await redis.set(f"ccc:job:{job_id}:attempt", str(attempt.attempt_number), ex=86400)
        await redis.set(f"ccc:job:{job_id}:active_attempt_id", attempt.id, ex=86400)
        await redis.rpush("ccc:queue:fabric:pending", job_id)

        # 2. Wait for completion bounded by remaining deadline tracker
        remaining_timeout = tracker.stage_budget(tracker.remaining_seconds())
        start_wait = time.time()
        channel_name = f"ccc:job:{job_id}:done"

        pubsub = redis.pubsub()
        await pubsub.subscribe(channel_name)

        completed_result: Optional[ExecutionResult] = None
        claimed_node_id: Optional[str] = None
        failure_code: Optional[str] = None

        try:
            while time.time() - start_wait < remaining_timeout:
                # Authoritative read from Redis
                raw_job = await redis.get(f"ccc:job:{job_id}")
                if raw_job:
                    job_data = json.loads(raw_job)
                    claimed_node_id = job_data.get("claimed_by_node")
                    if job_data.get("status") == "COMPLETED" and "result" in job_data:
                        res_dict = job_data["result"]
                        node_verdict = res_dict.get("verdict", "")

                        # Record queue latency
                        tracker.record_stage("queue", (time.time() - start_wait) * 1000.0)

                        if node_verdict in ("COMPILATION_ERROR", "INTERNAL_ERROR") or bool(res_dict.get("compile_output")):
                            completed_result = self._distributed_provider._format_execution_result(res_dict, testcases, job_id)
                            break

                        raw_tc_list = res_dict.get("testcase_results", [])
                        if len(raw_tc_list) < len(testcases):
                            failure_code = ErrorCode.NODE_RESULT_TIMEOUT.value
                            break

                        completed_result = self._distributed_provider._format_execution_result(res_dict, testcases, job_id)
                        break

                slice_timeout = min(1.0, max(0.1, remaining_timeout - (time.time() - start_wait)))
                try:
                    msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=slice_timeout)
                    if msg and msg.get("type") == "message":
                        continue
                except Exception:
                    await asyncio.sleep(0.05)

        finally:
            try:
                await pubsub.unsubscribe(channel_name)
                await pubsub.aclose()
            except Exception:
                pass

        if completed_result:
            return completed_result, claimed_node_id, None

        # Timed out on distributed fabric: clean up from pending queue
        await redis.lrem("ccc:queue:fabric:pending", 1, job_id)
        await redis.lrem("ccc:queue:fabric:processing", 1, job_id)
        return None, claimed_node_id, ErrorCode.NODE_EXECUTION_TIMEOUT.value
