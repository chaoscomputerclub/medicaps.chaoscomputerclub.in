"""
Chaos Computer Club — Distributed Fallback Manager & Thundering Herd Eliminator
Governs transitions from Distributed Fabric to Codebox fallback.

Invariant:
Distributed node failure must reduce available compute capacity, NOT cause unlimited
fallback fan-out or Codebox queue saturation.
"""

from __future__ import annotations

import logging
from typing import Optional, Tuple

from app.engine.admission_controller import CodeboxAdmissionController, AdmissionPool
from app.engine.circuit_breaker import CodeboxCircuitBreaker, CircuitState
from app.engine.deadlines import ExecutionDeadlineTracker
from app.engine.errors import ErrorCode, JudgeExecutionException

logger = logging.getLogger("ccc.judge.fallback")


class FallbackDecision:
    def __init__(
        self,
        allowed: bool,
        fallback_provider: str = "codebox",
        admission_pool: str = AdmissionPool.FALLBACK,
        reason: str = "",
        rejection_code: Optional[ErrorCode] = None,
    ) -> None:
        self.allowed = allowed
        self.fallback_provider = fallback_provider
        self.admission_pool = admission_pool
        self.reason = reason
        self.rejection_code = rejection_code


class FallbackManager:
    """
    Evaluates whether an execution that failed or timed out on the distributed fabric
    may legitimately fall back to Codebox or local Docker.
    """

    def __init__(self) -> None:
        self._circuit_breaker = CodeboxCircuitBreaker.get_instance()
        self._admission_controller = CodeboxAdmissionController.get_instance()

    async def evaluate_fallback(
        self,
        deadline_tracker: ExecutionDeadlineTracker,
        attempt_number: int,
        primary_failure_code: Optional[str] = None,
    ) -> FallbackDecision:
        """
        Evaluates fallback eligibility against circuit breakers, admission queues, and deadlines.
        """
        # 1. Deadline check: must have at least 2.5s remaining to compile and run in fallback
        remaining = deadline_tracker.remaining_seconds()
        if remaining < 2.5:
            logger.warning(
                "🛑 [FallbackManager] Insufficient deadline budget (%.2fs) for fallback. Rejecting.",
                remaining
            )
            return FallbackDecision(
                allowed=False,
                reason="Dominant job deadline budget exhausted.",
                rejection_code=ErrorCode.EXECUTION_DEADLINE_EXCEEDED,
            )

        # 2. Circuit Breaker check
        cb_state = await self._circuit_breaker.get_state()
        if cb_state == CircuitState.OPEN:
            logger.warning("🛑 [FallbackManager] Codebox circuit breaker is OPEN. Fallback prohibited.")
            return FallbackDecision(
                allowed=False,
                reason="Fallback engine circuit is open due to repeated infrastructure faults.",
                rejection_code=ErrorCode.CODEBOX_UNAVAILABLE,
            )

        # 3. Admission pool check: check if fallback pool is already saturated
        pool_status = await self._admission_controller.get_pool_status()
        fallback_stats = pool_status.get(AdmissionPool.FALLBACK, {})
        if fallback_stats.get("saturated", False):
            # Check if emergency reserve is available
            emergency_stats = pool_status.get(AdmissionPool.EMERGENCY, {})
            if not emergency_stats.get("saturated", False):
                logger.info("⚡ [FallbackManager] Fallback pool saturated; granting Emergency Reserve slot.")
                return FallbackDecision(
                    allowed=True,
                    fallback_provider="codebox",
                    admission_pool=AdmissionPool.EMERGENCY,
                    reason="Assigned to emergency reserve pool.",
                )

            logger.warning("🛑 [FallbackManager] Codebox fallback pool and emergency reserve are fully saturated.")
            return FallbackDecision(
                allowed=False,
                reason="Fallback execution queue is full. Backpressure applied.",
                rejection_code=ErrorCode.CODEBOX_QUEUE_FULL,
            )

        return FallbackDecision(
            allowed=True,
            fallback_provider="codebox",
            admission_pool=AdmissionPool.FALLBACK,
            reason="Fallback permitted within capacity limits.",
        )
