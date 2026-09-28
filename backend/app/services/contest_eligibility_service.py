"""
Chaos Computer Club — Medi-Caps Chapter
services/contest_eligibility_service.py

Server-authoritative contest eligibility service for online competitive programming contests.
Follows a modern LeetCode/HackerRank architecture:
1. Authenticated member required.
2. Contests are open and online; no CampusPass, QR check-in, or Round 1 screening required.
3. Once an attempt is finalized or expired, further runs/submissions are strictly locked (single-attempt fair play).
4. Chapter core team, admins, and proctors have authorized access.
5. Contest lifecycle rules strictly enforced (upcoming vs. live vs. finished).
"""

import logging
from typing import Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import (
    OfflineContest,
    ContestAttempt,
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
    Returns true only when the contest attempt is finalized or expired.
    Submissions and runs are locked once an attempt is closed.
    """
    if not member or not contest:
        return False, ""

    attempt_res = await db.execute(
        select(ContestAttempt).where(
            ContestAttempt.contest_id == contest.id,
            ContestAttempt.member_id == member.id,
        )
    )
    attempt = attempt_res.scalars().first()
    if attempt and attempt.status in ("finalized", "expired"):
        return True, f"Contest attempt is {attempt.status}. Further submissions are locked."
    return False, ""


async def is_member_eligible_for_live_contest(
    member: Optional[MemberProfile],
    contest: OfflineContest,
    db: AsyncSession,
    require_checked_in: bool = False,
) -> Tuple[bool, str]:
    """
    Check if a candidate is eligible to enter an online contest or its coding workspace.

    Online Rules:
    - Candidate must be authenticated.
    - Single-attempt fair play: If attempt is finalized/expired, retakes are locked.
    - Core chapter team, proctors, and privileged test runners are always authorized.
    - Contest lifecycle:
        * upcoming: arena is sealed until scheduled start time.
        * finished: contest has concluded.
        * live: open to all authenticated participants.
    - Physical campus passes, QR check-ins, and Round 1 screening gates are fully deprecated.
    """
    # 0. STRICT ONE-ATTEMPT CHECK: Once submitted/finalized, retakes are locked
    if member:
        is_sub, sub_reason = await is_contest_attempt_submitted(member, contest, db)
        if is_sub:
            return False, sub_reason

    # 1. Unauthenticated users cannot enter live contests
    if not member:
        return False, "Authentication required to view or enter live contests."

    # 2. Chapter core team, admins, and privileged test runners have full access
    from app.core.security import is_privileged_test_member
    if is_privileged_test_member(member) or getattr(member, "is_core_member", False):
        return True, "Authorized chapter core team access."

    # 3. Contest lifecycle validation
    if contest.status == "upcoming":
        return False, "Contest has not started yet. The arena unlocks at the scheduled start time."

    if contest.status == "finished":
        return False, "Contest has concluded."

    if contest.status == "live":
        # Pure LeetCode/HackerRank model: open for authenticated members when live
        return True, "Open contest arena: All authenticated members are eligible."

    return False, f"Contest is not currently accessible (status: {contest.status})."
