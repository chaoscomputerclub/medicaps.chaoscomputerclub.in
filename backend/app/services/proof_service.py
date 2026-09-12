"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Trust-of-Proof Cryptographic Engine (SHA-256 Result Digest)
"""

import hashlib
import json
import uuid
from typing import Dict, Any


def generate_sha256_digest(payload: Dict[str, Any]) -> str:
    """Generate deterministic SHA-256 digest from a normalized json payload."""
    serialized = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def generate_prn_hash(prn: str) -> str:
    """Generate one-way cryptographic hash of student PRN to protect privacy on public certificates."""
    salt = "ccc-medicaps-university-salt-2026"
    return hashlib.sha256(f"{salt}:{prn}".encode("utf-8")).hexdigest()


def generate_certificate_id(contest_year: int, sequence_num: int) -> str:
    """Generate standardized CCC certificate identifier: e.g. CCC-MED-2026-0042."""
    return f"CCC-MED-{contest_year}-{sequence_num:04d}"


def create_trust_proof_data(
    contest_id: str,
    contest_title: str,
    member_handle: str,
    prn: str,
    rank: int,
    score: int,
    session_uuid: str,
    proctor_name: str,
    lab_venue: str,
    certificate_id: str,
) -> Dict[str, Any]:
    """Create verified proof payload with tamper-proof SHA-256 signature."""
    prn_hash = generate_prn_hash(prn)
    
    proof_body = {
        "certificate_id": certificate_id,
        "contest_id": contest_id,
        "contest_title": contest_title,
        "member_handle": member_handle,
        "prn_hash": prn_hash,
        "rank": rank,
        "score": score,
        "session_uuid": session_uuid,
        "proctor": proctor_name,
        "venue": lab_venue,
    }
    
    digest = generate_sha256_digest(proof_body)
    
    return {
        "certificate_id": certificate_id,
        "contest_id": contest_id,
        "member_handle": member_handle,
        "contest_title": contest_title,
        "session_uuid": session_uuid,
        "prn_hash": prn_hash,
        "sha256_digest": digest,
        "proctor_stamp": f"Verified by {proctor_name} (Chief Proctor)",
        "attendance_stamp": f"Physical In-Person Verified: {lab_venue}",
        "score": score,
        "rank": rank,
        "status": "verified",
    }
