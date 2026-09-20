"""
Chaos Computer Club — Medi-Caps Chapter
lib/cache_keys.py — Standardized Redis cache key builders and TTL policies.
"""

from typing import Optional

# Standard TTL constants (seconds)
TTL_CONTESTS_LIST = 30
TTL_CONTEST_DETAIL = 30
TTL_SCOREBOARD = 15
TTL_LEADERBOARD = 60
TTL_FEED = 120
TTL_PROOFS = 120
TTL_USER_PROFILE = 60


def contest_list_cache_key(
    status: Optional[str] = None,
    division: Optional[str] = None,
    member_key: Optional[str] = None,
) -> str:
    """Build cache key for the public contest catalog."""
    return f"cache:contests:list:{status or 'all'}:{division or 'all'}:{member_key or 'anon'}"


def contest_detail_cache_key(slug: str) -> str:
    """Build cache key for single contest metadata."""
    return f"cache:contest:{slug}"


def scoreboard_cache_key(
    slug: str,
    division: Optional[str] = None,
    department: Optional[str] = None,
) -> str:
    """Build cache key for contest scoreboard matrix."""
    return f"cache:scoreboard:{slug}:{division or 'all'}:{department or 'all'}"


def leaderboard_cache_key(
    department: Optional[str] = None,
    batch: Optional[str] = None,
    tier: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
) -> str:
    """Build cache key for university rating leaderboard."""
    return f"cache:leaderboard:{department or 'all'}:{batch or 'all'}:{tier or 'all'}:{limit or 'all'}:{offset or 0}"


def feed_announcements_cache_key(
    kind: Optional[str] = None,
    limit: int = 20,
) -> str:
    """Build cache key for campus announcements and feed."""
    return f"cache:feed:announcements:{kind or 'all'}:{limit}"


def proofs_list_cache_key(limit: int = 200) -> str:
    """Build cache key for trust of proof ledger listings."""
    return f"cache:verify:proofs:{limit}"
