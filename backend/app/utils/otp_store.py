"""
Chaos Computer Club — Medi-Caps Chapter
utils/otp_store.py — Redis OTP session store
Supports both transaction_id lookup and email lookup for maximum frontend/backend resilience.
"""
import json
import uuid
import logging
from app.core.redis import get_redis
from app.lib.otp import hash_otp

logger = logging.getLogger(__name__)

OTP_TTL_SECONDS = 300   # 5-minute expiry
MAX_ATTEMPTS = 5


async def send_otp(email: str, otp: str) -> dict:
    """
    Store OTP in Redis under both transactionID and direct email key.
    Returns { transaction_id, success }
    """
    clean_email = email.strip().lower()
    transaction_id = str(uuid.uuid4())
    key_txn = f"otp:{transaction_id}"
    key_email = f"otp:email:{clean_email}"
    payload = json.dumps({
        "email": clean_email,
        "hashedOTP": hash_otp(otp),
        "attempts": 0,
        "transaction_id": transaction_id,
    })
    try:
        client = get_redis()
        await client.setex(key_txn, OTP_TTL_SECONDS, payload)
        await client.setex(key_email, OTP_TTL_SECONDS, payload)
        logger.info("OTP stored for %s (txn=%s)", clean_email, transaction_id)
        return {"transaction_id": transaction_id, "success": True, "email": clean_email}
    except Exception as e:
        logger.error("Redis error storing OTP for %s: %s", clean_email, e)
        return {"transaction_id": None, "success": False, "error": str(e)}


async def verify_otp(identifier: str, otp: str) -> dict:
    """
    Verify OTP against Redis store using either transaction_id OR email address.
    Returns { valid, email, reason }
    """
    clean_id = identifier.strip().lower() if "@" in identifier else identifier.strip()
    client = get_redis()

    if "@" in clean_id:
        key = f"otp:email:{clean_id}"
    else:
        key = f"otp:{clean_id}"

    try:
        raw = await client.get(key)
    except Exception as e:
        logger.error("Redis error fetching OTP (%s): %s", key, e)
        return {"valid": False, "reason": "Session store unavailable. Please try again."}

    if not raw:
        return {"valid": False, "reason": "OTP expired or invalid session. Please request a new one."}

    try:
        data = json.loads(raw)
        email = data["email"]
        hashed_stored = data["hashedOTP"]
        attempts = data.get("attempts", 0)
        txn_id = data.get("transaction_id")
    except (json.JSONDecodeError, KeyError) as e:
        logger.error("Corrupted OTP data (%s): %s", key, e)
        return {"valid": False, "reason": "Corrupted session data. Please request a new OTP."}

    keys_to_clean = [f"otp:email:{email.lower()}"]
    if txn_id:
        keys_to_clean.append(f"otp:{txn_id}")
    if key not in keys_to_clean:
        keys_to_clean.append(key)

    # Rate limiting check
    if attempts >= MAX_ATTEMPTS:
        for k in keys_to_clean:
            try:
                await client.delete(k)
            except Exception:
                pass
        return {"valid": False, "reason": "Too many failed attempts. Please request a new OTP."}

    # Verify matching hash
    if hash_otp(otp) == hashed_stored:
        for k in keys_to_clean:
            try:
                await client.delete(k)
            except Exception:
                pass
        logger.info("OTP verified for %s", email)
        return {"valid": True, "email": email, "reason": "Verified"}

    # Increment attempts
    data["attempts"] = attempts + 1
    remaining = MAX_ATTEMPTS - data["attempts"]

    if remaining <= 0:
        for k in keys_to_clean:
            try:
                await client.delete(k)
            except Exception:
                pass
        return {"valid": False, "reason": "Too many failed attempts. Please request a new OTP."}

    try:
        updated_payload = json.dumps(data)
        for k in keys_to_clean:
            await client.setex(k, OTP_TTL_SECONDS, updated_payload)
    except Exception as e:
        logger.error("Redis error updating attempt count: %s", e)

    return {
        "valid": False,
        "reason": f"Invalid verification code. {remaining} attempt{'s' if remaining != 1 else ''} remaining.",
    }
