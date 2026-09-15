"""
Chaos Computer Club — Model Base Utilities & Helpers
"""

import uuid
from datetime import datetime, timezone
from app.core.db import Base


def get_uuid() -> str:
    """Generate RFC 4122 compliant UUID v4 string."""
    return str(uuid.uuid4())


def now_utc() -> datetime:
    """Generate timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)
