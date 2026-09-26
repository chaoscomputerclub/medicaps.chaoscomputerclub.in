"""
Chaos Computer Club — Medi-Caps Chapter
core/queue/lock.py — Distributed Locking via Redis Atomic Token Leases
Guarantees mutually exclusive execution across ASGI processes and cluster replicas.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional
from uuid import uuid4

from app.core.redis import get_redis

logger = logging.getLogger("ccc.lock")

# Lua script to release lock atomically ONLY if the token matches caller's lease
_RELEASE_LOCK_LUA = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
"""


class DistributedLock:
    """
    Production-grade Redis distributed lock with atomic token lease.
    Prevents lock-stealing and deadlocks if a process crashes while holding the lock.
    """

    def __init__(
        self,
        lock_key: str,
        ttl_seconds: int = 30,
        acquire_timeout_seconds: float = 0.0,
        retry_interval_seconds: float = 0.1,
    ):
        self.lock_key = f"ccc:lock:{lock_key.strip(':')}"
        self.ttl_ms = int(ttl_seconds * 1000)
        self.acquire_timeout = acquire_timeout_seconds
        self.retry_interval = retry_interval_seconds
        self.token = str(uuid4())
        self._acquired = False

    async def acquire(self) -> bool:
        redis = get_redis()
        loop = asyncio.get_running_loop()
        deadline = loop.time() + self.acquire_timeout

        while True:
            try:
                # SET lock_key token NX PX ttl_ms
                ok = await redis.set(
                    self.lock_key,
                    self.token,
                    nx=True,
                    px=self.ttl_ms,
                )
                if ok:
                    self._acquired = True
                    logger.debug("Acquired distributed lock: %s (token=%s)", self.lock_key, self.token[:8])
                    return True
            except Exception as exc:
                logger.warning("Redis error acquiring lock '%s': %s", self.lock_key, exc)

            if loop.time() >= deadline:
                break

            await asyncio.sleep(self.retry_interval)

        return False

    async def release(self) -> bool:
        if not self._acquired:
            return False

        redis = get_redis()
        try:
            res = await redis.eval(_RELEASE_LOCK_LUA, 1, self.lock_key, self.token)
            self._acquired = False
            released = bool(res == 1)
            if released:
                logger.debug("Released distributed lock: %s", self.lock_key)
            else:
                logger.warning("Failed to release lock '%s' (lease may have expired or token mismatch)", self.lock_key)
            return released
        except Exception as exc:
            logger.error("Error releasing distributed lock '%s': %s", self.lock_key, exc)
            self._acquired = False
            return False

    async def extend(self, additional_seconds: int = 30) -> bool:
        """Extend lock TTL if caller is still processing."""
        if not self._acquired:
            return False
        redis = get_redis()
        extend_lua = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("pexpire", KEYS[1], ARGV[2])
        else
            return 0
        end
        """
        try:
            res = await redis.eval(extend_lua, 1, self.lock_key, self.token, int(additional_seconds * 1000))
            return bool(res == 1)
        except Exception as exc:
            logger.error("Error extending distributed lock '%s': %s", self.lock_key, exc)
            return False


@asynccontextmanager
async def distributed_lock(
    lock_key: str,
    ttl_seconds: int = 30,
    acquire_timeout_seconds: float = 0.0,
) -> AsyncGenerator[bool, None]:
    """
    Context manager for distributed locking.
    Usage:
        async with distributed_lock("contest:finalize:slug-42", ttl_seconds=60) as acquired:
            if not acquired:
                # Lock is held by another process
                return
            # Perform protected critical section
    """
    lock = DistributedLock(
        lock_key=lock_key,
        ttl_seconds=ttl_seconds,
        acquire_timeout_seconds=acquire_timeout_seconds,
    )
    acquired = await lock.acquire()
    try:
        yield acquired
    finally:
        if acquired:
            await lock.release()
