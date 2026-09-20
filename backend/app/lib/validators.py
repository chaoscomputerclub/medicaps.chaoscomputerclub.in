"""
Chaos Computer Club — Medi-Caps Chapter
lib/validators.py — Domain validation primitives for emails, PRNs, and handles.
"""

import re

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.)*medicaps\.ac\.in$", re.IGNORECASE)
HANDLE_REGEX = re.compile(r"^[a-zA-Z0-9_-]{3,32}$")
PRN_REGEX = re.compile(r"^[a-zA-Z0-9]{6,20}$")


def is_valid_medicaps_email(email: str, allow_dev_domains: bool = False) -> bool:
    """Validate that email belongs to Medi-Caps University domain."""
    clean = email.strip().lower()
    if allow_dev_domains and (clean.endswith("@example.com") or clean.endswith("@ccc.in")):
        return True
    return bool(EMAIL_REGEX.match(clean))


def is_valid_handle(handle: str) -> bool:
    """Validate cadet handle format."""
    clean = handle.lstrip("@").strip()
    return bool(HANDLE_REGEX.match(clean))


def is_valid_prn(prn: str) -> bool:
    """Validate University Permanent Registration Number format."""
    return bool(PRN_REGEX.match(prn.strip()))
