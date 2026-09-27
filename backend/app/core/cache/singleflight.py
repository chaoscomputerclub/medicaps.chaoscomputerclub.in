"""
Chaos Computer Club — Single-Flight Request Coalescing
Eliminates Cache Stampedes (Thundering Herds) on cold or expired cache keys.
Guarantees that only ONE request queries PostgreSQL while concurrent callers await the result.
"""

from __future__ import annotations

import asyncio
import logging
import random
from typing import Any, Awaitable, Callable, Dict, Optional, TypeVar

from app.core.queue.lock import DistributedLock
from app.core.cache.base import get_cache

logger = logging.getLogger("ccc.cache.singleflight")

T = TypeVar("T")


class SingleFlight:
    """
    Coalesces concurrent requests for the same cache key.
    Combines in-process asyncio.Future deduplication with cross-process Redis distributed locks.
    """

    _instance: Optional[SingleFlight] = None

    def __init__(self):
        self._in_flight: Dict[str, asyncio.Future] = {}
        self._lock = asyncio.Lock()

    @classmethod
    def get_instance(cls) -> SingleFlight:
        if cls._instance is None:
            cls._instance = SingleFlight()
        return cls._instance

    async def execute(
        self,
        key: str,
        fn: Callable[[], Awaitable[T]],
        use_distributed_lock: bool = True,
        distributed_lock_ttl: int = 5,
        bypass_cache_check: bool = False,
    ) -> T:
        """
        Execute `fn` with single-flight suppression for `key`.
        If another coroutine in this process is currently running `fn` for `key`,
        awaits its completion and returns its result without re-executing `fn`.
        """
        loop = asyncio.get_running_loop()

        # ─── 1. In-Process Single-Flight Check ─────────────────────────────────
        async with self._lock:
            if key in self._in_flight:
                fut = self._in_flight[key]
                logger.debug("SingleFlight (in-process hit) awaiting in-flight work for key '%s'", key)
                return await asyncio.shield(fut)

            fut = loop.create_future()
            self._in_flight[key] = fut

        # ─── 2. Execution with Cleanup & Fan-Out ──────────────────────────────
        try:
            if use_distributed_lock:
                val = await self._execute_cross_process(key, fn, distributed_lock_ttl, bypass_cache_check)
            else:
                val = await fn()

            if not fut.done():
                fut.set_result(val)
            return val

        except Exception as exc:
            if not fut.done():
                fut.set_exception(exc)
            raise
        finally:
            async with self._lock:
                self._in_flight.pop(key, None)

    async def _execute_cross_process(
        self,
        key: str,
        fn: Callable[[], Awaitable[T]],
        lock_ttl: int,
        bypass_cache_check: bool = False,
    ) -> T:
        """
        Cross-process coordination using Redis distributed lock.
        If another process is currently calculating this key, waits briefly and
        attempts to read the freshly populated cache before falling back to DB.
        """
        lock_name = f"singleflight:{key.strip(':')}"
        dist_lock = DistributedLock(lock_name, ttl_seconds=lock_ttl, acquire_timeout_seconds=0.0)

        acquired = await dist_lock.acquire()
        if acquired:
            try:
                if not bypass_cache_check:
                    cached = await get_cache(key)
                    if cached is not None:
                        return cached  # type: ignore

                return await fn()
            finally:
                await dist_lock.release()
        else:
            # Another process is populating this key. Wait up to 300ms for cache to appear.
            logger.debug("SingleFlight (cross-process contention) waiting for lock on '%s'", key)
            for _ in range(6):
                await asyncio.sleep(0.05 + random.uniform(0.01, 0.03))
                cached = await get_cache(key)
                if cached is not None:
                    logger.debug("SingleFlight successfully resolved from fresh cache for '%s'", key)
                    return cached  # type: ignore

            # If cache didn't appear in time, execute directly as a safety fallback
            return await fn()


single_flight = SingleFlight.get_instance()
