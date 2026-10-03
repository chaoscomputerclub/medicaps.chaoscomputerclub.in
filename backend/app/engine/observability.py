"""
Chaos Computer Club — Execution Observability & Decision Telemetry
Tracks real-time Prometheus-style metrics, queue wait times, provider routing, and decision records.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Dict, Optional

from app.core.redis import get_redis

logger = logging.getLogger("ccc.judge.observability")


class ExecutionObservability:
    """Central metrics collector and execution decision recorder."""

    _instance: Optional["ExecutionObservability"] = None

    def __init__(self) -> None:
        # In-memory metric counters
        self.metrics: Dict[str, float] = {
            "judge_jobs_total": 0,
            "judge_jobs_completed_total": 0,
            "judge_jobs_failed_total": 0,
            "judge_jobs_retried_total": 0,
            "judge_jobs_dead_letter_total": 0,
            "judge_queue_wait_ms_total": 0,
            "judge_attempts_total": 0,
            "judge_stale_results_total": 0,
            "judge_duplicate_results_total": 0,
            "judge_lease_expirations_total": 0,
            "codebox_requests_total": 0,
            "codebox_success_total": 0,
            "codebox_timeout_total": 0,
            "codebox_503_total": 0,
            "codebox_fallback_requests": 0,
            "codebox_fallback_rejected": 0,
            "distributed_execution_total": 0,
            "fallback_execution_total": 0,
            # Prometheus language-aware execution metrics
            "ccc_compile_total": 0,
            "ccc_compile_duration_seconds": 0.0,
            "ccc_compile_failures_total": 0,
            "ccc_compile_cache_hits_total": 0,
            "ccc_compile_cache_misses_total": 0,
            "ccc_execution_total": 0,
            "ccc_execution_duration_seconds": 0.0,
            "ccc_testcase_duration_seconds": 0.0,
            "ccc_judge_system_errors_total": 0,
            "ccc_judge_timeouts_total": 0,
            "ccc_judge_memory_errors_total": 0,
        }
        self.labeled_metrics: Dict[str, float] = {}

    @classmethod
    def get_instance(cls) -> "ExecutionObservability":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def record_counter(self, name: str, increment: float = 1.0) -> None:
        """Increment a metric counter."""
        if name in self.metrics:
            self.metrics[name] += increment
        else:
            self.metrics[name] = increment

    async def record_redis_counter(self, name: str, increment: int = 1) -> None:
        """Increment cluster-wide metric counter in Redis."""
        self.record_counter(name, float(increment))
        try:
            redis = get_redis()
            await redis.incrby(f"ccc:metrics:{name}", increment)
        except Exception:
            pass

    def record_compilation(self, language: str, duration_seconds: float, success: bool, cached: bool) -> None:
        """Record bounded Prometheus compile telemetry."""
        lang = str(language).lower()
        self.record_counter("ccc_compile_total", 1.0)
        self.record_counter("ccc_compile_duration_seconds", duration_seconds)
        if cached:
            self.record_counter("ccc_compile_cache_hits_total", 1.0)
        else:
            self.record_counter("ccc_compile_cache_misses_total", 1.0)
        if not success:
            self.record_counter("ccc_compile_failures_total", 1.0)

        # Labeled metric keys
        k_tot = f"ccc_compile_total{{language=\"{lang}\"}}"
        k_dur = f"ccc_compile_duration_seconds{{language=\"{lang}\"}}"
        self.labeled_metrics[k_tot] = self.labeled_metrics.get(k_tot, 0.0) + 1.0
        self.labeled_metrics[k_dur] = self.labeled_metrics.get(k_dur, 0.0) + duration_seconds

    def record_testcase_execution(self, language: str, execution_mode: str, duration_seconds: float, verdict: str) -> None:
        """Record bounded Prometheus testcase execution telemetry."""
        lang = str(language).lower()
        mode = str(execution_mode).lower()
        v_class = str(verdict).upper()
        self.record_counter("ccc_execution_total", 1.0)
        self.record_counter("ccc_execution_duration_seconds", duration_seconds)
        self.record_counter("ccc_testcase_duration_seconds", duration_seconds)

        if v_class == "TIME_LIMIT_EXCEEDED":
            self.record_counter("ccc_judge_timeouts_total", 1.0)
        elif v_class == "MEMORY_LIMIT_EXCEEDED":
            self.record_counter("ccc_judge_memory_errors_total", 1.0)
        elif v_class == "SYSTEM_ERROR":
            self.record_counter("ccc_judge_system_errors_total", 1.0)

        k_tot = f"ccc_execution_total{{language=\"{lang}\",execution_mode=\"{mode}\",result_class=\"{v_class}\"}}"
        k_dur = f"ccc_execution_duration_seconds{{language=\"{lang}\",execution_mode=\"{mode}\"}}"
        self.labeled_metrics[k_tot] = self.labeled_metrics.get(k_tot, 0.0) + 1.0
        self.labeled_metrics[k_dur] = self.labeled_metrics.get(k_dur, 0.0) + duration_seconds

    @staticmethod
    def create_decision_record(
        job_id: str,
        attempt_id: str,
        provider_selected: str,
        provider_attempted: str,
        fallback_used: bool,
        node_id: Optional[str] = None,
        queue_wait_ms: float = 0.0,
        execution_ms: float = 0.0,
        failure_code: Optional[str] = None,
        circuit_state: str = "CLOSED",
    ) -> Dict[str, Any]:
        """
        Creates an immutable, secret-free Execution Decision Record for auditing.
        Guarantees zero leakage of testcase secrets, tokens, or system paths.
        """
        record = {
            "job_id": job_id,
            "attempt_id": attempt_id,
            "provider_selected": provider_selected,
            "provider_attempted": provider_attempted,
            "fallback_used": fallback_used,
            "node_id": node_id,
            "queue_wait_ms": round(queue_wait_ms, 2),
            "execution_ms": round(execution_ms, 2),
            "failure_code": failure_code,
            "circuit_state": circuit_state,
            "timestamp": time.time(),
        }
        logger.info(
            "📋 [ExecutionDecision] Job %s (Attempt %s) -> Selected: %s, Executed: %s, Fallback: %s, Verdict/Failure: %s",
            job_id, attempt_id, provider_selected, provider_attempted, fallback_used, failure_code or "OK"
        )
        return record

    async def get_all_metrics(self) -> Dict[str, Any]:
        """Returns snapshot of in-memory and cluster Redis metrics."""
        result = dict(self.metrics)
        try:
            redis = get_redis()
            keys = [
                "judge_jobs_total", "judge_jobs_completed_total", "judge_jobs_failed_total",
                "judge_jobs_retried_total", "judge_attempts_total", "judge_stale_results_total",
                "codebox_requests_total", "codebox_503_total", "distributed_execution_total",
                "fallback_execution_total",
            ]
            for k in keys:
                val = await redis.get(f"ccc:metrics:{k}")
                if val:
                    result[f"cluster_{k}"] = int(val)
        except Exception:
            pass
        return result
