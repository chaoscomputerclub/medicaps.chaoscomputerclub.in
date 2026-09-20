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
    """Service handling campus pass issuance, cryptographic QR verification, and gate check-ins."""

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

        clean_query = pass_code.strip()
        clean_handle = clean_query.lstrip("@").strip()

        # 1. Match by exact pass_code
        stmt = (
            select(CampusPass, OfflineContest, MemberProfile)
            .join(OfflineContest, CampusPass.contest_id == OfflineContest.id)
            .join(MemberProfile, CampusPass.member_id == MemberProfile.id)
            .where(CampusPass.pass_code == clean_query)
        )
        result = await db.execute(stmt)
        row = result.first()

        # 2. Match by partial pass_code or qr_data
        if not row:
            stmt_partial = (
                select(CampusPass, OfflineContest, MemberProfile)
                .join(OfflineContest, CampusPass.contest_id == OfflineContest.id)
                .join(MemberProfile, CampusPass.member_id == MemberProfile.id)
                .where((CampusPass.pass_code.ilike(f"%{clean_query}%")) | (CampusPass.qr_data.ilike(f"%{clean_query}%")))
            )
            if contest_slug:
                stmt_partial = stmt_partial.where(OfflineContest.slug == contest_slug)
            res_partial = await db.execute(stmt_partial)
            row = res_partial.first()

        # 3. Match by student Handle, PRN, or Email
        if not row:
            m_stmt = select(MemberProfile).where(
                (MemberProfile.handle.ilike(clean_handle)) |
                (MemberProfile.prn.ilike(clean_query)) |
                (MemberProfile.email.ilike(clean_query))
            )
            m_res = await db.execute(m_stmt)
            member = m_res.scalars().first()
            if member:
                target_contest = None
                if contest_slug:
                    c_stmt = select(OfflineContest).where(OfflineContest.slug == contest_slug)
                    c_res = await db.execute(c_stmt)
                    target_contest = c_res.scalars().first()
                if not target_contest:
                    c_stmt = select(OfflineContest).order_by(OfflineContest.starts_at.desc())
                    c_res = await db.execute(c_stmt)
                    target_contest = c_res.scalars().first()

                if target_contest:
                    p_stmt = select(CampusPass).where(
                        CampusPass.member_id == member.id,
                        CampusPass.contest_id == target_contest.id,
                    )
                    p_res = await db.execute(p_stmt)
                    c_pass = p_res.scalars().first()

                    reg_stmt = select(ContestRegistration).where(
                        ContestRegistration.contest_id == target_contest.id,
                        ContestRegistration.member_id == member.id,
                    )
                    reg_res = await db.execute(reg_stmt)
                    reg = reg_res.scalars().first()

                    # Air-Gap Security Gate Rule:
                    # 1. Candidate took assessment and scored outside Top 30 -> STRICT DENIAL
                    if reg and (reg.is_top_30_qualified is False or (reg.assessment_rank and reg.assessment_rank > 30)):
                        return PassVerifyResponse(
                            valid=False,
                            status="not_qualified",
                            message=f"Access Denied: Candidate {member.full_name} (@{member.handle}) scored rank #{reg.assessment_rank or 31} ({reg.assessment_score or 0} pts), which is below the Top 30 finalist cutoff. Physical lab access is restricted strictly to Top 30 finalists.",
                            handle=member.handle,
                            candidate_name=member.full_name or member.handle,
                            department=member.department or "CSE",
                            qualification_rank=reg.assessment_rank,
                            screening_score=reg.assessment_score,
                            contest_title=target_contest.title,
                            contest_slug=target_contest.slug,
                        )

                    # 2. Candidate is not registered for this contest -> STRICT DENIAL
                    if not reg:
                        return PassVerifyResponse(
                            valid=False,
                            status="unregistered",
                            message=f"Access Denied: Candidate {member.full_name} (@{member.handle}) is not registered for contest '{target_contest.title}'.",
                            handle=member.handle,
                            candidate_name=member.full_name or member.handle,
                            department=member.department or "CSE",
                            contest_title=target_contest.title,
                            contest_slug=target_contest.slug,
                        )

                    if not c_pass and reg.is_top_30_qualified:
                        cnt_stmt = select(CampusPass).where(CampusPass.contest_id == target_contest.id)
                        cnt_res = await db.execute(cnt_stmt)
                        pass_count = len(cnt_res.scalars().all())
                        seat_num = reg.seat_assigned or f"LAB-04-PC{pass_count + 1:02d}"
                        contest_pfx = target_contest.slug[:8].upper()
                        gen_pass_code = reg.campus_pass_code or f"CCC-{contest_pfx}-{(member.handle or 'CADET')[:4].upper()}-{pass_count + 1:02d}"
                        qr_payload = f"CCC-PASS:{gen_pass_code}:{member.id}:{seat_num}:QUALIFIED"

                        c_pass = CampusPass(
                            member_id=member.id,
                            contest_id=target_contest.id,
                            pass_code=gen_pass_code,
                            seat_number=seat_num,
                            qr_data=qr_payload,
                            check_in_status="issued",
                        )
                        db.add(c_pass)
                        reg.campus_pass_code = gen_pass_code
                        reg.seat_assigned = seat_num
                        await db.flush()

                    if c_pass:
                        row = (c_pass, target_contest, member)

        if not row:
            return PassVerifyResponse(
                valid=False,
                status="invalid_pass",
                message=f"No matching campus pass, registered cadet, or PRN found for query '{clean_query}'.",
                pass_code=clean_query,
            )

        c_pass, contest, member = row

        if contest_slug and contest.slug != contest_slug:
            return PassVerifyResponse(
                valid=False,
                status="wrong_contest",
                message=f"Pass is for contest '{contest.title}', not '{contest_slug}'.",
                pass_code=c_pass.pass_code,
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
                message=f"Candidate {member.full_name} (@{member.handle}) was ALREADY checked in at {c_pass.checked_in_at.strftime('%H:%M:%S') if c_pass.checked_in_at else 'earlier'} by {c_pass.checked_in_by or 'Proctor'}.",
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
        if reg:
            reg.checked_in_at = now

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
            pass

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
        limit: Optional[int] = None,
        offset: Optional[int] = 0,
    ) -> List[ContestAttendeeItem]:
        """Fetch all registered participants, screening candidates, and qualified finalists for proctor display."""
        contest_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == contest_slug))
        contest = contest_res.scalars().first()
        if not contest:
            return []

        # 1. Query all contest registrations joined with MemberProfile and outer-joined with CampusPass
        stmt_reg = (
            select(ContestRegistration, MemberProfile, CampusPass)
            .join(MemberProfile, ContestRegistration.member_id == MemberProfile.id)
            .outerjoin(
                CampusPass,
                (CampusPass.contest_id == ContestRegistration.contest_id) & (CampusPass.member_id == ContestRegistration.member_id)
            )
            .where(ContestRegistration.contest_id == contest.id)
            .order_by(
                desc(ContestRegistration.is_top_30_qualified),
                desc(ContestRegistration.assessment_score),
                ContestRegistration.registered_at.asc()
            )
        )

        start_idx = 1
        if limit is not None:
            from app.lib.pagination import normalize_pagination
            safe_limit, safe_offset = normalize_pagination(limit, offset, default_limit=200, max_limit=1000)
            stmt_reg = stmt_reg.limit(safe_limit).offset(safe_offset)
            start_idx = safe_offset + 1

        reg_result = await db.execute(stmt_reg)
        reg_rows = reg_result.all()

        seen_member_ids = set()
        attendees: List[ContestAttendeeItem] = []

        for idx, (reg, member, c_pass) in enumerate(reg_rows, start=start_idx):

            seen_member_ids.add(member.id)
            is_qualified = bool(reg.is_top_30_qualified or c_pass is not None)

            if c_pass and c_pass.check_in_status:
                check_in_status = c_pass.check_in_status
                checked_in_at = c_pass.checked_in_at
                checked_in_by = c_pass.checked_in_by
                seat_number = c_pass.seat_number or reg.seat_assigned or "UNASSIGNED"
                pass_code = c_pass.pass_code or reg.campus_pass_code or "—"
            elif reg.checked_in_at:
                check_in_status = "checked_in"
                checked_in_at = reg.checked_in_at
                checked_in_by = "Proctor Terminal"
                seat_number = reg.seat_assigned or "UNASSIGNED"
                pass_code = reg.campus_pass_code or "—"
            elif is_qualified:
                check_in_status = "issued"
                checked_in_at = None
                checked_in_by = None
                seat_number = reg.seat_assigned or "UNASSIGNED"
                pass_code = reg.campus_pass_code or "—"
            else:
                check_in_status = "registered"
                checked_in_at = None
                checked_in_by = None
                seat_number = reg.seat_assigned or "UNASSIGNED"
                pass_code = reg.campus_pass_code or "—"

            attendees.append(
                ContestAttendeeItem(
                    rank=reg.assessment_rank if reg.assessment_rank else idx,
                    handle=member.handle or f"cadet_{member.id[:6]}",
                    full_name=member.full_name or member.handle or "Cadet",
                    department=member.department or "CSE",
                    batch=member.batch or "2023-27",
                    seat_number=seat_number,
                    pass_code=pass_code,
                    check_in_status=check_in_status,
                    checked_in_at=checked_in_at,
                    checked_in_by=checked_in_by,
                    screening_score=reg.assessment_score if reg.assessment_score is not None else 0.0,
                    email=member.email,
                    prn=member.prn,
                    enrollment_number=member.prn or member.handle,
                    registered_at=reg.registered_at,
                    registration_status=reg.status or "confirmed",
                    assessment_taken=bool(reg.assessment_taken),
                    is_top_30_qualified=is_qualified,
                    rating=member.rating if member.rating is not None else 1200,
                )
            )

        # 2. Query any CampusPass entries for this contest whose member didn't have a ContestRegistration record
        stmt_pass = (
            select(CampusPass, MemberProfile)
            .join(MemberProfile, CampusPass.member_id == MemberProfile.id)
            .where(CampusPass.contest_id == contest.id)
            .order_by(CampusPass.seat_number)
        )
        pass_result = await db.execute(stmt_pass)
        pass_rows = pass_result.all()

        for c_pass, member in pass_rows:
            if member.id in seen_member_ids:
                continue
            seen_member_ids.add(member.id)
            attendees.append(
                ContestAttendeeItem(
                    rank=len(attendees) + 1,
                    handle=member.handle or f"cadet_{member.id[:6]}",
                    full_name=member.full_name or member.handle or "Cadet",
                    department=member.department or "CSE",
                    batch=member.batch or "2023-27",
                    seat_number=c_pass.seat_number or "UNASSIGNED",
                    pass_code=c_pass.pass_code or "—",
                    check_in_status=c_pass.check_in_status or "issued",
                    checked_in_at=c_pass.checked_in_at,
                    checked_in_by=c_pass.checked_in_by,
                    screening_score=100.0,
                    email=member.email,
                    prn=member.prn,
                    enrollment_number=member.prn or member.handle,
                    registered_at=c_pass.issued_at,
                    registration_status="confirmed",
                    assessment_taken=True,
                    is_top_30_qualified=True,
                    rating=member.rating if member.rating is not None else 1200,
                )
            )

        return attendees
