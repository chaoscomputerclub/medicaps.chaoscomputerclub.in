"""
Chaos Computer Club -- Redis-backed sliding-window rate limiter.

Usage (FastAPI dependency):
    from app.middleware.rate_limit import rate_limit

    @router.post("/submit")
    async def submit(
        request: Request,
        _rl: None = Depends(rate_limit("assessment:submit", max_calls=5, window_seconds=60)),
        ...
    ):
        ...

Rules encoded here (per authenticated user, keyed by JWT member_id):
  - /run    : 30 requests / 60 s  (sample test spam protection)
  - /submit : 5  requests / 60 s  (judge queue protection)
  - /finish : 2  requests / 60 s  (idempotent, but still limited)

Falls back gracefully (allows request through) when Redis is unavailable,
so a cache outage never blocks the contest.
"""

from __future__ import annotations

import logging
import time
from typing import Callable

from fastapi import Depends, HTTPException, Request, status

logger = logging.getLogger("ccc.rate_limit")


def _member_id_from_request(request: Request) -> str | None:
    """Extract member_id from request.state or from JWT in HttpOnly cookie / Bearer token."""
    state_id = getattr(getattr(request, "state", None), "member_id", None)
    if state_id:
        return state_id
    from app.middleware.auth import extract_access_token
    from app.core.security import decode_access_token
    token = extract_access_token(request)
    if token:
        payload = decode_access_token(token)
        if payload:
            return payload.get("sub")
    return None


def rate_limit(scope: str, max_calls: int, window_seconds: int) -> Callable:
    """
    FastAPI dependency factory that enforces a sliding-window rate limit.

    Args:
        scope: Unique scope name (e.g. "assessment:run")
        max_calls: Max requests allowed in the window
        window_seconds: Length of the sliding window in seconds

    Returns a FastAPI dependency function.
    """
    async def _check(request: Request) -> None:
        from app.core.redis import get_redis

        member_id = _member_id_from_request(request)
        if not member_id:
            # Unauthenticated — let auth middleware handle the 401
            return

        key = f"ccc:rl:{scope}:{member_id}"
        now_ms = int(time.time() * 1000)
        window_ms = window_seconds * 1000

        try:
            redis = get_redis()
            pipe = redis.pipeline()
            # Remove entries outside the sliding window
            pipe.zremrangebyscore(key, 0, now_ms - window_ms)
            # Count remaining hits in window
            pipe.zcard(key)
            # Add current hit with score = now_ms
            pipe.zadd(key, {str(now_ms): now_ms})
            # Expire the whole key after the window so Redis doesn't accumulate stale keys
            pipe.expire(key, window_seconds + 5)
            results = await pipe.execute()

            current_count = int(results[1])  # count BEFORE this request

            if current_count >= max_calls:
                retry_after = window_seconds
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        f"Rate limit exceeded: {max_calls} requests per {window_seconds}s "
                        f"for scope '{scope}'. Slow down and retry in {retry_after}s."
                    ),
                    headers={"Retry-After": str(retry_after)},
                )

        except HTTPException:
            raise
        except Exception as exc:
            # Redis unavailable — allow through (graceful degradation)
            logger.warning("rate_limit: Redis error for key '%s': %s — allowing through", key, exc)

    return _check
