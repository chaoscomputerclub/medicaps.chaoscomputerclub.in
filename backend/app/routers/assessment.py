"""
Chaos Computer Club — Assessment & Code Execution Router
Powered by CodeBox Execution Engine & Decoupled Assessment Service
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import select, desc, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.middleware.auth import get_current_member
from app.middleware.rate_limit import rate_limit
from app.middleware.assessment_guard import require_active_assessment_session
from app.engine.enums import Language, Verdict, ComparisonMode
from app.engine.providers.factory import get_judge_provider
from app.engine.schemas import TestCaseSchema
from app.services.assessment_service import AssessmentService
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


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/{contest_slug}")
async def get_or_start_assessment(
    contest_slug: str,
    response: Response,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve candidate assessment status or active session.
    If the window has not opened yet, returns waiting metadata with opens_in countdown.
    If open, returns/initializes the active session with problems and starter code.
    If already submitted, returns finalized completed state.
    """
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return await AssessmentService.get_assessment_status(contest_slug, current_member, db)


@router.post("/{contest_slug}/run")
async def run_sample_code(
    request: Request,
    contest_slug: str,
    payload: RunCodeRequest,
    active_guard: tuple = Depends(require_active_assessment_session),
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
    _rl: None = Depends(rate_limit("assessment:run", max_calls=30, window_seconds=60)),
):
    """Run code against sample testcases or custom stdin using the CodeBox engine. Blocked if already submitted."""
    session, assessment, _ = active_guard
    p_result = await db.execute(select(AssessmentProblem).where(AssessmentProblem.id == payload.problem_id))
    problem = p_result.scalars().first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found.")

    if payload.custom_stdin is not None:
        tcs = [TestCaseSchema(id="custom", stdin=payload.custom_stdin, expected_output="")]
    else:
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

    provider = get_judge_provider()
    exec_result = await provider.execute_batch(
        language=payload.language,
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
    request: Request,
    contest_slug: str,
    payload: SubmitCodeRequest,
    active_guard: tuple = Depends(require_active_assessment_session),
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
    _rl: None = Depends(rate_limit("assessment:submit", max_calls=10, window_seconds=60)),
):
    """Submit code for official assessment evaluation against all testcases on CodeBox. Blocked if already submitted."""
    session, assessment, contest = active_guard
    # 1. Fetch problem & session
    p_result = await db.execute(select(AssessmentProblem).where(AssessmentProblem.id == payload.problem_id))
    problem = p_result.scalars().first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found.")

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

    # 3. Execute via CodeBox Judge Engine
    provider = get_judge_provider()
    exec_result = await provider.execute_batch(
        language=payload.language,
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
    assessment, _ = await AssessmentService.get_or_create_assessment_for_contest(contest_slug, db)

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
    assessment, contest = await AssessmentService.get_or_create_assessment_for_contest(contest_slug, db)

    s_result = await db.execute(
        select(AssessmentSession).where(
            AssessmentSession.assessment_id == assessment.id,
            AssessmentSession.member_id == current_member.id,
        )
    )
    session = s_result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found.")

    if session.status == "submitted":
        return {
            "success": True,
            "already_submitted": True,
            "message": "Assessment already submitted.",
            "total_score": session.total_score,
        }

    if session.status == "in_progress":
        session.status = "submitted"
        session.submitted_at = now_utc()

        # Sync ContestRegistration
        if contest:
            reg_stmt = select(ContestRegistration).where(
                ContestRegistration.contest_id == contest.id,
                ContestRegistration.member_id == current_member.id,
            )
            reg_res = await db.execute(reg_stmt)
            reg = reg_res.scalars().first()
            if not reg:
                reg = ContestRegistration(
                    contest_id=contest.id,
                    member_id=current_member.id,
                    registered_at=now_utc(),
                    assessment_taken=True,
                    assessment_score=session.total_score,
                )
                db.add(reg)
            else:
                reg.assessment_taken = True
                reg.assessment_score = session.total_score

        await db.commit()
        await invalidate_ranking(contest_slug)
        if contest:
            try:
                await AssessmentService.evaluate_and_qualify_top_30(contest_slug, db)
            except Exception:
                pass
        try:
            from app.core.cache import delete_cache_pattern
            await delete_cache_pattern("cache:*")
        except Exception:
            pass

    return {"success": True, "total_score": session.total_score if session else 0}


@router.get("/{contest_slug}/leaderboard")
async def get_assessment_leaderboard(
    contest_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Round 1 ranking, served from cache.
    Sealed until the screening window closes, then published in full with the exact Top 30 cutoff.
    """
    assessment, contest = await AssessmentService.get_or_create_assessment_for_contest(contest_slug, db)

    if contest is not None and not ranking_released(contest.starts_at, contest_slug=contest_slug):
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
    """Freezes assessment rankings, tags Top 30 qualifiers, and auto-issues Digital Campus QR Passes."""
    return await AssessmentService.evaluate_and_qualify_top_30(contest_slug, db)


@router.post("/{contest_slug}/reset-dev-session")
async def reset_dev_assessment_session(
    contest_slug: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Development endpoint: Reset candidate's attempt for testing from scratch."""
    assessment, contest = await AssessmentService.get_or_create_assessment_for_contest(contest_slug, db)

    s_result = await db.execute(
        select(AssessmentSession).where(
            AssessmentSession.assessment_id == assessment.id,
            AssessmentSession.member_id == current_member.id,
        )
    )
    session = s_result.scalars().first()
    if session:
        await db.execute(
            delete(AssessmentSubmission).where(AssessmentSubmission.session_id == session.id)
        )
        await db.delete(session)

    # Also reset registration record if exists
    if contest:
        reg_stmt = select(ContestRegistration).where(
            ContestRegistration.contest_id == contest.id,
            ContestRegistration.member_id == current_member.id,
        )
        reg_res = await db.execute(reg_stmt)
        reg = reg_res.scalars().first()
        if reg:
            reg.assessment_taken = False
            reg.assessment_score = 0.0
            reg.assessment_rank = None
            reg.is_top_30_qualified = False

    await db.commit()
    await invalidate_ranking(contest_slug)

    return {
        "success": True,
        "contest_slug": contest_slug,
        "message": "Candidate assessment session and submissions reset successfully.",
    }
