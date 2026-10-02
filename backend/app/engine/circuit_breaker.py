"""
Chaos Computer Club — Codebox Execution Circuit Breaker
Protects the platform from cascading Codebox infrastructure failures (HTTP 503, worker crashes, connection drops).

States:
- CLOSED: Normal operation. Requests flow to Codebox.
- OPEN: Tripped after consecutive infrastructure failures. Fast-fails without sending requests.
- HALF_OPEN: Cooldown elapsed. Allows a single probe request to test recovery.

CRITICAL INVARIANT:
User program errors (WA, TLE, RE, CE) NEVER trip the circuit breaker.
Only genuine infrastructure faults (503, connection drops, readiness failure, timeouts) increment failure counters.
"""

from __future__ import annotations

import asyncio
import enum
import logging
import os
import time
from typing import Optional

from app.core.redis import get_redis

logger = logging.getLogger("ccc.judge.circuit_breaker")


class CircuitState(str, enum.Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CodeboxCircuitBreaker:
    """
    Observable, Redis-backed circuit breaker with in-process fallback.
    Prevents retry storms and cascading failure when Codebox is struggling.
    """

    _instance: Optional["CodeboxCircuitBreaker"] = None

    def __init__(self) -> None:
        self.failure_threshold = int(os.getenv("CODEBOX_CB_FAILURE_THRESHOLD", "3"))
        self.cooldown_seconds = float(os.getenv("CODEBOX_CB_COOLDOWN_SECONDS", "15.0"))
        self.window_seconds = float(os.getenv("CODEBOX_CB_WINDOW_SECONDS", "60.0"))

        # In-process state fallback
        self._local_state = CircuitState.CLOSED
        self._local_failures = 0
        self._local_failure_times: list[float] = []
        self._local_last_failure_time = 0.0
        self._local_half_open_probe_active = False
        self._lock = asyncio.Lock()

    @classmethod
    def get_instance(cls) -> "CodeboxCircuitBreaker":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def get_state(self) -> CircuitState:
        """Read current circuit state, handling automatic OPEN -> HALF_OPEN cooldown transition."""
        redis = None
        try:
            redis = get_redis()
        except Exception:
            pass

        now = time.time()

        if redis is not None:
            try:
                state_raw = await redis.get("ccc:circuit:codebox:state")
                last_failure_raw = await redis.get("ccc:circuit:codebox:last_failure")
                state_str = state_raw.decode() if isinstance(state_raw, bytes) else (state_raw or "CLOSED")
                last_failure = float(last_failure_raw) if last_failure_raw else 0.0

                if state_str == CircuitState.OPEN.value:
                    if now - last_failure >= self.cooldown_seconds:
                        # Transition to HALF_OPEN to allow probe
                        await redis.set("ccc:circuit:codebox:state", CircuitState.HALF_OPEN.value)
                        logger.info("⚡ [CircuitBreaker] Codebox circuit cooled down; transitioning OPEN -> HALF_OPEN for probe")
                        return CircuitState.HALF_OPEN
                    return CircuitState.OPEN
                elif state_str == CircuitState.HALF_OPEN.value:
                    return CircuitState.HALF_OPEN
                return CircuitState.CLOSED
            except Exception as e:
                logger.debug("Redis circuit read error: %s", e)

        # Fallback to in-process state
        if self._local_state == CircuitState.OPEN:
            if now - self._local_last_failure_time >= self.cooldown_seconds:
                self._local_state = CircuitState.HALF_OPEN
                self._local_half_open_probe_active = False
                logger.info("⚡ [CircuitBreaker] Codebox circuit cooled down locally; transitioning OPEN -> HALF_OPEN")
                return CircuitState.HALF_OPEN
            return CircuitState.OPEN
        return self._local_state

    async def can_execute(self) -> bool:
        """
        Determines whether a new execution request may proceed to Codebox.
        Returns:
            True if CLOSED or if caller is selected as the HALF_OPEN probe.
            False if OPEN or probe already in progress.
        """
        state = await self.get_state()
        if state == CircuitState.CLOSED:
            return True

        if state == CircuitState.OPEN:
            return False

        # In HALF_OPEN: allow exactly one probe through
        redis = None
        try:
            redis = get_redis()
        except Exception:
            pass

        if redis is not None:
            try:
                # Use Redis setnx for atomic single-probe lease (10s TTL)
                is_probe_owner = await redis.set("ccc:circuit:codebox:probe_lease", "1", nx=True, ex=10)
                return bool(is_probe_owner)
            except Exception:
                pass

        async with self._lock:
            if not self._local_half_open_probe_active:
                self._local_half_open_probe_active = True
                return True
            return False

    async def record_success(self) -> None:
        """Record successful execution or probe. Resets failures and closes circuit."""
        now = time.time()
        redis = None
        try:
            redis = get_redis()
        except Exception:
            pass

        if redis is not None:
            try:
                await redis.set("ccc:circuit:codebox:state", CircuitState.CLOSED.value)
                await redis.delete("ccc:circuit:codebox:failures")
                await redis.delete("ccc:circuit:codebox:failure_times")
                await redis.delete("ccc:circuit:codebox:probe_lease")
            except Exception:
                pass

        async with self._lock:
            if self._local_state != CircuitState.CLOSED:
                logger.info("✓ [CircuitBreaker] Codebox probe succeeded! Circuit is now CLOSED.")
            self._local_state = CircuitState.CLOSED
            self._local_failures = 0
            self._local_failure_times = []
            self._local_half_open_probe_active = False

    async def record_failure(self, is_infrastructure: bool = True, reason: str = "") -> None:
        """
        Record execution failure.
        Only genuine infrastructure errors (is_infrastructure=True) increment the counter and trip the breaker.
        Uses a sliding time window (window_seconds) to prevent permanent accumulation of historical errors.
        """
        if not is_infrastructure:
            # Domain / user error (WA, CE, RE) - do NOT trip infrastructure circuit!
            return

        now = time.time()
        window_start = now - self.window_seconds
        redis = None
        try:
            redis = get_redis()
        except Exception:
            pass

        failures = 0
        if redis is not None:
            try:
                # Sliding time window via Redis ZSET
                await redis.zremrangebyscore("ccc:circuit:codebox:failure_times", "-inf", window_start)
                entry_id = f"{now}:{time.monotonic()}"
                await redis.zadd("ccc:circuit:codebox:failure_times", {entry_id: now})
                await redis.expire("ccc:circuit:codebox:failure_times", int(self.window_seconds * 2))
                failures = await redis.zcard("ccc:circuit:codebox:failure_times")
                await redis.set("ccc:circuit:codebox:failures", str(failures))
                await redis.set("ccc:circuit:codebox:last_failure", str(now))
                await redis.delete("ccc:circuit:codebox:probe_lease")
                if failures >= self.failure_threshold:
                    await redis.set("ccc:circuit:codebox:state", CircuitState.OPEN.value)
                    logger.error(
                        "🛑 [CircuitBreaker] Codebox circuit TRIPPED to OPEN after %d failures within %ds window. Reason: %s",
                        failures, int(self.window_seconds), reason
                    )
            except Exception as e:
                logger.debug("Redis circuit record failure: %s", e)

        async with self._lock:
            self._local_failure_times = [t for t in self._local_failure_times if t > window_start]
            self._local_failure_times.append(now)
            self._local_failures = len(self._local_failure_times)
            self._local_last_failure_time = now
            self._local_half_open_probe_active = False
            if self._local_failures >= self.failure_threshold:
                self._local_state = CircuitState.OPEN
                logger.error(
                    "🛑 [CircuitBreaker] Codebox circuit TRIPPED to OPEN locally after %d failures within %ds window. Reason: %s",
                    self._local_failures, int(self.window_seconds), reason
                )

    async def get_metrics(self) -> dict:
        """Observable circuit breaker telemetry."""
        state = await self.get_state()
        redis = None
        try:
            redis = get_redis()
        except Exception:
            pass

        failures = self._local_failures
        if redis is not None:
            try:
                f_val = await redis.get("ccc:circuit:codebox:failures")
                failures = int(f_val) if f_val else 0
            except Exception:
                pass

        return {
            "state": state.value,
            "consecutive_failures": failures,
            "failure_threshold": self.failure_threshold,
            "cooldown_seconds": self.cooldown_seconds,
        }
