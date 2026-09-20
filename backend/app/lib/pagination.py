"""
Chaos Computer Club — Medi-Caps Chapter
lib/pagination.py — Query pagination and slicing utilities.
"""

from typing import Any, List, Optional, Tuple


def normalize_pagination(
    limit: Optional[int] = None,
    offset: Optional[int] = 0,
    default_limit: int = 50,
    max_limit: int = 500,
) -> Tuple[int, int]:
    """Normalize limit and offset parameters to safe bounds."""
    safe_offset = max(0, offset or 0)
    if limit is None:
        safe_limit = default_limit
    else:
        safe_limit = min(max_limit, max(1, limit))
    return safe_limit, safe_offset


def slice_page(items: List[Any], limit: Optional[int] = None, offset: int = 0) -> List[Any]:
    """In-memory slice helper for lists."""
    start = max(0, offset)
    if limit is None:
        return items[start:]
    return items[start : start + limit]
