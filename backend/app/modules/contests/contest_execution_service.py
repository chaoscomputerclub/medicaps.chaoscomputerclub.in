"""
Chaos Computer Club — Medi-Caps Chapter
modules/contests/contest_execution_service.py — Arena Code Sandbox Execution & Submission Service
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.cache import delete_cache_pattern
from app.core.config import settings
from app.engine.enums import ComparisonMode
from app.engine.languages import Language, LanguageRegistry, LanguageContaminationError, UnsupportedLanguageError
from app.engine.providers.factory import get_judge_provider
from app.engine.schemas import TestCaseSchema
from app.models.db_models import (
    ContestProblem,
    ContestSubmission,
    MemberProfile,
    OfflineContest,
    ScoreboardEntry,
    Problem,
    ProblemVersion,
    ProblemTestCase,
    now_utc,
)
from app.engine.contracts import FunctionSignature, EvaluationConfig, DataType
from app.engine.binder import InputBinder, InputBindingError
from app.engine.adapters import OutputEvaluator
from app.engine.harness import prepare_solution_code
from app.engine.judge import JudgeEngine

from app.modules.contests.contest_repository import ContestRepository
from app.services.contest_eligibility_service import (
    is_member_eligible_for_live_contest,
    is_contest_attempt_submitted,
)
from app.services.event_broadcaster import broadcast_event

logger = logging.getLogger(__name__)


class ArenaRunRequest(BaseModel):
    problem_id: str
    language: Any
    code: str
    custom_stdin: Optional[str] = None


class ArenaSubmitRequest(BaseModel):
    problem_id: str
    language: Any
    code: str


class ContestExecutionService:
    """Handles code execution, sandbox test case runs, scoring, and scoreboard updates."""

    @classmethod
    async def _resolve_problem_execution_contract(
        cls,
        problem: ContestProblem,
        db: AsyncSession,
    ) -> Tuple[Optional[FunctionSignature], Optional[EvaluationConfig], List[Dict[str, Any]], List[Dict[str, Any]], float, int]:
        fn_sig = None
        eval_cfg = None
        visible_cases = []
        hidden_cases = []
        time_limit = getattr(problem, "time_limit", 2.0) or 2.0
        memory_limit = getattr(problem, "memory_limit", 256) or 256

        # Check master problem link
        master_prob_id = getattr(problem, "problem_id", None)
        master_ver = getattr(problem, "problem_version", None) or 1

        if master_prob_id:
            tc_stmt = select(ProblemTestCase).where(
                ProblemTestCase.problem_id == master_prob_id,
                ProblemTestCase.version == master_ver,
                ProblemTestCase.is_active == True,
            ).order_by(ProblemTestCase.order.asc(), ProblemTestCase.created_at.asc())
            vault_cases = (await db.scalars(tc_stmt)).all()
            if vault_cases:
                for vc in vault_cases:
                    c_dict = {
                        "testcase_id": vc.testcase_id,
                        "input": vc.input_data,
                        "expected_output": vc.expected_output,
                        "explanation": vc.explanation,
                        "weight": vc.weight,
                    }
                    if vc.is_hidden:
                        hidden_cases.append(c_dict)
                    else:
                        visible_cases.append(c_dict)

            # Master problem signature
            master_prob = await db.get(Problem, master_prob_id)
            if master_prob:
                raw_sig = getattr(problem, "function_signature", None) or master_prob.function_signature
                if raw_sig:
                    try:
                        fn_sig = FunctionSignature(**raw_sig)
                    except Exception:
                        pass
                raw_eval = getattr(problem, "evaluation_config", None) or master_prob.evaluation_config
                if raw_eval:
                    try:
                        eval_cfg = EvaluationConfig(**raw_eval)
                    except Exception:
                        pass
                if not getattr(problem, "time_limit", None) and master_prob.time_limit:
                    time_limit = master_prob.time_limit
                if not getattr(problem, "memory_limit", None) and master_prob.memory_limit:
                    memory_limit = master_prob.memory_limit

        # Fallback to inline fields on ContestProblem
        if not visible_cases and not hidden_cases:
            visible_cases = getattr(problem, "sample_testcases", None) or []
            hidden_cases = getattr(problem, "hidden_testcases", None) or []

        if not fn_sig:
            raw_sig = getattr(problem, "function_signature", None)
            if raw_sig:
                try:
                    fn_sig = FunctionSignature(**raw_sig)
                except Exception:
                    pass

        if not eval_cfg:
            raw_eval = getattr(problem, "evaluation_config", None)
            if raw_eval:
                try:
                    eval_cfg = EvaluationConfig(**raw_eval)
                except Exception:
                    pass

        return fn_sig, eval_cfg, visible_cases, hidden_cases, time_limit, memory_limit

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

        fn_sig, eval_cfg, sample_list, _, time_limit, memory_limit = await ContestExecutionService._resolve_problem_execution_contract(problem, db)
        try:
            lang_enum = LanguageRegistry.normalize(payload.language)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
        adapter = LanguageRegistry.get_adapter(lang_enum) if fn_sig else None

        tc_binding_errors: dict[int, str] = {}
        if payload.custom_stdin is not None:
            if adapter and fn_sig:
                try:
                    custom_payload = adapter.serialize_input(fn_sig, payload.custom_stdin)
                except InputBindingError as e:
                    custom_payload = ""
                    tc_binding_errors[0] = str(e)
            else:
                custom_payload = payload.custom_stdin
            tcs = [TestCaseSchema(id="custom", stdin=custom_payload, expected_output="")]
            raw_cases = [{"input": payload.custom_stdin, "expected_output": ""}]
        else:
            tcs = []
            raw_cases = sample_list if sample_list else []
            for i, s in enumerate(raw_cases):
                inp = s.get("input") if s.get("input") is not None else s.get("stdin", "")
                if adapter and fn_sig:
                    try:
                        stdin_payload = adapter.serialize_input(fn_sig, inp)
                    except InputBindingError as e:
                        stdin_payload = ""
                        tc_binding_errors[i] = str(e)
                else:
                    stdin_payload = str(inp)

                exp_out = s.get("expected_output") if s.get("expected_output") is not None else s.get("output", "")
                tcs.append(
                    TestCaseSchema(
                        id=f"sample_{i+1}",
                        name=f"Sample Test {i+1}",
                        stdin=stdin_payload,
                        expected_output=str(exp_out),
                    )
                )
            if not tcs:
                tcs = [TestCaseSchema(id="sample_1", name="Sample 1", stdin="", expected_output="")]
                raw_cases = [{"input": "", "expected_output": ""}]

        if adapter and fn_sig:
            exec_code = adapter.generate_wrapper(fn_sig, payload.code)
        else:
            exec_code = prepare_solution_code(
                code=payload.code,
                language=lang_enum,
                problem_index=problem.problem_index,
                starter_codes=getattr(problem, "starter_codes", None) or {},
                function_signature=fn_sig,
            )

        LanguageRegistry.validate_source(lang_enum, exec_code)

        provider = get_judge_provider()
        exec_result = await provider.execute_batch(
            language=lang_enum,
            code=exec_code,
            testcases=tcs,
            time_limit=time_limit,
            memory_limit_mb=memory_limit,
            comparison_mode=ComparisonMode.TRIMMED,
        )

        # Post-process evaluation with typed contract when function mode is active
        testcase_results = []
        passed_count = 0
        for i, tr in enumerate(exec_result.testcase_results):
            raw_case = raw_cases[i] if i < len(raw_cases) else {}
            exp_val = raw_case.get("expected_output") if raw_case.get("expected_output") is not None else raw_case.get("output", "")

            if i in tc_binding_errors:
                tr.passed = False
                tr.verdict = "INPUT_FORMAT_ERROR"
                tr.stderr = f"Input binding error: {tc_binding_errors[i]}"
            elif tr.verdict not in ("TIME_LIMIT_EXCEEDED", "MEMORY_LIMIT_EXCEEDED", "COMPILATION_ERROR", "RUNTIME_ERROR"):
                if fn_sig:
                    passed, msg, _ = OutputEvaluator.compare(tr.stdout or "", exp_val, fn_sig.return_type, eval_cfg)
                    if not passed:
                        # Fallback: if OutputEvaluator fails (e.g., mismatched declared type),
                        # use JudgeEngine semantic comparison (handles [0, 1] vs [0,1] etc.)
                        passed = JudgeEngine.compare(tr.stdout or "", str(exp_val), ComparisonMode.TRIMMED)
                    tr.passed = passed
                    tr.verdict = "ACCEPTED" if passed else "WRONG_ANSWER"
                else:
                    # No function signature: use semantic comparison, not plain string equality
                    passed = JudgeEngine.compare(tr.stdout or "", str(exp_val), ComparisonMode.TRIMMED)
                    tr.passed = passed
                    tr.verdict = "ACCEPTED" if passed else "WRONG_ANSWER"

            if tr.passed:
                passed_count += 1

            testcase_results.append({
                "testcase_id": tr.testcase_id,
                "name": tr.name,
                "passed": tr.passed,
                "verdict": tr.verdict,
                "stdout": tr.stdout,
                "expected_output": str(exp_val),
                "stdin": (tcs[i].stdin if i < len(tcs) else ""),
                "stderr": tr.stderr,
                "compile_output": tr.compile_output,
                "wall_time_ms": tr.wall_time_ms,
            })

        all_passed = (passed_count == len(testcase_results)) and len(testcase_results) > 0
        final_verdict = "ACCEPTED" if all_passed else (exec_result.verdict if not exec_result.success else "WRONG_ANSWER")

        logger.info(
            "Arena Code Run Completed: problem_id=%s, lang=%s, fn=%s, params=%d, passed=%d/%d, verdict=%s",
            problem.id,
            lang_enum.value,
            fn_sig.name if fn_sig else "none",
            len(fn_sig.parameters) if fn_sig else 0,
            passed_count,
            len(testcase_results),
            final_verdict,
        )

        return {
            "success": all_passed,  # BUG FIX: was exec_result.success (stale, pre-post-processing)
            "verdict": final_verdict,
            "stdout": exec_result.stdout,
            "stderr": exec_result.stderr,
            "compile_output": exec_result.compile_output,
            "time": exec_result.time,
            "memory": exec_result.memory,
            "passed_testcases": passed_count,
            "total_testcases": len(testcase_results),
            "score": exec_result.score,
            "testcase_results": testcase_results,
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

        # Idempotency / debounce check: prevent duplicate submissions within 2 seconds
        recent_sub_stmt = select(ContestSubmission).where(
            ContestSubmission.contest_id == contest.id,
            ContestSubmission.problem_id == problem.id,
            ContestSubmission.member_id == current_member.id,
        ).order_by(ContestSubmission.submitted_at.desc()).limit(1)
        recent_sub = (await db.scalars(recent_sub_stmt)).first()
        if recent_sub and recent_sub.code == payload.code:
            now_time = now_utc()
            sub_time = recent_sub.submitted_at.replace(tzinfo=timezone.utc) if recent_sub.submitted_at.tzinfo is None else recent_sub.submitted_at
            if (now_time - sub_time).total_seconds() < 2.0:
                raise HTTPException(
                    status_code=429,
                    detail="Duplicate submission detected. Please wait a moment before submitting again."
                )

        fn_sig, eval_cfg, samples, hidden, time_limit, memory_limit = await ContestExecutionService._resolve_problem_execution_contract(problem, db)
        try:
            lang_enum = LanguageRegistry.normalize(payload.language)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
        adapter = LanguageRegistry.get_adapter(lang_enum) if fn_sig else None
        all_raw = samples + hidden

        all_tcs: list[TestCaseSchema] = []
        tc_binding_errors: dict[int, str] = {}
        for i, s in enumerate(all_raw):
            inp = s.get("input") if s.get("input") is not None else s.get("stdin", "")
            if adapter and fn_sig:
                try:
                    stdin_payload = adapter.serialize_input(fn_sig, inp)
                except InputBindingError as e:
                    stdin_payload = ""
                    tc_binding_errors[i] = str(e)
            else:
                stdin_payload = str(inp)

            exp_out = s.get("expected_output") if s.get("expected_output") is not None else s.get("output", "")
            all_tcs.append(
                TestCaseSchema(
                    id=f"tc_{i+1}",
                    name=f"Test {i+1}",
                    stdin=stdin_payload,
                    expected_output=str(exp_out),
                    hidden=(i >= len(samples)),
                    weight=float(s.get("weight", 1.0) or 1.0),
                )
            )
        if not all_tcs:
            all_tcs = [TestCaseSchema(id="tc_1", name="Test 1", stdin="", expected_output="")]

        if adapter and fn_sig:
            exec_code = adapter.generate_wrapper(fn_sig, payload.code)
        else:
            exec_code = prepare_solution_code(
                code=payload.code,
                language=lang_enum,
                problem_index=problem.problem_index,
                starter_codes=getattr(problem, "starter_codes", None) or {},
                function_signature=fn_sig,
            )

        LanguageRegistry.validate_source(lang_enum, exec_code)

        provider = get_judge_provider()
        exec_result = await provider.execute_batch(
            language=lang_enum,
            code=exec_code,
            testcases=all_tcs,
            time_limit=time_limit,
            memory_limit_mb=memory_limit,
            comparison_mode=ComparisonMode.TRIMMED,
        )

        # Post-process evaluation with typed contract when function mode is active
        passed_count = 0
        for i, tr in enumerate(exec_result.testcase_results):
            raw_case = all_raw[i] if i < len(all_raw) else {}
            exp_val = raw_case.get("expected_output") if raw_case.get("expected_output") is not None else raw_case.get("output", "")

            if i in tc_binding_errors:
                tr.passed = False
                tr.verdict = "INPUT_FORMAT_ERROR"
                tr.stderr = f"Input binding error: {tc_binding_errors[i]}"
            elif tr.verdict not in ("TIME_LIMIT_EXCEEDED", "MEMORY_LIMIT_EXCEEDED", "COMPILATION_ERROR", "RUNTIME_ERROR"):
                if fn_sig:
                    passed, msg, _ = OutputEvaluator.compare(tr.stdout or "", exp_val, fn_sig.return_type, eval_cfg)
                    if not passed:
                        # Fallback: semantic comparison if OutputEvaluator fails type parsing
                        passed = JudgeEngine.compare(tr.stdout or "", str(exp_val), ComparisonMode.TRIMMED)
                    tr.passed = passed
                    tr.verdict = "ACCEPTED" if passed else "WRONG_ANSWER"
                else:
                    passed = JudgeEngine.compare(tr.stdout or "", str(exp_val), ComparisonMode.TRIMMED)
                    tr.passed = passed
                    tr.verdict = "ACCEPTED" if passed else "WRONG_ANSWER"

            if tr.passed:
                passed_count += 1

        is_accepted = (passed_count == len(all_tcs)) and len(all_tcs) > 0
        verdict_str = "ACCEPTED" if is_accepted else (exec_result.verdict if not exec_result.success else "WRONG_ANSWER")
        total_tc = max(1, len(all_tcs))
        points_awarded = problem.points if is_accepted else int(problem.points * (passed_count / total_tc))

        exec_result.passed_testcases = passed_count
        exec_result.total_testcases = len(all_tcs)

        sub = ContestSubmission(
            contest_id=contest.id,
            problem_id=problem.id,
            member_id=current_member.id,
            handle=current_member.handle or f"cadet_{current_member.id[:6]}",
            language=lang_enum.value,
            code=payload.code,
            verdict=verdict_str,
            passed_testcases=passed_count,
            total_testcases=len(all_tcs),
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

        logger.info(
            "Arena Code Submission Evaluated: submission_id=%s, problem_id=%s, lang=%s, fn=%s, params=%d, passed=%d/%d, verdict=%s, points=%d",
            sub.id,
            problem.id,
            lang_enum.value,
            fn_sig.name if fn_sig else "none",
            len(fn_sig.parameters) if fn_sig else 0,
            passed_count,
            len(all_tcs),
            verdict_str,
            points_awarded,
        )

        return {
            "submission_id": sub.id,
            "success": exec_result.success,
            "verdict": verdict_str,
            "passed_testcases": passed_count,
            "total_testcases": len(all_tcs),
            "points_awarded": points_awarded,
            "execution_time": exec_result.time,
            "memory": exec_result.memory,
            "compile_output": exec_result.compile_output,
            "stderr": exec_result.stderr,
            "message": "Accepted! Solved problem awarded to scoreboard." if is_accepted else f"Verdict: {verdict_str} ({passed_count}/{len(all_tcs)} testcases passed)",
            "testcase_results": submit_tc_results,
        }
