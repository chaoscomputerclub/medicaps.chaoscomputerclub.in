"""
Chaos Computer Club — Medi-Caps Chapter
utils/otp_store.py — Redis OTP session store
Architecture mirrors: Interleet/backend/app/utils/OTP.py

Flow:
  send_otp(email) → transactionID
    Redis SETEX otp:{transactionID} 300s → {email, hashedOTP, attempts:0}
    
  verify_otp(transactionID, otp) → {valid, email, reason}
    GET otp:{transactionID}
    check attempts < 5
    compare sha256(otp) == hashedOTP
    on fail: increment attempts, re-SETEX 300s
    on success: DEL key → return {valid: True, email}
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
    Store OTP in Redis under a new transactionID.
    Returns { transaction_id, success }
    Mirrors Interleet sendOTP() but uses async Redis client.
    """
    transaction_id = str(uuid.uuid4())
    key = f"otp:{transaction_id}"
    payload = json.dumps({
        "email": email,
        "hashedOTP": hash_otp(otp),
        "attempts": 0,
    })
    try:
        client = get_redis()
        await client.setex(key, OTP_TTL_SECONDS, payload)
        logger.info("OTP stored for %s (txn=%s)", email, transaction_id)
        return {"transaction_id": transaction_id, "success": True}
    except Exception as e:
        logger.error("Redis error storing OTP for %s: %s", email, e)
        return {"transaction_id": None, "success": False, "error": str(e)}


async def verify_otp(transaction_id: str, otp: str) -> dict:
    """
    Verify OTP against Redis store.
    Returns { valid, email, reason }
    Mirrors Interleet VerifyOTPbyUtils() with 5-attempt rate limiting.
    """
    key = f"otp:{transaction_id}"
    client = get_redis()

    try:
        raw = await client.get(key)
    except Exception as e:
        logger.error("Redis error fetching OTP (txn=%s): %s", transaction_id, e)
        return {"valid": False, "reason": "Session store unavailable. Please try again."}

    if not raw:
        return {"valid": False, "reason": "OTP expired or invalid session. Please request a new one."}

    try:
        data = json.loads(raw)
        email = data["email"]
        hashed_stored = data["hashedOTP"]
        attempts = data.get("attempts", 0)
    except (json.JSONDecodeError, KeyError) as e:
        logger.error("Corrupted OTP data (txn=%s): %s", transaction_id, e)
        return {"valid": False, "reason": "Corrupted session data. Please request a new OTP."}

    # Rate limiting
    if attempts >= MAX_ATTEMPTS:
        await client.delete(key)
        return {"valid": False, "reason": "Too many failed attempts. Please request a new OTP."}

    # Verify
    if hash_otp(otp) == hashed_stored:
        await client.delete(key)
        logger.info("OTP verified for %s (txn=%s)", email, transaction_id)
        return {"valid": True, "email": email, "reason": "Verified"}

    # Increment attempts
    data["attempts"] = attempts + 1
    remaining = MAX_ATTEMPTS - data["attempts"]

    if remaining <= 0:
        await client.delete(key)
        return {"valid": False, "reason": "Too many failed attempts. Please request a new OTP."}

    try:
        await client.setex(key, OTP_TTL_SECONDS, json.dumps(data))
    except Exception as e:
        logger.warning("Failed to update attempt count (txn=%s): %s", transaction_id, e)

    return {
        "valid": False,
        "reason": "Invalid OTP. " + str(remaining) + (" attempts" if remaining != 1 else " attempt") + " remaining.",
    }
