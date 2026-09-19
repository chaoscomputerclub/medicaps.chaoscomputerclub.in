"""
Chaos Computer Club — Dynamic Contest Management & Admin API Router
Endpoints for creating, updating, cloning, configuring, and publishing campus contests.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import get_db
from app.middleware.auth import require_admin_or_core
from app.models.db_models import (
    MemberProfile,
    OfflineContest,
    ContestRegistration,
    CampusPass,
    Assessment,
    AssessmentSession,
    now_utc,
)
from app.schemas.campus_pass import ContestAttendeeItem
from app.services.pass_service import PassService
from app.services.assessment_service import AssessmentService
from app.schemas.dynamic_contest import (
    DynamicContestCreateRequest,
    DynamicContestUpdateRequest,
    ProblemCreateSchema,
    ProblemSaveRequest,
    ProblemSyncRequest,
    AssessmentUpdateRequest,
    ContestAdminDetailResponse,
    ContestCloneRequest,
    PresetContestLaunchRequest,
    ContestStatusChangeRequest,
)
from app.services.dynamic_contest_service import DynamicContestService

router = APIRouter(prefix="/admin/contests", tags=["Admin Contest Management"])


@router.get(
    "",
    summary="List all contests for admin management",
)
async def list_admin_contests(
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """List all campus contests with administrative overview metrics."""
    stmt = (
        select(OfflineContest)
        .options(
            selectinload(OfflineContest.problems),
            selectinload(OfflineContest.assessment),
        )
        .order_by(OfflineContest.starts_at.desc())
    )
    result = await db.execute(stmt)
    contests = result.scalars().all()

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


@router.get(
    "/{slug}",
    summary="Fetch complete admin dossier for a contest",
    response_model=ContestAdminDetailResponse,
)
async def get_admin_contest(
    slug: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Fetch complete administrative details: contest, assessment, arena problems, and screening problems."""
    return await DynamicContestService.get_admin_contest_detail(slug, db)


@router.post(
    "",
    summary="Create dynamic contest, screening assessment, and problems",
    status_code=status.HTTP_201_CREATED,
)
async def create_dynamic_contest(
    payload: DynamicContestCreateRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """
    Production-grade dynamic contest creator.
    Atomically creates:
    - OfflineContest entity
    - Phase 1 Online Screening Assessment
    - Full mirrored problem challenge suite (Arena & Assessment)
    - Custom starter codes and sample/hidden test cases
    """
    return await DynamicContestService.create_contest(payload, db, creator=admin)


@router.put(
    "/{slug}",
    summary="Update contest specifications",
)
async def update_contest(
    slug: str,
    payload: DynamicContestUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Dynamically update contest details, schedule, venue, rules, or capacity."""
    return await DynamicContestService.update_contest(slug, payload, db)


@router.delete(
    "/{slug}",
    summary="Delete contest permanently",
)
async def delete_contest(
    slug: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Cascade delete a contest, its problems, submissions, screening rounds, and passes."""
    return await DynamicContestService.delete_contest(slug, db)


@router.put(
    "/{slug}/assessment",
    summary="Update or configure Phase 1 screening assessment",
)
async def update_contest_assessment(
    slug: str,
    payload: AssessmentUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Update or initialize the Phase 1 screening assessment linked to this contest."""
    return await DynamicContestService.update_assessment(slug, payload, db)


@router.post(
    "/{slug}/problems",
    summary="Add or update a problem challenge in contest and/or assessment",
)
async def add_or_update_problem(
    slug: str,
    payload: ProblemCreateSchema,
    target: Optional[str] = Query(None, description="Target collection: 'contest', 'assessment', or 'both'"),
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Add a new problem or replace an existing problem by index (A-F) in arena, assessment, or both."""
    resolved_target = getattr(payload, "target", None) or target or "both"
    return await DynamicContestService.add_or_update_problem(slug, payload, db, target=resolved_target)


@router.delete(
    "/{slug}/problems/{problem_index}",
    summary="Delete a problem challenge from contest and/or assessment",
)
async def delete_problem(
    slug: str,
    problem_index: str,
    target: Optional[str] = Query("both", description="Target collection: 'contest', 'assessment', or 'both'"),
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Delete a problem by its index letter (A, B, C, etc.) from arena, assessment, or both."""
    return await DynamicContestService.delete_problem(slug, problem_index, db, target=target or "both")


@router.post(
    "/{slug}/problems/sync",
    summary="Synchronize problems between contest arena and screening assessment",
)
async def sync_contest_problems(
    slug: str,
    payload: ProblemSyncRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """One-click synchronization of problems between contest arena and screening assessment."""
    return await DynamicContestService.sync_problems(slug, payload.direction, db)


@router.post(
    "/{slug}/clone",
    summary="Clone contest into a new edition",
    status_code=status.HTTP_201_CREATED,
)
async def clone_contest(
    slug: str,
    payload: ContestCloneRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Clone an existing contest's problem set and configuration into a newly scheduled contest."""
    return await DynamicContestService.clone_contest(slug, payload, db)


@router.patch(
    "/{slug}/status",
    summary="Transition contest lifecycle status",
)
@router.post(
    "/{slug}/status",
    summary="Transition contest lifecycle status",
)
async def change_contest_status(
    slug: str,
    payload: ContestStatusChangeRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """
    Transition contest status: upcoming -> live -> finished.
    When moving to live, automatically qualifies Top 30 scorers and issues Campus QR Passes.
    """
    return await DynamicContestService.change_contest_status(
        slug,
        payload.status,
        db,
        auto_qualify_top_30=payload.auto_qualify_top_30,
    )


@router.post(
    "/preset/launch",
    summary="One-click launch for Weekly / Biweekly contest presets",
    status_code=status.HTTP_201_CREATED,
)
async def launch_preset(
    payload: PresetContestLaunchRequest,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """One-click endpoint to deploy a complete Weekly or Biweekly contest edition with 4 curated challenges."""
    return await DynamicContestService.launch_preset(payload, db)


@router.get(
    "/{slug}/participants",
    summary="List all registered participants and dossier details for contest",
    response_model=List[ContestAttendeeItem],
)
async def list_admin_contest_participants(
    slug: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Retrieve full registered participant dossier, screening scores, and pass statuses."""
    return await PassService.list_contest_attendees(slug, db)


@router.post(
    "/{slug}/participants/register",
    summary="Manually register an enrolled cadet for contest",
)
async def admin_register_participant(
    slug: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Admin endpoint to manually register a student by handle, PRN, or email."""
    c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug))
    contest = c_res.scalars().first()
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

    # Check if already registered
    r_stmt = select(ContestRegistration).where(
        ContestRegistration.contest_id == contest.id,
        ContestRegistration.member_id == member.id,
    )
    r_res = await db.execute(r_stmt)
    reg = r_res.scalars().first()
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

    return {
        "status": "confirmed",
        "message": f"Successfully registered @{member.handle} ({member.full_name}) for {contest.title}.",
        "member_id": member.id,
        "handle": member.handle,
        "registered_count": contest.registered_count,
    }


@router.post(
    "/{slug}/seed-demo-participants",
    summary="Seed mock Medi-Caps participants for instant testing",
)
async def seed_demo_participants(
    slug: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """Seed 10 realistic Medi-Caps student participants with screening scores and PRNs."""
    c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug))
    contest = c_res.scalars().first()
    if not contest:
        raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

    demo_cadets = [
        {"handle": "santusht", "full_name": "Santusht Kotai", "prn": "EN23CS301927", "email": "en23cs301927@medicaps.ac.in", "dept": "CSE", "score": 98.5},
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

        r_stmt = select(ContestRegistration).where(
            ContestRegistration.contest_id == contest.id,
            ContestRegistration.member_id == member.id,
        )
        r_res = await db.execute(r_stmt)
        reg = r_res.scalars().first()
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
            p_stmt = select(CampusPass).where(
                CampusPass.member_id == member.id,
                CampusPass.contest_id == contest.id,
            )
            p_res = await db.execute(p_stmt)
            c_pass = p_res.scalars().first()
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
    return {
        "status": "success",
        "message": f"Successfully initialized {len(demo_cadets)} Medi-Caps participants for {contest.title}.",
        "added_count": added,
        "total_registered": contest.registered_count,
    }


@router.post(
    "/{slug}/simulate-100-cadets",
    summary="Production deep dive simulation: 100 cadets, Phase 1 screening, Top 30 QR issuance, and 70 eliminated",
)
async def simulate_100_cadets(
    slug: str,
    db: AsyncSession = Depends(get_db),
    admin: Optional[MemberProfile] = Depends(require_admin_or_core),
):
    """
    Automated deep dive simulation:
    1. Generates 100 realistic Medi-Caps student users with Indian names, PRNs, emails, and ratings.
    2. Registers all 100 for the contest.
    3. Completes Phase 1 screening assessment for all 100 cadets with deterministic score & penalty distributions.
    4. Evaluates Top 30 finalists: exactly 30 receive is_top_30_qualified=True and CampusPass records with seats LAB-04-PC01 to LAB-04-PC30.
    5. The remaining 70 cadets are marked is_top_30_qualified=False with ZERO passes.
    """
    c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug))
    contest = c_res.scalars().first()
    if not contest:
        raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

    # 1. Purge previous registrations & passes for this contest to ensure clean state
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

    qual_res = await AssessmentService.evaluate_and_qualify_top_30(contest.slug, db)

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


