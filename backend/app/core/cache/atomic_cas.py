"""
Chaos Computer Club — Atomic Compare-And-Set (CAS) Cache Version Protection
Guarantees cache monotonicity via atomic Redis Lua scripts.
Invariant: cache_version NEVER decreases.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

from app.core.redis import get_redis
from app.core.cache.base import CCCJsonEncoder
from app.core.cache.contracts import CacheSyncEvent, SyncStrategy

logger = logging.getLogger("ccc.cache.atomic_cas")

VERSION_KEY_PREFIX = "ccc:version"
IDEMPOTENCY_KEY_PREFIX = "ccc:sync:idem"

DEFAULT_IDEMPOTENCY_TTL_SECONDS = 3600      # 1 hour
DEFAULT_VERSION_TTL_SECONDS = 604800         # 7 days

# ─── Atomic Compare-And-Set Lua Script ────────────────────────────────────────
# Guarantees that:
# 1. Idempotency is checked atomically
# 2. Version is strictly compared (incoming_version > current_version)
# 3. Version is advanced atomically
# 4. Cache state is updated or invalidated atomically
_CAS_SYNC_LUA = """
local version_key = KEYS[1]
local idem_key    = KEYS[2]

local inc_ver     = tonumber(ARGV[1])
local event_id    = ARGV[2]
local strategy    = ARGV[3]
local cache_key   = ARGV[4]
local cache_val   = ARGV[5]
local cache_ttl   = tonumber(ARGV[6])
local del_keys_js = ARGV[7]
local idem_ttl    = tonumber(ARGV[8])
local ver_ttl     = tonumber(ARGV[9])

-- 1. Check idempotency: if event already processed, ignore
local already_seen = redis.call("get", idem_key)
local cur_ver = tonumber(redis.call("get", version_key) or "0")

if already_seen then
    return cjson.encode({
        status = "duplicate",
        current_version = cur_ver,
        incoming_version = inc_ver
    })
end

-- 2. Monotonic Version Check: require inc_ver > cur_ver
if inc_ver <= cur_ver then
    -- Record idempotency to suppress duplicate retries of stale event
    redis.call("set", idem_key, event_id, "EX", idem_ttl)
    return cjson.encode({
        status = "stale",
        current_version = cur_ver,
        incoming_version = inc_ver
    })
end

-- 3. Monotonic State Advancement
redis.call("set", version_key, tostring(inc_ver), "EX", ver_ttl)
redis.call("set", idem_key, event_id, "EX", idem_ttl)

-- 4. Apply Cache Mutation Strategy
if strategy == "UPDATE" and cache_key ~= "" and cache_val ~= "" then
    redis.call("set", cache_key, cache_val, "EX", cache_ttl)
elseif strategy == "INVALIDATE" and del_keys_js ~= "" and del_keys_js ~= "[]" then
    local del_keys = cjson.decode(del_keys_js)
    if type(del_keys) == "table" and #del_keys > 0 then
        for i = 1, #del_keys do
            redis.call("del", del_keys[i])
        end
    end
end

return cjson.encode({
    status = "applied",
    current_version = inc_ver,
    previous_version = cur_ver
})
"""


def _version_key(resource_id: str) -> str:
    return f"{VERSION_KEY_PREFIX}:{resource_id.strip(':')}"


def _idem_key(event_id: str) -> str:
    return f"{IDEMPOTENCY_KEY_PREFIX}:{event_id}"


async def get_cached_resource_version(resource_id: str) -> int:
    """Read the current cached version for a resource from Redis."""
    redis = get_redis()
    raw = await redis.get(_version_key(resource_id))
    return int(raw) if raw is not None else 0


async def execute_atomic_cas_sync(event: CacheSyncEvent) -> Dict[str, Any]:
    """
    Execute atomic Compare-And-Set cache synchronization in Redis.
    Guarantees version monotonicity, idempotency, and atomic cache updates.
    """
    redis = get_redis()
    v_key = _version_key(event.resource_id)
    i_key = _idem_key(event.event_id)

    cache_val_str = ""
    if event.strategy == SyncStrategy.UPDATE and event.cache_value is not None:
        cache_val_str = json.dumps(event.cache_value, cls=CCCJsonEncoder)

    del_keys_json = json.dumps(event.keys_to_invalidate or [])

    try:
        raw_res = await redis.eval(
            _CAS_SYNC_LUA,
            2,
            v_key,
            i_key,
            event.version,
            event.event_id,
            event.strategy.value,
            event.cache_key or "",
            cache_val_str,
            event.cache_ttl,
            del_keys_json,
            DEFAULT_IDEMPOTENCY_TTL_SECONDS,
            DEFAULT_VERSION_TTL_SECONDS,
        )
        if isinstance(raw_res, str):
            return json.loads(raw_res)
        return {"status": "failed", "error": "Invalid Redis response"}
    except Exception as exc:
        logger.exception("Atomic CAS script execution failed for %s: %s", event.event_id, exc)
        return {"status": "failed", "error": str(exc)}
