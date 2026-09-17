"""
Chaos Computer Club — Assessment Anti-Reattempt Middleware & Dependency Guard
Strictly enforces single-attempt rules for online screening rounds.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.middleware.auth import get_current_member
from app.models.db_models import (
    MemberProfile,
    OfflineContest,
    Assessment,
    AssessmentSession,
    ContestRegistration,
    now_utc,
)
from app.services.assessment_service import (
    AssessmentService,
    ASSESSMENT_DURATION_MINUTES,
)


async def require_active_assessment_session(
    contest_slug: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
) -> Tuple[AssessmentSession, Assessment, Optional[OfflineContest]]:
    """
    Middleware / Dependency Guard:
    Strictly verifies that:
    1. Assessment round exists and candidate is authenticated.
    2. Candidate has an active session.
    3. Candidate has NOT submitted or finalized the session.
    4. Session has NOT been disqualified.
    5. Session duration has NOT expired.

    Rejects any reattempt, code execution, or submission after completion with HTTP 403 Forbidden.
    """
    assessment, contest = await AssessmentService.get_or_create_assessment_for_contest(contest_slug, db)

    s_result = await db.execute(
        select(AssessmentSession).where(
            AssessmentSession.assessment_id == assessment.id,
            AssessmentSession.member_id == current_member.id,
        )
    )
    session = s_result.scalars().first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No active assessment session found. You must register and start the screening assessment first.",
        )

    if session.status == "submitted":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assessment has already been submitted and finalized. Reattempts and code executions are not permitted.",
        )

    if session.status == "disqualified":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assessment session was disqualified due to anti-cheat policy violations. Reattempts are not permitted.",
        )

    if session.status != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Assessment session is in '{session.status}' state and is not currently active.",
        )

    # Check 120-minute timer expiration
    started_at = session.started_at
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    duration_min = assessment.duration_minutes or ASSESSMENT_DURATION_MINUTES
    expires_at = started_at + timedelta(minutes=duration_min)

    if now_utc() > expires_at:
        session.status = "submitted"
        session.submitted_at = expires_at
        if contest:
            reg_res = await db.execute(
                select(ContestRegistration).where(
                    ContestRegistration.contest_id == contest.id,
                    ContestRegistration.member_id == current_member.id,
                )
            )
            reg = reg_res.scalars().first()
            if reg:
                reg.assessment_taken = True
                reg.assessment_score = session.total_score
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assessment duration has expired. Your submission has been finalized.",
        )

    return session, assessment, contest
