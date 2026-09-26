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


from app.core.config import settings


async def is_contest_attempt_submitted(
    member: Optional[MemberProfile],
    contest: OfflineContest,
    db: AsyncSession,
) -> Tuple[bool, str]:
    """
    Returns (True, reason) if the given member has already submitted or completed
    their attempt for this contest (either screening assessment or live contest).
    Once submitted, retakes and further attempts are strictly locked.
    """
    if not member or not contest:
        return False, ""

    # 1. Check ContestRegistration record
    reg_res = await db.execute(
        select(ContestRegistration).where(
            ContestRegistration.contest_id == contest.id,
            ContestRegistration.member_id == member.id,
        )
    )
    reg = reg_res.scalars().first()
    if reg and (reg.status in ("submitted", "completed") or reg.assessment_taken):
        return True, "Contest attempt has already been submitted. Retakes are not permitted."

    # 2. Check AssessmentSession record for any assessment linked to this contest
    assess_res = await db.execute(
        select(Assessment).where(
            (Assessment.contest_id == contest.id) | (Assessment.slug == contest.slug)
        )
    )
    assessments = assess_res.scalars().all()
    for assess in assessments:
        s_res = await db.execute(
            select(AssessmentSession).where(
                AssessmentSession.assessment_id == assess.id,
                AssessmentSession.member_id == member.id,
            )
        )
        sess = s_res.scalars().first()
        if sess and sess.status in ("submitted", "completed", "expired", "disqualified"):
            return True, "Contest attempt has already been submitted. Retakes are not permitted."

    return False, ""


async def is_member_eligible_for_live_contest(
    member: Optional[MemberProfile],
    contest: OfflineContest,
    db: AsyncSession,
    require_checked_in: bool = True,
) -> Tuple[bool, str]:
    """
    Check if candidate is eligible to access a live contest or its live arena.
    
    If require_checked_in is True (default for arena, submissions, runs, and live problems):
      - Candidate MUST have completed physical QR check-in at the lab gate (CampusPass.check_in_status == "checked_in").
      - Remote access from home is strictly denied.
    
    If require_checked_in is False (for contest info & pass retrieval):
      - Top 30 qualifiers can view contest details to fetch and present their QR pass.
    """
    # 0. STRICT ONE-ATTEMPT CHECK: Once submitted, retakes are strictly locked
    if member:
        is_sub, sub_reason = await is_contest_attempt_submitted(member, contest, db)
        if is_sub:
            return False, sub_reason

    # 0.1 Global Development Bypass Mode from ENV
    if settings.is_dev_bypass_enabled:
        return True, "Development restriction bypass mode active."

    # 1. If contest is NOT live, it is open for public view / announcement
    if contest.status != "live":
        return True, "Contest is public"

    # 1.5 Dev test arena contests are open to allow easy development testing
    if contest.slug.startswith("dev-"):
        return True, "Development test arena access."

    # 2. If unauthenticated, live contest access is strictly denied
    if not member:
        return False, "Authentication required to view or enter live contests."

    from app.core.security import is_privileged_test_member
    if is_privileged_test_member(member):
        return True, "Privileged test mode active: Full contest access granted."

    # 3. Core chapter team & proctors always have access
    if getattr(member, "is_core_member", False):
        return True, "Authorized chapter core team / proctor access."

    # 4. Standard Open Contest Mode (Online Assessment & QR turned off):
    # Pure LeetCode-style: open for everyone to participate when live.
    if not settings.FEATURE_ASSESSMENT_AND_QR_ENABLED:
        return True, "Open contest arena: All authenticated members are eligible."

    # 5. Check whether member is a Top 30 qualified finalist or registered finalist
    is_qualified = False
    qualify_reason = ""

    # Check direct registration
    reg_res = await db.execute(
        select(ContestRegistration).where(
            ContestRegistration.contest_id == contest.id,
            ContestRegistration.member_id == member.id,
        )
    )
    reg_obj = reg_res.scalars().first()
    if reg_obj:
        is_qualified = True
        qualify_reason = "Confirmed registered finalist."

    # Check Phase 1 Screening Assessment qualification
    if not is_qualified:
        assess_res = await db.execute(
            select(Assessment).where(Assessment.contest_id == contest.id)
        )
        assessments = assess_res.scalars().all()
        if not assessments:
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
                    is_qualified = True
                    qualify_reason = "Top 30 qualified finalist from Phase 1 Screening."
                    break

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
                            is_qualified = True
                            qualify_reason = f"Top 30 screening qualifier (Rank #{rank_num})."
                        break
                if is_qualified:
                    break

    # Also check if they already have an issued CampusPass for this contest
    pass_res = await db.execute(
        select(CampusPass).where(
            CampusPass.member_id == member.id,
            CampusPass.contest_id == contest.id,
        )
    )
    c_pass = pass_res.scalars().first()
    if c_pass:
        is_qualified = True

    if not is_qualified:
        return False, "Access restricted: Live contest is restricted to registered/qualified participants."

    # 5. If checked-in status is not required (e.g., viewing pass or contest info), allow
    if not require_checked_in:
        return True, qualify_reason or "Qualified for live contest arena."

    # 6. STRICT PHYSICAL PROCTORING GATE: Require CampusPass.check_in_status == "checked_in"
    if not c_pass:
        return False, "No Campus Pass allocated. Please visit the qualification portal to claim your pass."

    if c_pass.check_in_status == "revoked":
        return False, "Campus Pass has been revoked by the chief proctor."

    if c_pass.check_in_status != "checked_in":
        return False, "Physical gate check-in required. Your QR Campus Pass must be scanned by a lab proctor at the venue before entering the live arena."

    return True, f"Verified physical gate check-in at workstation {c_pass.seat_number}."
