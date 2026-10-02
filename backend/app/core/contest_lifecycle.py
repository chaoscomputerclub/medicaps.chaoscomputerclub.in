"""
Chaos Computer Club — Medi-Caps Chapter
core/contest_lifecycle.py — Real-time Distributed Contest Lifecycle Modes

Defines fine-grained contest execution states coordinated via Redis:
- PRE_CONTEST: Contest starts within 30 minutes; caches warmup, sandboxes prepared; submissions closed.
- CONTEST_ACTIVE: Contest is live; submissions accepted.
- DRAINING: Contest time expired; submissions rejected (422); in-flight queue jobs are draining.
- FINALIZING: In-flight queue drained; computing Elo rating deltas, unfreezing scoreboards, top-30 qualification sweep.
- COMPLETE: Contest archived / concluded; final results published.

State stored in Redis: ccc:contest:{slug}:lifecycle_state
"""

from __future__ import annotations

import enum
import logging
from typing import Optional
from fastapi import HTTPException, status
from app.core.redis import get_redis

logger = logging.getLogger("ccc.contest_lifecycle")


class ContestLifecycleState(str, enum.Enum):
    PRE_CONTEST = "PRE_CONTEST"
    CONTEST_ACTIVE = "CONTEST_ACTIVE"
    DRAINING = "DRAINING"
    FINALIZING = "FINALIZING"
    COMPLETE = "COMPLETE"


def _lifecycle_key(slug: str) -> str:
    return f"ccc:contest:{slug}:lifecycle_state"


async def get_lifecycle_state(slug: str) -> Optional[ContestLifecycleState]:
    """Retrieve the current real-time lifecycle state of a contest from Redis."""
    try:
        r = get_redis()
        val = await r.get(_lifecycle_key(slug))
        if not val:
            return None
        val_str = val.decode("utf-8") if isinstance(val, bytes) else str(val)
        return ContestLifecycleState(val_str)
    except ValueError:
        return None
    except Exception as exc:
        logger.debug("Error reading contest lifecycle state for '%s': %s", slug, exc)
        return None


async def set_lifecycle_state(
    slug: str,
    state: ContestLifecycleState,
    ttl_seconds: int = 86400 * 3,  # 3 days default TTL
) -> None:
    """Transition a contest to a new real-time lifecycle state in Redis."""
    try:
        r = get_redis()
        val = state.value if isinstance(state, ContestLifecycleState) else str(state)
        await r.set(_lifecycle_key(slug), val, ex=ttl_seconds)
        logger.info("Contest '%s' lifecycle transitioned to %s (ttl=%ds)", slug, val, ttl_seconds)
    except Exception as exc:
        logger.warning("Failed to set lifecycle state %s for contest '%s': %s", state, slug, exc)


async def assert_submissions_open(slug: str) -> None:
    """
    Enforces contest submission gate based on the lifecycle state.
    Raises HTTP 422 if the contest is in PRE_CONTEST, DRAINING, FINALIZING, or COMPLETE.
    If no lifecycle state is set in Redis, defaults to open (allowing DB checks).
    """
    state = await get_lifecycle_state(slug)
    if state is None:
        return

    if state == ContestLifecycleState.CONTEST_ACTIVE:
        return

    if state == ContestLifecycleState.DRAINING:
        raise HTTPException(
            status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
            detail="Contest time has expired and the queue is DRAINING. In-flight submissions are completing; new submissions are closed.",
        )
    elif state == ContestLifecycleState.FINALIZING:
        raise HTTPException(
            status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
            detail="Contest is currently FINALIZING rankings and rating deltas. Submissions are closed.",
        )
    elif state == ContestLifecycleState.COMPLETE:
        raise HTTPException(
            status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
            detail="Contest is COMPLETE. Submissions are locked.",
        )
    elif state == ContestLifecycleState.PRE_CONTEST:
        raise HTTPException(
            status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
            detail="Contest is in PRE_CONTEST warmup phase. Submissions will open when the contest officially starts.",
        )
