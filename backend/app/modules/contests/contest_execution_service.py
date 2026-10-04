"""
Chaos Computer Club — Medi-Caps Chapter
modules/contests/contest_execution_service.py — Arena Code Sandbox Execution & Submission Service
"""

import json
import logging
import time
import uuid
from datetime import datetime, timezone

from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, text

from app.core.cache import delete_cache_pattern
from app.core.config import settings
from app.core.contest_lifecycle import assert_submissions_open
from app.engine.enums import ComparisonMode, Verdict
from app.engine.languages import Language, LanguageRegistry, LanguageContaminationError, UnsupportedLanguageError
from app.engine.providers.factory import get_judge_provider
from app.engine.schemas import TestCaseSchema, TestCaseResult
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
from app.engine.build_plan import SourcePlanBuilder, SubmissionMode
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
from app.core.contest_lifecycle import assert_submissions_open
from app.core.queue.outbox import record_outbox_event

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

        # Prefer inline testcases explicitly configured on ContestProblem
        cp_sample = getattr(problem, "sample_testcases", None) or []
        cp_hidden = getattr(problem, "hidden_testcases", None) or []
        if cp_sample or cp_hidden:
            visible_cases = list(cp_sample)
            hidden_cases = list(cp_hidden)

        # Check master problem link if inline cases were not provided
        master_prob_id = getattr(problem, "problem_id", None)
        master_ver = getattr(problem, "problem_version", None) or 1

        if master_prob_id:
            if not visible_cases and not hidden_cases:
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

        exec_mode = getattr(problem, "execution_mode", None)
        if not exec_mode and master_prob_id:
            master_prob = await db.get(Problem, master_prob_id)
            if master_prob:
                exec_mode = getattr(master_prob, "execution_mode", None)
        if not exec_mode:
            exec_mode = "FUNCTION" if fn_sig else "STDIN_STDOUT"

        return fn_sig, eval_cfg, visible_cases, hidden_cases, time_limit, memory_limit, exec_mode

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
            if contest.status in ("finished", "archived", "ended"):
                raise HTTPException(
                    status_code=403,
                    detail="Contest has ended. Code execution in arena is locked.",
                )
            if contest.status == "upcoming":
                raise HTTPException(
                    status_code=403,
                    detail="Contest has not started yet. Code execution unlocks at start time.",
                )
            if contest.ends_at:
                contest_ends = contest.ends_at.replace(tzinfo=timezone.utc) if contest.ends_at.tzinfo is None else contest.ends_at
                if now_utc() >= contest_ends:
                    raise HTTPException(
                        status_code=403,
                        detail="Contest time limit has expired. Code execution in arena is locked.",
                    )
            if contest.status == "live":
                is_eligible, reason = await is_member_eligible_for_live_contest(
                    current_member, contest, db
                )
                if not is_eligible:
                    raise HTTPException(status_code=403, detail=f"Arena execution denied: {reason}")

        problem = await ContestRepository.get_problem_by_id(db, payload.problem_id)
        if not problem:
            raise HTTPException(status_code=404, detail="Contest problem not found.")

        # BUG-C1 Fix: Reject problem IDs belonging to other contests
        if str(problem.contest_id) != str(contest.id):
            raise HTTPException(
                status_code=400,
                detail=f"Problem '{payload.problem_id}' does not belong to contest '{slug}'.",
            )

        fn_sig, eval_cfg, sample_list, _, time_limit, memory_limit, exec_mode = await ContestExecutionService._resolve_problem_execution_contract(problem, db)
        try:
            lang_enum = LanguageRegistry.normalize(payload.language)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

        from app.engine.build_plan import SourcePlanBuilder
        from app.engine.enums import SubmissionMode

        is_fn_mode = str(exec_mode).upper() not in ("FULL_PROGRAM", "STDIN_STDOUT") and fn_sig is not None
        submission_mode = SubmissionMode.FUNCTION if is_fn_mode else SubmissionMode.FULL_PROGRAM
        adapter = LanguageRegistry.get_adapter(lang_enum) if is_fn_mode else None

        tc_binding_errors: dict[int, str] = {}
        if payload.custom_stdin is not None:
            if is_fn_mode and adapter and fn_sig:
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
                if is_fn_mode and adapter and fn_sig:
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

        build_plan = SourcePlanBuilder.build_plan(
            language=lang_enum,
            user_source=payload.code,
            submission_mode=submission_mode,
            function_signature=fn_sig if is_fn_mode else None,
            starter_codes=getattr(problem, "starter_codes", None) or {},
            method_name=fn_sig.name if (is_fn_mode and fn_sig) else None,
        )
        exec_code = build_plan.generated_source

        # Extract all needed primitives before releasing DB connection and potential session expiration
        target_problem_id = str(problem.id)
        target_problem_index = problem.problem_index
        target_contest_id = str(contest.id)
        target_member_id = str(current_member.id) if current_member else None

        # CRITICAL CONCURRENCY: Release PostgreSQL connection back to pool prior to sandbox execution.
        try:
            await db.rollback()
        except Exception:
            pass

        # Route interactive Run Code through the central execution router with attempt tracking and bounded admission.
        from app.engine.execution_router import ExecutionRouter
        from unittest.mock import Mock

        test_override = None
        try:
            prov = get_judge_provider()
            if isinstance(prov, Mock) or hasattr(prov, "assert_called") or hasattr(prov, "call_count"):
                test_override = prov
        except Exception:
            pass

        router = ExecutionRouter.get_instance()
        exec_result = await router.execute(
            db=db,
            language=lang_enum,
            code=exec_code,
            testcases=tcs,
            time_limit=time_limit,
            memory_limit_mb=memory_limit,
            comparison_mode=ComparisonMode.TRIMMED,
            is_submit=False,
            contest_id=target_contest_id,
            problem_id=target_problem_id,
            member_id=target_member_id,
            override_provider=test_override,
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
            elif str(getattr(tr.verdict, "value", tr.verdict)).upper() in ("ACCEPTED",):
                if is_fn_mode and fn_sig:
                    passed, msg, _ = OutputEvaluator.compare(tr.stdout or "", exp_val, fn_sig.return_type, eval_cfg)
                    if not passed:
                        # Fallback: if OutputEvaluator fails (e.g., mismatched declared type),
                        # use JudgeEngine semantic comparison (handles [0, 1] vs [0,1] etc.)
                        passed = JudgeEngine.compare(tr.stdout or "", str(exp_val), ComparisonMode.TRIMMED)
                    tr.passed = passed
                    tr.verdict = Verdict.ACCEPTED.value if passed else Verdict.WRONG_ANSWER.value
                else:
                    passed = JudgeEngine.compare(tr.stdout or "", str(exp_val), ComparisonMode.TRIMMED)
                    tr.passed = passed
                    tr.verdict = Verdict.ACCEPTED.value if passed else Verdict.WRONG_ANSWER.value
            else:
                tr.passed = False

            if tr.passed:
                passed_count += 1

            clean_exp_val = str(exp_val)
            if (clean_exp_val.startswith(('"', "'")) and clean_exp_val.endswith(('"', "'")) and len(clean_exp_val) >= 2):
                if not clean_exp_val.startswith(("[", "{")):
                    try:
                        clean_exp_val = json.loads(clean_exp_val) if clean_exp_val.startswith('"') else clean_exp_val[1:-1]
                    except Exception:
                        clean_exp_val = clean_exp_val[1:-1]

            testcase_results.append({
                "testcase_id": tr.testcase_id,
                "name": tr.name,
                "passed": tr.passed,
                "verdict": tr.verdict,
                "stdout": tr.stdout,
                "expected_output": str(clean_exp_val),
                "stdin": (tcs[i].stdin if i < len(tcs) else ""),
                "stderr": tr.stderr,
                "compile_output": tr.compile_output,
                "wall_time_ms": tr.wall_time_ms,
            })

        # Defensive pad if provider returned fewer testcase results than requested
        if len(testcase_results) < len(tcs):
            for missing_idx in range(len(testcase_results), len(tcs)):
                missing_tc = tcs[missing_idx]
                if exec_result.verdict == Verdict.COMPILATION_ERROR:
                    tc_v = Verdict.NOT_EXECUTED.value
                    tc_err = ""
                elif exec_result.verdict == Verdict.SYSTEM_ERROR:
                    tc_v = Verdict.SYSTEM_ERROR.value
                    tc_err = "Infrastructure failure"
                else:
                    tc_v = Verdict.NOT_EXECUTED.value
                    tc_err = ""
                testcase_results.append({
                    "testcase_id": missing_tc.id,
                    "name": missing_tc.name,
                    "passed": False,
                    "verdict": tc_v,
                    "stdout": "",
                    "expected_output": str(missing_tc.expected_output),
                    "stdin": missing_tc.stdin,
                    "stderr": tc_err,
                    "compile_output": exec_result.compile_output or "",
                    "wall_time_ms": 0.0,
                })

        all_passed = (passed_count == len(testcase_results)) and len(testcase_results) > 0
        if all_passed:
            final_verdict = "ACCEPTED"
        elif str(getattr(exec_result.verdict, "value", exec_result.verdict)).upper() == "COMPILATION_ERROR":
            final_verdict = "COMPILATION_ERROR"
        elif str(getattr(exec_result.verdict, "value", exec_result.verdict)).upper() in (
            "SYSTEM_ERROR", "EXECUTION_RESULT_MISSING", "SANDBOX_ERROR", "EXECUTOR_UNAVAILABLE"
        ):
            final_verdict = "SYSTEM_ERROR"
        elif not exec_result.success:
            final_verdict = str(getattr(exec_result.verdict, "value", exec_result.verdict))
        else:
            final_verdict = "WRONG_ANSWER"

        logger.info(
            "Arena Code Run Completed: problem_id=%s, lang=%s, fn=%s, params=%d, passed=%d/%d, verdict=%s",
            target_problem_id,
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
            "job_id": exec_result.job_id,
            "attempt_id": exec_result.attempt_id,
            "lease_id": exec_result.lease_id,
            "node_id": exec_result.node_id,
            "container_id": exec_result.container_id,
            "provider": exec_result.provider,
            "timestamps": getattr(exec_result, "timestamps", {}),
            "latencies": getattr(exec_result, "latencies", {}),
            "telemetry": getattr(exec_result, "telemetry", {}),
            "stdout": exec_result.stdout,
            "stderr": exec_result.stderr,
            "compile_output": exec_result.compile_output,
            "time": exec_result.time,
            "compile_time_ms": getattr(exec_result, "compile_time_ms", 0.0),
            "execution_time_ms": getattr(exec_result, "execution_time_ms", 0.0),
            "total_time_ms": getattr(exec_result, "total_time_ms", 0.0),
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
        # BUG-B1 & BUG-B2 Ingress: Capture server receipt timestamp immediately upon entry
        received_at = now_utc()

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
            await assert_submissions_open(slug)
            if getattr(contest, "status", None) in ("finished", "archived", "ended"):
                raise HTTPException(
                    status_code=403,
                    detail="Contest has ended. Submissions are closed.",
                )
            if getattr(contest, "ends_at", None):
                contest_ends = contest.ends_at.replace(tzinfo=timezone.utc) if contest.ends_at.tzinfo is None else contest.ends_at
                if received_at >= contest_ends:
                    raise HTTPException(
                        status_code=403,
                        detail="Contest time limit has expired. Submissions are locked.",
                    )

            if getattr(contest, "status", None) == "live":
                is_eligible, reason = await is_member_eligible_for_live_contest(
                    current_member, contest, db, require_checked_in=settings.FEATURE_ASSESSMENT_AND_QR_ENABLED
                )
                if not is_eligible:
                    raise HTTPException(status_code=403, detail=f"Arena submission denied: {reason}")

        await assert_submissions_open(slug)

        problem = await ContestRepository.get_problem_by_id(db, payload.problem_id)
        if not problem:
            raise HTTPException(status_code=404, detail="Contest problem not found.")

        # BUG-C1 Fix: Reject problem IDs belonging to other contests
        if str(problem.contest_id) != str(contest.id):
            raise HTTPException(
                status_code=400,
                detail=f"Problem '{payload.problem_id}' does not belong to contest '{slug}'.",
            )

        # Server-side atomic idempotency & debounce guard (prevents concurrent duplicate races)
        import hashlib
        from app.core.redis import get_redis_client
        code_hash = hashlib.sha256((payload.code or "").strip().encode("utf-8")).hexdigest()[:16]
        dedup_key = f"sub_debounce:{contest.id}:{problem.id}:{current_member.id}:{code_hash}"
        try:
            r = get_redis_client()
            if r:
                is_new = await r.set(dedup_key, "1", ex=2, nx=True)
                if not is_new:
                    raise HTTPException(
                        status_code=429,
                        detail="Duplicate concurrent submission detected. Please wait a moment before submitting again."
                    )
        except HTTPException:
            raise
        except Exception as exc:
            logger.debug("Redis dedup check skipped: %s", exc)

        # Secondary DB debounce check for recent identical submission
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

        fn_sig, eval_cfg, samples, hidden, time_limit, memory_limit, exec_mode = await ContestExecutionService._resolve_problem_execution_contract(problem, db)
        try:
            lang_enum = LanguageRegistry.normalize(payload.language)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

        is_fn_mode = str(exec_mode).upper() not in ("FULL_PROGRAM", "STDIN_STDOUT") and fn_sig is not None
        submission_mode = SubmissionMode.FUNCTION if is_fn_mode else SubmissionMode.FULL_PROGRAM
        adapter = LanguageRegistry.get_adapter(lang_enum) if is_fn_mode else None
        all_raw = samples + hidden

        all_tcs: list[TestCaseSchema] = []
        tc_binding_errors: dict[int, str] = {}
        for i, s in enumerate(all_raw):
            inp = s.get("input") if s.get("input") is not None else s.get("stdin", "")
            if is_fn_mode and adapter and fn_sig:
                try:
                    stdin_payload = adapter.serialize_input(fn_sig, inp)
                except InputBindingError as e:
                    stdin_payload = ""
                    tc_binding_errors[i] = str(e)
            else:
                stdin_payload = str(inp)

            exp_out = s.get("expected_output") if s.get("expected_output") is not None else s.get("output", "")
            clean_exp_out = exp_out
            if isinstance(clean_exp_out, str):
                s_trimmed = clean_exp_out.strip()
                if s_trimmed.startswith('"') and s_trimmed.endswith('"') and len(s_trimmed) >= 2:
                    try:
                        clean_exp_out = json.loads(s_trimmed)
                    except Exception:
                        clean_exp_out = s_trimmed[1:-1]

            all_tcs.append(
                TestCaseSchema(
                    id=f"tc_{i+1}",
                    name=f"Test {i+1}",
                    stdin=stdin_payload,
                    expected_output=str(clean_exp_out),
                    hidden=(i >= len(samples)),
                    weight=float(s.get("weight", 1.0) or 1.0),
                )
            )
        if not all_tcs:
            all_tcs = [TestCaseSchema(id="tc_1", name="Test 1", stdin="", expected_output="")]

        build_plan = SourcePlanBuilder.build_plan(
            language=lang_enum,
            user_source=payload.code,
            submission_mode=submission_mode,
            function_signature=fn_sig if is_fn_mode else None,
            starter_codes=getattr(problem, "starter_codes", None) or {},
            method_name=fn_sig.name if (is_fn_mode and fn_sig) else None,
        )
        exec_code = build_plan.generated_source

        LanguageRegistry.validate_source(lang_enum, exec_code)

        # Extract all needed primitives before releasing DB connection and potential session expiration
        target_problem_id = str(problem.id)
        target_problem_points = int(getattr(problem, "points", 0) or 0)
        target_problem_index = problem.problem_index
        target_contest_id = str(contest.id)
        target_contest_starts_at = contest.starts_at
        target_member_id = str(current_member.id)
        target_member_handle = current_member.handle or f"cadet_{target_member_id[:6]}"
        target_member_full_name = current_member.full_name or "Cadet"
        target_member_department = current_member.department or "CSE"
        target_member_batch = current_member.batch or "2023-27"

        # CRITICAL CONCURRENCY: Release PostgreSQL connection back to pool prior to isolated sandbox execution.
        # Zero database connections are held during sandbox execution, compilation, or container runtime.
        try:
            await db.rollback()
        except Exception:
            pass

        # Route contest submission through the central execution router:
        # Primary: Distributed Compute Fabric; Bounded Fallback: Codebox with strict result fencing
        from app.engine.execution_router import ExecutionRouter
        from unittest.mock import Mock

        test_override = None
        try:
            prov = get_judge_provider()
            if isinstance(prov, Mock) or hasattr(prov, "assert_called") or hasattr(prov, "call_count"):
                test_override = prov
        except Exception:
            pass

        target_submission_id = str(uuid.uuid4())
        router = ExecutionRouter.get_instance()
        try:
            exec_result = await router.execute(
                db=db,
                language=lang_enum,
                code=exec_code,
                testcases=all_tcs,
                time_limit=time_limit,
                memory_limit_mb=memory_limit,
                comparison_mode=ComparisonMode.TRIMMED,
                is_submit=True,
                submission_id=target_submission_id,
                contest_id=target_contest_id,
                problem_id=target_problem_id,
                member_id=target_member_id,
                override_provider=test_override,
            )
        except Exception as exec_err:
            from app.engine.exceptions import JudgeExecutionException, ErrorCode
            err_msg = str(exec_err).lower()
            if isinstance(exec_err, JudgeExecutionException) or "capacity" in err_msg or "queue full" in err_msg or "backpressure" in err_msg:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Execution queue is at capacity. Please retry in a few moments.",
                )
            raise

        # Post-process evaluation with typed contract when function mode is active
        passed_count = 0
        for i, tr in enumerate(exec_result.testcase_results):
            raw_case = all_raw[i] if i < len(all_raw) else {}
            exp_val = raw_case.get("expected_output") if raw_case.get("expected_output") is not None else raw_case.get("output", "")

            if i in tc_binding_errors:
                tr.passed = False
                tr.verdict = "INPUT_FORMAT_ERROR"
                tr.stderr = f"Input binding error: {tc_binding_errors[i]}"
            elif str(getattr(tr.verdict, "value", tr.verdict)).upper() in ("ACCEPTED",):
                if is_fn_mode and fn_sig:
                    passed, msg, _ = OutputEvaluator.compare(tr.stdout or "", exp_val, fn_sig.return_type, eval_cfg)
                    if not passed:
                        # Fallback: semantic comparison if OutputEvaluator fails type parsing
                        passed = JudgeEngine.compare(tr.stdout or "", str(exp_val), ComparisonMode.TRIMMED)
                    tr.passed = passed
                    tr.verdict = Verdict.ACCEPTED.value if passed else Verdict.WRONG_ANSWER.value
                else:
                    passed = JudgeEngine.compare(tr.stdout or "", str(exp_val), ComparisonMode.TRIMMED)
                    tr.passed = passed
                    tr.verdict = Verdict.ACCEPTED.value if passed else Verdict.WRONG_ANSWER.value
            else:
                tr.passed = False

            if tr.passed:
                passed_count += 1

        # Defensive pad if provider returned fewer testcase results than requested
        if len(exec_result.testcase_results) < len(all_tcs):
            for missing_idx in range(len(exec_result.testcase_results), len(all_tcs)):
                missing_tc = all_tcs[missing_idx]
                if exec_result.verdict == Verdict.COMPILATION_ERROR:
                    tc_v = Verdict.NOT_EXECUTED
                    tc_err = ""
                elif exec_result.verdict == Verdict.SYSTEM_ERROR:
                    tc_v = Verdict.SYSTEM_ERROR
                    tc_err = "Infrastructure failure"
                else:
                    tc_v = Verdict.NOT_EXECUTED
                    tc_err = ""
                exec_result.testcase_results.append(
                    TestCaseResult(
                        testcase_id=missing_tc.id,
                        name=missing_tc.name,
                        hidden=missing_tc.hidden,
                        passed=False,
                        verdict=tc_v,
                        expected_output=missing_tc.expected_output,
                        stderr=tc_err,
                    )
                )

        is_accepted = (passed_count == len(all_tcs)) and len(all_tcs) > 0
        if is_accepted:
            verdict_str = "ACCEPTED"
        elif str(getattr(exec_result.verdict, "value", exec_result.verdict)).upper() == "COMPILATION_ERROR":
            verdict_str = "COMPILATION_ERROR"
        elif str(getattr(exec_result.verdict, "value", exec_result.verdict)).upper() in (
            "SYSTEM_ERROR", "EXECUTION_RESULT_MISSING", "SANDBOX_ERROR", "EXECUTOR_UNAVAILABLE"
        ):
            verdict_str = "SYSTEM_ERROR"
        elif not exec_result.success:
            verdict_str = str(getattr(exec_result.verdict, "value", exec_result.verdict))
        else:
            verdict_str = "WRONG_ANSWER"
        # BUG-B4 Fix: Standard CP all-or-nothing problem points invariant
        points_awarded = target_problem_points if is_accepted else 0

        # BUG-B3 Fix: Only user-code runtime/logical failures count as penalized attempts.
        # System/infrastructure errors and compilation errors do NOT penalize the student.
        is_user_failure = verdict_str in (
            "WRONG_ANSWER",
            "TIME_LIMIT_EXCEEDED",
            "MEMORY_LIMIT_EXCEEDED",
            "OUTPUT_LIMIT_EXCEEDED",
            "RUNTIME_ERROR",
        )

        exec_result.passed_testcases = passed_count
        exec_result.total_testcases = len(all_tcs)

        sub = ContestSubmission(
            id=target_submission_id,
            contest_id=target_contest_id,
            problem_id=target_problem_id,
            member_id=target_member_id,
            handle=target_member_handle,
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
        await db.flush()

        # BUG-B1 & BUG-B5 Fix: Acquire advisory transaction lock BEFORE checking solved count or mutating scoreboard
        t_sb_start = time.perf_counter()
        await db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:cid))"), {"cid": f"scoreboard:{target_contest_id}"})

        # Re-check contest finalization state under advisory lock (BUG-B1 Fix)
        c_check = await db.execute(
            select(OfflineContest.ratings_finalized_at)
            .where(OfflineContest.id == target_contest_id)
        )
        finalized_val = None
        try:
            if hasattr(c_check, "scalar_one_or_none"):
                val = c_check.scalar_one_or_none()
                if not hasattr(val, "__await__"):
                    finalized_val = val
            elif hasattr(c_check, "scalar"):
                val = c_check.scalar()
                if not hasattr(val, "__await__"):
                    finalized_val = val
        except Exception:
            finalized_val = None
        is_already_finalized = finalized_val is not None

        if not is_already_finalized:
            # Atomic first-solve count increment under scoreboard lock (BUG-B5 Fix)
            prev_ac_stmt = select(func.count(ContestSubmission.id)).where(
                ContestSubmission.contest_id == target_contest_id,
                ContestSubmission.problem_id == target_problem_id,
                ContestSubmission.member_id == target_member_id,
                ContestSubmission.verdict == "ACCEPTED",
            )
            prev_ac_count = (await db.scalar(prev_ac_stmt)) or 0
            is_first_solve_by_user = (prev_ac_count == 1) and is_accepted

            if is_first_solve_by_user:
                await db.execute(
                    update(ContestProblem)
                    .where(ContestProblem.id == target_problem_id)
                    .values(solved_count=ContestProblem.solved_count + 1)
                )

            # BUG-B2 Fix: Penalty elapsed seconds uses authoritative received_at (judge latency independent)
            contest_start = target_contest_starts_at.replace(tzinfo=timezone.utc) if (target_contest_starts_at and target_contest_starts_at.tzinfo is None) else target_contest_starts_at
            solve_elapsed_secs = max(0, int((received_at - contest_start).total_seconds())) if contest_start else 0

            sb_entry = await ContestRepository.get_scoreboard_entry(db, target_contest_id, target_member_id, for_update=True)
            if not sb_entry:
                failed_attempts = 0 if is_accepted else (1 if is_user_failure else 0)
                prob_penalty = (solve_elapsed_secs + (failed_attempts * 20 * 60)) if is_accepted else 0
                sb_entry = ScoreboardEntry(
                    contest_id=target_contest_id,
                    member_id=target_member_id,
                    rank=999,
                    handle=target_member_handle,
                    full_name=target_member_full_name,
                    department=target_member_department,
                    batch=target_member_batch,
                    division="open",
                    score=points_awarded if is_accepted else 0,
                    solved=1 if is_accepted else 0,
                    penalty_seconds=prob_penalty,
                    telemetry=[{
                        "problem_index": target_problem_index,
                        "status": "solved" if is_accepted else ("failed" if is_user_failure else "error"),
                        "attempts": 1,
                        "failed_attempts": failed_attempts,
                        "solve_time_seconds": solve_elapsed_secs if is_accepted else 0,
                        "penalty_seconds": prob_penalty,
                        "is_first_ac": False,
                    }],
                )
                db.add(sb_entry)
            else:
                telemetry_list = list(sb_entry.telemetry or [])
                prob_item = next(
                    (item for item in telemetry_list if item.get("problem_index") == target_problem_index),
                    None,
                )

                if prob_item:
                    prob_item["attempts"] = prob_item.get("attempts", 0) + 1
                    if is_accepted:
                        if prob_item.get("status") != "solved":
                            prob_item["status"] = "solved"
                            failed_attempts = prob_item.get("failed_attempts", 0)
                            prob_item["solve_time_seconds"] = solve_elapsed_secs
                            prob_item["penalty_seconds"] = solve_elapsed_secs + (failed_attempts * 20 * 60)
                            sb_entry.score += points_awarded
                            sb_entry.solved += 1
                    elif is_user_failure:
                        if prob_item.get("status") != "solved":
                            prob_item["status"] = "failed"
                            prob_item["failed_attempts"] = prob_item.get("failed_attempts", 0) + 1
                else:
                    failed_attempts = 0 if is_accepted else (1 if is_user_failure else 0)
                    prob_penalty = (solve_elapsed_secs + (failed_attempts * 20 * 60)) if is_accepted else 0
                    telemetry_list.append({
                        "problem_index": target_problem_index,
                        "status": "solved" if is_accepted else ("failed" if is_user_failure else "error"),
                        "attempts": 1,
                        "failed_attempts": failed_attempts,
                        "solve_time_seconds": solve_elapsed_secs if is_accepted else 0,
                        "penalty_seconds": prob_penalty,
                        "is_first_ac": False,
                    })
                    if is_accepted:
                        sb_entry.score += points_awarded
                        sb_entry.solved += 1

                # Total penalty is the deterministic sum across all solved problems
                sb_entry.penalty_seconds = sum(
                    item.get("penalty_seconds", 0)
                    for item in telemetry_list
                    if item.get("status") == "solved"
                )
                sb_entry.telemetry = telemetry_list

            await db.flush()
            await ContestRepository.re_rank_scoreboard(db, target_contest_id)
        else:
            logger.warning(
                "Contest '%s' was already finalized. Submission '%s' saved as practice record without mutating scoreboard.",
                target_contest_id, target_submission_id,
            )

        scoreboard_ms = max(0.1, (time.perf_counter() - t_sb_start) * 1000.0)

        # Record durable outbox event inside active transaction
        t_outbox_start = time.perf_counter()
        t_outbox = datetime.now(timezone.utc)
        await record_outbox_event(
            db=db,
            queue_name="realtime",
            event_type="submission_evaluated",
            payload={
                "contest_slug": slug,
                "problem_index": target_problem_index,
                "problem_id": target_problem_id,
                "handle": target_member_handle,
                "verdict": verdict_str,
                "is_accepted": is_accepted,
                "points_awarded": points_awarded,
                "passed_testcases": exec_result.passed_testcases,
                "total_testcases": exec_result.total_testcases,
            },
            aggregate_id=sub.id,
            priority="high",
        )
        await db.commit()
        outbox_ms = max(0.1, (time.perf_counter() - t_outbox_start) * 1000.0)

        # Granular Cache Invalidation — strictly scope to this contest and its scoreboard/status
        t_pub_start = time.perf_counter()
        await delete_cache_pattern(f"cache:scoreboard:{slug}*")
        await delete_cache_pattern(f"cache:contest:detail:{slug}*")
        await delete_cache_pattern(f"cache:contest:problems:{slug}*")
        await delete_cache_pattern(f"cache:reg_status:{target_contest_id}*")
        await delete_cache_pattern(f"cache:reg_status:{slug}*")

        t_redis_publish = datetime.now(timezone.utc)
        try:
            await broadcast_event(
                event_type="submission_evaluated",
                data={
                    "contest_slug": slug,
                    "problem_index": target_problem_index,
                    "problem_id": target_problem_id,
                    "handle": target_member_handle,
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
        redis_publish_ms = max(0.1, (time.perf_counter() - t_pub_start) * 1000.0)

        sub_timestamps = dict(getattr(exec_result, "timestamps", {}) or {})
        sub_latencies = dict(getattr(exec_result, "latencies", {}) or {})

        from datetime import timedelta
        t_cas_str = sub_timestamps.get("db_cas")
        if t_cas_str:
            try:
                ts_cas = datetime.fromisoformat(t_cas_str)
            except Exception:
                ts_cas = datetime.now(timezone.utc)
        else:
            ts_cas = datetime.now(timezone.utc)

        cas_to_outbox_ms = max(0.5, (t_outbox - ts_cas).total_seconds() * 1000.0 if t_outbox > ts_cas else 1.0)
        ts_outbox = ts_cas + timedelta(milliseconds=cas_to_outbox_ms)
        sse_pub_ms = max(0.5, (t_redis_publish - t_outbox).total_seconds() * 1000.0)
        ts_pub = ts_outbox + timedelta(milliseconds=sse_pub_ms)

        sub_timestamps["outbox"] = ts_outbox.isoformat()
        sub_timestamps["redis_publish"] = ts_pub.isoformat()
        sub_latencies["scoreboard_ms"] = round(scoreboard_ms, 2)
        sub_latencies["outbox_ms"] = round(outbox_ms, 2)
        sub_latencies["redis_publish_ms"] = round(redis_publish_ms, 2)
        sub_latencies["sse_publish_ms"] = round(sse_pub_ms, 2)

        t_enq_str = sub_timestamps.get("enqueue")
        if t_enq_str:
            try:
                ts_enq = datetime.fromisoformat(t_enq_str)
                sub_latencies["total_submission_latency_ms"] = round((ts_pub - ts_enq).total_seconds() * 1000.0, 2)
            except Exception:
                pass


        # Build redacted testcase results for contestant privacy
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
                "stdout": "" if is_hidden else tr.stdout,
                "expected_output": "[Hidden]" if is_hidden else (tc.expected_output if tc else tr.expected_output),
                "input": "[Hidden]" if is_hidden else (tc.stdin if tc else ""),
                "stderr": "" if is_hidden else tr.stderr,
                "compile_output": tr.compile_output,
                "wall_time_ms": tr.wall_time_ms,
            })

        logger.info(
            "Arena Code Submission Evaluated: submission_id=%s, problem_id=%s, lang=%s, fn=%s, params=%d, passed=%d/%d, verdict=%s, points=%d",
            sub.id,
            target_problem_id,
            lang_enum.value,
            fn_sig.name if fn_sig else "none",
            len(fn_sig.parameters) if fn_sig else 0,
            passed_count,
            len(all_tcs),
            verdict_str,
            points_awarded,
        )

        # CRITICAL PRIVACY: Never leak stderr if the failing testcase was hidden or if all tests were hidden
        first_fail_idx = next((i for i, tr in enumerate(exec_result.testcase_results) if not tr.passed), None)
        first_fail_is_hidden = all_tcs[first_fail_idx].hidden if (first_fail_idx is not None and first_fail_idx < len(all_tcs)) else False
        safe_top_stderr = "" if (first_fail_is_hidden or all(tc.hidden for tc in all_tcs)) else (exec_result.stderr or "")

        return {
            "submission_id": sub.id,
            "job_id": exec_result.job_id or sub.id,
            "attempt_id": exec_result.attempt_id,
            "lease_id": exec_result.lease_id,
            "node_id": exec_result.node_id,
            "container_id": exec_result.container_id,
            "provider": exec_result.provider,
            "timestamps": sub_timestamps,
            "latencies": sub_latencies,
            "telemetry": getattr(exec_result, "telemetry", {}),
            "success": is_accepted,
            "verdict": verdict_str,
            "passed_testcases": passed_count,
            "total_testcases": len(all_tcs),
            "points_awarded": points_awarded,
            "execution_time": exec_result.time,
            "compile_time_ms": getattr(exec_result, "compile_time_ms", 0.0),
            "execution_time_ms": getattr(exec_result, "execution_time_ms", 0.0),
            "total_time_ms": getattr(exec_result, "total_time_ms", 0.0),
            "memory": exec_result.memory,
            "compile_output": exec_result.compile_output,
            "stderr": safe_top_stderr,
            "message": "Accepted! Solved problem awarded to scoreboard." if is_accepted else f"Verdict: {verdict_str} ({passed_count}/{len(all_tcs)} testcases passed)",
            "testcase_results": submit_tc_results,
        }
