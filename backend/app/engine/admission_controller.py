"""
Chaos Computer Club — Distributed Codebox Admission Controller & Capacity Pools
Enforces strict bounded concurrency, queue limits, and isolated capacity pools.

Protects against:
- Distributed node failure causing a Codebox thundering herd
- Run Code traffic consuming all contest fallback capacity
- Unbounded in-memory queue accumulation
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional
from uuid import uuid4

from app.core.config import settings
from app.core.redis import get_redis
from app.engine.errors import ErrorCode, JudgeExecutionException

logger = logging.getLogger("ccc.judge.admission")

# Lua script for atomic distributed permit acquisition and bounded queueing.
# KEYS[1]: concurrency key (integer)
# KEYS[2]: queue depth key (integer)
# ARGV[1]: max concurrency (e.g. 2)
# ARGV[2]: max queue (e.g. 10)
# Returns:
#   "ACQUIRED" : Permit granted immediately
#   "QUEUED"   : Capacity full, but slot available in bounded queue
#   "REJECTED" : Queue is full (backpressure applied immediately)
_ACQUIRE_PERMIT_LUA = """
local active_concurrency = tonumber(redis.call("get", KEYS[1]) or "0")
local queue_depth = tonumber(redis.call("get", KEYS[2]) or "0")
local max_concurrency = tonumber(ARGV[1])
local max_queue = tonumber(ARGV[2])

if active_concurrency < max_concurrency then
    redis.call("incr", KEYS[1])
    redis.call("expire", KEYS[1], 60)
    return "ACQUIRED"
end

if queue_depth < max_queue then
    redis.call("incr", KEYS[2])
    redis.call("expire", KEYS[2], 60)
    return "QUEUED"
end

return "REJECTED"
"""

# Lua script for atomic distributed permit release.
# If queued waiters exist in KEYS[2], hand off the permit immediately to the next waiter.
# Otherwise, decrements active concurrency.
_RELEASE_PERMIT_LUA = """
local next_req = redis.call("lpop", KEYS[2])
if next_req then
    local queue_depth = tonumber(redis.call("get", KEYS[3]) or "0")
    if queue_depth > 0 then redis.call("decr", KEYS[3]) end
    redis.call("rpush", "ccc:admission:grant:" .. next_req, "1")
    redis.call("expire", "ccc:admission:grant:" .. next_req, 30)
    return "HANDED_OFF"
else
    local active_concurrency = tonumber(redis.call("get", KEYS[1]) or "0")
    if active_concurrency > 0 then
        redis.call("decr", KEYS[1])
    end
    return "RELEASED"
end
"""

_DECR_QUEUE_LUA = """
local queue_depth = tonumber(redis.call("get", KEYS[1]) or "0")
if queue_depth > 0 then
    redis.call("decr", KEYS[1])
end
return "DECREMENTED"
"""


class AdmissionPool:
    RUN_CODE = "run_code"
    FALLBACK = "fallback"
    EMERGENCY = "emergency"


class CodeboxAdmissionController:
    """
    Redis-backed distributed admission controller with bounded concurrency & queues.
    Isolates Run Code traffic from Contest Fallback submissions.
    """

    _instance: Optional["CodeboxAdmissionController"] = None

    def __init__(self) -> None:
        # Configurable capacity limits
        self.total_max_concurrency = int(os.getenv("CODEBOX_MAX_CONCURRENCY", "4"))
        self.total_max_queue = int(os.getenv("CODEBOX_MAX_QUEUE", "20"))

        # Pool allocations
        # Normal Run Code pool: 2 slots, queue 10
        self.run_code_concurrency = int(os.getenv("CODEBOX_RUN_CODE_CONCURRENCY", "2"))
        self.run_code_max_queue = int(os.getenv("CODEBOX_RUN_CODE_MAX_QUEUE", "10"))

        # Fallback pool: 2 slots, queue 10
        self.fallback_concurrency = int(os.getenv("CODEBOX_FALLBACK_CONCURRENCY", "2"))
        self.fallback_max_queue = int(os.getenv("CODEBOX_FALLBACK_MAX_QUEUE", "10"))

        # Emergency reserve: 1 extra slot for critical contest submit fallbacks
        self.emergency_reserve_concurrency = int(os.getenv("CODEBOX_EMERGENCY_CONCURRENCY", "1"))

        # Local in-process semaphores as fallback if Redis is temporarily unreachable
        self._local_semaphores = {
            AdmissionPool.RUN_CODE: asyncio.Semaphore(self.run_code_concurrency),
            AdmissionPool.FALLBACK: asyncio.Semaphore(self.fallback_concurrency),
            AdmissionPool.EMERGENCY: asyncio.Semaphore(self.emergency_reserve_concurrency),
        }

    @classmethod
    def get_instance(cls) -> "CodeboxAdmissionController":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _get_pool_limits(self, pool: str) -> tuple[int, int]:
        if pool == AdmissionPool.RUN_CODE:
            return self.run_code_concurrency, self.run_code_max_queue
        elif pool == AdmissionPool.EMERGENCY:
            return self.emergency_reserve_concurrency, 2
        return self.fallback_concurrency, self.fallback_max_queue

    @asynccontextmanager
    async def acquire_permit(
        self,
        pool: str = AdmissionPool.FALLBACK,
        wait_timeout_s: float = 10.0,
    ) -> AsyncGenerator[bool, None]:
        """
        Acquires an execution permit from the specified capacity pool.
        Enforces bounded queueing. If queue is full, fast-fails with CODEBOX_QUEUE_FULL.
        Guarantees permit release even on exception or timeout.
        """
        max_concurrency, max_queue = self._get_pool_limits(pool)
        redis = None
        try:
            redis = get_redis()
        except Exception:
            pass

        key_concurrency = f"ccc:admission:codebox:{pool}:concurrency"
        key_queue = f"ccc:admission:codebox:{pool}:queue"
        key_waiters = f"ccc:admission:codebox:{pool}:waiters"

        if redis is not None:
            # 1. Atomic Redis check
            try:
                decision = await redis.eval(
                    _ACQUIRE_PERMIT_LUA,
                    2,
                    key_concurrency,
                    key_queue,
                    max_concurrency,
                    max_queue,
                )
                if isinstance(decision, bytes):
                    decision = decision.decode()

                if decision == "REJECTED":
                    logger.warning(
                        "🛑 [AdmissionController] Codebox pool '%s' queue full (%d max). Rejecting with backpressure.",
                        pool, max_queue
                    )
                    raise JudgeExecutionException(
                        error_code=ErrorCode.CODEBOX_QUEUE_FULL,
                        safe_message="Execution queue is at capacity. Please retry in a few moments.",
                        provider="codebox",
                    )

                if decision == "QUEUED":
                    # Event-driven admission: wait on private grant key via BLPOP
                    logger.info("⏳ [AdmissionController] Request queued in '%s' pool; waiting for free slot (timeout=%.1fs)", pool, wait_timeout_s)
                    req_id = uuid4().hex
                    grant_key = f"ccc:admission:grant:{req_id}"
                    acquired = False

                    await redis.rpush(key_waiters, req_id)
                    await redis.expire(key_waiters, 60)

                    try:
                        timeout_int = max(1, int(wait_timeout_s))
                        res = await redis.blpop(grant_key, timeout=timeout_int)
                        if res is not None:
                            acquired = True
                    except Exception as wait_err:
                        logger.debug("BLPOP wait interrupted: %s", wait_err)
                    finally:
                        if not acquired:
                            await redis.lrem(key_waiters, 1, req_id)
                            await redis.eval(_DECR_QUEUE_LUA, 1, key_queue)
                            try:
                                late_grant = await redis.get(grant_key)
                                if late_grant:
                                    await redis.delete(grant_key)
                                    await redis.eval(_RELEASE_PERMIT_LUA, 3, key_concurrency, key_waiters, key_queue)
                            except Exception:
                                pass

                    if not acquired:
                        raise JudgeExecutionException(
                            error_code=ErrorCode.EXECUTION_CAPACITY_EXHAUSTED,
                            safe_message="Timed out waiting for execution capacity in queue.",
                            provider="codebox",
                        )

            except JudgeExecutionException:
                raise
            except Exception as redis_err:
                logger.warning("Redis admission check failed (%s); using in-process semaphore fallback", redis_err)
                redis = None

        if redis is None:
            # Fallback to in-process semaphore
            sem = self._local_semaphores.get(pool, self._local_semaphores[AdmissionPool.FALLBACK])
            try:
                await asyncio.wait_for(sem.acquire(), timeout=wait_timeout_s)
            except asyncio.TimeoutError:
                raise JudgeExecutionException(
                    error_code=ErrorCode.EXECUTION_CAPACITY_EXHAUSTED,
                    safe_message="Local execution capacity exhausted.",
                    provider="codebox",
                )

        try:
            yield True
        finally:
            # Guaranteed release
            if redis is not None:
                try:
                    await redis.eval(_RELEASE_PERMIT_LUA, 3, key_concurrency, key_waiters, key_queue)
                except Exception as rel_err:
                    logger.debug("Error releasing Redis permit: %s", rel_err)
            else:
                sem = self._local_semaphores.get(pool, self._local_semaphores[AdmissionPool.FALLBACK])
                sem.release()

    async def get_pool_status(self) -> dict:
        """Returns current utilization across all capacity pools."""
        redis = None
        try:
            redis = get_redis()
        except Exception:
            pass

        status = {}
        for pool in [AdmissionPool.RUN_CODE, AdmissionPool.FALLBACK, AdmissionPool.EMERGENCY]:
            max_c, max_q = self._get_pool_limits(pool)
            active_c = 0
            current_q = 0
            if redis is not None:
                try:
                    raw_c = await redis.get(f"ccc:admission:codebox:{pool}:concurrency")
                    raw_q = await redis.get(f"ccc:admission:codebox:{pool}:queue")
                    active_c = int(raw_c) if raw_c else 0
                    current_q = int(raw_q) if raw_q else 0
                except Exception:
                    pass
            status[pool] = {
                "active_concurrency": active_c,
                "max_concurrency": max_c,
                "current_queue": current_q,
                "max_queue": max_q,
                "saturated": (active_c >= max_c and current_q >= max_q),
            }
        return status
