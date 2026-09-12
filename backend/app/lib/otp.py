"""
Chaos Computer Club — Medi-Caps Chapter
lib/otp.py — Pure OTP primitives (no side effects, no I/O)
Architecture mirrors: Interleet/backend/app/lib/generateOTP.py
"""
import hashlib
import random


def generate_otp() -> str:
    """Generate a cryptographically sufficient 6-digit numeric OTP."""
    return str(random.randint(100000, 999999))


def hash_otp(otp: str) -> str:
    """SHA-256 hash of OTP string. Stored in Redis; plaintext never persisted."""
    return hashlib.sha256(otp.encode("utf-8")).hexdigest()
