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


def inject_pagination_headers(
    response: Any,
    total_count: int,
    limit: int,
    offset: int,
) -> None:
    """Inject standard pagination telemetry headers into an HTTP response."""
    if not hasattr(response, "headers"):
        return
    page_size = max(1, limit)
    current_page = (offset // page_size) + 1
    total_pages = max(1, (total_count + page_size - 1) // page_size)
    has_next = (offset + limit) < total_count

    response.headers["X-Total-Count"] = str(total_count)
    response.headers["X-Page"] = str(current_page)
    response.headers["X-Page-Size"] = str(page_size)
    response.headers["X-Offset"] = str(offset)
    response.headers["X-Total-Pages"] = str(total_pages)
    response.headers["X-Has-Next"] = "true" if has_next else "false"

    # Ensure frontend fetch/XHR clients can inspect pagination headers in CORS contexts
    exposed = response.headers.get("Access-Control-Expose-Headers", "")
    new_exposed = "X-Total-Count, X-Page, X-Page-Size, X-Offset, X-Total-Pages, X-Has-Next"
    if exposed:
        if "X-Total-Count" not in exposed:
            response.headers["Access-Control-Expose-Headers"] = f"{exposed}, {new_exposed}"
    else:
        response.headers["Access-Control-Expose-Headers"] = new_exposed

