"""
Chaos Computer Club — Medi-Caps Chapter
modules/contests/contest_execution_service.py — Arena Code Sandbox Execution & Submission Service
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.cache import delete_cache_pattern
from app.core.config import settings
from app.engine.enums import ComparisonMode, Language
from app.engine.providers.factory import get_judge_provider
from app.engine.schemas import TestCaseSchema
from app.models.db_models import (
    ContestProblem,
    ContestSubmission,
    MemberProfile,
    OfflineContest,
    ScoreboardEntry,
    now_utc,
)
from app.modules.contests.contest_repository import ContestRepository
from app.services.contest_eligibility_service import (
    is_member_eligible_for_live_contest,
    is_contest_attempt_submitted,
)
from app.services.event_broadcaster import broadcast_event

logger = logging.getLogger(__name__)


class ArenaRunRequest(BaseModel):
    problem_id: str
    language: Language
    code: str
    custom_stdin: Optional[str] = None


class ArenaSubmitRequest(BaseModel):
    problem_id: str
    language: Language
    code: str


class ContestExecutionService:
    """Handles code execution, sandbox test case runs, scoring, and scoreboard updates."""

    @staticmethod
    async def run_arena_code(
        slug: str,
        payload: ArenaRunRequest,
        current_member: Optional[MemberProfile],
        db: AsyncSession,
    ) -> Dict[str, Any]:
        contest = await ContestRepository.get_by_slug(db, slug)
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        if not current_member:
            raise HTTPException(status_code=401, detail="Authentication required to execute code in contest arena.")

        is_sub, sub_reason = await is_contest_attempt_submitted(current_member, contest, db)
        if is_sub:
            raise HTTPException(
                status_code=403,
                detail=sub_reason or "Contest attempt has already been submitted. Further code runs are locked.",
            )

        if not (settings.DEV_MODE and slug.startswith("dev-")):
            if contest.status == "upcoming":
                raise HTTPException(
                    status_code=403,
                    detail="Contest has not started yet. Code execution unlocks at start time.",
                )
            if contest.status == "live":
                is_eligible, reason = await is_member_eligible_for_live_contest(
                    current_member, contest, db, require_checked_in=settings.FEATURE_ASSESSMENT_AND_QR_ENABLED
                )
                if not is_eligible:
                    raise HTTPException(status_code=403, detail=f"Arena execution denied: {reason}")

        problem = await ContestRepository.get_problem_by_id(db, payload.problem_id)
        if not problem:
            raise HTTPException(status_code=404, detail="Contest problem not found.")

        if payload.custom_stdin is not None:
            tcs = [TestCaseSchema(id="custom", stdin=payload.custom_stdin, expected_output="")]
        else:
            sample_list = getattr(problem, "sample_testcases", None) or []
            tcs = [
                TestCaseSchema(
                    id=f"sample_{i+1}",
                    name=f"Sample Test {i+1}",
                    stdin=s.get("stdin") if s.get("stdin") is not None else s.get("input", ""),
                    expected_output=s.get("expected_output") if s.get("expected_output") is not None else s.get("output", ""),
                )
                for i, s in enumerate(sample_list)
            ]
            if not tcs:
                tcs = [TestCaseSchema(id="sample_1", name="Sample 1", stdin="", expected_output="")]

        from app.engine.harness import prepare_solution_code
        exec_code = prepare_solution_code(
            code=payload.code,
            language=payload.language,
            problem_index=problem.problem_index,
            starter_codes=getattr(problem, "starter_codes", None) or {},
        )

        provider = get_judge_provider()
        exec_result = await provider.execute_batch(
            language=payload.language,
            code=exec_code,
            testcases=tcs,
            time_limit=getattr(problem, "time_limit", 2.0) or 2.0,
            memory_limit_mb=getattr(problem, "memory_limit", 256) or 256,
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
                    "stdin": (tcs[i].stdin if i < len(tcs) else ""),
                    "stderr": tr.stderr,
                    "compile_output": tr.compile_output,
                    "wall_time_ms": tr.wall_time_ms,
                }
                for i, tr in enumerate(exec_result.testcase_results)
            ],
        }

    @staticmethod
    async def submit_arena_code(
        slug: str,
        payload: ArenaSubmitRequest,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        contest = await ContestRepository.get_by_slug(db, slug)
        if not contest:
            raise HTTPException(status_code=404, detail=f"Contest '{slug}' not found.")

        if not current_member:
            raise HTTPException(status_code=401, detail="Authentication required to submit code in contest arena.")

        is_sub, sub_reason = await is_contest_attempt_submitted(current_member, contest, db)
        if is_sub:
            raise HTTPException(
                status_code=403,
                detail=sub_reason or "Contest attempt has already been submitted. Further code submissions are locked.",
            )

        if not (settings.DEV_MODE and slug.startswith("dev-")):
            if contest.status == "upcoming":
                raise HTTPException(
                    status_code=403,
                    detail="Contest has not started yet. Submissions unlock at start time.",
                )
            if contest.status == "live":
                is_eligible, reason = await is_member_eligible_for_live_contest(
                    current_member, contest, db, require_checked_in=settings.FEATURE_ASSESSMENT_AND_QR_ENABLED
                )
                if not is_eligible:
                    raise HTTPException(status_code=403, detail=f"Arena submission denied: {reason}")

        problem = await ContestRepository.get_problem_by_id(db, payload.problem_id)
        if not problem:
            raise HTTPException(status_code=404, detail="Contest problem not found.")

        samples = getattr(problem, "sample_testcases", None) or []
        hidden = getattr(problem, "hidden_testcases", None) or []
        all_raw = samples + hidden

        all_tcs: list[TestCaseSchema] = []
        for i, s in enumerate(all_raw):
            all_tcs.append(
                TestCaseSchema(
                    id=f"tc_{i+1}",
                    name=f"Test {i+1}",
                    stdin=s.get("stdin") if s.get("stdin") is not None else s.get("input", ""),
                    expected_output=s.get("expected_output") if s.get("expected_output") is not None else s.get("output", ""),
                    hidden=(i >= len(samples)),
                    weight=1.0,
                )
            )
        if not all_tcs:
            all_tcs = [TestCaseSchema(id="tc_1", name="Test 1", stdin="", expected_output="")]

        from app.engine.harness import prepare_solution_code
        exec_code = prepare_solution_code(
            code=payload.code,
            language=payload.language,
            problem_index=problem.problem_index,
            starter_codes=getattr(problem, "starter_codes", None) or {},
        )

        provider = get_judge_provider()
        exec_result = await provider.execute_batch(
            language=payload.language,
            code=exec_code,
            testcases=all_tcs,
            time_limit=getattr(problem, "time_limit", 2.0) or 2.0,
            memory_limit_mb=getattr(problem, "memory_limit", 256) or 256,
            comparison_mode=ComparisonMode.TRIMMED,
        )

        is_accepted = exec_result.passed_testcases == exec_result.total_testcases
        verdict_str = "ACCEPTED" if is_accepted else (exec_result.verdict or "WRONG_ANSWER")
        points_awarded = problem.points if is_accepted else int(problem.points * (exec_result.passed_testcases / max(1, exec_result.total_testcases)))

        sub = ContestSubmission(
            contest_id=contest.id,
            problem_id=problem.id,
            member_id=current_member.id,
            handle=current_member.handle or f"cadet_{current_member.id[:6]}",
            language=str(payload.language),
            code=payload.code,
            verdict=verdict_str,
            passed_testcases=exec_result.passed_testcases,
            total_testcases=exec_result.total_testcases,
            execution_time=exec_result.time or 0.0,
            memory_used=exec_result.memory or 0,
            points_awarded=points_awarded,
            submitted_at=now_utc(),
        )
        db.add(sub)

        # Check if cadet previously solved this problem to prevent duplicate scoring
        prev_ac_stmt = select(func.count(ContestSubmission.id)).where(
            ContestSubmission.contest_id == contest.id,
            ContestSubmission.problem_id == problem.id,
            ContestSubmission.member_id == current_member.id,
            ContestSubmission.verdict == "ACCEPTED",
        )
        prev_ac_count = (await db.scalar(prev_ac_stmt)) or 0
        is_first_solve_by_user = (prev_ac_count == 0) and is_accepted

        if is_first_solve_by_user:
            problem.solved_count += 1

        contest_start = contest.starts_at.replace(tzinfo=timezone.utc) if (contest.starts_at and contest.starts_at.tzinfo is None) else contest.starts_at
        penalty_secs = max(0, int((now_utc() - contest_start).total_seconds())) if contest_start else 0

        sb_entry = await ContestRepository.get_scoreboard_entry(db, contest.id, current_member.id, for_update=True)
        if not sb_entry:
            sb_entry = ScoreboardEntry(
                contest_id=contest.id,
                member_id=current_member.id,
                rank=999,
                handle=current_member.handle or f"cadet_{current_member.id[:6]}",
                full_name=current_member.full_name or "Cadet",
                department=current_member.department or "CSE",
                batch=current_member.batch or "2023-27",
                division="open",
                score=points_awarded if is_accepted else 0,
                solved=1 if is_accepted else 0,
                penalty_seconds=penalty_secs if is_accepted else 0,
                telemetry=[{
                    "problem_index": problem.problem_index,
                    "status": "solved" if is_accepted else "failed",
                    "attempts": 1,
                    "is_first_ac": False,
                }],
            )
            db.add(sb_entry)
        else:
            telemetry_list = list(sb_entry.telemetry or [])
            prob_item = next(
                (item for item in telemetry_list if item.get("problem_index") == problem.problem_index),
                None,
            )

            if prob_item:
                prob_item["attempts"] = prob_item.get("attempts", 0) + 1
                if is_accepted and prob_item.get("status") != "solved":
                    prob_item["status"] = "solved"
                    sb_entry.score += points_awarded
                    sb_entry.solved += 1
                    sb_entry.penalty_seconds = penalty_secs
            else:
                telemetry_list.append({
                    "problem_index": problem.problem_index,
                    "status": "solved" if is_accepted else "failed",
                    "attempts": 1,
                    "is_first_ac": False,
                })
                if is_accepted:
                    sb_entry.score += points_awarded
                    sb_entry.solved += 1
                    sb_entry.penalty_seconds = penalty_secs

            sb_entry.telemetry = telemetry_list

        await db.flush()
        await ContestRepository.re_rank_scoreboard(db, contest.id)
        await db.commit()

        await delete_cache_pattern("cache:scoreboard*")
        await delete_cache_pattern("cache:contest*")

        try:
            await broadcast_event(
                event_type="submission_evaluated",
                data={
                    "contest_slug": slug,
                    "problem_index": problem.problem_index,
                    "problem_id": problem.id,
                    "handle": current_member.handle,
                    "verdict": verdict_str,
                    "is_accepted": is_accepted,
                    "points_awarded": points_awarded,
                    "passed_testcases": exec_result.passed_testcases,
                    "total_testcases": exec_result.total_testcases,
                },
                contest_slug=slug,
            )
        except Exception as e:
            logger.debug("Broadcast error: %s", e)

        submit_tc_results = []
        for i, tr in enumerate(exec_result.testcase_results):
            tc = all_tcs[i] if i < len(all_tcs) else None
            is_hidden = tc.hidden if tc else (i >= len(samples))
            submit_tc_results.append({
                "testcase_id": tr.testcase_id,
                "name": f"Hidden Testcase {i - len(samples) + 1}" if is_hidden else tr.name,
                "passed": tr.passed,
                "verdict": tr.verdict,
                "is_hidden": is_hidden,
                "stdout": tr.stdout if not is_hidden else ("[Hidden output]" if not tr.passed else ""),
                "expected_output": tr.expected_output if not is_hidden else "[Hidden]",
                "input": tc.stdin if (tc and not is_hidden) else "[Hidden]",
                "stderr": tr.stderr,
                "compile_output": tr.compile_output,
                "wall_time_ms": tr.wall_time_ms,
            })

        return {
            "submission_id": sub.id,
            "success": exec_result.success,
            "verdict": verdict_str,
            "passed_testcases": exec_result.passed_testcases,
            "total_testcases": exec_result.total_testcases,
            "points_awarded": points_awarded,
            "execution_time": exec_result.time,
            "memory": exec_result.memory,
            "compile_output": exec_result.compile_output,
            "stderr": exec_result.stderr,
            "message": "Accepted! Solved problem awarded to scoreboard." if is_accepted else f"Verdict: {verdict_str} ({exec_result.passed_testcases}/{exec_result.total_testcases} testcases passed)",
            "testcase_results": submit_tc_results,
        }
