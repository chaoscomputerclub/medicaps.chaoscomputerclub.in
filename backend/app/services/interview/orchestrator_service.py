"""
Chaos Computer Club — Medi-Caps Chapter
app.services.interview.orchestrator_service — AI Interview Orchestration Engine
Enforces backend state machine invariants, idempotent answer submissions, and evaluation synthesis.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import MemberProfile
from app.models.interview import (
    InterviewSession,
    InterviewQuestion,
    InterviewAnswer,
    InterviewEvaluation,
    InterviewReport,
)
from app.schemas.interview import (
    InterviewConfigCreate,
    InterviewAnswerSubmit,
    InterviewSessionDetail,
    InterviewSessionListItem,
    InterviewQuestionSummary,
    InterviewAnswerSummary,
    InterviewEvaluationSummary,
    InterviewReportDetail,
)
from app.services.interview.category_registry import get_category_config
from app.services.interview.candidate_context_service import CandidateContextService
from app.services.llm.factory import get_llm_provider

logger = logging.getLogger("ccc.interview.orchestrator")


# ── Structured Output Schemas for LLM Calls ──────────────────────────────────

class PlannedAgendaItem(BaseModel):
    topic: str
    title: str
    prompt: str
    code_starter: Optional[str] = None
    judge_problem_slug: Optional[str] = None
    expected_criteria: List[str] = Field(default_factory=list)


class InterviewPlanOutput(BaseModel):
    interview_title: str
    agenda: List[PlannedAgendaItem]


class QuestionFormulationOutput(BaseModel):
    question_type: str = "PRIMARY"
    topic: str
    title: str
    prompt: str
    code_starter: Optional[str] = None
    judge_problem_slug: Optional[str] = None
    expected_criteria: List[str] = Field(default_factory=list)


class TurnEvaluationOutput(BaseModel):
    score: int = Field(..., ge=0, le=100)
    rubric_scores: Dict[str, int] = Field(default_factory=dict)
    strengths: List[str] = Field(default_factory=list)
    gaps: List[str] = Field(default_factory=list)
    evidence_quotes: List[str] = Field(default_factory=list)
    model_answer: str
    follow_up_recommended: bool = False
    suggested_follow_up: Optional[str] = None


class RecommendedAction(BaseModel):
    topic: str
    description: str
    action_type: str = "PRACTICE_CHALLENGE"


class FinalReportOutput(BaseModel):
    overall_score: int = Field(..., ge=0, le=100)
    verdict: str
    executive_summary: str
    dimension_breakdown: Dict[str, int] = Field(default_factory=dict)
    top_strengths: List[str] = Field(default_factory=list)
    areas_to_improve: List[str] = Field(default_factory=list)
    recommended_practice: List[RecommendedAction] = Field(default_factory=list)


# ── Core Orchestrator Service ────────────────────────────────────────────────

class InterviewOrchestrator:

    @classmethod
    async def create_session(
        cls,
        member: MemberProfile,
        payload: InterviewConfigCreate,
        db: AsyncSession,
    ) -> InterviewSessionDetail:
        category_config = get_category_config(payload.category)
        default_count = category_config.get("default_questions", 4)

        topics = payload.focus_topics if payload.focus_topics else category_config.get("default_topics", [])

        session = InterviewSession(
            member_id=member.id,
            target_role=payload.target_role.strip(),
            experience_level=payload.experience_level,
            category=payload.category,
            difficulty=payload.difficulty,
            duration_minutes=payload.duration_minutes,
            preferred_language=payload.preferred_language,
            focus_topics=topics,
            job_description=payload.job_description,
            resume_notes=payload.resume_notes,
            state="CREATED",
            current_question_index=0,
            total_questions_planned=default_count,
            plan_metadata={},
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

        logger.info("Created InterviewSession %s for member %s", session.id, member.handle)
        return await cls.get_session_detail(session.id, member, db)

    @classmethod
    async def start_session(
        cls,
        session_id: str,
        member: MemberProfile,
        db: AsyncSession,
    ) -> InterviewSessionDetail:
        session = await cls._get_session_or_raise(session_id, member.id, db)

        if session.state not in ("CREATED", "FAILED"):
            # Session already in progress or completed
            return await cls.get_session_detail(session.id, member, db)

        session.state = "PREPARING"
        session.started_at = datetime.now(timezone.utc)
        await db.commit()

        llm = get_llm_provider()
        context_str = await CandidateContextService.build_bounded_context(
            member=member,
            target_role=session.target_role,
            category=session.category,
            resume_notes=session.resume_notes,
            job_description=session.job_description,
            db=db,
        )

        system_prompt = (
            "You are an elite technical interview bar-raiser for Chaos Computer Club. "
            "Formulate a structured interview agenda tailored to the candidate's target role, "
            "seniority level, and category. Generate realistic, non-Googleable questions. "
            "Include technical depth, trade-off analysis, and system invariants."
        )
        user_prompt = (
            f"{context_str}\n\n"
            f"Category: {session.category}\n"
            f"Difficulty: {session.difficulty}\n"
            f"Duration: {session.duration_minutes} minutes\n"
            f"Total Questions: {session.total_questions_planned}\n"
            f"Focus Topics: {', '.join(session.focus_topics)}\n\n"
            f"Generate a structured interview plan with exactly {session.total_questions_planned} questions."
        )

        try:
            plan = await llm.generate_structured(system_prompt, user_prompt, InterviewPlanOutput)
            session.plan_metadata = plan.model_dump()

            first_item = plan.agenda[0]
            first_q = InterviewQuestion(
                session_id=session.id,
                order_index=0,
                question_type="PRIMARY",
                topic=first_item.topic,
                title=first_item.title,
                prompt=first_item.prompt,
                code_starter=first_item.code_starter,
                judge_problem_slug=first_item.judge_problem_slug,
                expected_criteria=first_item.expected_criteria,
            )
            db.add(first_q)

            session.state = "ASKING"
            session.current_question_index = 0
            await db.commit()
            logger.info("Session %s transitioned to ASKING with question 0", session.id)

        except Exception as exc:
            logger.exception("Failed to prepare interview plan for session %s: %s", session.id, exc)
            session.state = "FAILED"
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Interview orchestrator failed to formulate questions: {exc}",
            )

        return await cls.get_session_detail(session.id, member, db)

    @classmethod
    async def submit_answer(
        cls,
        session_id: str,
        member: MemberProfile,
        payload: InterviewAnswerSubmit,
        db: AsyncSession,
    ) -> InterviewSessionDetail:
        session = await cls._get_session_or_raise(session_id, member.id, db)

        if session.state == "COMPLETED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Interview session is already COMPLETED. No further answers accepted.",
            )

        # 1. Idempotency Check
        idemp_stmt = select(InterviewAnswer).where(InterviewAnswer.idempotency_key == payload.idempotency_key)
        existing_answer = (await db.execute(idemp_stmt)).scalars().first()
        if existing_answer:
            logger.info("Idempotent replay detected for answer key %s", payload.idempotency_key)
            return await cls.get_session_detail(session.id, member, db)

        # 2. Identify active question
        q_stmt = (
            select(InterviewQuestion)
            .where(InterviewQuestion.session_id == session.id)
            .order_by(InterviewQuestion.order_index.desc())
        )
        active_question = (await db.execute(q_stmt)).scalars().first()
        if not active_question:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active question found to answer.",
            )

        # 3. Record Answer
        answer = InterviewAnswer(
            session_id=session.id,
            question_id=active_question.id,
            idempotency_key=payload.idempotency_key,
            answer_text=payload.answer_text.strip(),
            submitted_code=payload.submitted_code,
            audio_duration_seconds=payload.audio_duration_seconds,
        )
        db.add(answer)
        session.state = "EVALUATING"
        await db.commit()
        await db.refresh(answer)

        # 4. Evaluate Answer with LLM
        llm = get_llm_provider()
        eval_sys_prompt = (
            "You are an objective, evidence-based technical interviewer. "
            "Evaluate the candidate's answer against the question and expected criteria. "
            "Score from 0 to 100 based on technical correctness, depth, trade-off awareness, and communication. "
            "Extract exact quotes as evidence. Determine if an adaptive follow-up is warranted."
        )
        eval_user_prompt = (
            f"Question Topic: {active_question.topic}\n"
            f"Question Title: {active_question.title}\n"
            f"Question Prompt: {active_question.prompt}\n"
            f"Expected Criteria: {json.dumps(active_question.expected_criteria)}\n\n"
            f"Candidate Answer:\n{answer.answer_text}\n"
            f"{f'Submitted Code:\n{answer.submitted_code}' if answer.submitted_code else ''}\n\n"
            "Evaluate this turn and provide structured feedback with score, strengths, gaps, evidence quotes, and model answer."
        )

        try:
            eval_res = await llm.generate_structured(eval_sys_prompt, eval_user_prompt, TurnEvaluationOutput)
            evaluation = InterviewEvaluation(
                session_id=session.id,
                question_id=active_question.id,
                answer_id=answer.id,
                score=eval_res.score,
                rubric_scores=eval_res.rubric_scores,
                strengths=eval_res.strengths,
                gaps=eval_res.gaps,
                evidence_quotes=eval_res.evidence_quotes,
                model_answer=eval_res.model_answer,
                follow_up_recommended=eval_res.follow_up_recommended,
            )
            db.add(evaluation)
            await db.commit()

            # 5. Decide Next Action (Follow-up vs Next Topic vs Complete)
            next_idx = active_question.order_index + 1
            agenda: List[Dict[str, Any]] = session.plan_metadata.get("agenda", [])

            # If follow up recommended and we haven't followed up too many times
            if eval_res.follow_up_recommended and eval_res.suggested_follow_up and active_question.question_type == "PRIMARY":
                follow_up_q = InterviewQuestion(
                    session_id=session.id,
                    order_index=next_idx,
                    parent_question_id=active_question.id,
                    question_type="FOLLOW_UP",
                    topic=f"{active_question.topic} (Follow-up)",
                    title=f"Follow-up: {active_question.title}",
                    prompt=eval_res.suggested_follow_up,
                    expected_criteria=active_question.expected_criteria,
                )
                db.add(follow_up_q)
                session.current_question_index = next_idx
                session.state = "ASKING"
                await db.commit()

            elif next_idx < len(agenda):
                # Deliver next planned question
                next_item = agenda[next_idx]
                next_q = InterviewQuestion(
                    session_id=session.id,
                    order_index=next_idx,
                    question_type="PRIMARY",
                    topic=next_item.get("topic", "Technical"),
                    title=next_item.get("title", f"Question {next_idx + 1}"),
                    prompt=next_item.get("prompt", ""),
                    code_starter=next_item.get("code_starter"),
                    judge_problem_slug=next_item.get("judge_problem_slug"),
                    expected_criteria=next_item.get("expected_criteria", []),
                )
                db.add(next_q)
                session.current_question_index = next_idx
                session.state = "ASKING"
                await db.commit()

            else:
                # All questions finished -> Complete and synthesize report
                await cls._finalize_and_synthesize_report(session, member, db)

        except Exception as e:
            logger.exception("Error evaluating answer for session %s: %s", session.id, e)
            # Safe recovery: keep session in ASKING or allow retry
            session.state = "ASKING"
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Evaluation engine encountered an error: {e}",
            )

        return await cls.get_session_detail(session.id, member, db)

    @classmethod
    async def _finalize_and_synthesize_report(
        cls,
        session: InterviewSession,
        member: MemberProfile,
        db: AsyncSession,
    ) -> None:
        session.state = "COMPLETING"
        await db.commit()

        # Load all questions and evaluations
        q_stmt = select(InterviewQuestion).where(InterviewQuestion.session_id == session.id).order_by(InterviewQuestion.order_index)
        questions = (await db.execute(q_stmt)).scalars().all()

        ev_stmt = select(InterviewEvaluation).where(InterviewEvaluation.session_id == session.id)
        evaluations = (await db.execute(ev_stmt)).scalars().all()

        ans_stmt = select(InterviewAnswer).where(InterviewAnswer.session_id == session.id)
        answers = (await db.execute(ans_stmt)).scalars().all()

        # Compute average score
        scores = [e.score for e in evaluations]
        avg_score = int(sum(scores) / len(scores)) if scores else 70

        llm = get_llm_provider()
        sys_prompt = (
            "You are a principal technical bar-raiser synthesizing a final candidate interview dossier. "
            "Produce an evidence-backed summary, breakdown of technical dimensions, standout strengths, "
            "prioritized areas of development, and concrete recommended practice actions."
        )
        user_prompt = (
            f"Candidate: {member.full_name or member.handle} | Target Role: {session.target_role}\n"
            f"Category: {session.category} | Average Score: {avg_score}/100\n\n"
            f"Questions Asked ({len(questions)}):\n"
            + "\n".join([f"- {q.title} (Topic: {q.topic})" for q in questions])
            + "\n\nSynthesize the final coaching report with dimensional breakdown and practice recommendations."
        )

        try:
            report_out = await llm.generate_structured(sys_prompt, user_prompt, FinalReportOutput)
            report = InterviewReport(
                session_id=session.id,
                member_id=member.id,
                overall_score=report_out.overall_score if report_out.overall_score else avg_score,
                verdict=report_out.verdict,
                executive_summary=report_out.executive_summary,
                dimension_breakdown=report_out.dimension_breakdown,
                top_strengths=report_out.top_strengths,
                areas_to_improve=report_out.areas_to_improve,
                recommended_practice=[r.model_dump() for r in report_out.recommended_practice],
            )
            db.add(report)

            session.state = "COMPLETED"
            session.completed_at = datetime.now(timezone.utc)
            await db.commit()
            logger.info("Session %s COMPLETED with overall score %d", session.id, report.overall_score)

        except Exception as e:
            logger.exception("Failed to synthesize final report for session %s: %s", session.id, e)
            # Fallback report generation ensures candidate never loses interview results
            fallback_report = InterviewReport(
                session_id=session.id,
                member_id=member.id,
                overall_score=avg_score,
                verdict="HIRE" if avg_score >= 75 else "LEANING_HIRE",
                executive_summary="Interview completed. Candidate demonstrated foundational understanding across core topics.",
                dimension_breakdown={"Technical Correctness": avg_score, "Problem Solving": avg_score},
                top_strengths=["Completed full technical simulation.", "Maintained structured answers."],
                areas_to_improve=["Continue targeted practice on edge cases."],
                recommended_practice=[{"topic": "Algorithmic Practice", "description": "Solve related practice arena challenges.", "action_type": "PRACTICE_CHALLENGE"}],
            )
            db.add(fallback_report)
            session.state = "COMPLETED"
            session.completed_at = datetime.now(timezone.utc)
            await db.commit()

    @classmethod
    async def pause_session(cls, session_id: str, member: MemberProfile, db: AsyncSession) -> InterviewSessionDetail:
        session = await cls._get_session_or_raise(session_id, member.id, db)
        if session.state in ("COMPLETED", "FAILED"):
            raise HTTPException(status_code=400, detail="Cannot pause a terminated session.")
        session.state = "PAUSED"
        session.paused_at = datetime.now(timezone.utc)
        await db.commit()
        return await cls.get_session_detail(session.id, member, db)

    @classmethod
    async def resume_session(cls, session_id: str, member: MemberProfile, db: AsyncSession) -> InterviewSessionDetail:
        session = await cls._get_session_or_raise(session_id, member.id, db)
        if session.state != "PAUSED":
            raise HTTPException(status_code=400, detail="Only PAUSED sessions can be resumed.")
        session.state = "ASKING"
        session.paused_at = None
        await db.commit()
        return await cls.get_session_detail(session.id, member, db)

    @classmethod
    async def complete_session(cls, session_id: str, member: MemberProfile, db: AsyncSession) -> InterviewSessionDetail:
        session = await cls._get_session_or_raise(session_id, member.id, db)
        if session.state != "COMPLETED":
            await cls._finalize_and_synthesize_report(session, member, db)
        return await cls.get_session_detail(session.id, member, db)

    @classmethod
    async def get_session_detail(
        cls,
        session_id: str,
        member: MemberProfile,
        db: AsyncSession,
    ) -> InterviewSessionDetail:
        stmt = (
            select(InterviewSession)
            .options(
                selectinload(InterviewSession.questions),
                selectinload(InterviewSession.answers),
                selectinload(InterviewSession.evaluations),
                selectinload(InterviewSession.report),
            )
            .where(InterviewSession.id == session_id)
        )
        res = await db.execute(stmt)
        session = res.scalars().first()
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found.")
        if session.member_id != member.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to interview session.")

        q_summaries = [
            InterviewQuestionSummary(
                id=q.id,
                order_index=q.order_index,
                parent_question_id=q.parent_question_id,
                question_type=q.question_type,
                topic=q.topic,
                title=q.title,
                prompt=q.prompt,
                code_starter=q.code_starter,
                judge_problem_slug=q.judge_problem_slug,
                created_at=q.created_at,
            )
            for q in session.questions
        ]
        q_summaries.sort(key=lambda x: x.order_index)

        current_q = q_summaries[-1] if q_summaries else None

        a_summaries = [
            InterviewAnswerSummary(
                id=a.id,
                question_id=a.question_id,
                idempotency_key=a.idempotency_key,
                answer_text=a.answer_text,
                submitted_code=a.submitted_code,
                judge_result=a.judge_result,
                created_at=a.created_at,
            )
            for a in session.answers
        ]

        ev_summaries = [
            InterviewEvaluationSummary(
                id=e.id,
                question_id=e.question_id,
                answer_id=e.answer_id,
                score=e.score,
                rubric_scores=e.rubric_scores,
                strengths=e.strengths,
                gaps=e.gaps,
                evidence_quotes=e.evidence_quotes,
                model_answer=e.model_answer,
                follow_up_recommended=e.follow_up_recommended,
                created_at=e.created_at,
            )
            for e in session.evaluations
        ]

        report_summary = None
        if session.report:
            report_summary = InterviewReportDetail(
                id=session.report.id,
                session_id=session.report.session_id,
                overall_score=session.report.overall_score,
                verdict=session.report.verdict,
                executive_summary=session.report.executive_summary,
                dimension_breakdown=session.report.dimension_breakdown,
                top_strengths=session.report.top_strengths,
                areas_to_improve=session.report.areas_to_improve,
                recommended_practice=session.report.recommended_practice,
                created_at=session.report.created_at,
            )

        return InterviewSessionDetail(
            id=session.id,
            member_id=session.member_id,
            target_role=session.target_role,
            experience_level=session.experience_level,
            category=session.category,
            difficulty=session.difficulty,
            duration_minutes=session.duration_minutes,
            preferred_language=session.preferred_language,
            focus_topics=session.focus_topics,
            job_description=session.job_description,
            resume_notes=session.resume_notes,
            state=session.state,
            current_question_index=session.current_question_index,
            total_questions_planned=session.total_questions_planned,
            started_at=session.started_at,
            paused_at=session.paused_at,
            completed_at=session.completed_at,
            created_at=session.created_at,
            updated_at=session.updated_at,
            current_question=current_q,
            questions=q_summaries,
            answers=a_summaries,
            evaluations=ev_summaries,
            report=report_summary,
        )

    @classmethod
    async def list_sessions(
        cls,
        member: MemberProfile,
        limit: int = 50,
        offset: int = 0,
        db: AsyncSession = None,
    ) -> List[InterviewSessionListItem]:
        stmt = (
            select(InterviewSession)
            .options(
                selectinload(InterviewSession.questions),
                selectinload(InterviewSession.answers),
                selectinload(InterviewSession.report),
            )
            .where(InterviewSession.member_id == member.id)
            .order_by(InterviewSession.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        res = await db.execute(stmt)
        sessions = res.scalars().all()

        items = []
        for s in sessions:
            items.append(
                InterviewSessionListItem(
                    id=s.id,
                    target_role=s.target_role,
                    experience_level=s.experience_level,
                    category=s.category,
                    difficulty=s.difficulty,
                    duration_minutes=s.duration_minutes,
                    state=s.state,
                    started_at=s.started_at,
                    completed_at=s.completed_at,
                    created_at=s.created_at,
                    overall_score=s.report.overall_score if s.report else None,
                    verdict=s.report.verdict if s.report else None,
                    total_questions=len(s.questions),
                    total_answers=len(s.answers),
                )
            )
        return items

    @classmethod
    async def delete_session(
        cls,
        session_id: str,
        member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        session = await cls._get_session_or_raise(session_id, member.id, db)
        await db.delete(session)
        await db.commit()
        return {"success": True, "message": f"Session {session_id} deleted."}

    @classmethod
    async def _get_session_or_raise(
        cls,
        session_id: str,
        member_id: str,
        db: AsyncSession,
    ) -> InterviewSession:
        stmt = select(InterviewSession).where(InterviewSession.id == session_id)
        res = await db.execute(stmt)
        session = res.scalars().first()
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found.")
        if session.member_id != member_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to interview session.")
        return session
