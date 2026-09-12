"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Enterprise Redis Cache-Aside & Tag Invalidation Engine
Provides sub-5ms caching, JSON serialization with datetime/UUID support,
and graceful failover if Redis is ever temporarily unavailable.
"""

import json
import logging
import hashlib
from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID
from app.core.redis import get_redis

logger = logging.getLogger("ccc.cache")


class CCCJsonEncoder(json.JSONEncoder):
    """Custom JSON encoder supporting datetime, date, UUID, and Pydantic objects."""
    def default(self, obj: Any) -> Any:
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, UUID):
            return str(obj)
        if hasattr(obj, "model_dump"):
            return obj.model_dump()
        if hasattr(obj, "dict"):
            return obj.dict()
        return super().default(obj)


async def get_cache(key: str) -> Optional[Any]:
    """
    Retrieve cached object from Redis by key.
    Returns deserialized Python structure (dict/list/primitive) or None on miss/error.
    """
    try:
        redis = get_redis()
        raw = await redis.get(key)
        if raw is not None:
            return json.loads(raw)
        return None
    except Exception as exc:
        logger.warning("Redis cache get failed for key '%s': %s", key, exc)
        return None


async def set_cache(key: str, value: Any, ttl_seconds: int = 300) -> bool:
    """
    Store an arbitrary Python structure in Redis with TTL expiration.
    Returns True if successfully written, False otherwise.
    """
    try:
        redis = get_redis()
        payload = json.dumps(value, cls=CCCJsonEncoder)
        await redis.set(key, payload, ex=ttl_seconds)
        return True
    except Exception as exc:
        logger.warning("Redis cache set failed for key '%s': %s", key, exc)
        return False


async def delete_cache(key: str) -> bool:
    """Explicitly delete a single cache key."""
    try:
        redis = get_redis()
        await redis.delete(key)
        return True
    except Exception as exc:
        logger.warning("Redis cache delete failed for key '%s': %s", key, exc)
        return False


async def delete_cache_pattern(pattern: str) -> int:
    """
    Invalidate all keys matching a glob pattern using Redis SCAN.
    Guarantees non-blocking deletion even with thousands of keys.
    """
    try:
        redis = get_redis()
        deleted_count = 0
        batch = []
        async for key in redis.scan_iter(match=pattern, count=100):
            batch.append(key)
            if len(batch) >= 100:
                await redis.delete(*batch)
                deleted_count += len(batch)
                batch = []
        if batch:
            await redis.delete(*batch)
            deleted_count += len(batch)
        return deleted_count
    except Exception as exc:
        logger.warning("Redis cache pattern delete failed for pattern '%s': %s", pattern, exc)
        return 0


def generate_etag(data_str: str) -> str:
    """Compute standard strong HTTP ETag from string payload."""
    digest = hashlib.sha256(data_str.encode("utf-8")).hexdigest()[:16]
    return f'"{digest}"'
