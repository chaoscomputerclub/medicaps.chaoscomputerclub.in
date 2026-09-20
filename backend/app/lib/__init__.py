"""
Chaos Computer Club — Medi-Caps Chapter
app.lib — Reusable, cross-cutting primitives and low-level utilities.
"""

from app.lib.cache_keys import (
    TTL_CONTESTS_LIST,
    TTL_CONTEST_DETAIL,
    TTL_SCOREBOARD,
    TTL_LEADERBOARD,
    TTL_FEED,
    TTL_PROOFS,
    TTL_USER_PROFILE,
    contest_list_cache_key,
    contest_detail_cache_key,
    scoreboard_cache_key,
    leaderboard_cache_key,
    feed_announcements_cache_key,
    proofs_list_cache_key,
)
from app.lib.crypto import (
    compute_sha256_digest,
    compute_prn_hash,
    format_certificate_id,
)
from app.lib.otp import generate_otp, hash_otp
from app.lib.pagination import inject_pagination_headers, normalize_pagination, slice_page
from app.lib.chunking import chunk_list, chunked_in_query, gather_with_concurrency
from app.lib.qr import build_campus_pass_qr, parse_campus_pass_qr
from app.lib.validators import (
    is_valid_medicaps_email,
    is_valid_handle,
    is_valid_prn,
)

__all__ = [
    "TTL_CONTESTS_LIST",
    "TTL_CONTEST_DETAIL",
    "TTL_SCOREBOARD",
    "TTL_LEADERBOARD",
    "TTL_FEED",
    "TTL_PROOFS",
    "TTL_USER_PROFILE",
    "contest_list_cache_key",
    "contest_detail_cache_key",
    "scoreboard_cache_key",
    "leaderboard_cache_key",
    "feed_announcements_cache_key",
    "proofs_list_cache_key",
    "compute_sha256_digest",
    "compute_prn_hash",
    "format_certificate_id",
    "generate_otp",
    "hash_otp",
    "normalize_pagination",
    "slice_page",
    "inject_pagination_headers",
    "chunk_list",
    "chunked_in_query",
    "gather_with_concurrency",
    "build_campus_pass_qr",
    "parse_campus_pass_qr",
    "is_valid_medicaps_email",
    "is_valid_handle",
    "is_valid_prn",
]

