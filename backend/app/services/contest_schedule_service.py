"""
Chaos Computer Club India — Medi-Caps Chapter
Contest Schedule Service: Canonical Schedule Authority

Canonical Schedule:
- Cadence: Weekly Contest
- Schedule: Every Wednesday, 3:00 PM to 4:30 PM IST (15:00 to 16:30 IST)
- Duration: 90 Minutes (1.5 Hours)
- Timezone: Indian Standard Time (IST, UTC+05:30)
- UTC Start: 09:30 UTC
- UTC End: 11:00 UTC
- Check-in Opens: 2:00 PM IST (14:00 IST / 08:30 UTC), 1 hour before start
- Screening Assessment Opens: Tuesday 3:00 PM IST (15:00 IST / 09:30 UTC), strictly 24 hours before start
- Screening Assessment Closes: Wednesday 1:00 PM IST (13:00 IST / 07:30 UTC), strictly 2 hours before start

Strict Immutability Guarantee:
- Once an official contest is created/scheduled in the database, its timers are strictly immutable.
- Subsequent builds, redeployments, or CI/CD runs will NEVER reset, shift, or overwrite the active timer.
"""

from datetime import datetime, timezone, timedelta
from typing import Tuple, Optional

IST = timezone(timedelta(hours=5, minutes=30))


def get_next_wednesday_schedule(
    reference_dt: Optional[datetime] = None,
) -> Tuple[datetime, datetime, datetime, datetime, datetime]:
    """
    Computes canonical Wednesday contest timestamps:
    - starts_at: Wednesday 15:00 IST (09:30 UTC)
    - ends_at: Wednesday 16:30 IST (11:00 UTC)
    - check_in_opens_at: Wednesday 14:00 IST (08:30 UTC)
    - assessment_opens_at: Tuesday 15:00 IST (09:30 UTC) [strictly 24h prior]
    - assessment_closes_at: Wednesday 13:00 IST (07:30 UTC) [strictly 2h prior]

    Returns all datetimes in timezone-aware UTC.
    """
    if reference_dt is None:
        reference_dt = datetime.now(timezone.utc)
    elif reference_dt.tzinfo is None:
        reference_dt = reference_dt.replace(tzinfo=timezone.utc)

    dt_ist = reference_dt.astimezone(IST)

    # Wednesday is weekday 2 (Monday=0, Tuesday=1, Wednesday=2, ...)
    days_ahead = (2 - dt_ist.weekday()) % 7

    # If today is Wednesday and the contest has already ended (after 16:30 IST), target next Wednesday
    if days_ahead == 0 and (dt_ist.hour > 16 or (dt_ist.hour == 16 and dt_ist.minute >= 30)):
        days_ahead = 7

    target_date = dt_ist.date() + timedelta(days=days_ahead)

    starts_at_ist = datetime(target_date.year, target_date.month, target_date.day, 15, 0, 0, tzinfo=IST)
    ends_at_ist = datetime(target_date.year, target_date.month, target_date.day, 16, 30, 0, tzinfo=IST)
    checkin_ist = datetime(target_date.year, target_date.month, target_date.day, 14, 0, 0, tzinfo=IST)
    assess_opens_ist = starts_at_ist - timedelta(hours=24) # Strictly 24 hours prior (Tuesday 3:00 PM IST)
    assess_closes_ist = datetime(target_date.year, target_date.month, target_date.day, 13, 0, 0, tzinfo=IST) # Strictly 2 hours prior

    return (
        starts_at_ist.astimezone(timezone.utc),
        ends_at_ist.astimezone(timezone.utc),
        checkin_ist.astimezone(timezone.utc),
        assess_opens_ist.astimezone(timezone.utc),
        assess_closes_ist.astimezone(timezone.utc),
    )
