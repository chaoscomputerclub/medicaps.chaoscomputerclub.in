"""
Chaos Computer Club — Medi-Caps Chapter
core/redis.py — Async Redis client singleton
Architecture mirrors: Interleet/backend/app/lib/redis.py
"""
import logging
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)

# ─── Async Redis Client ───────────────────────────────────────────────────────

_redis_client: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    """Return the singleton async Redis client. Raises if not initialized."""
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD or None,
            decode_responses=True,
        )
    return _redis_client


async def ping_redis() -> bool:
    """Health-check the Redis connection. Returns True if reachable."""
    try:
        return await get_redis().ping()
    except Exception as e:
        logger.error("Redis health check failed: %s", e)
        return False
