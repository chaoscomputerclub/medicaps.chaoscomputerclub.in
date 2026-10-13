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
from app.engine.enums import ComparisonMode, SubmissionMode
from app.engine.binder import InputBindingError
from app.engine.execution_router import ExecutionRouter
from app.engine.languages import LanguageRegistry
from app.engine.build_plan import SourcePlanBuilder
from app.engine.schemas import TestCaseSchema
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

        # Build query
        base_query = select(Problem).where(and_(*conditions))

        # Join member stats if user is authenticated or filtering by status
        member_id = current_member.id if current_member else None
        if member_id:
            base_query = base_query.outerjoin(
                MemberProblemStats,
                and_(
                    MemberProblemStats.problem_id == Problem.id,
                    MemberProblemStats.member_id == member_id,
                ),
            )
            if status and status.strip() and status.upper() != "ALL":
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
        for p in problems_rows:
            total_s, acc_s = acc_stats.get(p.id, (0, 0))
            rate = round((acc_s / total_s) * 100, 1) if total_s > 0 else 0.0
            solved_state = user_states.get(p.id, "UNATTEMPTED")

            items.append({
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
                "tags": p.tags or [],
            })

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

        visible_samples = [
            {
                "testcase_id": tc.testcase_id,
                "input": tc.input_data,
                "expected_output": tc.expected_output,
                "explanation": tc.explanation,
                "weight": tc.weight,
                "order": tc.order,
            }
            for tc in samples
        ]

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
            "function_signature": problem.function_signature or {},
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
        """
        stmt = select(Problem).where(or_(Problem.id == slug_or_id, Problem.slug == slug_or_id))
        problem = await db.scalar(stmt)
        if not problem:
            raise HTTPException(status_code=404, detail=f"Problem '{slug_or_id}' not found.")

        # Visible test cases
        tc_stmt = select(ProblemTestCase).where(
            ProblemTestCase.problem_id == problem.id,
            ProblemTestCase.version == problem.version,
            ProblemTestCase.is_active == True,
            ProblemTestCase.is_hidden == False,
        ).order_by(ProblemTestCase.order.asc(), ProblemTestCase.created_at.asc())
        samples = (await db.scalars(tc_stmt)).all()

        try:
            lang_enum = LanguageRegistry.normalize(language)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

        is_fn_mode = str(problem.execution_mode).upper() not in ("FULL_PROGRAM", "STDIN_STDOUT")
        submission_mode = SubmissionMode.FUNCTION if is_fn_mode else SubmissionMode.FULL_PROGRAM

        fn_sig = None
        if is_fn_mode and problem.function_signature and isinstance(problem.function_signature, dict):
            try:
                fn_sig = FunctionSignature(**problem.function_signature)
            except Exception:
                pass

        adapter = LanguageRegistry.get_adapter(lang_enum) if is_fn_mode else None

        testcases: List[TestCaseSchema] = []
        for i, tc in enumerate(samples):
            inp = tc.input_data
            if is_fn_mode and adapter and fn_sig:
                try:
                    stdin_payload = adapter.serialize_input(fn_sig, inp)
                except InputBindingError as e:
                    stdin_payload = ""
            else:
                stdin_payload = str(inp)

            exp_out = tc.expected_output
            clean_exp_out = exp_out
            if isinstance(clean_exp_out, str):
                s_trimmed = clean_exp_out.strip()
                if s_trimmed.startswith('"') and s_trimmed.endswith('"') and len(s_trimmed) >= 2:
                    try:
                        clean_exp_out = json.loads(s_trimmed)
                    except Exception:
                        clean_exp_out = s_trimmed[1:-1]

            testcases.append(
                TestCaseSchema(
                    id=tc.testcase_id,
                    name=f"Sample {i+1}",
                    stdin=stdin_payload,
                    expected_output=str(clean_exp_out),
                    hidden=False,
                    weight=tc.weight,
                )
            )

        if not testcases:
            testcases = [TestCaseSchema(id="sample_1", name="Sample 1", stdin="", expected_output="")]

        build_plan = SourcePlanBuilder.build_plan(
            language=lang_enum,
            user_source=code,
            submission_mode=submission_mode,
            function_signature=fn_sig if is_fn_mode else None,
            starter_codes=problem.starter_code or {},
            method_name=fn_sig.name if (is_fn_mode and fn_sig) else None,
        )
        exec_code = build_plan.generated_source
        LanguageRegistry.validate_source(lang_enum, exec_code)

        router = ExecutionRouter.get_instance()
        exec_result = await router.execute(
            db=db,
            language=lang_enum,
            code=exec_code,
            testcases=testcases,
            time_limit=problem.time_limit,
            memory_limit_mb=problem.memory_limit,
            comparison_mode=ComparisonMode.TRIMMED,
            is_submit=False,
            problem_id=problem.id,
            member_id=current_member.id if current_member else None,
        )

        testcase_results = []
        for idx, tc_res in enumerate(exec_result.testcases):
            orig_tc = samples[idx] if idx < len(samples) else None
            testcase_results.append({
                "testcase_id": tc_res.testcase_id,
                "status": tc_res.status.value,
                "passed": tc_res.passed,
                "execution_time": tc_res.execution_time,
                "memory_used": tc_res.memory_used,
                "input": orig_tc.input_data if orig_tc else None,
                "expected_output": orig_tc.expected_output if orig_tc else tc_res.expected_output,
                "stdout": tc_res.stdout,
                "stderr": tc_res.stderr,
                "compile_error": tc_res.compile_error,
                "runtime_error": tc_res.runtime_error,
            })

        return {
            "verdict": exec_result.verdict.value,
            "status": exec_result.status.value,
            "execution_time": exec_result.time,
            "memory_used": exec_result.memory,
            "passed_count": exec_result.passed_count,
            "total_count": len(testcases),
            "testcases": testcase_results,
            "compile_output": exec_result.compile_output,
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
        Persists canonical submission and atomically updates MemberProblemStats.
        """
        if not current_member:
            raise HTTPException(status_code=401, detail="Authentication required to submit practice solutions.")

        stmt = select(Problem).where(or_(Problem.id == slug_or_id, Problem.slug == slug_or_id))
        problem = await db.scalar(stmt)
        if not problem:
            raise HTTPException(status_code=404, detail=f"Problem '{slug_or_id}' not found.")

        # Debounce duplicate submissions (2-second window)
        try:
            r = get_redis_client()
            if r:
                import hashlib
                code_hash = hashlib.sha256(code.strip().encode("utf-8")).hexdigest()[:16]
                dedup_key = f"practice_debounce:{problem.id}:{current_member.id}:{code_hash}"
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

        # Fetch all testcases (samples + hidden)
        tc_stmt = select(ProblemTestCase).where(
            ProblemTestCase.problem_id == problem.id,
            ProblemTestCase.version == problem.version,
            ProblemTestCase.is_active == True,
        ).order_by(ProblemTestCase.order.asc(), ProblemTestCase.created_at.asc())
        all_cases = (await db.scalars(tc_stmt)).all()

        samples = [tc for tc in all_cases if not tc.is_hidden]
        hidden = [tc for tc in all_cases if tc.is_hidden]

        try:
            lang_enum = LanguageRegistry.normalize(language)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

        is_fn_mode = str(problem.execution_mode).upper() not in ("FULL_PROGRAM", "STDIN_STDOUT")
        submission_mode = SubmissionMode.FUNCTION if is_fn_mode else SubmissionMode.FULL_PROGRAM

        fn_sig = None
        if is_fn_mode and problem.function_signature and isinstance(problem.function_signature, dict):
            try:
                fn_sig = FunctionSignature(**problem.function_signature)
            except Exception:
                pass

        adapter = LanguageRegistry.get_adapter(lang_enum) if is_fn_mode else None

        all_tcs: List[TestCaseSchema] = []
        ordered_cases = samples + hidden
        for i, tc in enumerate(ordered_cases):
            inp = tc.input_data
            if is_fn_mode and adapter and fn_sig:
                try:
                    stdin_payload = adapter.serialize_input(fn_sig, inp)
                except InputBindingError:
                    stdin_payload = ""
            else:
                stdin_payload = str(inp)

            exp_out = tc.expected_output
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
                    id=tc.testcase_id,
                    name=f"Test {i+1}",
                    stdin=stdin_payload,
                    expected_output=str(clean_exp_out),
                    hidden=tc.is_hidden,
                    weight=tc.weight,
                )
            )

        if not all_tcs:
            all_tcs = [TestCaseSchema(id="tc_1", name="Test 1", stdin="", expected_output="", hidden=False)]

        build_plan = SourcePlanBuilder.build_plan(
            language=lang_enum,
            user_source=code,
            submission_mode=submission_mode,
            function_signature=fn_sig if is_fn_mode else None,
            starter_codes=problem.starter_code or {},
            method_name=fn_sig.name if (is_fn_mode and fn_sig) else None,
        )
        exec_code = build_plan.generated_source
        LanguageRegistry.validate_source(lang_enum, exec_code)

        submission_id = str(uuid.uuid4())
        router = ExecutionRouter.get_instance()
        exec_result = await router.execute(
            db=db,
            language=lang_enum,
            code=exec_code,
            testcases=all_tcs,
            time_limit=problem.time_limit,
            memory_limit_mb=problem.memory_limit,
            comparison_mode=ComparisonMode.TRIMMED,
            is_submit=True,
            submission_id=submission_id,
            problem_id=problem.id,
            member_id=current_member.id,
        )

        verdict_str = exec_result.verdict.value.upper()
        is_accepted = verdict_str in ("ACCEPTED", "AC")

        # Create canonical submission record in contest_submissions table
        submission = ContestSubmission(
            id=submission_id,
            context="PRACTICE",
            contest_id=None,
            problem_id=None,
            master_problem_id=problem.id,
            member_id=current_member.id,
            handle=current_member.handle or f"cadet_{current_member.id[:6]}",
            language=str(language),
            code=code,
            verdict=verdict_str,
            passed_testcases=exec_result.passed_count,
            total_testcases=len(all_tcs),
            execution_time=exec_result.time,
            memory_used=exec_result.memory,
            points_awarded=problem.points if is_accepted else 0,
            submitted_at=now_utc(),
        )
        db.add(submission)
        await db.commit()

        # Update or create MemberProblemStats atomically
        await cls.update_member_problem_stats(
            session=db,
            member_id=current_member.id,
            problem_id=problem.id,
            is_accepted=is_accepted,
            runtime=exec_result.time,
            memory=exec_result.memory,
        )

        now_ts = now_utc()

        # Invalidate member caches
        await delete_cache(f"cache:profile:{current_member.id}")
        await delete_cache(f"member:problem-stats:{current_member.id}")
        for yr in [now_ts.year, now_ts.year - 1]:
            await delete_cache(f"member:activity:{current_member.id}:{yr}")

        # Broadcast realtime event
        await broadcast_event(
            event_type="submission_completed",
            payload={
                "submission_id": submission_id,
                "problem_id": problem.id,
                "problem_slug": problem.slug,
                "member_id": current_member.id,
                "verdict": verdict_str,
                "context": "PRACTICE",
                "is_accepted": is_accepted,
                "new_solve": is_accepted and not was_previously_solved,
            },
        )
        if is_accepted and not was_previously_solved:
            await broadcast_event(
                event_type="problem_solved",
                payload={
                    "problem_id": problem.id,
                    "problem_slug": problem.slug,
                    "member_id": current_member.id,
                    "handle": current_member.handle,
                    "difficulty": problem.difficulty,
                },
            )

        # Build sanitized testcase results for student
        sanitized_tcs = []
        for idx, tc_res in enumerate(exec_result.testcases):
            orig_tc = ordered_cases[idx] if idx < len(ordered_cases) else None
            is_hid = orig_tc.is_hidden if orig_tc else False
            item = {
                "testcase_id": f"TC-{idx+1}",
                "status": tc_res.status.value,
                "passed": tc_res.passed,
                "execution_time": tc_res.execution_time,
                "memory_used": tc_res.memory_used,
                "is_hidden": is_hid,
            }
            # Only expose stdout / expected output for visible samples
            if not is_hid and orig_tc:
                item["input"] = orig_tc.input_data
                item["expected_output"] = orig_tc.expected_output
                item["stdout"] = tc_res.stdout
                item["stderr"] = tc_res.stderr
            sanitized_tcs.append(item)

        return {
            "submission_id": submission_id,
            "verdict": verdict_str,
            "status": exec_result.status.value,
            "is_accepted": is_accepted,
            "is_first_solve": is_accepted and not was_previously_solved,
            "passed_count": exec_result.passed_count,
            "total_count": len(all_tcs),
            "execution_time": exec_result.time,
            "memory_used": exec_result.memory,
            "submitted_at": now_ts.isoformat(),
            "testcases": sanitized_tcs,
            "compile_output": exec_result.compile_output,
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
