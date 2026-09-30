"""
Chaos Computer Club — Medi-Caps Chapter
core/user_concurrency.py — Per-User Judge Job Concurrency Limiter

Prevents a single user from monopolising the judge queue by maintaining
a Redis counter of their currently-in-flight jobs. Integrates directly
into the contest controller's async submit path.

Redis key:  ccc:user:{member_id}:active_judge_jobs
Strategy:   INCR before enqueue, DECR after job completes (via job metadata)
            Counter TTL is set to VISIBILITY_TIMEOUT_S so it self-heals
            even if the decrement is never called (e.g. worker crash).

Default limit: 3 concurrent judge jobs per user
             (covers legitimate language/problem variation)
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import HTTPException, status

from app.core.redis import get_redis

logger = logging.getLogger("ccc.user_concurrency")

# Maximum in-flight judge jobs allowed per user at a time
DEFAULT_USER_JOB_LIMIT = 3
# TTL on the counter — self-heals after visibility timeout (5 min)
COUNTER_TTL_S = 300


def _user_jobs_key(member_id: str) -> str:
    return f"ccc:user:{member_id}:active_judge_jobs"


async def acquire_user_job_slot(
    member_id: str,
    max_concurrent: int = DEFAULT_USER_JOB_LIMIT,
) -> None:
    """
    Increment the user's active job counter.
    Raises HTTP 429 if the user already has max_concurrent jobs in-flight.
    Call this BEFORE enqueuing the job.

    Atomically: check current count → if < limit, increment and set TTL.
    If >= limit, raise 429.
    """
    r = get_redis()
    key = _user_jobs_key(member_id)

    # Lua: atomically read + conditionally increment
    _INCR_IF_BELOW_LUA = """
local current = tonumber(redis.call('get', KEYS[1])) or 0
if current >= tonumber(ARGV[1]) then
    return -1
end
local new_val = redis.call('incr', KEYS[1])
redis.call('expire', KEYS[1], ARGV[2])
return new_val
"""
    result = await r.eval(_INCR_IF_BELOW_LUA, 1, key, max_concurrent, COUNTER_TTL_S)

    if result == -1:
        logger.warning(
            "User %s rejected: %d active judge jobs (limit=%d)",
            member_id, max_concurrent, max_concurrent,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"You already have {max_concurrent} submission(s) being evaluated. "
                "Please wait for your current submissions to complete before submitting again."
            ),
            headers={"Retry-After": "30"},
        )

    logger.debug("User %s acquired judge slot (active=%s)", member_id, result)


async def release_user_job_slot(member_id: str) -> None:
    """
    Decrement the user's active job counter.
    Call this AFTER job completes (success or failure).
    Safe to call even if counter is 0 (floor at 0).
    """
    r = get_redis()
    key = _user_jobs_key(member_id)

    _DECR_FLOOR_ZERO_LUA = """
local current = tonumber(redis.call('get', KEYS[1])) or 0
if current <= 0 then
    redis.call('del', KEYS[1])
    return 0
end
return redis.call('decr', KEYS[1])
"""
    result = await r.eval(_DECR_FLOOR_ZERO_LUA, 1, key)
    logger.debug("User %s released judge slot (remaining=%s)", member_id, result)


async def get_user_active_jobs(member_id: str) -> int:
    """Return the current number of active judge jobs for a user."""
    r = get_redis()
    val = await r.get(_user_jobs_key(member_id))
    return int(val) if val else 0
