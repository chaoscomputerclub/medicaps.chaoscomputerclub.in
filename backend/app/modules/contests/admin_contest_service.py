"""
Chaos Computer Club — Medi-Caps Chapter
modules/contests/admin_contest_service.py — Proctor & Admin Contest Operations Application Service
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select

from app.core.cache import delete_cache_pattern
from app.lib.pagination import normalize_pagination, inject_pagination_headers
from app.models.db_models import (
    AssessmentSession,
    CampusPass,
    ContestProblem,
    ContestRegistration,
    MemberProfile,
    OfflineContest,
    now_utc,
)
from app.core.config import settings
from app.modules.contests.contest_repository import ContestRepository
from app.services.assessment_service import AssessmentService
from app.services.event_broadcaster import broadcast_event

logger = logging.getLogger(__name__)


class AdminContestService:
    """Operations service for proctors and contest administrators."""

    @staticmethod
    async def list_admin_contests(
        db: AsyncSession,
        limit: Optional[int] = None,
        offset: Optional[int] = 0,
        response: Optional[Response] = None,
    ) -> List[Dict[str, Any]]:
        safe_limit = None
        safe_offset = 0
        if limit is not None:
            safe_limit, safe_offset = normalize_pagination(limit, offset, default_limit=100, max_limit=500)

        contests, total_count = await ContestRepository.list_admin_contests(db, limit=safe_limit, offset=safe_offset)

        if limit is not None and response:
            inject_pagination_headers(response, total_count, safe_limit, safe_offset)

        payload = []
        for c in contests:
            payload.append({
                "id": c.id,
                "slug": c.slug,
                "title": c.title,
                "season": c.season,
                "status": c.status,
                "division": c.division,
                "cadence": c.cadence,
                "edition": c.edition,
                "starts_at": c.starts_at.isoformat() if c.starts_at else None,
                "ends_at": c.ends_at.isoformat() if c.ends_at else None,
                "check_in_opens_at": c.check_in_opens_at.isoformat() if c.check_in_opens_at else None,
                "venue": c.venue,
                "seat_capacity": c.seat_capacity,
                "registered_count": c.registered_count,
                "problem_count": len(c.problems) if c.problems else 0,
                "has_assessment": c.assessment is not None,
                "assessment_duration": c.assessment.duration_minutes if c.assessment else None,
                "assessment_active": c.assessment.is_active if c.assessment else False,
                "environment": c.environment,
                "summary": c.summary,
                "rules": c.rules or [],
            })
        return payload

    @staticmethod
    async def list_admin_contest_problems(slug: str, db: AsyncSession) -> List[Any]:
        contest = await ContestRepository.get_by_slug(db, slug)
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")
        records = await ContestRepository.get_contest_problems(db, contest.id)
        return list(records)

    @staticmethod
    async def admin_register_participant(
        slug: str,
        payload: Dict[str, Any],
        db: AsyncSession,
    ) -> Dict[str, Any]:
        contest = await ContestRepository.get_by_slug(db, slug)
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        identifier = str(payload.get("identifier") or payload.get("handle") or "").strip()
        clean_handle = identifier.lstrip("@").strip()
        if not clean_handle:
            raise HTTPException(status_code=400, detail="Student identifier (handle, PRN, or email) is required.")

        m_stmt = select(MemberProfile).where(
            (MemberProfile.handle.ilike(clean_handle)) |
            (MemberProfile.prn.ilike(identifier)) |
            (MemberProfile.email.ilike(identifier))
        )
        m_res = await db.execute(m_stmt)
        member = m_res.scalars().first()
        if not member:
            raise HTTPException(status_code=404, detail=f"No student found with identifier '{identifier}'.")

        reg = await ContestRepository.get_registration(db, contest.id, member.id)
        if reg:
            return {
                "status": "already_registered",
                "message": f"Cadet @{member.handle} ({member.full_name}) is already registered.",
                "member_id": member.id,
                "handle": member.handle,
            }

        new_reg = ContestRegistration(
            contest_id=contest.id,
            member_id=member.id,
            status="confirmed",
        )
        db.add(new_reg)
        contest.registered_count += 1
        await db.commit()

        await delete_cache_pattern("cache:contest*")
        await delete_cache_pattern("cache:contests*")
        await delete_cache_pattern(f"cache:*:{member.id}:*")
        await delete_cache_pattern("cache:passes*")

        try:
            await broadcast_event(
                event_type="contest_registered",
                data={
                    "contest_slug": contest.slug,
                    "contest_title": contest.title,
                    "member_id": member.id,
                    "handle": member.handle,
                    "full_name": member.full_name or member.handle,
                    "registered_count": contest.registered_count,
                    "capacity": contest.seat_capacity,
                    "status": "confirmed",
                },
                contest_slug=contest.slug,
            )
        except Exception:
            pass

        return {
            "status": "confirmed",
            "message": f"Successfully registered @{member.handle} ({member.full_name}) for {contest.title}.",
            "member_id": member.id,
            "handle": member.handle,
            "registered_count": contest.registered_count,
        }

    @staticmethod
    async def seed_demo_participants(slug: str, db: AsyncSession) -> Dict[str, Any]:
        contest = await ContestRepository.get_by_slug(db, slug)
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        demo_cadets = [
            {"handle": "santusht", "full_name": "Santusht Kotai", "prn": "EN23CS301927", "email": settings.ADMIN_PRIMARY_EMAIL, "dept": "CSE", "score": 98.5},
            {"handle": "aarav_sharma", "full_name": "Aarav Sharma", "prn": "EN23CS301042", "email": "aarav.sharma@medicaps.ac.in", "dept": "CSE", "score": 94.0},
            {"handle": "priya_patel", "full_name": "Priya Patel", "prn": "EN23IT301118", "email": "priya.patel@medicaps.ac.in", "dept": "IT", "score": 91.5},
            {"handle": "rohan_verma", "full_name": "Rohan Verma", "prn": "EN23CS301205", "email": "rohan.verma@medicaps.ac.in", "dept": "Cyber Security", "score": 88.0},
            {"handle": "ananya_singh", "full_name": "Ananya Singh", "prn": "EN24AI301012", "email": "ananya.singh@medicaps.ac.in", "dept": "AIDS", "score": 86.5},
            {"handle": "vikram_aditya", "full_name": "Vikram Aditya", "prn": "EN22CS301088", "email": "vikram.aditya@medicaps.ac.in", "dept": "CSE", "score": 82.0},
            {"handle": "sneha_reddy", "full_name": "Sneha Reddy", "prn": "EN23IT301064", "email": "sneha.reddy@medicaps.ac.in", "dept": "IT", "score": 79.5},
            {"handle": "dev_malhotra", "full_name": "Dev Malhotra", "prn": "EN24CS301310", "email": "dev.malhotra@medicaps.ac.in", "dept": "CSE", "score": 76.0},
            {"handle": "ishita_gupta", "full_name": "Ishita Gupta", "prn": "EN23CS301150", "email": "ishita.gupta@medicaps.ac.in", "dept": "Cyber Security", "score": 73.0},
            {"handle": "kabir_joshi", "full_name": "Kabir Joshi", "prn": "EN24IT301099", "email": "kabir.joshi@medicaps.ac.in", "dept": "IT", "score": 69.5},
        ]

        added = 0
        for idx, cadet_data in enumerate(demo_cadets, start=1):
            m_stmt = select(MemberProfile).where(
                (MemberProfile.handle == cadet_data["handle"]) | (MemberProfile.email == cadet_data["email"])
            )
            m_res = await db.execute(m_stmt)
            member = m_res.scalars().first()
            if not member:
                member = MemberProfile(
                    handle=cadet_data["handle"],
                    full_name=cadet_data["full_name"],
                    email=cadet_data["email"],
                    prn=cadet_data["prn"],
                    department=cadet_data["dept"],
                    batch="2023-27",
                    rating=1200 + int(cadet_data["score"] * 5),
                    is_onboarded=True,
                )
                db.add(member)
                await db.flush()

            reg = await ContestRepository.get_registration(db, contest.id, member.id)
            is_top30 = idx <= 5
            seat_num = f"LAB-04-PC{idx:02d}" if is_top30 else None
            pass_code = f"CCC-{contest.slug[:8].upper()}-{member.handle[:4].upper()}-{idx:02d}" if is_top30 else None

            if not reg:
                reg = ContestRegistration(
                    contest_id=contest.id,
                    member_id=member.id,
                    status="confirmed",
                    assessment_taken=True,
                    assessment_score=cadet_data["score"],
                    assessment_rank=idx,
                    is_top_30_qualified=is_top30,
                    seat_assigned=seat_num,
                    campus_pass_code=pass_code,
                )
                db.add(reg)
                contest.registered_count += 1
                added += 1
            else:
                reg.assessment_taken = True
                reg.assessment_score = cadet_data["score"]
                reg.assessment_rank = idx
                reg.is_top_30_qualified = is_top30
                reg.seat_assigned = seat_num
                reg.campus_pass_code = pass_code

            if is_top30:
                c_pass = await ContestRepository.get_campus_pass(db, contest.id, member.id)
                if not c_pass:
                    c_pass = CampusPass(
                        member_id=member.id,
                        contest_id=contest.id,
                        pass_code=pass_code,
                        seat_number=seat_num,
                        qr_data=f"CCC-PASS:{pass_code}:{member.id}:{seat_num}:QUALIFIED",
                        check_in_status="issued" if idx > 2 else "checked_in",
                        checked_in_at=now_utc() if idx <= 2 else None,
                        checked_in_by="Proctor Station 1" if idx <= 2 else None,
                    )
                    db.add(c_pass)

        await db.commit()
        await delete_cache_pattern("cache:contest*")
        await delete_cache_pattern("cache:contests*")
        await delete_cache_pattern("cache:passes*")

        try:
            await broadcast_event(
                event_type="contest_updated",
                data={
                    "contest_slug": contest.slug,
                    "contest_title": contest.title,
                    "status": contest.status,
                    "registered_count": contest.registered_count,
                    "change": "demo_participants_seeded",
                },
                contest_slug=contest.slug,
            )
        except Exception:
            pass

        return {
            "status": "success",
            "message": f"Successfully initialized {len(demo_cadets)} Medi-Caps participants for {contest.title}.",
            "added_count": added,
            "total_registered": contest.registered_count,
        }

    @staticmethod
    async def simulate_100_cadets(slug: str, db: AsyncSession) -> Dict[str, Any]:
        contest = await ContestRepository.get_by_slug(db, slug)
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        await db.execute(delete(CampusPass).where(CampusPass.contest_id == contest.id))
        await db.execute(delete(ContestRegistration).where(ContestRegistration.contest_id == contest.id))

        assessment, _ = await AssessmentService.get_or_create_assessment_for_contest(contest.slug, db)
        await db.execute(delete(AssessmentSession).where(AssessmentSession.assessment_id == assessment.id))
        contest.registered_count = 0
        await db.commit()

        FIRST_NAMES = [
            "Aarav", "Priya", "Rohan", "Ananya", "Vikram", "Sneha", "Dev", "Ishita", "Kabir", "Riya",
            "Aditya", "Tanvi", "Siddharth", "Meera", "Aryan", "Diya", "Yash", "Pooja", "Varun", "Shreya",
            "Aman", "Neha", "Karan", "Natasha", "Arjun", "Kriti", "Rahul", "Simran", "Nikhil", "Avani",
            "Gaurav", "Swati", "Rajat", "Alia", "Manish", "Divya", "Tarun", "Bhavna", "Kunal", "Payal",
            "Sameer", "Tara", "Harsh", "Sakshi", "Abhishek", "Ritika", "Pranav", "Kavya", "Mohit", "Deepika"
        ]
        LAST_NAMES = [
            "Sharma", "Patel", "Verma", "Singh", "Aditya", "Reddy", "Malhotra", "Gupta", "Joshi", "Sen",
            "Rao", "Bhat", "Nair", "Iyer", "Kapoor", "Mehta", "Kulkarni", "Hegde", "Dhawan", "Ghoshal"
        ]

        all_members = []
        for i in range(1, 101):
            dept = "CSE" if i <= 40 else "IT" if i <= 65 else "Cyber Security" if i <= 85 else "AIDS"
            prn = f"EN23SIM{i:04d}"
            first_name = FIRST_NAMES[(i - 1) % len(FIRST_NAMES)]
            last_name = LAST_NAMES[((i - 1) * 3) % len(LAST_NAMES)]
            full_name = f"{first_name} {last_name}"
            handle = f"cadet_{i:03d}"
            email = f"cadet_{i:03d}@medicaps.ac.in"

            if i <= 10:
                score = round(99.5 - (i - 1) * 0.75, 1)
            elif i <= 30:
                score = round(91.0 - (i - 11) * 0.95, 1)
            elif i <= 70:
                score = round(71.0 - (i - 31) * 0.75, 1)
            else:
                score = round(40.0 - (i - 71) * 1.0, 1)

            penalty = 600 + i * 95

            m_res = await db.execute(
                select(MemberProfile).where(
                    (MemberProfile.prn == prn) | (MemberProfile.handle == handle) | (MemberProfile.email == email)
                )
            )
            member = m_res.scalars().first()
            if not member:
                member = MemberProfile(
                    handle=handle,
                    full_name=full_name,
                    email=email,
                    prn=prn,
                    department=dept,
                    batch="2023-27" if i % 2 == 0 else "2024-28",
                    rating=1200 + int(score * 6),
                    is_onboarded=True,
                )
                db.add(member)
                await db.flush()
            else:
                member.handle = handle
                member.full_name = full_name
                member.email = email
                member.prn = prn
                member.department = dept
                member.rating = 1200 + int(score * 6)

            all_members.append((member, score, penalty))

            reg = ContestRegistration(
                contest_id=contest.id,
                member_id=member.id,
                status="confirmed",
                registered_at=now_utc(),
                assessment_taken=True,
                assessment_score=score,
            )
            db.add(reg)

            session = AssessmentSession(
                assessment_id=assessment.id,
                member_id=member.id,
                handle=member.handle,
                full_name=member.full_name,
                department=dept,
                batch=member.batch or "2023-27",
                started_at=now_utc(),
                submitted_at=now_utc(),
                status="submitted",
                total_score=score,
                total_penalty_seconds=penalty,
                anti_cheat_violations=0,
                is_top_30_qualified=False,
            )
            db.add(session)

        contest.registered_count = 100
        await db.commit()

        await delete_cache_pattern("cache:contest*")
        await delete_cache_pattern("cache:contests*")
        await delete_cache_pattern("cache:passes*")

        try:
            await broadcast_event(
                event_type="contest_updated",
                data={
                    "contest_slug": contest.slug,
                    "contest_title": contest.title,
                    "status": contest.status,
                    "registered_count": contest.registered_count,
                    "change": "simulation_100_cadets_completed",
                },
                contest_slug=contest.slug,
            )
        except Exception:
            pass

        await AssessmentService.evaluate_and_qualify_top_30(contest.slug, db)

        top_passes_res = await db.execute(
            select(CampusPass).where(CampusPass.contest_id == contest.id).order_by(CampusPass.seat_number.asc())
        )
        passes = top_passes_res.scalars().all()

        return {
            "status": "success",
            "contest_slug": contest.slug,
            "contest_title": contest.title,
            "total_cadets_registered": 100,
            "total_assessments_submitted": 100,
            "top_30_qualified_count": len(passes),
            "eliminated_unqualified_count": 100 - len(passes),
            "qualifier_rank_1": {
                "handle": all_members[0][0].handle,
                "name": all_members[0][0].full_name,
                "prn": all_members[0][0].prn,
                "score": all_members[0][1],
                "seat_number": "LAB-04-PC01",
                "pass_code": passes[0].pass_code if passes else None,
                "qr_data": passes[0].qr_data if passes else None,
            },
            "cutoff_rank_30": {
                "handle": all_members[29][0].handle,
                "name": all_members[29][0].full_name,
                "prn": all_members[29][0].prn,
                "score": all_members[29][1],
                "seat_number": "LAB-04-PC30",
                "pass_code": passes[29].pass_code if len(passes) >= 30 else None,
            },
            "eliminated_rank_31": {
                "handle": all_members[30][0].handle,
                "name": all_members[30][0].full_name,
                "prn": all_members[30][0].prn,
                "score": all_members[30][1],
                "is_top_30_qualified": False,
                "has_pass": False,
            },
            "last_cadet_rank_100": {
                "handle": all_members[99][0].handle,
                "name": all_members[99][0].full_name,
                "prn": all_members[99][0].prn,
                "score": all_members[99][1],
                "is_top_30_qualified": False,
                "has_pass": False,
            },
        }
