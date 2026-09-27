"""
Chaos Computer Club — Medi-Caps Chapter
services/contest_eligibility_service.py

Pure Online Competitive Programming Contest Eligibility (LeetCode-style):
- Contests are open online collegiate algorithmic tournaments.
- All authenticated enrolled members can register and participate when live.
- Strict one-attempt enforcement: once a candidate finalized and submitted their contest attempt,
  the attempt is locked.
"""

import logging
from typing import Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import (
    OfflineContest,
    MemberProfile,
    ContestRegistration,
)

logger = logging.getLogger(__name__)


async def is_contest_attempt_submitted(
    member: Optional[MemberProfile],
    contest: OfflineContest,
    db: AsyncSession,
) -> Tuple[bool, str]:
    """
    Returns (True, reason) if the member has finalized and submitted their contest attempt.
    Once submitted, retakes and further code executions are strictly prohibited.
    """
    if not member or not contest:
        return False, ""

    reg_res = await db.execute(
        select(ContestRegistration).where(
            ContestRegistration.contest_id == contest.id,
            ContestRegistration.member_id == member.id,
        )
    )
    reg = reg_res.scalars().first()
    if reg and reg.status in ("submitted", "completed"):
        return True, "Contest attempt has already been submitted. Retakes are not permitted."

    return False, ""


async def is_member_eligible_for_live_contest(
    member: Optional[MemberProfile],
    contest: OfflineContest,
    db: AsyncSession,
    require_checked_in: bool = False,
) -> Tuple[bool, str]:
    """
    LeetCode-style contest eligibility:
    - Non-live contests are publicly visible.
    - Live contest arena requires user authentication.
    - If user has already finalized their attempt, access to code execution is locked.
    - All authenticated students are eligible to solve problems and participate.
    """
    if member:
        is_sub, sub_reason = await is_contest_attempt_submitted(member, contest, db)
        if is_sub:
            return False, sub_reason

    if contest.status != "live":
        return True, "Contest is public"

    if not member:
        return False, "Authentication required to enter live contest arena."

    return True, "Eligible for live contest arena."
