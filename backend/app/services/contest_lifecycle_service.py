"""
Chaos Computer Club — Contest Lifecycle Service
Single source of truth for the two-round contest funnel.

Rules encoded here (and nowhere else):
  * Round 1 (online assessment) opens ASSESSMENT_WINDOW_HOURS before the offline
    final and closes the moment the final goes live. It is unavailable once the
    parent contest is live or finished.
  * A Round 1 session lasts ASSESSMENT_DURATION_MINUTES. The timer is anchored to
    the server-side started_at and can never be paused, extended, or restarted.
  * Only the top FINALIST_SEATS verified sessions qualify for Round 2 and receive
    a QR campus pass.

Routers stay thin: they translate HTTP, call these helpers, and serialise.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

ASSESSMENT_WINDOW_HOURS = 24
ASSESSMENT_DURATION_MINUTES = 120
FINALIST_SEATS = 30


def _aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class AssessmentWindow:
    opens_at: datetime
    closes_at: datetime

    def is_open(self, at: Optional[datetime] = None) -> bool:
        moment = _aware(at or utcnow())
        return self.opens_at <= moment <= self.closes_at

    def as_dict(self) -> dict:
        return {
            "opens_at": self.opens_at.isoformat(),
            "closes_at": self.closes_at.isoformat(),
            "duration_minutes": ASSESSMENT_DURATION_MINUTES,
            "window_hours": ASSESSMENT_WINDOW_HOURS,
        }


def assessment_window(contest_starts_at: datetime) -> AssessmentWindow:
    """Round 1 runs in the 24 hours immediately before the offline final."""
    closes_at = _aware(contest_starts_at)
    return AssessmentWindow(
        opens_at=closes_at - timedelta(hours=ASSESSMENT_WINDOW_HOURS),
        closes_at=closes_at,
    )


def assessment_available(contest_status: str, contest_starts_at: datetime,
                         at: Optional[datetime] = None) -> tuple[bool, str]:
    """Whether Round 1 may be entered right now, plus a human explanation."""
    if contest_status == "live":
        return False, (
            "Round 1 is closed. The offline final is live and restricted to the "
            f"Top {FINALIST_SEATS} qualified finalists."
        )
    if contest_status == "finished":
        return False, "This contest has concluded."

    window = assessment_window(contest_starts_at)
    moment = _aware(at or utcnow())
    if moment < window.opens_at:
        return False, (
            "Round 1 unlocks 24 hours before contest day, at "
            f"{window.opens_at.isoformat()}."
        )
    if moment > window.closes_at:
        return False, "The Round 1 window has closed."
    return True, "Round 1 is open."


def session_deadline(started_at: datetime) -> datetime:
    """Immutable session expiry, derived only from the server-recorded start."""
    return _aware(started_at) + timedelta(minutes=ASSESSMENT_DURATION_MINUTES)


def remaining_seconds(started_at: datetime, at: Optional[datetime] = None) -> int:
    moment = _aware(at or utcnow())
    return max(0, int((session_deadline(started_at) - moment).total_seconds()))


def is_expired(started_at: datetime, at: Optional[datetime] = None) -> bool:
    return remaining_seconds(started_at, at) <= 0


def rank_sessions(sessions: Iterable) -> list[tuple[int, object]]:
    """Rank by score descending, then by penalty seconds ascending."""
    ordered = sorted(
        sessions,
        key=lambda s: (-float(getattr(s, "total_score", 0) or 0),
                       int(getattr(s, "total_penalty_seconds", 0) or 0)),
    )
    return [(index, session) for index, session in enumerate(ordered, start=1)]


def qualifies_for_final(rank: int) -> bool:
    return 1 <= rank <= FINALIST_SEATS
