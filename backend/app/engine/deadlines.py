"""
Chaos Computer Club — Queue-Aware Deadlines & Execution Budgets
Enforces dominant job deadlines, granular stage breakdowns, and non-extensible budgets.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Optional

from app.engine.errors import ErrorCode, JudgeExecutionException


class ExecutionDeadlineTracker:
    """
    Tracks and enforces granular deadlines across execution stages:
    - admission deadline
    - queue deadline
    - compilation deadline
    - execution deadline
    - cleanup deadline
    - dominant total deadline

    Invariant: No child operation may extend beyond the dominant parent job deadline.
    Retries inherit the parent deadline and NEVER reset it.
    """

    def __init__(
        self,
        total_timeout_s: float = 30.0,
        admission_timeout_s: float = 3.0,
        queue_timeout_s: float = 15.0,
        compile_timeout_s: float = 10.0,
        execution_timeout_s: float = 10.0,
        cleanup_timeout_s: float = 2.0,
        deadline_at: Optional[datetime] = None,
        start_time: Optional[float] = None,
    ) -> None:
        self.start_monotonic = start_time or time.monotonic()
        self.total_timeout_s = total_timeout_s
        self.admission_timeout_s = admission_timeout_s
        self.queue_timeout_s = queue_timeout_s
        self.compile_timeout_s = compile_timeout_s
        self.execution_timeout_s = execution_timeout_s
        self.cleanup_timeout_s = cleanup_timeout_s

        if deadline_at is not None:
            self.deadline_at = deadline_at
            # Recompute total timeout relative to now (can be negative if already expired)
            now_dt = datetime.now(timezone.utc)
            remaining_sec = (deadline_at - now_dt).total_seconds()
            self.dominant_timeout_s = remaining_sec
        else:
            self.dominant_timeout_s = total_timeout_s
            now_dt = datetime.now(timezone.utc)
            from datetime import timedelta
            self.deadline_at = now_dt + timedelta(seconds=total_timeout_s)

        # Stage timings recorded in milliseconds
        self.admission_ms: float = 0.0
        self.queue_wait_ms: float = 0.0
        self.compile_ms: float = 0.0
        self.execution_ms: float = 0.0
        self.cleanup_ms: float = 0.0

    def remaining_seconds(self) -> float:
        """Remaining wall-clock seconds before the dominant deadline expires."""
        elapsed = time.monotonic() - self.start_monotonic
        remaining = self.dominant_timeout_s - elapsed
        return max(0.0, remaining)

    def is_expired(self) -> bool:
        """True if the dominant deadline has passed."""
        return self.remaining_seconds() <= 0.0

    def check_deadline(self, stage: str = "execution") -> None:
        """Raise EXECUTION_DEADLINE_EXCEEDED if dominant deadline has passed."""
        if self.is_expired():
            raise JudgeExecutionException(
                error_code=ErrorCode.EXECUTION_DEADLINE_EXCEEDED,
                safe_message=f"Execution budget exceeded during {stage} stage.",
            )

    def stage_budget(self, configured_stage_timeout_s: float) -> float:
        """
        Calculates the maximum safe timeout for a child stage.
        The child stage budget is strictly capped by the remaining dominant job deadline.
        """
        remaining = self.remaining_seconds()
        if remaining <= 0:
            raise JudgeExecutionException(
                error_code=ErrorCode.EXECUTION_DEADLINE_EXCEEDED,
                safe_message="Execution deadline exceeded before stage could begin.",
            )
        # Leave a small 200ms cushion for cleanup
        usable_remaining = max(0.1, remaining - 0.2)
        return min(configured_stage_timeout_s, usable_remaining)

    def total_elapsed_ms(self) -> float:
        """Total elapsed milliseconds from the start of this tracker."""
        return (time.monotonic() - self.start_monotonic) * 1000.0

    def record_stage(self, stage: str, duration_ms: float) -> None:
        """Record the measured duration for a specific execution stage."""
        if stage == "admission":
            self.admission_ms = duration_ms
        elif stage == "queue":
            self.queue_wait_ms = duration_ms
        elif stage == "compile":
            self.compile_ms = duration_ms
        elif stage == "execution":
            self.execution_ms = duration_ms
        elif stage == "cleanup":
            self.cleanup_ms = duration_ms

    def breakdown_dict(self) -> dict:
        """Returns structured stage breakdown in milliseconds."""
        return {
            "admission_ms": round(self.admission_ms, 2),
            "queue_wait_ms": round(self.queue_wait_ms, 2),
            "compile_ms": round(self.compile_ms, 2),
            "execution_ms": round(self.execution_ms, 2),
            "cleanup_ms": round(self.cleanup_ms, 2),
            "total_ms": round(self.total_elapsed_ms(), 2),
        }
