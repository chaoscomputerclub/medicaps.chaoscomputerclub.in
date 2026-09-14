import uuid
"""
Chaos Computer Club — Assessment & Code Execution Router
Inspired by Interleet Judge Engine
"""

from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.middleware.auth import get_current_member
from app.engine.enums import Language, Verdict, ComparisonMode
from app.engine.executors.factory import get_executor
from app.engine.schemas import TestCaseSchema
from app.services.contest_lifecycle_service import (
    ASSESSMENT_DURATION_MINUTES,
    assessment_available,
    assessment_window,
    remaining_seconds as session_remaining_seconds,
    session_deadline,
)
from app.services.ranking_service import (
    build_ranking,
    cached_ranking,
    invalidate_ranking,
    ranking_released,
    withheld_payload,
)
from app.models.db_models import (
    OfflineContest,
    Assessment,
    ContestRegistration,
    AssessmentProblem,
    AssessmentSession,
    AssessmentSubmission,
    CampusPass,
    MemberProfile,
    now_utc,
)

router = APIRouter(prefix="/assessment", tags=["Assessment & Code Execution"])


# ─── Pydantic Request Models ──────────────────────────────────────────────────

class RunCodeRequest(BaseModel):
    problem_id: str
    language: Language
    code: str
    custom_stdin: Optional[str] = None


class SubmitCodeRequest(BaseModel):
    problem_id: str
    language: Language
    code: str


class TelemetryRequest(BaseModel):
    event_type: str  # "tab_switch", "window_blur", "fullscreen_exit"


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _normalize_testcase(tc: dict) -> dict:
    stdin_val = tc.get("stdin") if tc.get("stdin") is not None else tc.get("input", "")
    expected_out = tc.get("expected_output") if tc.get("expected_output") is not None else tc.get("output", "")
    return {
        "stdin": stdin_val,
        "input": stdin_val,
        "expected_output": expected_out,
        "output": expected_out,
        "explanation": tc.get("explanation"),
    }


def _public_problem_data(problem: AssessmentProblem) -> dict:
    """Return problem details without leaking hidden testcases."""
    return {
        "id": problem.id,
        "problem_index": problem.problem_index,
        "title": problem.title,
        "difficulty": problem.difficulty,
        "description": problem.description,
        "input_format": problem.input_format,
        "output_format": problem.output_format,
        "constraints": problem.constraints,
        "points": problem.points,
        "time_limit": problem.time_limit,
        "memory_limit": problem.memory_limit,
        "starter_codes": problem.starter_codes or {},
        "sample_testcases": [_normalize_testcase(s) for s in (problem.sample_testcases or [])],
    }



async def get_or_create_assessment(slug: str, db: AsyncSession) -> Assessment:
    """Find assessment by slug from database strictly."""
    result = await db.execute(select(Assessment).where(Assessment.slug == slug))
    assessment = result.scalars().first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment round not found.")
    return assessment

# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/{contest_slug}")
async def get_or_start_assessment(
    contest_slug: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve or initialize candidate assessment session."""
    # 1. Fetch or auto-provision assessment
    assessment = await get_or_create_assessment(contest_slug, db)

    # 1.1 Verify Contest Lifecycle & Candidate Contest Registration
    if assessment.contest_id:
        c_check = await db.execute(select(OfflineContest).where(OfflineContest.id == assessment.contest_id))
        contest = c_check.scalars().first()
        if contest:
            allowed, reason = assessment_available(contest.status, contest.starts_at)
            # An already-started session stays reachable so a candidate never
            # loses an in-flight attempt when the window edge is crossed.
            has_open_session = await db.execute(
                select(AssessmentSession).where(
                    AssessmentSession.assessment_id == assessment.id,
                    AssessmentSession.member_id == current_member.id,
                )
            )
            if not allowed and not has_open_session.scalars().first():
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=reason)

        reg_check = await db.execute(
            select(ContestRegistration).where(
                ContestRegistration.contest_id == assessment.contest_id,
                ContestRegistration.member_id == current_member.id,
            )
        )
        if not reg_check.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Contest registration required before entering the Phase 1 online screening assessment.",
            )

    # 2. Fetch or create session
    s_result = await db.execute(
        select(AssessmentSession).where(
            AssessmentSession.assessment_id == assessment.id,
            AssessmentSession.member_id == current_member.id,
        )
    )
    session = s_result.scalars().first()

    if not session:
        session = AssessmentSession(
            assessment_id=assessment.id,
            member_id=current_member.id,
            handle=current_member.handle or f"member_{current_member.id[:6]}",
            full_name=current_member.full_name or "Candidate",
            department=current_member.department or "CSE",
            batch=current_member.batch or "2023-27",
            started_at=now_utc(),
            status="in_progress",
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

    # 3. Calculate remaining seconds
    # The 2-hour session clock is anchored to the server-recorded start and can
    # never be paused, extended, or restarted.
    started_at = session.started_at
    expires_at = session_deadline(started_at)
    remaining_seconds = session_remaining_seconds(started_at)

    if remaining_seconds <= 0 and session.status == "in_progress":
        session.status = "submitted"
        session.submitted_at = expires_at
        await db.commit()

    # 4. Fetch problems
    p_result = await db.execute(
        select(AssessmentProblem)
        .where(AssessmentProblem.assessment_id == assessment.id)
        .order_by(AssessmentProblem.problem_index)
    )
    problems = p_result.scalars().all()

    # 5. Fetch previous submissions for this session
    sub_result = await db.execute(
        select(AssessmentSubmission).where(AssessmentSubmission.session_id == session.id)
    )
    submissions = sub_result.scalars().all()
    sub_map = {}
    for s in submissions:
        # Keep best or latest submission per problem
        if s.problem_id not in sub_map or s.score > sub_map[s.problem_id]["score"]:
            sub_map[s.problem_id] = {
                "id": s.id,
                "language": s.language,
                "verdict": s.verdict,
                "score": s.score,
                "code": s.code,
                "submitted_at": s.submitted_at.isoformat(),
            }

    return {
        "assessment": {
            "id": assessment.id,
            "slug": assessment.slug,
            "title": assessment.title,
            "summary": assessment.summary,
            "duration_minutes": ASSESSMENT_DURATION_MINUTES,
            "max_violations": assessment.max_violations,
            "window": assessment_window(
                contest.starts_at
            ).as_dict() if assessment.contest_id and contest else None,
        },
        "session": {
            "id": session.id,
            "status": session.status,
            "started_at": session.started_at.isoformat(),
            "remaining_seconds": remaining_seconds,
            "total_score": session.total_score,
            "anti_cheat_violations": session.anti_cheat_violations,
            "is_top_30_qualified": session.is_top_30_qualified,
        },
        "problems": [_public_problem_data(p) for p in problems],
        "submissions": sub_map,
    }


@router.post("/{contest_slug}/run")
async def run_sample_code(
    contest_slug: str,
    payload: RunCodeRequest,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Run code against sample testcases or custom stdin."""
    p_result = await db.execute(select(AssessmentProblem).where(AssessmentProblem.id == payload.problem_id))
    problem = p_result.scalars().first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found.")

    executor = get_executor(payload.language)

    if payload.custom_stdin is not None:
        # Single custom testcase run
        tcs = [TestCaseSchema(id="custom", stdin=payload.custom_stdin, expected_output="")]
    else:
        # Run against problem's visible sample testcases
        sample_list = problem.sample_testcases or []
        tcs = [
            TestCaseSchema(
                id=f"sample_{i+1}",
                name=f"Sample Test {i+1}",
                stdin=s.get("stdin") if s.get("stdin") is not None else s.get("input", ""),
                expected_output=s.get("expected_output") if s.get("expected_output") is not None else s.get("output", ""),
            )
            for i, s in enumerate(sample_list)
        ]

    exec_result = await executor.execute_batch(
        code=payload.code,
        testcases=tcs,
        time_limit=problem.time_limit,
        memory_limit_mb=problem.memory_limit,
        comparison_mode=ComparisonMode.TRIMMED,
    )

    return {
        "success": exec_result.success,
        "verdict": exec_result.verdict,
        "stdout": exec_result.stdout,
        "stderr": exec_result.stderr,
        "compile_output": exec_result.compile_output,
        "time": exec_result.time,
        "memory": exec_result.memory,
        "passed_testcases": exec_result.passed_testcases,
        "total_testcases": exec_result.total_testcases,
        "score": exec_result.score,
        "testcase_results": [
            {
                "testcase_id": tr.testcase_id,
                "name": tr.name,
                "passed": tr.passed,
                "verdict": tr.verdict,
                "stdout": tr.stdout,
                "expected_output": tr.expected_output,
                "stderr": tr.stderr,
                "wall_time_ms": tr.wall_time_ms,
            }
            for tr in exec_result.testcase_results
        ],
    }


@router.post("/{contest_slug}/submit")
async def submit_assessment_code(
    contest_slug: str,
    payload: SubmitCodeRequest,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Submit code for official assessment evaluation against all testcases."""
    # 1. Fetch problem & session
    p_result = await db.execute(select(AssessmentProblem).where(AssessmentProblem.id == payload.problem_id))
    problem = p_result.scalars().first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found.")

    s_result = await db.execute(
        select(AssessmentSession).where(
            AssessmentSession.assessment_id == problem.assessment_id,
            AssessmentSession.member_id == current_member.id,
        )
    )
    session = s_result.scalars().first()
    if not session or session.status != "in_progress":
        raise HTTPException(status_code=400, detail="Assessment session is not currently active.")

    # 2. Assemble complete testcases (samples + hidden)
    all_tcs: list[TestCaseSchema] = []
    samples = problem.sample_testcases or []
    for i, s in enumerate(samples):
        all_tcs.append(
            TestCaseSchema(
                id=f"sample_{i+1}",
                name=f"Sample {i+1}",
                stdin=s.get("stdin") if s.get("stdin") is not None else s.get("input", ""),
                expected_output=s.get("expected_output") if s.get("expected_output") is not None else s.get("output", ""),
                hidden=False,
                weight=1.0,
            )
        )

    hidden = problem.hidden_testcases or []
    for i, h in enumerate(hidden):
        all_tcs.append(
            TestCaseSchema(
                id=f"hidden_{i+1}",
                name=f"Testcase {len(samples) + i + 1}",
                stdin=h.get("stdin") if h.get("stdin") is not None else h.get("input", ""),
                expected_output=h.get("expected_output") if h.get("expected_output") is not None else h.get("output", ""),
                hidden=True,
                weight=h.get("weight", 2.0),
            )
        )

    # 3. Execute via Interleet engine
    executor = get_executor(payload.language)
    exec_result = await executor.execute_batch(
        code=payload.code,
        testcases=all_tcs,
        time_limit=problem.time_limit,
        memory_limit_mb=problem.memory_limit,
    )

    # 4. Calculate points earned on this problem
    points_earned = round((exec_result.score / 100.0) * problem.points, 2)

    # 5. Persist submission
    submission = AssessmentSubmission(
        session_id=session.id,
        problem_id=problem.id,
        member_id=current_member.id,
        language=payload.language.value,
        code=payload.code,
        verdict=exec_result.verdict.value,
        score=points_earned,
        runtime_ms=round(exec_result.time * 1000.0, 2),
        memory_mb=exec_result.memory,
        testcase_results=[
            {
                "testcase_id": tr.testcase_id,
                "name": tr.name,
                "passed": tr.passed,
                "verdict": tr.verdict.value,
                "hidden": tr.hidden,
                "stdout": tr.stdout if not tr.hidden else "",
                "expected_output": tr.expected_output if not tr.hidden else "",
                "wall_time_ms": tr.wall_time_ms,
            }
            for tr in exec_result.testcase_results
        ],
        submitted_at=now_utc(),
    )
    db.add(submission)

    # 6. Recalculate session total score (best score per problem)
    all_subs_result = await db.execute(
        select(AssessmentSubmission).where(AssessmentSubmission.session_id == session.id)
    )
    existing_subs = all_subs_result.scalars().all()
    best_per_prob = {}
    for s in existing_subs + [submission]:
        if s.problem_id not in best_per_prob or s.score > best_per_prob[s.problem_id]:
            best_per_prob[s.problem_id] = s.score

    session.total_score = round(sum(best_per_prob.values()), 2)
    started_at = session.started_at.replace(tzinfo=timezone.utc) if session.started_at.tzinfo is None else session.started_at
    session.total_penalty_seconds = int((now_utc() - started_at).total_seconds())

    await db.commit()
    await invalidate_ranking(contest_slug)

    return {
        "verdict": exec_result.verdict,
        "score": points_earned,
        "max_points": problem.points,
        "passed_testcases": exec_result.passed_testcases,
        "total_testcases": exec_result.total_testcases,
        "runtime_ms": round(exec_result.time * 1000.0, 2),
        "memory_mb": exec_result.memory,
        "testcase_results": [
            {
                "testcase_id": tr.testcase_id,
                "name": tr.name,
                "passed": tr.passed,
                "verdict": tr.verdict,
                "hidden": tr.hidden,
                "stdout": tr.stdout if not tr.hidden else "(hidden testcase)",
                "expected_output": tr.expected_output if not tr.hidden else "(hidden testcase)",
                "wall_time_ms": tr.wall_time_ms,
            }
            for tr in exec_result.testcase_results
        ],
    }


@router.post("/{contest_slug}/telemetry")
async def report_anti_cheat_event(
    contest_slug: str,
    payload: TelemetryRequest,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Log tab switch / window blur event."""
    assessment = await get_or_create_assessment(contest_slug, db)

    s_result = await db.execute(
        select(AssessmentSession).where(
            AssessmentSession.assessment_id == assessment.id,
            AssessmentSession.member_id == current_member.id,
        )
    )
    session = s_result.scalars().first()
    if session and session.status == "in_progress":
        session.anti_cheat_violations += 1
        is_disqualified = session.anti_cheat_violations >= assessment.max_violations
        if is_disqualified:
            session.status = "disqualified"
        await db.commit()
        return {
            "violations": session.anti_cheat_violations,
            "max_violations": assessment.max_violations,
            "is_disqualified": is_disqualified,
        }

    return {"violations": 0, "max_violations": 3, "is_disqualified": False}


@router.post("/{contest_slug}/finish")
async def finish_assessment(
    contest_slug: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Candidate manually finishes the assessment."""
    assessment = await get_or_create_assessment(contest_slug, db)

    s_result = await db.execute(
        select(AssessmentSession).where(
            AssessmentSession.assessment_id == assessment.id,
            AssessmentSession.member_id == current_member.id,
        )
    )
    session = s_result.scalars().first()
    if session and session.status == "in_progress":
        session.status = "submitted"
        session.submitted_at = now_utc()
        await db.commit()
        await invalidate_ranking(contest_slug)

    return {"success": True, "total_score": session.total_score if session else 0}


@router.get("/{contest_slug}/leaderboard")
async def get_assessment_leaderboard(
    contest_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Round 1 ranking, served from cache.

    Sealed until the 24-hour entry window closes, then published in full with
    the exact Top 30 cutoff.
    """
    assessment = await get_or_create_assessment(contest_slug, db)

    contest_result = await db.execute(
        select(OfflineContest).where(OfflineContest.slug == contest_slug)
    )
    contest = contest_result.scalars().first()

    if contest is not None and not ranking_released(contest.starts_at):
        payload = withheld_payload(contest_slug, contest.starts_at)
        payload["assessment_title"] = assessment.title
        return payload

    async def compute() -> dict:
        s_result = await db.execute(
            select(AssessmentSession).where(
                AssessmentSession.assessment_id == assessment.id,
                AssessmentSession.status.in_(["in_progress", "submitted"]),
            )
        )
        payload = build_ranking(s_result.scalars().all(), contest_slug)
        payload["assessment_title"] = assessment.title
        payload["released"] = True
        return payload

    return await cached_ranking(contest_slug, compute)


@router.post("/{contest_slug}/qualify-top30")
async def qualify_top_30(
    contest_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Core Organizer Action: Freezes assessment rankings and auto-issues Digital Campus QR Passes."""
    assessment = await get_or_create_assessment(contest_slug, db)

    s_result = await db.execute(
        select(AssessmentSession)
        .where(
            AssessmentSession.assessment_id == assessment.id,
            AssessmentSession.status != "disqualified",
        )
        .order_by(desc(AssessmentSession.total_score), AssessmentSession.total_penalty_seconds)
        .limit(30)
    )
    top_30_sessions = s_result.scalars().all()

    issued_passes = []
    for idx, s in enumerate(top_30_sessions, start=1):
        s.is_top_30_qualified = True
        seat_num = f"LAB-04-PC{idx:02d}"

        # Generate or update CampusPass
        pass_code = f"CCC-MCU-26-{s.handle[:4].upper()}-{idx:02d}"
        qr_payload = f"CCC-PASS:{pass_code}:{s.member_id}:{seat_num}:OFFLINE-QUALIFIED"

        # Upsert pass
        pass_result = await db.execute(
            select(CampusPass).where(
                CampusPass.member_id == s.member_id,
                CampusPass.contest_id == assessment.id,
            )
        )
        c_pass = pass_result.scalars().first()
        if not c_pass:
            c_pass = CampusPass(
                member_id=s.member_id,
                contest_id=assessment.id,
                pass_code=pass_code,
                seat_number=seat_num,
                qr_data=qr_payload,
                check_in_status="issued",
            )
            db.add(c_pass)
        else:
            c_pass.seat_number = seat_num
            c_pass.qr_data = qr_payload

        issued_passes.append({
            "rank": idx,
            "handle": s.handle,
            "seat_number": seat_num,
            "pass_code": pass_code,
        })

    await db.commit()

    return {
        "success": True,
        "qualified_count": len(issued_passes),
        "qualifiers": issued_passes,
    }
