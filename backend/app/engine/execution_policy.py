"""
Chaos Computer Club — Central Execution Policy & Bounded Retry Rules
Controls provider selection, failure retryability, and backoff with jitter.
"""

from __future__ import annotations

import random
import time
from typing import Optional

from app.engine.enums import Language, Verdict
from app.engine.errors import ErrorCode, RETRYABLE_ERROR_CODES


class ExecutionPolicy:
    """
    Defines deterministic execution routing, retry eligibility, and backoff timing.

    Rules:
    - User domain errors (CE, WA, RE, TLE) NEVER retry.
    - Stale / duplicate results NEVER retry.
    - Infrastructure failures (node lost, 503, connection dropped) retry only if within deadline budget.
    - Max retries strictly bounded (default 2).
    """

    def __init__(
        self,
        max_attempts: int = 2,
        backoff_base_s: float = 0.5,
        backoff_max_s: float = 2.0,
    ) -> None:
        self.max_attempts = max_attempts
        self.backoff_base_s = backoff_base_s
        self.backoff_max_s = backoff_max_s

    def should_retry(
        self,
        error_code: Optional[ErrorCode | str],
        current_attempt: int,
        remaining_deadline_s: float,
    ) -> bool:
        """Determines whether a failed attempt qualifies for a retry or fallback attempt."""
        if current_attempt >= self.max_attempts:
            return False

        if remaining_deadline_s < 2.0:
            return False

        if not error_code:
            return False

        code_enum = error_code if isinstance(error_code, ErrorCode) else None
        if code_enum is None:
            try:
                code_enum = ErrorCode(str(error_code))
            except ValueError:
                return False

        return code_enum in RETRYABLE_ERROR_CODES

    def compute_backoff(self, attempt_number: int) -> float:
        """Calculates exponential backoff with full jitter to eliminate thundering herds."""
        exp_backoff = min(self.backoff_max_s, self.backoff_base_s * (2 ** (attempt_number - 1)))
        # Full jitter between 0.1s and exp_backoff
        return random.uniform(0.1, exp_backoff)

    @staticmethod
    def select_initial_provider(
        is_submit: bool,
        has_active_nodes: bool,
    ) -> str:
        """
        Contest submissions use the distributed fabric whenever active nodes exist.
        Interactive 'Run Code' may use Codebox for fast cloud execution.
        """
        if is_submit:
            return "distributed" if has_active_nodes else "codebox"
        # Run code preference
        return "codebox" if not has_active_nodes else "distributed"
