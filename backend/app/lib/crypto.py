"""
Chaos Computer Club — Medi-Caps Chapter
lib/crypto.py — Cryptographic digest, PRN hashing, and proof signature primitives.
"""

import hashlib
import json
from typing import Any, Dict

PRN_SALT = "ccc-medicaps-university-salt-2026"


def compute_sha256_digest(payload: Dict[str, Any]) -> str:
    """Generate deterministic SHA-256 digest from a normalized JSON payload."""
    serialized = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def compute_prn_hash(prn: str, salt: str = PRN_SALT) -> str:
    """Generate one-way cryptographic hash of student PRN to protect privacy on public certificates."""
    return hashlib.sha256(f"{salt}:{prn.strip().upper()}".encode("utf-8")).hexdigest()


def format_certificate_id(contest_year: int, sequence_num: int) -> str:
    """Generate standardized CCC certificate identifier: e.g. CCC-MED-2026-0042."""
    return f"CCC-MED-{contest_year}-{sequence_num:04d}"
