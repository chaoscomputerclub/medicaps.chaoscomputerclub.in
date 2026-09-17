"""
Chaos Computer Club — Single-Use Campus Entrance Pass & Attendance Verification Service
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, List, Tuple
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campus_pass import CampusPass
from app.models.contest import OfflineContest, ContestRegistration
from app.models.assessment import Assessment, AssessmentSession
from app.models.member import MemberProfile
from app.models.base import now_utc
from app.schemas.campus_pass import PassVerifyResponse, ContestAttendeeItem


class PassService:
    """Service handling campus pass issuance, cryptographic QR verification, and faculty check-ins."""

    @staticmethod
    def parse_qr_or_code(raw_input: str) -> str:
        """Extract clean pass code from raw QR string (e.g., 'CCC-PASS:CODE:ID:SEAT:QUALIFIED' -> 'CODE')."""
        clean = raw_input.strip()
        if clean.startswith("CCC-PASS:"):
            parts = clean.split(":")
            if len(parts) >= 2:
                return parts[1].strip()
        return clean

    @staticmethod
    async def get_active_pass_for_member(
        member_id: str,
        contest_slug: Optional[str],
        db: AsyncSession,
    ) -> Optional[dict]:
        """Fetch the member's campus pass for a specific contest or their latest issued pass."""
        stmt = (
            select(CampusPass, OfflineContest, MemberProfile)
            .join(OfflineContest, CampusPass.contest_id == OfflineContest.id)
            .join(MemberProfile, CampusPass.member_id == MemberProfile.id)
            .where(CampusPass.member_id == member_id)
        )
        if contest_slug:
            stmt = stmt.where(OfflineContest.slug == contest_slug)
        stmt = stmt.order_by(CampusPass.issued_at.desc())

        result = await db.execute(stmt)
        row = result.first()
        if not row:
            # Check if member is Top 30 qualified or has submitted assessment for this contest
            target_contest = None
            if contest_slug:
                c_stmt = select(OfflineContest).where(OfflineContest.slug == contest_slug)
                c_res = await db.execute(c_stmt)
                target_contest = c_res.scalars().first()
            else:
                c_stmt = (
                    select(OfflineContest)
                    .join(ContestRegistration, ContestRegistration.contest_id == OfflineContest.id)
                    .where(ContestRegistration.member_id == member_id)
                    .order_by(OfflineContest.starts_at.desc())
                )
                c_res = await db.execute(c_stmt)
                target_contest = c_res.scalars().first()

            if target_contest:
                from app.services.assessment_service import AssessmentService
                await AssessmentService.evaluate_and_qualify_top_30(target_contest.slug, db)
                result = await db.execute(stmt)
                row = result.first()
                if not row:
                    return None
            else:
                return None

        c_pass, contest, member = row
        return {
            "pass_code": c_pass.pass_code,
            "contest_id": c_pass.contest_id,
            "seat_number": c_pass.seat_number,
            "seat": c_pass.seat_number,
            "qr_data": c_pass.qr_data,
            "check_in_status": c_pass.check_in_status,
            "status": c_pass.check_in_status,
            "issued_at": c_pass.issued_at,
            "checked_in_at": c_pass.checked_in_at,
            "checked_in_by": c_pass.checked_in_by,
            "member_name": member.full_name or member.handle,
            "handle": member.handle,
            "department": member.department or "CSE",
            "batch": member.batch or "2023-27",
            "contest_title": contest.title,
            "contest_slug": contest.slug,
            "check_in_opens_at": contest.check_in_opens_at or contest.starts_at,
        }

    @staticmethod
    async def verify_and_check_in(
        raw_input: str,
        proctor_name: str,
        db: AsyncSession,
        contest_slug: Optional[str] = None,
    ) -> PassVerifyResponse:
        """
        Verify student gate pass presented at the air-gapped lab entrance.
        Validates qualification, prevents duplicate check-ins, and records proctor arrival stamp.
        """
        pass_code = PassService.parse_qr_or_code(raw_input)
        if not pass_code:
            return PassVerifyResponse(
                valid=False,
                status="invalid_pass",
                message="Invalid or empty pass code supplied.",
            )

        stmt = (
            select(CampusPass, OfflineContest, MemberProfile)
            .join(OfflineContest, CampusPass.contest_id == OfflineContest.id)
            .join(MemberProfile, CampusPass.member_id == MemberProfile.id)
            .where(CampusPass.pass_code == pass_code)
        )
        result = await db.execute(stmt)
        row = result.first()
        if not row:
            return PassVerifyResponse(
                valid=False,
                status="invalid_pass",
                message=f"No matching campus pass found for code '{pass_code}'.",
                pass_code=pass_code,
            )

        c_pass, contest, member = row

        if contest_slug and contest.slug != contest_slug:
            return PassVerifyResponse(
                valid=False,
                status="wrong_contest",
                message=f"Pass is for contest '{contest.title}', not '{contest_slug}'.",
                pass_code=pass_code,
                contest_title=contest.title,
                contest_slug=contest.slug,
            )

        # Check screening qualification rank / score
        reg_stmt = select(ContestRegistration).where(
            ContestRegistration.contest_id == contest.id,
            ContestRegistration.member_id == member.id,
        )
        reg_res = await db.execute(reg_stmt)
        reg = reg_res.scalars().first()

        screening_rank = reg.assessment_rank if reg else None
        screening_score = reg.assessment_score if reg else None

        # Check if already checked in
        if c_pass.check_in_status == "checked_in":
            return PassVerifyResponse(
                valid=True,
                status="already_checked_in",
                message=f"Candidate {member.full_name} (@{member.handle}) was ALREADY checked in at {c_pass.checked_in_at.strftime('%H:%M:%S')} by {c_pass.checked_in_by or 'Proctor'}.",
                pass_code=c_pass.pass_code,
                seat_number=c_pass.seat_number,
                contest_title=contest.title,
                contest_slug=contest.slug,
                candidate_name=member.full_name or member.handle,
                handle=member.handle,
                department=member.department or "CSE",
                batch=member.batch or "2023-27",
                qualification_rank=screening_rank,
                screening_score=screening_score,
                checked_in_at=c_pass.checked_in_at,
                checked_in_by=c_pass.checked_in_by,
            )

        # Mark Check-in
        now = now_utc()
        c_pass.check_in_status = "checked_in"
        c_pass.checked_in_at = now
        c_pass.checked_in_by = proctor_name

        await db.commit()

        # Broadcast real-time event via SSE and Webhooks
        try:
            from app.services.event_broadcaster import broadcast_event
            await broadcast_event(
                event_type="pass_checked_in",
                data={
                    "member_id": member.id,
                    "handle": member.handle,
                    "candidate_name": member.full_name or member.handle,
                    "pass_code": c_pass.pass_code,
                    "seat_number": c_pass.seat_number,
                    "status": "checked_in",
                    "checked_in_at": now.isoformat(),
                    "checked_in_by": proctor_name,
                },
                contest_slug=contest.slug,
            )
        except Exception as e:
            logger.debug("Realtime event broadcast exception: %s", e)

        return PassVerifyResponse(
            valid=True,
            status="verified",
            message=f"Verified! Candidate {member.full_name} (@{member.handle}) admitted to seat {c_pass.seat_number}.",
            pass_code=c_pass.pass_code,
            seat_number=c_pass.seat_number,
            contest_title=contest.title,
            contest_slug=contest.slug,
            candidate_name=member.full_name or member.handle,
            handle=member.handle,
            department=member.department or "CSE",
            batch=member.batch or "2023-27",
            qualification_rank=screening_rank,
            screening_score=screening_score,
            checked_in_at=now,
            checked_in_by=proctor_name,
        )

    @staticmethod
    async def list_contest_attendees(
        contest_slug: str,
        db: AsyncSession,
    ) -> List[ContestAttendeeItem]:
        """Fetch all Top 30 qualified finalists and their check-in status for proctor display."""
        contest_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == contest_slug))
        contest = contest_res.scalars().first()
        if not contest:
            return []

        stmt = (
            select(CampusPass, MemberProfile, ContestRegistration)
            .join(MemberProfile, CampusPass.member_id == MemberProfile.id)
            .outerjoin(
                ContestRegistration,
                (ContestRegistration.contest_id == CampusPass.contest_id) & (ContestRegistration.member_id == CampusPass.member_id)
            )
            .where(CampusPass.contest_id == contest.id)
            .order_by(CampusPass.seat_number)
        )
        result = await db.execute(stmt)
        rows = result.all()

        attendees = []
        for idx, (c_pass, member, reg) in enumerate(rows, start=1):
            attendees.append(
                ContestAttendeeItem(
                    rank=reg.assessment_rank if reg and reg.assessment_rank else idx,
                    handle=member.handle,
                    full_name=member.full_name or member.handle,
                    department=member.department or "CSE",
                    batch=member.batch or "2023-27",
                    seat_number=c_pass.seat_number,
                    pass_code=c_pass.pass_code,
                    check_in_status=c_pass.check_in_status,
                    checked_in_at=c_pass.checked_in_at,
                    checked_in_by=c_pass.checked_in_by,
                    screening_score=reg.assessment_score if reg and reg.assessment_score is not None else 0.0,
                )
            )
        return attendees
