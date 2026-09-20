"""
Chaos Computer Club — Medi-Caps Chapter
lib/qr.py — Campus Pass QR token formatting & parsing primitives.
"""

from typing import Optional, Tuple


def build_campus_pass_qr(pass_code: str, member_id: str, seat_number: str) -> str:
    """
    Format standard cryptographic QR badge payload:
    CCC-PASS:<PASS_CODE>:<MEMBER_ID>:<SEAT_NUMBER>:QUALIFIED
    """
    return f"CCC-PASS:{pass_code.strip()}:{member_id.strip()}:{seat_number.strip()}:QUALIFIED"


def parse_campus_pass_qr(raw_input: str) -> Tuple[str, Optional[str], Optional[str]]:
    """
    Parse a scanned string or code.
    Returns (pass_code, member_id_or_none, seat_number_or_none).
    """
    clean = raw_input.strip()
    if clean.startswith("CCC-PASS:"):
        parts = clean.split(":")
        pass_code = parts[1].strip() if len(parts) > 1 else clean
        member_id = parts[2].strip() if len(parts) > 2 else None
        seat_number = parts[3].strip() if len(parts) > 3 else None
        return pass_code, member_id, seat_number
    return clean, None, None
