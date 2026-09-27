"""
Chaos Computer Club — Stale-While-Revalidate (SWR) Engine
Enables sub-millisecond responses for read-heavy resources (leaderboards, histograms)
by serving stale data immediately while scheduling an asynchronous single-flight refresh.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Awaitable, Callable, Optional, TypeVar

from app.core.cache.base import get_cache, set_cache
from app.core.cache.singleflight import single_flight
from app.core.cache.metrics import metrics

logger = logging.getLogger("ccc.cache.swr")

T = TypeVar("T")


class SWREngine:
    """Provides Stale-While-Revalidate semantics for read-heavy analytics and leaderboards."""

    @staticmethod
    async def get_with_swr(
        key: str,
        fetcher: Callable[[], Awaitable[T]],
        ttl_seconds: int = 60,
        swr_seconds: int = 30,
    ) -> T:
        """
        1. Fresh cache: Return immediately.
        2. Stale cache within SWR window: Return stale data immediately AND trigger background refresh.
        3. Hard miss / expired: Synchronous single-flight fetch.
        """
        cached = await get_cache(key)
        now = time.time()

        if isinstance(cached, dict) and "_swr_meta" in cached and "data" in cached:
            meta = cached["_swr_meta"]
            cached_at = meta.get("cached_at", 0)
            age = now - cached_at

            if age <= ttl_seconds:
                # Fresh cache hit
                metrics.inc_hit()
                return cached["data"]

            if age <= (ttl_seconds + swr_seconds):
                # Stale hit — return stale data immediately, refresh in background
                metrics.inc_hit()
                logger.debug("SWR hit (stale by %.1fs) for key '%s' — spawning background refresh", age - ttl_seconds, key)

                async def _refresh():
                    try:
                        fresh_val = await single_flight.execute(key, fetcher, bypass_cache_check=True)
                        envelope = {
                            "data": fresh_val,
                            "_swr_meta": {"cached_at": time.time(), "ttl": ttl_seconds},
                        }
                        await set_cache(key, envelope, ttl_seconds=ttl_seconds + swr_seconds)
                    except Exception as e:
                        logger.warning("Background SWR refresh failed for '%s': %s", key, e)

                asyncio.create_task(_refresh())
                return cached["data"]

        # Hard cache miss or expired past SWR window
        metrics.inc_miss()
        fresh_val = await single_flight.execute(key, fetcher, bypass_cache_check=True)
        envelope = {
            "data": fresh_val,
            "_swr_meta": {"cached_at": now, "ttl": ttl_seconds},
        }
        await set_cache(key, envelope, ttl_seconds=ttl_seconds + swr_seconds)
        return fresh_val


swr_engine = SWREngine()
