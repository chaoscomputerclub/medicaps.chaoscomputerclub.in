"""
Chaos Computer Club — Medi-Caps Chapter
services/contest_eligibility_service.py

Determines whether a member is eligible to view, register, or enter a LIVE contest.
Enforces that Phase 2 On-Premise Air-Gapped Live Finals are strictly restricted to:
1. Core team organizers & proctors (is_core_member == True)
2. Direct registered finalists (ContestRegistration)
3. Verified CampusPass holders
4. Top 30 qualifiers from Phase 1 Online Screening Assessments (is_top_30_qualified == True or rank <= 30)
"""

import logging
from typing import Optional, Tuple
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import (
    OfflineContest,
    MemberProfile,
    ContestRegistration,
    Assessment,
    AssessmentSession,
    CampusPass,
)

logger = logging.getLogger(__name__)


async def is_member_eligible_for_live_contest(
    member: Optional[MemberProfile],
    contest: OfflineContest,
    db: AsyncSession,
) -> Tuple[bool, str]:
    """
    Check if candidate is eligible to access a live contest.
    Returns (is_eligible, reason).
    """
    # 1. If contest is NOT live, it is open for public view / announcement
    if contest.status != "live":
        return True, "Contest is public"

    # 1.5 Dev test arena contests are open to allow easy development testing
    if contest.slug.startswith("dev-"):
        return True, "Development test arena access."

    # 2. If unauthenticated, live contest access is strictly denied
    if not member:
        return False, "Authentication required to view or enter live contests."

    # 3. Core chapter team & proctors always have access
    if getattr(member, "is_core_member", False):
        return True, "Authorized chapter core team / proctor access."

    # 4. Check direct registration for this live contest
    reg_res = await db.execute(
        select(ContestRegistration).where(
            ContestRegistration.contest_id == contest.id,
            ContestRegistration.member_id == member.id,
        )
    )
    if reg_res.scalars().first():
        return True, "Confirmed registered finalist for this live contest."

    # 5. Check direct CampusPass for this contest
    pass_res = await db.execute(
        select(CampusPass).where(
            CampusPass.member_id == member.id,
            CampusPass.contest_id == contest.id,
            CampusPass.check_in_status != "revoked",
        )
    )
    if pass_res.scalars().first():
        return True, "Valid Digital Campus QR Pass holder."

    # 6. Check Phase 1 Screening Assessment qualification
    # Look for assessments linked to this contest
    assess_res = await db.execute(
        select(Assessment).where(Assessment.contest_id == contest.id)
    )
    assessments = assess_res.scalars().all()
    if not assessments:
        # Companion screening assessment
        all_assess_res = await db.execute(
            select(Assessment).where(Assessment.is_active == True)
        )
        assessments = all_assess_res.scalars().all()

    for assess in assessments:
        s_res = await db.execute(
            select(AssessmentSession).where(
                AssessmentSession.assessment_id == assess.id,
                AssessmentSession.member_id == member.id,
            )
        )
        my_session = s_res.scalars().first()
        if my_session:
            if my_session.is_top_30_qualified:
                return True, "Top 30 qualified finalist from Phase 1 Screening."

            # Calculate rank in assessment
            all_s_res = await db.execute(
                select(AssessmentSession)
                .where(
                    AssessmentSession.assessment_id == assess.id,
                    AssessmentSession.status.in_(["in_progress", "submitted"]),
                )
                .order_by(desc(AssessmentSession.total_score), AssessmentSession.total_penalty_seconds)
            )
            all_sessions = all_s_res.scalars().all()
            for rank_num, s in enumerate(all_sessions, start=1):
                if s.member_id == member.id:
                    if rank_num <= 30 and (s.total_score > 0 or len(all_sessions) <= 30):
                        return True, f"Top 30 screening qualifier (Rank #{rank_num})."
                    break

    return False, "Live Final is strictly restricted to Top 30 qualified cadets."
