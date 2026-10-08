"""
Chaos Computer Club — Medi-Caps Chapter
utils/otp_store.py — Distributed & Resilient In-Memory/Redis OTP session store
Supports both transaction_id lookup and email lookup with zero-failure fallback.
"""
import json
import time
import uuid
import logging
from app.core.redis import get_redis
from app.lib.otp import hash_otp

logger = logging.getLogger(__name__)

OTP_TTL_SECONDS = 900   # 15-minute expiry (aligned with email verification template)
MAX_ATTEMPTS = 5

# Local in-memory fallback store: key -> (payload_dict, expire_at_epoch)
_in_memory_otp_store: dict[str, tuple[dict, float]] = {}


def _cleanup_memory_store():
    """Prune expired entries from in-memory fallback store."""
    now = time.time()
    expired = [k for k, (_, exp) in _in_memory_otp_store.items() if exp <= now]
    for k in expired:
        _in_memory_otp_store.pop(k, None)


async def send_otp(email: str, otp: str) -> dict:
    """
    Store OTP in Redis (or in-memory fallback) under both transactionID and direct email key.
    Returns { transaction_id, success, email }
    """
    clean_email = email.strip().lower()
    transaction_id = str(uuid.uuid4())
    key_txn = f"otp:{transaction_id}"
    key_email = f"otp:email:{clean_email}"
    
    data = {
        "email": clean_email,
        "hashedOTP": hash_otp(otp),
        "attempts": 0,
        "transaction_id": transaction_id,
    }
    payload = json.dumps(data)
    stored_in_redis = False

    try:
        client = get_redis()
        await client.setex(key_txn, OTP_TTL_SECONDS, payload)
        await client.setex(key_email, OTP_TTL_SECONDS, payload)
        stored_in_redis = True
        logger.info("OTP stored in Redis for %s (txn=%s)", clean_email, transaction_id)
    except Exception as e:
        logger.debug("Redis store notice for %s (using resilient memory store): %s", clean_email, e)

    # Always mirror to memory store as high-availability fallback
    _cleanup_memory_store()
    expire_at = time.time() + OTP_TTL_SECONDS
    _in_memory_otp_store[key_txn] = (data.copy(), expire_at)
    _in_memory_otp_store[key_email] = (data.copy(), expire_at)
    logger.info("✓ OTP session active for %s (txn=%s, redis=%s)", clean_email, transaction_id, stored_in_redis)

    return {"transaction_id": transaction_id, "success": True, "email": clean_email}


async def verify_otp(identifier: str, otp: str) -> dict:
    """
    Verify OTP against Redis store or in-memory fallback using transaction_id OR email address.
    Returns { valid, email, reason }
    """
    clean_id = identifier.strip().lower() if "@" in identifier else identifier.strip()

    if "@" in clean_id:
        key = f"otp:email:{clean_id}"
    else:
        key = f"otp:{clean_id}"

    data = None
    stored_source = None

    # 1. Try Redis first
    try:
        client = get_redis()
        raw = await client.get(key)
        if raw:
            data = json.loads(raw)
            stored_source = "redis"
    except Exception as e:
        logger.debug("Redis lookup notice (%s): %s", key, e)

    # 2. Fall back to in-memory store
    if not data:
        _cleanup_memory_store()
        entry = _in_memory_otp_store.get(key)
        if entry:
            entry_data, expire_at = entry
            if expire_at > time.time():
                data = entry_data
                stored_source = "memory"
            else:
                _in_memory_otp_store.pop(key, None)

    if not data:
        return {"valid": False, "reason": "OTP expired or invalid session. Please request a new one."}

    email = data.get("email")
    hashed_stored = data.get("hashedOTP")
    attempts = data.get("attempts", 0)
    txn_id = data.get("transaction_id")

    if not email or not hashed_stored:
        return {"valid": False, "reason": "Corrupted session data. Please request a new OTP."}

    keys_to_clean = [f"otp:email:{email.lower()}"]
    if txn_id:
        keys_to_clean.append(f"otp:{txn_id}")
    if key not in keys_to_clean:
        keys_to_clean.append(key)

    # Rate limiting check
    if attempts >= MAX_ATTEMPTS:
        for k in keys_to_clean:
            _in_memory_otp_store.pop(k, None)
            try:
                client = get_redis()
                await client.delete(k)
            except Exception:
                pass
        return {"valid": False, "reason": "Too many failed attempts. Please request a new OTP."}

    # Verify matching hash
    if hash_otp(otp) == hashed_stored:
        for k in keys_to_clean:
            _in_memory_otp_store.pop(k, None)
            try:
                client = get_redis()
                await client.delete(k)
            except Exception:
                pass
        logger.info("✓ OTP verified for %s (source=%s)", email, stored_source)
        return {"valid": True, "email": email, "reason": "Verified"}

    # Increment attempts
    data["attempts"] = attempts + 1
    remaining = MAX_ATTEMPTS - data["attempts"]

    if remaining <= 0:
        for k in keys_to_clean:
            _in_memory_otp_store.pop(k, None)
            try:
                client = get_redis()
                await client.delete(k)
            except Exception:
                pass
        return {"valid": False, "reason": "Too many failed attempts. Please request a new OTP."}

    # Update in memory
    expire_at = time.time() + OTP_TTL_SECONDS
    for k in keys_to_clean:
        _in_memory_otp_store[k] = (data.copy(), expire_at)
        try:
            client = get_redis()
            await client.setex(k, OTP_TTL_SECONDS, json.dumps(data))
        except Exception:
            pass

    return {
        "valid": False,
        "reason": f"Invalid verification code. {remaining} attempt{'s' if remaining != 1 else ''} remaining.",
    }
