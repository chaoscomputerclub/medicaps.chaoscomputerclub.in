"""
Chaos Computer Club Medi-Caps — Practice Platform & Coding Activity Service
Authoritative domain service handling practice problem repository, LeetCode-style
function execution/judge submissions, atomic member statistics, and 365-day activity aggregation.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException
from sqlalchemy import (
    and_,
    case,
    cast,
    Date,
    distinct,
    extract,
    func,
    or_,
    select,
    update,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import delete_cache, get_cache, set_cache
from app.core.config import settings
from app.core.redis import get_redis_client
from app.engine.contracts import EvaluationConfig, FunctionSignature
from app.engine.enums import ComparisonMode, SubmissionMode, Verdict
from app.engine.binder import InputBinder, InputBindingError
from app.engine.judge import JudgeEngine
from app.engine.adapters import OutputEvaluator
from app.engine.execution_router import ExecutionRouter
from app.engine.languages import LanguageRegistry
from app.engine.build_plan import SourcePlanBuilder
from app.engine.schemas import TestCaseSchema, TestCaseResult
from app.models.base import now_utc
from app.models.contest import ContestSubmission
from app.models.member import MemberProfile
from app.models.problem import MemberProblemStats, Problem, ProblemTestCase
from app.services.event_broadcaster import broadcast_event

logger = logging.getLogger("PracticeService")

CANONICAL_TOPICS = [
    "Arrays",
    "Strings",
    "Hash Table",
    "Two Pointers",
    "Binary Search",
    "Stack",
    "Queue",
    "Linked List",
    "Trees",
    "Graphs",
    "Dynamic Programming",
    "Greedy",
    "Backtracking",
    "Bit Manipulation",
    "Math",
    "Sorting",
    "Heap",
    "Prefix Sum",
    "Algorithms",
]


class PracticeService:
    """Canonical domain service for the Practice Platform and Coding Activity."""

    # ─── TAXONOMY ────────────────────────────────────────────────────────────
    @staticmethod
    async def get_topics(db: AsyncSession) -> List[Dict[str, Any]]:
        """Returns canonical taxonomy of DSA topics with problem counts."""
        res = await db.execute(
            select(Problem.topic, func.count(Problem.id))
            .where(Problem.status == "PUBLISHED")
            .group_by(Problem.topic)
        )
        counts = {row[0]: row[1] for row in res.all()}
        result = []
        for topic in CANONICAL_TOPICS:
            result.append({
                "name": topic,
                "slug": topic.lower().replace(" ", "-"),
                "problem_count": counts.get(topic, 0),
            })
        return result

    # ─── PROBLEM LISTING ─────────────────────────────────────────────────────
    @classmethod
    async def list_practice_problems(
        cls,
        db: AsyncSession,
        current_member: Optional[MemberProfile] = None,
        q: Optional[str] = None,
        difficulty: Optional[str] = None,
        topic: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        limit: int = 50,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Server-side filtered and paginated list of published practice problems.
        Includes authoritative solved/attempted status for authenticated users.
        """
        page = max(1, page)
        limit = min(max(1, limit), 100)
        offset = (page - 1) * limit

        # Base query for published problems
        conditions = [Problem.status == "PUBLISHED"]

        if q and q.strip():
            clean_q = f"%{q.strip()}%"
            conditions.append(
                or_(
                    Problem.title.ilike(clean_q),
                    Problem.topic.ilike(clean_q),
                    Problem.description.ilike(clean_q),
                    Problem.problem_index.ilike(clean_q),
                )
            )

        if difficulty and difficulty.strip() and difficulty.upper() != "ALL":
            conditions.append(func.upper(Problem.difficulty) == difficulty.strip().upper())

        if topic and topic.strip() and topic.upper() != "ALL":
            t_clean = topic.strip().replace("-", " ")
            conditions.append(
                or_(
                    func.lower(Problem.topic) == topic.strip().lower(),
                    func.lower(Problem.topic) == t_clean.lower(),
                )
            )

        member_id = current_member.id if current_member else None
        is_user_status_filter = bool(status and status.strip() and status.upper() != "ALL")

        # Cache key for public practice catalog (when not filtering by user's personal solved state)
        catalog_cache_key = f"cache:practice:catalog:{difficulty or 'all'}:{topic or 'all'}:all:{q or 'none'}:{sort or 'default'}:{limit}:{offset}"
        cached_catalog = None
        if not is_user_status_filter:
            cached_catalog = await get_cache(catalog_cache_key)

        if cached_catalog is not None:
            items = [dict(it) for it in cached_catalog.get("items", [])]
            total_matching = cached_catalog.get("total", len(items))
            prob_ids = [it["id"] for it in items]

            # Overlay user's solved state if authenticated
            if member_id and prob_ids:
                stats_rows = await db.scalars(
                    select(MemberProblemStats).where(
                        MemberProblemStats.member_id == member_id,
                        MemberProblemStats.problem_id.in_(prob_ids),
                    )
                )
                user_states = {s.problem_id: s.status for s in stats_rows.all()}
                for it in items:
                    st = user_states.get(it["id"], "UNATTEMPTED")
                    it["solved_status"] = st
                    it["user_status"] = st
        else:
            # Build query
            base_query = select(Problem).where(and_(*conditions))

            # Join member stats only if filtering by personal status
            if member_id and is_user_status_filter:
                base_query = base_query.outerjoin(
                    MemberProblemStats,
                    and_(
                        MemberProblemStats.problem_id == Problem.id,
                        MemberProblemStats.member_id == member_id,
                    ),
                )
                st = status.strip().upper()
                if st == "SOLVED":
                    base_query = base_query.where(MemberProblemStats.status == "SOLVED")
                elif st == "ATTEMPTED":
                    base_query = base_query.where(MemberProblemStats.status == "ATTEMPTED")
                elif st == "UNSOLVED":
                    base_query = base_query.where(
                        or_(
                            MemberProblemStats.status.is_(None),
                            MemberProblemStats.status == "UNATTEMPTED",
                        )
                    )

            # Count total matching
            count_stmt = select(func.count()).select_from(base_query.subquery())
            total_matching = (await db.scalar(count_stmt)) or 0

            # Sort order
            if sort == "difficulty_asc":
                order_case = case(
                    (func.upper(Problem.difficulty) == "EASY", 1),
                    (func.upper(Problem.difficulty) == "MEDIUM", 2),
                    (func.upper(Problem.difficulty) == "HARD", 3),
                    else_=4,
                )
                base_query = base_query.order_by(order_case.asc(), Problem.problem_index.asc())
            elif sort == "difficulty_desc":
                order_case = case(
                    (func.upper(Problem.difficulty) == "HARD", 1),
                    (func.upper(Problem.difficulty) == "MEDIUM", 2),
                    (func.upper(Problem.difficulty) == "EASY", 3),
                    else_=4,
                )
                base_query = base_query.order_by(order_case.asc(), Problem.problem_index.asc())
            elif sort == "title_asc":
                base_query = base_query.order_by(Problem.title.asc())
            else:
                base_query = base_query.order_by(Problem.created_at.asc(), Problem.problem_index.asc())

            # Select items
            items_stmt = base_query.offset(offset).limit(limit)
            problems_rows = (await db.scalars(items_stmt)).all()

            # Batch compute acceptance rates & user solved states
            prob_ids = [p.id for p in problems_rows]
            user_states: Dict[str, str] = {}
            if member_id and prob_ids:
                stats_rows = await db.scalars(
                    select(MemberProblemStats).where(
                        MemberProblemStats.member_id == member_id,
                        MemberProblemStats.problem_id.in_(prob_ids),
                    )
                )
                for s in stats_rows.all():
                    user_states[s.problem_id] = s.status

            # Aggregate submission metrics for these problems
            acc_stats: Dict[str, Tuple[int, int]] = {}
            if prob_ids:
                subs_res = await db.execute(
                    select(
                        ContestSubmission.master_problem_id,
                        func.count(ContestSubmission.id).label("total_subs"),
                        func.count(
                            case((func.upper(ContestSubmission.verdict).in_(["ACCEPTED", "AC"]), 1))
                        ).label("accepted_subs"),
                    )
                    .where(
                        ContestSubmission.master_problem_id.in_(prob_ids),
                        ContestSubmission.context == "PRACTICE",
                    )
                    .group_by(ContestSubmission.master_problem_id)
                )
                for row in subs_res.all():
                    acc_stats[row[0]] = (row[1] or 0, row[2] or 0)

            items = []
            public_cache_items = []
            for p in problems_rows:
                total_s, acc_s = acc_stats.get(p.id, (0, 0))
                rate = round((acc_s / total_s) * 100, 1) if total_s > 0 else 0.0
                solved_state = user_states.get(p.id, "UNATTEMPTED")

                item_dict = {
                    "id": p.id,
                    "problem_index": p.problem_index,
                    "title": p.title,
                    "slug": p.slug,
                    "difficulty": p.difficulty,
                    "topic": p.topic,
                    "points": p.points,
                    "acceptance_rate": rate,
                    "submission_count": total_s,
                    "solved_status": solved_state,
                    "user_status": solved_state,
                    "tags": p.tags or [],
                }
                items.append(item_dict)

                public_item = dict(item_dict)
                public_item["solved_status"] = "UNATTEMPTED"
                public_item["user_status"] = "UNATTEMPTED"
                public_cache_items.append(public_item)

            if not is_user_status_filter:
                await set_cache(catalog_cache_key, {"items": public_cache_items, "total": total_matching}, ttl_seconds=60)

        # Summary telemetry
        user_summary = {"total_problems": total_matching, "solved_count": 0, "attempted_count": 0}
        if member_id:
            summary_res = await db.execute(
                select(
                    func.count(case((MemberProblemStats.status == "SOLVED", 1))),
                    func.count(case((MemberProblemStats.status == "ATTEMPTED", 1))),
                ).where(MemberProblemStats.member_id == member_id)
            )
            row = summary_res.first()
            if row:
                user_summary["solved_count"] = row[0] or 0
                user_summary["attempted_count"] = row[1] or 0

        total_published = (
            await db.scalar(
                select(func.count(Problem.id)).where(Problem.status == "PUBLISHED")
            )
        ) or 0
        user_summary["total_problems"] = total_published
        user_summary["total_published"] = total_published

        return {
            "problems": items,
            "items": items,
            "total": total_matching,
            "page": page,
            "limit": limit,
            "total_pages": (total_matching + limit - 1) // limit if limit > 0 else 1,
            "summary": user_summary,
        }

    # ─── PROBLEM DETAIL ──────────────────────────────────────────────────────
    @classmethod
    async def get_practice_problem(
        cls,
        db: AsyncSession,
        slug_or_id: str,
        current_member: Optional[MemberProfile] = None,
    ) -> Dict[str, Any]:
        """
        Fetches practice problem detail with visible sample testcases.
        Hidden testcases are NEVER included for students.
        """
        stmt = select(Problem).where(or_(Problem.id == slug_or_id, Problem.slug == slug_or_id))
        problem = await db.scalar(stmt)
        if not problem:
            raise HTTPException(status_code=404, detail=f"Problem '{slug_or_id}' not found.")

        # RBAC: Only published problems are visible to students
        is_admin = False
        if current_member and current_member.email:
            is_admin = (
                current_member.email.strip().lower() in settings.core_team_emails_set
                or getattr(current_member, "role", "student") in ("admin", "proctor", "core")
            )

        if problem.status != "PUBLISHED" and not is_admin:
            raise HTTPException(status_code=404, detail="Problem is in draft or archived state.")

        # Fetch visible testcases only
        tc_stmt = select(ProblemTestCase).where(
            ProblemTestCase.problem_id == problem.id,
            ProblemTestCase.version == problem.version,
            ProblemTestCase.is_active == True,
            ProblemTestCase.is_hidden == False,
        ).order_by(ProblemTestCase.order.asc(), ProblemTestCase.created_at.asc())
        samples = (await db.scalars(tc_stmt)).all()

        from app.engine.binder import InputBinder
        visible_samples = []
        for tc in samples:
            clean_inp = tc.input_data
            if clean_inp is not None:
                parsed_inp = InputBinder.parse_raw_input(clean_inp)
                if isinstance(parsed_inp, dict) and "raw" in parsed_inp and len(parsed_inp) == 1:
                    clean_inp = parsed_inp["raw"]
                elif isinstance(parsed_inp, dict) and "input" in parsed_inp and len(parsed_inp) == 1:
                    clean_inp = parsed_inp["input"]
                elif isinstance(parsed_inp, (list, dict)):
                    clean_inp = parsed_inp
            visible_samples.append({
                "testcase_id": tc.testcase_id,
                "input": clean_inp,
                "expected_output": tc.expected_output,
                "explanation": tc.explanation,
                "weight": tc.weight,
                "order": tc.order,
            })

        # User's individual solved statistics
        user_status = "UNATTEMPTED"
        user_stats_data = None
        if current_member:
            stats = await db.scalar(
                select(MemberProblemStats).where(
                    MemberProblemStats.member_id == current_member.id,
                    MemberProblemStats.problem_id == problem.id,
                )
            )
            if stats:
                user_status = stats.status
                user_stats_data = {
                    "status": stats.status,
                    "attempt_count": stats.attempt_count,
                    "best_runtime": stats.best_runtime,
                    "best_memory": stats.best_memory,
                    "accepted_at": stats.accepted_at.isoformat() if stats.accepted_at else None,
                }

        # Editorial is exposed only if problem policy allows or problem is solved
        editorial_available = bool(problem.editorial and isinstance(problem.editorial, dict) and problem.editorial.get("approach"))
        editorial_content = None
        if editorial_available and (user_status == "SOLVED" or is_admin):
            editorial_content = problem.editorial

        fn_sig_dict = problem.function_signature or {}
        if not fn_sig_dict or (isinstance(fn_sig_dict, dict) and not fn_sig_dict.get("name") and not fn_sig_dict.get("parameters")):
            if str(problem.execution_mode).upper() not in ("FULL_PROGRAM", "STDIN_STDOUT"):
                starter_dict = getattr(problem, "starter_code", None)
                if not isinstance(starter_dict, dict):
                    starter_dict = getattr(problem, "starter_codes", None)
                if isinstance(starter_dict, dict) and any(isinstance(v, str) for v in starter_dict.values()):
                    try:
                        from app.engine.build_plan import infer_function_signature_from_sources
                        inferred_fn, inferred_params = infer_function_signature_from_sources(
                            starter_codes=starter_dict,
                            lang_str="python",
                        )
                        if inferred_fn:
                            fn_sig_dict = {
                                "name": inferred_fn,
                                "function_name": inferred_fn,
                                "class_name": "Solution",
                                "parameters": [{"name": p[0], "type": p[1] if p[1] != "object" else "any"} for p in inferred_params],
                                "return_type": "any",
                            }
                    except Exception:
                        pass

        return {
            "id": problem.id,
            "problem_index": problem.problem_index,
            "title": problem.title,
            "slug": problem.slug,
            "difficulty": problem.difficulty,
            "topic": problem.topic,
            "points": problem.points,
            "description": problem.description,
            "constraints": problem.constraints,
            "input_format": problem.input_format,
            "output_format": problem.output_format,
            "execution_mode": problem.execution_mode,
            "function_signature": fn_sig_dict,
            "starter_code": problem.starter_code or {},
            "time_limit": problem.time_limit,
            "memory_limit": problem.memory_limit,
            "hints": problem.hints or [],
            "tags": problem.tags or [],
            "status": problem.status,
            "version": problem.version,
            "samples": visible_samples,
            "sample_testcases": visible_samples,
            "user_status": user_status,
            "user_stats": user_stats_data,
            "editorial_available": editorial_available,
            "editorial": editorial_content,
        }

    # ─── INTERNAL: Resolve execution contract (mirrors ContestExecutionService) ──
    @classmethod
    async def _resolve_practice_execution_contract(
        cls,
        problem: Problem,
        db: AsyncSession,
    ) -> Tuple[Optional[FunctionSignature], Optional[EvaluationConfig], List[Dict[str, Any]], List[Dict[str, Any]], float, int, str]:
        """
        Resolves fn_sig, eval_cfg, visible_cases, hidden_cases, time_limit, memory_limit, exec_mode.
        Mirrors ContestExecutionService._resolve_problem_execution_contract exactly.
        Raw input_data is passed as-is; InputBinder handles parsing internally.
        """
        fn_sig = None
        eval_cfg = None
        visible_cases: List[Dict[str, Any]] = []
        hidden_cases: List[Dict[str, Any]] = []
        time_limit = getattr(problem, "time_limit", 2.0) or 2.0
        memory_limit = getattr(problem, "memory_limit", 256) or 256

        # Fetch all active testcases for this problem version
        tc_stmt = select(ProblemTestCase).where(
            ProblemTestCase.problem_id == problem.id,
            ProblemTestCase.version == (problem.version or 1),
            ProblemTestCase.is_active == True,
        ).order_by(ProblemTestCase.order.asc(), ProblemTestCase.created_at.asc())
        vault_cases = (await db.scalars(tc_stmt)).all()

        if not vault_cases:
            fallback_stmt = select(ProblemTestCase).where(
                ProblemTestCase.problem_id == problem.id,
                ProblemTestCase.is_active == True,
            ).order_by(ProblemTestCase.order.asc(), ProblemTestCase.created_at.asc())
            vault_cases = (await db.scalars(fallback_stmt)).all()

        for vc in vault_cases:
            # Pass raw input_data exactly as stored — identical to contest service
            c_dict = {
                "testcase_id": vc.testcase_id,
                "input": vc.input_data,
                "expected_output": vc.expected_output,
                "explanation": vc.explanation,
                "weight": float(vc.weight or 1.0),
                "is_hidden": bool(vc.is_hidden),
                "order": vc.order,
            }
            if vc.is_hidden:
                hidden_cases.append(c_dict)
            else:
                visible_cases.append(c_dict)

        # Resolve function signature
        raw_sig = getattr(problem, "function_signature", None)
        if isinstance(raw_sig, str):
            try:
                raw_sig = json.loads(raw_sig)
            except Exception:
                pass
        if raw_sig and isinstance(raw_sig, dict) and (raw_sig.get("name") or raw_sig.get("function_name") or raw_sig.get("parameters")):
            try:
                fn_sig = FunctionSignature(**raw_sig)
            except Exception:
                pass

        # Fallback: infer fn_sig from starter codes (identical to contest service)
        if not fn_sig or not getattr(fn_sig, "name", "") or len(fn_sig.parameters) == 0:
            starter_dict = getattr(problem, "starter_codes", None)
            if not isinstance(starter_dict, dict):
                starter_dict = getattr(problem, "starter_code", None)
            if isinstance(starter_dict, dict) and any(isinstance(v, str) for v in starter_dict.values()):
                try:
                    from app.engine.build_plan import infer_function_signature_from_sources
                    from app.engine.contracts import ParameterDefinition
                    inferred_fn, inferred_params = infer_function_signature_from_sources(
                        starter_codes=starter_dict,
                        lang_str="python",
                    )
                    if inferred_fn:
                        fn_sig = FunctionSignature(
                            class_name="Solution",
                            name=inferred_fn,
                            function_name=inferred_fn,
                            parameters=[ParameterDefinition(name=p[0], type=p[1]) for p in inferred_params],
                            return_type="any",
                        )
                except Exception:
                    pass

        # Resolve evaluation config
        raw_eval = getattr(problem, "evaluation_config", None)
        if isinstance(raw_eval, str):
            try:
                raw_eval = json.loads(raw_eval)
            except Exception:
                pass
        if raw_eval and isinstance(raw_eval, dict):
            try:
                eval_cfg = EvaluationConfig(**raw_eval)
            except Exception:
                pass

        exec_mode = getattr(problem, "execution_mode", None)
        if not exec_mode or exec_mode == "FUNCTION":
            exec_mode = "FUNCTION" if fn_sig else "STDIN_STDOUT"
        elif fn_sig and exec_mode != "FULL_PROGRAM":
            exec_mode = "FUNCTION"

        return fn_sig, eval_cfg, visible_cases, hidden_cases, time_limit, memory_limit, exec_mode

    # ─── RUN PRACTICE CODE (SAMPLE TESTS) ────────────────────────────────────
    @classmethod
    async def run_practice_code(
        cls,
        db: AsyncSession,
        slug_or_id: str,
        code: str,
        language: str,
        current_member: Optional[MemberProfile] = None,
    ) -> Dict[str, Any]:
        """
        Executes user code against visible sample test cases without persisting a submission.
        Uses the IDENTICAL architecture as ContestExecutionService.run_arena_code.
        """
        stmt = select(Problem).where(or_(Problem.id == slug_or_id, Problem.slug == slug_or_id))
        problem = await db.scalar(stmt)
        if not problem:
            raise HTTPException(status_code=404, detail=f"Problem '{slug_or_id}' not found.")

        fn_sig, eval_cfg, sample_list, _, time_limit, memory_limit, exec_mode = \
            await cls._resolve_practice_execution_contract(problem, db)

        try:
            lang_enum = LanguageRegistry.normalize(language)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

        is_fn_mode = str(exec_mode).upper() not in ("FULL_PROGRAM", "STDIN_STDOUT")
        submission_mode = SubmissionMode.FUNCTION if is_fn_mode else SubmissionMode.FULL_PROGRAM
        adapter = LanguageRegistry.get_adapter(lang_enum) if is_fn_mode else None

        raw_cases = sample_list
        tc_binding_errors: dict = {}
        tcs: List[TestCaseSchema] = []
        for i, s in enumerate(raw_cases):
            inp = s.get("input") if s.get("input") is not None else s.get("stdin", "")
            if is_fn_mode and adapter and fn_sig:
                try:
                    stdin_payload = adapter.serialize_input(fn_sig, inp)
                except InputBindingError as e:
                    stdin_payload = ""
                    tc_binding_errors[i] = str(e)
            else:
                if isinstance(inp, (dict, list)):
                    parsed_raw = InputBinder.parse_raw_input(inp)
                    stdin_payload = json.dumps(parsed_raw, ensure_ascii=False)
                else:
                    stdin_payload = str(inp) if inp is not None else ""

            exp_out = s.get("expected_output") if s.get("expected_output") is not None else s.get("output", "")
            clean_exp_out = exp_out
            if isinstance(clean_exp_out, str):
                s_trimmed = clean_exp_out.strip()
                if s_trimmed.startswith('"') and s_trimmed.endswith('"') and len(s_trimmed) >= 2:
                    try:
                        clean_exp_out = json.loads(s_trimmed)
                    except Exception:
                        clean_exp_out = s_trimmed[1:-1]

            tcs.append(TestCaseSchema(
                id=s.get("testcase_id", f"sample_{i+1}"),
                name=f"Sample Test {i+1}",
                stdin=stdin_payload,
                expected_output=str(clean_exp_out),
                return_type=fn_sig.return_type if (is_fn_mode and fn_sig) else None,
                expected_val=clean_exp_out,
            ))

        if not tcs:
            tcs = [TestCaseSchema(id="sample_1", name="Sample 1", stdin="", expected_output="")]
            raw_cases = [{"testcase_id": "sample_1", "input": "", "expected_output": "", "is_hidden": False}]

        build_plan = SourcePlanBuilder.build_plan(
            language=lang_enum,
            user_source=code,
            submission_mode=submission_mode,
            function_signature=fn_sig if is_fn_mode else None,
            starter_codes=getattr(problem, "starter_codes", None) or getattr(problem, "starter_code", None) or {},
            method_name=fn_sig.name if (is_fn_mode and fn_sig) else None,
        )
        exec_code = build_plan.generated_source
        LanguageRegistry.validate_source(lang_enum, exec_code)

        problem_id = str(problem.id)
        member_id_str = str(current_member.id) if current_member else None

        try:
            await db.rollback()
        except Exception:
            pass

        from app.engine.providers.factory import get_judge_provider
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
            problem_id=problem_id,
            member_id=member_id_str,
            override_provider=test_override,
        )

        testcase_results = []
        passed_count = 0
        for i, tr in enumerate(exec_result.testcase_results):
            raw_case = raw_cases[i] if i < len(raw_cases) else {}
            exp_val = raw_case.get("expected_output") if raw_case.get("expected_output") is not None else raw_case.get("output", "")

            if i in tc_binding_errors:
                tr.passed = False
                tr.verdict = "INPUT_FORMAT_ERROR"
                tr.stderr = f"Input binding error: {tc_binding_errors[i]}"
            else:
                tr.passed = str(getattr(tr.verdict, "value", tr.verdict)).upper() in ("ACCEPTED",)

            if tr.passed:
                passed_count += 1

            clean_exp = str(exp_val)
            if clean_exp.startswith(('"', "'")) and clean_exp.endswith(('"', "'")) and len(clean_exp) >= 2:
                if not clean_exp.startswith(("[", "{")):
                    try:
                        clean_exp = json.loads(clean_exp) if clean_exp.startswith('"') else clean_exp[1:-1]
                    except Exception:
                        clean_exp = clean_exp[1:-1]

            v_str = tr.verdict.value if hasattr(tr.verdict, "value") else str(tr.verdict)
            wall_ms = getattr(tr, "wall_time_ms", 0.0) or 0.0
            run_ms = getattr(tr, "runtime_ms", 0.0) or wall_ms

            testcase_results.append({
                "testcase_id": tr.testcase_id or f"sample_{i+1}",
                "name": tr.name or f"Sample {i+1}",
                "passed": tr.passed,
                "verdict": v_str,
                "status": v_str,
                "stdout": tr.stdout or "",
                "actual_output": tr.stdout or "",
                "expected_output": str(clean_exp),
                "stdin": (tcs[i].stdin if i < len(tcs) else ""),
                "input": (tcs[i].stdin if i < len(tcs) else ""),
                "stderr": tr.stderr or "",
                "error": tr.stderr or "",
                "compile_output": tr.compile_output or "",
                "compile_error": tr.compile_output or "",
                "wall_time_ms": wall_ms,
                "runtime_ms": run_ms,
                "execution_time": run_ms / 1000.0,
            })

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
                    "status": tc_v,
                    "stdout": "",
                    "actual_output": "",
                    "expected_output": str(missing_tc.expected_output),
                    "stdin": missing_tc.stdin,
                    "input": missing_tc.stdin,
                    "stderr": tc_err,
                    "error": tc_err,
                    "compile_output": exec_result.compile_output or "",
                    "compile_error": exec_result.compile_output or "",
                    "wall_time_ms": 0.0,
                    "runtime_ms": 0.0,
                    "execution_time": 0.0,
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

        runtime_ms = round((exec_result.time or 0.0) * 1000.0, 2)
        memory_kb = int((exec_result.memory or 0.0) * 1024)
        exec_status_str = exec_result.status.value if hasattr(exec_result.status, "value") else str(exec_result.status)

        return {
            "success": all_passed,
            "verdict": final_verdict,
            "status": exec_status_str,
            "job_id": exec_result.job_id,
            "attempt_id": exec_result.attempt_id,
            "lease_id": exec_result.lease_id,
            "node_id": exec_result.node_id,
            "container_id": exec_result.container_id,
            "provider": exec_result.provider,
            "timestamps": getattr(exec_result, "timestamps", {}),
            "latencies": getattr(exec_result, "latencies", {}),
            "telemetry": getattr(exec_result, "telemetry", {}),
            "stdout": exec_result.stdout or "",
            "stderr": exec_result.stderr or "",
            "compile_output": exec_result.compile_output or "",
            "time": exec_result.time or 0.0,
            "compile_time_ms": getattr(exec_result, "compile_time_ms", 0.0),
            "execution_time_ms": getattr(exec_result, "execution_time_ms", 0.0),
            "memory": exec_result.memory or 0.0,
            "memory_kb": memory_kb,
            "passed_count": passed_count,
            "passed_testcases": passed_count,
            "total_count": len(testcase_results),
            "total_testcases": len(testcase_results),
            "score": exec_result.score,
            "testcases": testcase_results,
            "testcase_results": testcase_results,
        }

    # ─── SUBMIT PRACTICE CODE (FULL JUDGE SUITE) ─────────────────────────────
    @classmethod
    async def submit_practice_code(
        cls,
        db: AsyncSession,
        slug_or_id: str,
        code: str,
        language: str,
        current_member: MemberProfile,
    ) -> Dict[str, Any]:
        """
        Executes user code against full judge test suite (sample + hidden testcases).
        Uses the IDENTICAL architecture as ContestExecutionService.submit_arena_code.
        """
        if not current_member:
            raise HTTPException(status_code=401, detail="Authentication required to submit practice solutions.")

        member_id = str(current_member.id)
        member_handle = getattr(current_member, "handle", None) or f"cadet_{member_id[:6]}"

        stmt = select(Problem).where(or_(Problem.id == slug_or_id, Problem.slug == slug_or_id))
        problem = await db.scalar(stmt)
        if not problem:
            raise HTTPException(status_code=404, detail=f"Problem '{slug_or_id}' not found.")

        problem_id = str(problem.id)
        problem_slug = str(problem.slug)
        problem_points = problem.points or 0
        problem_difficulty = problem.difficulty

        # Debounce duplicate submissions (2-second window)
        import hashlib
        try:
            r = get_redis_client()
            if r:
                code_hash = hashlib.sha256(code.strip().encode("utf-8")).hexdigest()[:16]
                dedup_key = f"practice_debounce:{problem_id}:{member_id}:{code_hash}"
                is_new = await r.set(dedup_key, "1", ex=2, nx=True)
                if not is_new:
                    raise HTTPException(
                        status_code=429,
                        detail="Duplicate submission detected. Please wait 2 seconds before submitting again."
                    )
        except HTTPException:
            raise
        except Exception:
            pass

        submission_id = str(uuid.uuid4())

        # Resolve execution contract via shared helper (identical to contest service)
        fn_sig, eval_cfg, samples, hidden, time_limit, memory_limit, exec_mode = \
            await cls._resolve_practice_execution_contract(problem, db)


        # Full suite: sample + hidden (mirrors contest submit_arena_code exactly)
        all_raw = samples + hidden
        try:
            lang_enum = LanguageRegistry.normalize(language)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

        is_fn_mode = str(exec_mode).upper() not in ("FULL_PROGRAM", "STDIN_STDOUT")
        submission_mode = SubmissionMode.FUNCTION if is_fn_mode else SubmissionMode.FULL_PROGRAM
        adapter = LanguageRegistry.get_adapter(lang_enum) if is_fn_mode else None

        tc_binding_errors: dict = {}
        tcs: List[TestCaseSchema] = []
        for i, s in enumerate(all_raw):
            inp = s.get("input") if s.get("input") is not None else s.get("stdin", "")
            is_hid = bool(s.get("is_hidden", False))
            if is_fn_mode and adapter and fn_sig:
                try:
                    stdin_payload = adapter.serialize_input(fn_sig, inp)
                except InputBindingError as e:
                    stdin_payload = ""
                    tc_binding_errors[i] = str(e)
            else:
                if isinstance(inp, (dict, list)):
                    parsed_raw = InputBinder.parse_raw_input(inp)
                    stdin_payload = json.dumps(parsed_raw, ensure_ascii=False)
                else:
                    stdin_payload = str(inp) if inp is not None else ""

            exp_out = s.get("expected_output") if s.get("expected_output") is not None else s.get("output", "")
            clean_exp_out = exp_out
            if isinstance(clean_exp_out, str):
                s_trimmed = clean_exp_out.strip()
                if s_trimmed.startswith('"') and s_trimmed.endswith('"') and len(s_trimmed) >= 2:
                    try:
                        clean_exp_out = json.loads(s_trimmed)
                    except Exception:
                        clean_exp_out = s_trimmed[1:-1]

            tcs.append(TestCaseSchema(
                id=s.get("testcase_id", f"tc_{i+1}"),
                name=f"Test {i+1}",
                stdin=stdin_payload,
                expected_output=str(clean_exp_out),
                hidden=is_hid,
                weight=float(s.get("weight", 1.0) or 1.0),
                return_type=fn_sig.return_type if (is_fn_mode and fn_sig) else None,
                expected_val=clean_exp_out,
            ))

        if not tcs:
            tcs = [TestCaseSchema(id="tc_1", name="Test 1", stdin="", expected_output="")]
            all_raw = [{"testcase_id": "tc_1", "input": "", "expected_output": "", "is_hidden": False}]
            samples = all_raw

        raw_cases = all_raw

        build_plan = SourcePlanBuilder.build_plan(
            language=lang_enum,
            user_source=code,
            submission_mode=submission_mode,
            function_signature=fn_sig if is_fn_mode else None,
            starter_codes=getattr(problem, "starter_codes", None) or getattr(problem, "starter_code", None) or {},
            method_name=fn_sig.name if (is_fn_mode and fn_sig) else None,
        )
        exec_code = build_plan.generated_source
        LanguageRegistry.validate_source(lang_enum, exec_code)

        # Release DB connection back to pool before sandbox execution
        try:
            await db.rollback()
        except Exception:
            pass

        from app.engine.providers.factory import get_judge_provider
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
            is_submit=True,
            submission_id=submission_id,
            problem_id=problem_id,
            member_id=member_id,
            override_provider=test_override,
        )

        testcase_results_raw = []
        passed_count = 0
        for i, tr in enumerate(exec_result.testcase_results):
            rc = raw_cases[i] if i < len(raw_cases) else {}
            exp_val = rc.get("expected_output") if rc.get("expected_output") is not None else rc.get("output", "")

            if i in tc_binding_errors:
                tr.passed = False
                tr.verdict = "INPUT_FORMAT_ERROR"
                tr.stderr = f"Input binding error: {tc_binding_errors[i]}"
            else:
                tr.passed = str(getattr(tr.verdict, "value", tr.verdict)).upper() in ("ACCEPTED",)

            if tr.passed:
                passed_count += 1
            testcase_results_raw.append(tr)

        if len(testcase_results_raw) < len(tcs):
            for missing_idx in range(len(testcase_results_raw), len(tcs)):
                missing_tc = tcs[missing_idx]
                tc_v = Verdict.NOT_EXECUTED.value

                class _FakeTR:
                    pass
                ftr = _FakeTR()
                ftr.testcase_id = missing_tc.id
                ftr.name = missing_tc.name
                ftr.passed = False
                ftr.verdict = tc_v
                ftr.stdout = ""

                ftr.stderr = ""
                ftr.compile_output = exec_result.compile_output or ""
                ftr.wall_time_ms = 0.0
                testcase_results_raw.append(ftr)

        all_passed = (passed_count == len(tcs)) and len(tcs) > 0
        if all_passed:
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

        is_accepted = verdict_str == "ACCEPTED"

        # Check existing solve status before updating stats
        prev_stats = await db.scalar(
            select(MemberProblemStats).where(
                MemberProblemStats.member_id == member_id,
                MemberProblemStats.problem_id == problem_id,
            )
        )
        was_previously_solved = (prev_stats is not None and prev_stats.status == "SOLVED")

        # Create canonical submission record in contest_submissions table
        submission = ContestSubmission(
            id=submission_id,
            context="PRACTICE",
            contest_id=None,
            problem_id=None,
            master_problem_id=problem_id,
            member_id=member_id,
            handle=member_handle,
            language=str(language),
            code=code,
            verdict=verdict_str,
            passed_testcases=passed_count,
            total_testcases=len(tcs),
            execution_time=exec_result.time or 0.0,
            memory_used=exec_result.memory or 0.0,
            points_awarded=problem_points if is_accepted else 0,
            submitted_at=now_utc(),
        )
        db.add(submission)
        await db.commit()

        # Update or create MemberProblemStats atomically
        await cls.update_member_problem_stats(
            session=db,
            member_id=member_id,
            problem_id=problem_id,
            is_accepted=is_accepted,
            runtime=exec_result.time,
            memory=exec_result.memory,
        )

        now_ts = now_utc()

        # Invalidate member caches
        await delete_cache(f"cache:profile:{member_id}")
        await delete_cache(f"member:problem-stats:{member_id}")
        for yr in [now_ts.year, now_ts.year - 1]:
            await delete_cache(f"member:activity:{member_id}:{yr}")

        # Broadcast realtime event
        await broadcast_event(
            event_type="submission_completed",
            data={
                "submission_id": submission_id,
                "problem_id": problem_id,
                "problem_slug": problem_slug,
                "member_id": member_id,
                "verdict": verdict_str,
                "context": "PRACTICE",
                "is_accepted": is_accepted,
                "new_solve": is_accepted and not was_previously_solved,
            },
        )
        if is_accepted and not was_previously_solved:
            await broadcast_event(
                event_type="problem_solved",
                data={
                    "problem_id": problem_id,
                    "problem_slug": problem_slug,
                    "member_id": member_id,
                    "handle": member_handle,
                    "difficulty": problem_difficulty,
                },
            )

        # Build redacted testcase results for student privacy (mirrors contest submit_arena_code)
        submit_tc_results = []
        first_failing_case = None

        for i, tr in enumerate(testcase_results_raw):
            is_hid = bool(raw_cases[i].get("is_hidden", False)) if i < len(raw_cases) else (i >= len(samples))
            v_str = tr.verdict.value if hasattr(tr.verdict, "value") else str(tr.verdict)
            wall_ms = getattr(tr, "wall_time_ms", 0.0) or 0.0
            run_ms = getattr(tr, "runtime_ms", 0.0) or wall_ms
            peak_mb = getattr(tr, "peak_memory_mb", 0.0) or 0.0

            item = {
                "testcase_id": tr.testcase_id or f"TC-{i+1}",
                "name": f"Hidden Testcase {i - len(samples) + 1}" if is_hid else (tr.name or f"Sample {i+1}"),
                "status": v_str,
                "verdict": v_str,
                "passed": tr.passed,
                "is_hidden": is_hid,
                "stdout": "" if is_hid else (tr.stdout or ""),
                "actual_output": "" if is_hid else (tr.stdout or ""),
                "expected_output": "[Hidden]" if is_hid else str(raw_cases[i].get("expected_output", "") if i < len(raw_cases) else ""),
                "input": "[Hidden]" if is_hid else str(tcs[i].stdin if i < len(tcs) else ""),
                "stdin": "[Hidden]" if is_hid else str(tcs[i].stdin if i < len(tcs) else ""),
                "stderr": "" if is_hid else (tr.stderr or ""),
                "error": "" if is_hid else (tr.stderr or ""),
                "compile_output": tr.compile_output or "",
                "wall_time_ms": wall_ms,
                "runtime_ms": run_ms,
                "execution_time": run_ms / 1000.0,
                "memory_used": peak_mb,
                "memory_kb": int(peak_mb * 1024),
            }

            if not tr.passed and first_failing_case is None:
                first_failing_case = {
                    "testcase_id": item["testcase_id"],
                    "status": v_str,
                    "verdict": v_str,
                    "input": item["input"],
                    "expected_output": item["expected_output"],
                    "actual_output": item["actual_output"],
                    "stdout": item["stdout"],
                    "error": item["error"],
                    "stderr": item["stderr"],
                }

            submit_tc_results.append(item)

        exec_status_str = exec_result.status.value if hasattr(exec_result.status, "value") else str(exec_result.status)
        runtime_ms = round((exec_result.time or 0.0) * 1000.0, 2)
        memory_kb = int((exec_result.memory or 0.0) * 1024)

        return {
            "submission_id": submission_id,
            "verdict": verdict_str,
            "status": exec_status_str,
            "success": is_accepted,
            "is_accepted": is_accepted,
            "is_first_solve": is_accepted and not was_previously_solved,
            "score": problem_points if is_accepted else 0,
            "points_awarded": problem_points if is_accepted else 0,
            "runtime": runtime_ms,
            "runtime_ms": runtime_ms,
            "execution_time": exec_result.time or 0.0,
            "time": exec_result.time or 0.0,
            "memory": exec_result.memory or 0.0,
            "memory_used": exec_result.memory or 0.0,
            "memory_kb": memory_kb,
            "passed_count": passed_count,
            "passed_testcases": passed_count,
            "total_count": len(tcs),
            "total_testcases": len(tcs),
            "submitted_at": now_ts.isoformat(),
            "first_failing_case": first_failing_case,
            "testcases": submit_tc_results,
            "testcase_results": submit_tc_results,
            "compile_output": exec_result.compile_output or "",
            "compile_error": exec_result.compile_output or "",
            "stdout": exec_result.stdout or "",
            "stderr": exec_result.stderr or "",
            "message": "Accepted! Problem solved successfully." if is_accepted else f"Verdict: {verdict_str} ({passed_count}/{len(tcs)} testcases passed)",
            "user_status": "SOLVED" if (is_accepted or was_previously_solved) else "ATTEMPTED",
        }
    # ─── PRACTICE SUBMISSIONS HISTORY ────────────────────────────────────────
    @classmethod
    async def get_practice_submissions(
        cls,
        db: AsyncSession,
        slug_or_id: str,
        current_member: MemberProfile,
        limit: int = 30,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Returns student's submission history for a specific practice problem."""
        stmt = select(Problem).where(or_(Problem.id == slug_or_id, Problem.slug == slug_or_id))
        problem = await db.scalar(stmt)
        if not problem:
            raise HTTPException(status_code=404, detail="Problem not found.")

        subs_stmt = (
            select(ContestSubmission)
            .where(
                ContestSubmission.master_problem_id == problem.id,
                ContestSubmission.member_id == current_member.id,
                ContestSubmission.context == "PRACTICE",
            )
            .order_by(ContestSubmission.submitted_at.desc())
            .offset(offset)
            .limit(min(limit, 100))
        )
        rows = (await db.scalars(subs_stmt)).all()

        return [
            {
                "id": s.id,
                "verdict": s.verdict,
                "language": s.language,
                "execution_time": s.execution_time,
                "memory_used": s.memory_used,
                "passed_testcases": s.passed_testcases,
                "total_testcases": s.total_testcases,
                "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            }
            for s in rows
        ]

    @classmethod
    async def get_recent_submissions(
        cls,
        db: AsyncSession,
        member_id: str,
        limit: int = 15,
        only_accepted: bool = False,
    ) -> List[Dict[str, Any]]:
        """Returns the cadet's most recent practice submissions with joined problem details."""
        query = (
            select(ContestSubmission, Problem)
            .outerjoin(Problem, ContestSubmission.master_problem_id == Problem.id)
            .where(
                ContestSubmission.member_id == member_id,
                or_(
                    ContestSubmission.context == "PRACTICE",
                    ContestSubmission.master_problem_id.isnot(None),
                ),
            )
        )
        if only_accepted:
            query = query.where(func.upper(ContestSubmission.verdict).in_(["ACCEPTED", "AC"]))

        query = query.order_by(ContestSubmission.submitted_at.desc()).limit(min(limit, 50))
        res = await db.execute(query)
        rows = res.all()

        results = []
        for s, p in rows:
            results.append({
                "id": s.id,
                "problem_id": s.master_problem_id,
                "problem_title": p.title if p else "Practice Challenge",
                "problem_slug": p.slug if p else "",
                "difficulty": p.difficulty if p else "MEDIUM",
                "verdict": s.verdict,
                "language": s.language,
                "execution_time": s.execution_time,
                "memory_used": s.memory_used,
                "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            })
        return results

    # ─── 365-DAY ACTIVITY AGGREGATION ────────────────────────────────────────
    @classmethod
    async def get_user_activity(
        cls,
        db: AsyncSession,
        member_id: str,
        year: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Computes 365-day coding activity via single PostgreSQL aggregation.
        Canonical metric: daily_problem_activity = unique problems submitted per day.
        Includes current streak, longest streak, active days, and problem counts.
        """
        target_year = year or now_utc().year

        cache_key = f"member:activity:{member_id}:{target_year}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        # Aggregation over contest_submissions where context = 'PRACTICE'
        # Grouped by calendar day in UTC
        res = await db.execute(
            select(
                cast(ContestSubmission.submitted_at, Date).label("sub_date"),
                func.count(distinct(ContestSubmission.master_problem_id)).label("unique_problems"),
                func.count(ContestSubmission.id).label("total_submissions"),
                func.count(
                    case((func.upper(ContestSubmission.verdict).in_(["ACCEPTED", "AC"]), 1))
                ).label("accepted_count"),
            )
            .where(
                ContestSubmission.member_id == member_id,
                ContestSubmission.context == "PRACTICE",
                extract("year", ContestSubmission.submitted_at) == target_year,
            )
            .group_by("sub_date")
            .order_by("sub_date")
        )
        db_rows = res.all()
        day_map = {
            row[0]: {
                "unique_problems": row[1] or 0,
                "total_submissions": row[2] or 0,
                "accepted": row[3] or 0,
            }
            for row in db_rows
        }

        # Build complete calendar days for the year
        start_date = date(target_year, 1, 1)
        end_date = date(target_year, 12, 31)
        today_date = now_utc().date()

        days = []
        cur = start_date
        active_days_count = 0
        total_accepted_year = 0

        # Set of active dates for streak calculation
        active_dates = set()

        while cur <= end_date:
            cur_iso = cur.isoformat()
            metrics = day_map.get(cur, {"unique_problems": 0, "total_submissions": 0, "accepted": 0})
            activity = metrics["unique_problems"]
            if activity > 0:
                active_days_count += 1
                active_dates.add(cur)
                total_accepted_year += metrics["accepted"]

            days.append({
                "date": cur_iso,
                "activity": activity,
                "unique_problems": metrics["unique_problems"],
                "total_submissions": metrics["total_submissions"],
                "accepted": metrics["accepted"],
            })
            cur += timedelta(days=1)

        # Unique problems across the entire year
        unique_probs_res = await db.scalar(
            select(func.count(distinct(ContestSubmission.master_problem_id))).where(
                ContestSubmission.member_id == member_id,
                ContestSubmission.context == "PRACTICE",
                extract("year", ContestSubmission.submitted_at) == target_year,
            )
        )
        total_unique_problems = unique_probs_res or 0

        # Calculate streaks
        # Current streak: consecutive active calendar days ending today or yesterday
        current_streak = 0
        streak_cursor = today_date
        if streak_cursor not in active_dates:
            streak_cursor = today_date - timedelta(days=1)

        while streak_cursor in active_dates:
            current_streak += 1
            streak_cursor -= timedelta(days=1)

        # Longest streak in target year
        longest_streak = 0
        temp_streak = 0
        cur = start_date
        while cur <= end_date:
            if cur in active_dates:
                temp_streak += 1
                if temp_streak > longest_streak:
                    longest_streak = temp_streak
            else:
                temp_streak = 0
            cur += timedelta(days=1)

        result = {
            "year": target_year,
            "days": days,
            "summary": {
                "active_days": active_days_count,
                "total_problems": total_unique_problems,
                "total_accepted": total_accepted_year,
                "current_streak": current_streak,
                "longest_streak": longest_streak,
            },
        }

        # Cache for 60 seconds
        await set_cache(cache_key, result, ttl_seconds=60)
        return result

    # ─── PROBLEM STATS & SOLVED CIRCLE ───────────────────────────────────────
    @classmethod
    async def get_user_problem_stats(cls, db: AsyncSession, member_id: str) -> Dict[str, Any]:
        """
        Canonical solved problem metrics and difficulty distribution for Profile & Dashboard.
        """
        cache_key = f"member:problem-stats:{member_id}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        # Total published problems by difficulty
        diff_totals_res = await db.execute(
            select(func.upper(Problem.difficulty), func.count(Problem.id))
            .where(Problem.status == "PUBLISHED")
            .group_by(func.upper(Problem.difficulty))
        )
        diff_totals = {row[0]: row[1] for row in diff_totals_res.all()}
        total_published = sum(diff_totals.values())

        # Solved and attempted counts for this member
        user_solves_res = await db.execute(
            select(
                func.upper(Problem.difficulty),
                MemberProblemStats.status,
                func.count(MemberProblemStats.id),
            )
            .join(Problem, MemberProblemStats.problem_id == Problem.id)
            .where(
                MemberProblemStats.member_id == member_id,
                Problem.status == "PUBLISHED",
            )
            .group_by(func.upper(Problem.difficulty), MemberProblemStats.status)
        )

        solved_by_diff = {"EASY": 0, "MEDIUM": 0, "HARD": 0}
        total_solved = 0
        total_attempted = 0

        for diff, st, count in user_solves_res.all():
            if st == "SOLVED":
                solved_by_diff[diff] = solved_by_diff.get(diff, 0) + count
                total_solved += count
                total_attempted += count
            elif st == "ATTEMPTED":
                total_attempted += count

        result = {
            "problems": {
                "solved": total_solved,
                "attempted": total_attempted,
                "total": total_published,
            },
            "difficulty": {
                "easy": {
                    "solved": solved_by_diff.get("EASY", 0),
                    "total": diff_totals.get("EASY", 0),
                },
                "medium": {
                    "solved": solved_by_diff.get("MEDIUM", 0),
                    "total": diff_totals.get("MEDIUM", 0),
                },
                "hard": {
                    "solved": solved_by_diff.get("HARD", 0),
                    "total": diff_totals.get("HARD", 0),
                },
            },
        }

        await set_cache(cache_key, result, ttl_seconds=60)
        return result

    @classmethod
    async def update_member_problem_stats(
        cls,
        session: AsyncSession,
        member_id: str,
        problem_id: str,
        is_accepted: bool,
        runtime: Optional[float] = None,
        memory: Optional[int] = None,
    ) -> MemberProblemStats:
        """Atomically updates or creates MemberProblemStats preserving SOLVED invariant."""
        stats_stmt = select(MemberProblemStats).where(
            MemberProblemStats.member_id == member_id,
            MemberProblemStats.problem_id == problem_id,
        )
        stats = await session.scalar(stats_stmt)
        now_ts = now_utc()

        was_previously_solved = False
        if stats:
            was_previously_solved = (stats.status == "SOLVED")
            stats.attempt_count += 1
            stats.last_attempt_at = now_ts

            if is_accepted:
                stats.status = "SOLVED"
                if not stats.accepted_at:
                    stats.accepted_at = now_ts
                if runtime is not None and (stats.best_runtime is None or runtime < stats.best_runtime):
                    stats.best_runtime = runtime
                if memory is not None and (stats.best_memory is None or memory < stats.best_memory):
                    stats.best_memory = memory
            else:
                if not was_previously_solved:
                    stats.status = "ATTEMPTED"
        else:
            stats = MemberProblemStats(
                id=str(uuid.uuid4()),
                member_id=member_id,
                problem_id=problem_id,
                status="SOLVED" if is_accepted else "ATTEMPTED",
                attempt_count=1,
                first_attempt_at=now_ts,
                last_attempt_at=now_ts,
                accepted_at=now_ts if is_accepted else None,
                best_runtime=runtime if is_accepted else None,
                best_memory=memory if is_accepted else None,
            )
            session.add(stats)

        await session.commit()
        await delete_cache(f"member:problem-stats:{member_id}")
        return stats

    # ─── RECONCILIATION & SELF-HEALING ───────────────────────────────────────
    @classmethod
    async def reconcile_member_problem_stats(cls, db: AsyncSession, member_id: str) -> int:
        """
        Reconciles/rebuilds MemberProblemStats from canonical ContestSubmission records.
        Guarantees self-healing if cache or derived tables ever drift.
        """
        # Find all practice submissions for member
        subs_res = await db.execute(
            select(ContestSubmission)
            .where(
                ContestSubmission.member_id == member_id,
                ContestSubmission.context == "PRACTICE",
                ContestSubmission.master_problem_id.isnot(None),
            )
            .order_by(ContestSubmission.submitted_at.asc())
        )
        subs = subs_res.scalars().all()

        by_prob: Dict[str, List[ContestSubmission]] = {}
        for s in subs:
            by_prob.setdefault(s.master_problem_id, []).append(s)

        reconciled_count = 0
        for prob_id, p_subs in by_prob.items():
            first_at = p_subs[0].submitted_at
            last_at = p_subs[-1].submitted_at
            attempts = len(p_subs)

            accepted_subs = [s for s in p_subs if s.verdict in ("ACCEPTED", "AC")]
            is_solved = len(accepted_subs) > 0
            accepted_at = accepted_subs[0].submitted_at if is_solved else None

            best_time = min([s.execution_time for s in accepted_subs]) if is_solved else None
            best_mem = min([s.memory_used for s in accepted_subs]) if is_solved else None

            stat = await db.scalar(
                select(MemberProblemStats).where(
                    MemberProblemStats.member_id == member_id,
                    MemberProblemStats.problem_id == prob_id,
                )
            )
            if stat:
                stat.attempt_count = attempts
                stat.first_attempt_at = first_at
                stat.last_attempt_at = last_at
                stat.status = "SOLVED" if is_solved else "ATTEMPTED"
                stat.accepted_at = accepted_at
                stat.best_runtime = best_time
                stat.best_memory = best_mem
            else:
                stat = MemberProblemStats(
                    id=str(uuid.uuid4()),
                    member_id=member_id,
                    problem_id=prob_id,
                    status="SOLVED" if is_solved else "ATTEMPTED",
                    attempt_count=attempts,
                    first_attempt_at=first_at,
                    last_attempt_at=last_at,
                    accepted_at=accepted_at,
                    best_runtime=best_time,
                    best_memory=best_mem,
                )
                db.add(stat)
            reconciled_count += 1

        await db.commit()
        await delete_cache(f"member:problem-stats:{member_id}")
        return reconciled_count
