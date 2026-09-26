"""
Chaos Computer Club — Medi-Caps Chapter
core/redis.py — Async Redis client singleton
Architecture mirrors: Interleet/backend/app/lib/redis.py
"""
import asyncio
import logging
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)

# ─── Async Redis Client ───────────────────────────────────────────────────────

_redis_client: aioredis.Redis | None = None
_redis_loop: asyncio.AbstractEventLoop | None = None


def get_redis() -> aioredis.Redis:
    """Return the async Redis client for the currently active event loop.
    Re-creates the client automatically if the event loop changes or closes.
    """
    global _redis_client, _redis_loop
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if (
        _redis_client is None
        or _redis_loop is not current_loop
        or (_redis_loop is not None and _redis_loop.is_closed())
    ):
        _redis_client = aioredis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD or None,
            decode_responses=True,
        )
        _redis_loop = current_loop
    return _redis_client


async def close_redis() -> None:
    """Close the active Redis client."""
    global _redis_client, _redis_loop
    if _redis_client is not None:
        try:
            await _redis_client.aclose()
        except Exception:
            pass
        _redis_client = None
        _redis_loop = None


async def ping_redis() -> bool:
    """Health-check the Redis connection. Returns True if reachable."""
    try:
        return await get_redis().ping()
    except Exception as e:
        logger.error("Redis health check failed: %s", e)
        return False
