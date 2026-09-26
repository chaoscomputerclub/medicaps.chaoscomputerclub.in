"""
Chaos Computer Club — Medi-Caps Chapter
controllers/assessment_controller.py — Online Screening Assessment Orchestrator
"""

from datetime import timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import (
    AssessmentProblem,
    AssessmentSession,
    AssessmentSubmission,
    ContestRegistration,
    MemberProfile,
    ScoreboardEntry,
    now_utc,
)
from app.engine.enums import ComparisonMode, Language
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
from app.services.event_broadcaster import broadcast_event


class AssessmentController:
    """Orchestrator for Phase 1 screening assessment, code execution, anti-cheat, and cutoffs."""

    @staticmethod
    async def get_or_start_assessment(
        contest_slug: str,
        response: Response,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return await AssessmentService.get_assessment_status(contest_slug, current_member, db)

    @staticmethod
    async def run_sample_code(
        problem_id: str,
        language: Language,
        code: str,
        custom_stdin: Optional[str],
        active_guard: tuple,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        session, assessment, _ = active_guard
        p_result = await db.execute(select(AssessmentProblem).where(AssessmentProblem.id == problem_id))
        problem = p_result.scalars().first()
        if not problem:
            raise HTTPException(status_code=404, detail="Problem not found.")

        if custom_stdin is not None:
            tcs = [TestCaseSchema(id="custom", stdin=custom_stdin, expected_output="")]
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

        from app.engine.harness import prepare_solution_code
        lang_str = language.value if hasattr(language, "value") else str(language)
        exec_code = prepare_solution_code(
            code=code,
            language=lang_str,
            problem_index=problem.problem_index,
            starter_codes=getattr(problem, "starter_codes", None) or {},
        )

        provider = get_judge_provider()
        exec_result = await provider.execute_batch(
            language=lang_str,
            code=exec_code,
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
                    "compile_output": tr.compile_output,
                    "wall_time_ms": tr.wall_time_ms,
                }
                for tr in exec_result.testcase_results
            ],
        }

    @staticmethod
    async def submit_assessment_code(
        contest_slug: str,
        problem_id: str,
        language: Language,
        code: str,
        active_guard: tuple,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        session, assessment, contest = active_guard
        p_result = await db.execute(select(AssessmentProblem).where(AssessmentProblem.id == problem_id))
        problem = p_result.scalars().first()
        if not problem:
            raise HTTPException(status_code=404, detail="Problem not found.")

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

        from app.engine.harness import prepare_solution_code
        lang_str = language.value if hasattr(language, "value") else str(language)
        exec_code = prepare_solution_code(
            code=code,
            language=lang_str,
            problem_index=problem.problem_index,
            starter_codes=getattr(problem, "starter_codes", None) or {},
        )

        provider = get_judge_provider()
        exec_result = await provider.execute_batch(
            language=lang_str,
            code=exec_code,
            testcases=all_tcs,
            time_limit=problem.time_limit,
            memory_limit_mb=problem.memory_limit,
        )

        points_earned = round((exec_result.score / 100.0) * problem.points, 2)

        submission = AssessmentSubmission(
            session_id=session.id,
            problem_id=problem.id,
            member_id=current_member.id,
            language=language.value,
            code=code,
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

        try:
            await broadcast_event(
                event_type="submission_evaluated",
                data={
                    "contest_slug": contest_slug,
                    "problem_id": problem.id,
                    "member_id": current_member.id,
                    "handle": current_member.handle,
                    "full_name": current_member.full_name,
                    "score": points_earned,
                    "verdict": exec_result.verdict.value,
                    "total_score": session.total_score,
                },
                contest_slug=contest_slug,
            )
        except Exception:
            pass

        return {
            "verdict": exec_result.verdict,
            "score": points_earned,
            "max_points": problem.points,
            "passed_testcases": exec_result.passed_testcases,
            "total_testcases": exec_result.total_testcases,
            "runtime_ms": round(exec_result.time * 1000.0, 2),
            "memory_mb": exec_result.memory,
            "compile_output": exec_result.compile_output,
            "stderr": exec_result.stderr,
            "testcase_results": [
                {
                    "testcase_id": tr.testcase_id,
                    "name": tr.name,
                    "passed": tr.passed,
                    "verdict": tr.verdict,
                    "hidden": tr.hidden,
                    "stdout": tr.stdout if not tr.hidden else "(hidden testcase)",
                    "expected_output": tr.expected_output if not tr.hidden else "(hidden testcase)",
                    "stderr": tr.stderr,
                    "compile_output": tr.compile_output,
                    "wall_time_ms": tr.wall_time_ms,
                }
                for tr in exec_result.testcase_results
            ],
        }

    @staticmethod
    async def report_anti_cheat_event(
        contest_slug: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
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

    @staticmethod
    async def finish_assessment(
        contest_slug: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        assessment, contest = await AssessmentService.get_or_create_assessment_for_contest(contest_slug, db)

        s_result = await db.execute(
            select(AssessmentSession).where(
                AssessmentSession.assessment_id == assessment.id,
                AssessmentSession.member_id == current_member.id,
            )
        )
        session = s_result.scalars().first()
        # Determine score
        score_val = 0.0
        if contest:
            sb_res = await db.execute(
                select(ScoreboardEntry).where(
                    ScoreboardEntry.contest_id == contest.id,
                    ScoreboardEntry.member_id == current_member.id,
                )
            )
            sb_entry = sb_res.scalars().first()
            if sb_entry and sb_entry.score is not None:
                score_val = float(sb_entry.score)

        if not session:
            session = AssessmentSession(
                assessment_id=assessment.id,
                member_id=current_member.id,
                handle=current_member.handle or f"cadet_{current_member.id[:6]}",
                full_name=current_member.full_name or "Cadet",
                department=current_member.department or "CSE",
                batch=current_member.batch or "2026",
                started_at=now_utc(),
                submitted_at=now_utc(),
                status="submitted",
                total_score=score_val,
            )
            db.add(session)
        else:
            session.status = "submitted"
            session.submitted_at = now_utc()
            if (session.total_score is None or session.total_score == 0) and score_val > 0:
                session.total_score = score_val

        # Always update ContestRegistration status to "submitted" and assessment_taken = True
        final_score = session.total_score if (session and session.total_score is not None) else score_val
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
                    status="submitted",
                    assessment_taken=True,
                    assessment_score=final_score,
                )
                db.add(reg)
            else:
                reg.status = "submitted"
                reg.assessment_taken = True
                reg.assessment_score = final_score

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

        try:
            await broadcast_event(
                event_type="assessment_finished",
                data={
                    "contest_slug": contest_slug,
                    "member_id": current_member.id,
                    "handle": current_member.handle,
                    "status": "submitted",
                    "total_score": final_score,
                },
                contest_slug=contest_slug,
            )
            await broadcast_event(
                event_type="contest_updated",
                data={"contest_slug": contest_slug, "status": contest.status if contest else "live"},
                contest_slug=contest_slug,
            )
        except Exception:
            pass

        return {
            "success": True,
            "message": "Contest attempt finalized and submitted.",
            "total_score": final_score,
        }

    @staticmethod
    async def get_assessment_leaderboard(
        contest_slug: str,
        db: AsyncSession,
    ) -> Dict[str, Any]:
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

    @staticmethod
    async def qualify_top_30(
        contest_slug: str,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        return await AssessmentService.evaluate_and_qualify_top_30(contest_slug, db)

    @staticmethod
    async def reset_dev_assessment_session(
        contest_slug: str,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
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
