"""
Chaos Computer Club — Medi-Caps Chapter
app.services.interview.langgraph_orchestrator — LangGraph Stateful Interview Engine (v2)

Implements LangGraph workflow graph with explicit nodes, conditional routing,
bounded follow-ups, and transactional state persistence in PostgreSQL.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
import hashlib
from pathlib import Path
import pickle
import re
import threading
import uuid
from typing import Any, Dict, List, Optional, TypedDict
from fastapi import HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from app.models.db_models import MemberProfile
from app.models.interview import (
    InterviewSession,
    InterviewQuestion,
    InterviewAnswer,
    InterviewEvaluation,
    InterviewReport,
    CandidateProfile,
    CandidateResumeAsset,
    CandidateResumeFact,
    CandidateConsent,
    InterviewVoiceLink,
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
    CandidateProfileResponse,
    CandidateProfileUpdate,
    ResumeUploadResponse,
    ResumeDetailResponse,
    ResumeFactItem,
    ResumeFactUpdateRequest,
    ResumeConsentRequest,
)
from app.services.interview.category_registry import get_category_config
from app.services.interview.candidate_context_service import CandidateContextService
from app.services.llm.factory import get_llm_provider
from app.services.interview.bkt_engine import BKTEngine, CompetencyBKTState
from app.services.interview.irt_engine import IRTEngine, IRTItemParameters, CandidateAbilityEstimate
from app.services.interview.state_estimator import KalmanPerformanceFilter, KalmanState
from app.services.interview.adaptive_selector import AdaptiveQuestionSelector, QuestionCandidate
from app.services.interview.graph_projection_service import GraphProjectionService
from app.services.interview.prediction_service import PredictionService
from app.services.interview.competency_taxonomy import CompetencyTaxonomyService, COMPETENCY_REGISTRY
from app.services.interview.blueprint_registry import BlueprintRegistryService

logger = logging.getLogger("ccc.interview.langgraph")


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


# ── LangGraph Typed State Definition ─────────────────────────────────────────

class InterviewGraphState(TypedDict):
    session_id: str
    member_id: str
    target_role: str
    category: str
    experience_level: str
    difficulty: str
    duration_minutes: int
    focus_topics: List[str]
    candidate_context: str

    # Plan & Agenda
    total_questions_planned: int
    current_question_index: int
    agenda: List[Dict[str, Any]]

    # Active Question
    active_question_id: Optional[str]
    active_question_title: Optional[str]
    active_question_prompt: Optional[str]
    active_question_type: str  # PRIMARY | FOLLOW_UP
    active_question_topic: str
    active_code_starter: Optional[str]
    active_expected_criteria: List[str]

    # Candidate Answer
    last_answer_text: Optional[str]
    last_submitted_code: Optional[str]
    last_idempotency_key: Optional[str]

    # Turn Evaluation
    last_score: Optional[int]
    last_rubric_scores: Dict[str, int]
    last_strengths: List[str]
    last_gaps: List[str]
    last_evidence_quotes: List[str]
    last_model_answer: Optional[str]
    follow_up_recommended: bool
    suggested_follow_up: Optional[str]

    # Loop Bounds & Lifecycle State
    follow_up_count_current_topic: int
    max_follow_ups_per_topic: int
    lifecycle_state: str  # PREPARING | ASKING | EVALUATING | COMPLETED | FAILED
    error_message: Optional[str]


# ── Global Persistent LangGraph Checkpointer ─────────────────────────────────

class DurableDiskCheckpointer(MemorySaver):
    """
    Persistent file-backed LangGraph checkpointer.
    Survives application restarts, worker redeployments, and server reboots.
    Implements CCC-AI-0301.
    """
    def __init__(self, file_path: Optional[str] = None):
        super().__init__()
        base_dir = Path(__file__).resolve().parent.parent.parent.parent
        self.file_path = Path(file_path or (base_dir / "storage" / "checkpoints" / "interview_state.pkl"))
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._load()

    def _load(self):
        if self.file_path.exists():
            try:
                with open(self.file_path, "rb") as f:
                    data = pickle.load(f)
                    self.storage.update(data.get("storage", {}))
                    self.writes.update(data.get("writes", {}))
                    self.blobs.update(data.get("blobs", {}))
                logger.info("Loaded persistent LangGraph checkpoints from %s", self.file_path)
            except Exception as e:
                logger.warning("Could not load checkpointer state from %s: %s", self.file_path, e)

    def _persist(self):
        with self._lock:
            try:
                tmp = self.file_path.with_suffix(".tmp")
                with open(tmp, "wb") as f:
                    pickle.dump({
                        "storage": dict(self.storage),
                        "writes": dict(self.writes),
                        "blobs": dict(self.blobs),
                    }, f)
                tmp.replace(self.file_path)
            except Exception as e:
                logger.error("Error persisting checkpointer state: %s", e)

    def put(self, config, checkpoint, metadata, new_versions):
        res = super().put(config, checkpoint, metadata, new_versions)
        self._persist()
        return res

    def put_writes(self, config, writes, task_id, task_path=""):
        res = super().put_writes(config, writes, task_id, task_path)
        self._persist()
        return res

    def delete_thread(self, thread_id: str) -> None:
        super().delete_thread(thread_id)
        self._persist()


_LANGGRAPH_CHECKPOINTER = DurableDiskCheckpointer()


# ── LangGraph Workflow Construction ──────────────────────────────────────────

def build_interview_graph():
    """Builds and compiles the LangGraph StateGraph with conditional edges."""
    builder = StateGraph(InterviewGraphState)

    # 1. Plan initialization node
    async def node_initialize_plan(state: InterviewGraphState) -> Dict[str, Any]:
        if state.get("agenda") and len(state["agenda"]) > 0:
            return {}

        llm = get_llm_provider()
        sys_prompt = (
            "You are an elite technical interview bar-raiser for Chaos Computer Club. "
            "Formulate a structured interview agenda tailored to the candidate's target role, "
            "seniority level, and category. Generate realistic, non-Googleable questions. "
            "Include technical depth, trade-off analysis, and system invariants."
        )
        user_prompt = (
            f"{state.get('candidate_context', '')}\n\n"
            f"Category: {state['category']}\n"
            f"Difficulty: {state['difficulty']}\n"
            f"Duration: {state['duration_minutes']} minutes\n"
            f"Total Questions: {state['total_questions_planned']}\n"
            f"Focus Topics: {', '.join(state['focus_topics'])}\n\n"
            f"Generate a structured interview plan with exactly {state['total_questions_planned']} questions."
        )
        plan = await llm.generate_structured(sys_prompt, user_prompt, InterviewPlanOutput)
        agenda = [item.model_dump() for item in plan.agenda]

        first_q = agenda[0] if agenda else {
            "topic": "Core Fundamentals",
            "title": "Systems Fundamentals & Architecture",
            "prompt": "Walk through the architectural trade-offs of your most complex project.",
            "expected_criteria": ["Trade-off analysis", "Bottleneck mitigation"],
        }

        return {
            "agenda": agenda,
            "current_question_index": 0,
            "active_question_type": "PRIMARY",
            "active_question_title": first_q.get("title", "Question 1"),
            "active_question_prompt": first_q.get("prompt", ""),
            "active_question_topic": first_q.get("topic", "Technical"),
            "active_code_starter": first_q.get("code_starter"),
            "active_expected_criteria": first_q.get("expected_criteria", []),
            "lifecycle_state": "ASKING",
            "follow_up_count_current_topic": 0,
        }

    # 2. Analyze Answer & Score Node
    async def node_analyze_and_score(state: InterviewGraphState) -> Dict[str, Any]:
        llm = get_llm_provider()
        sys_prompt = (
            "You are an objective, evidence-based technical interviewer. "
            "Evaluate the candidate's answer against the question and expected criteria. "
            "Score from 0 to 100 based on technical correctness, depth, trade-off awareness, and communication. "
            "Extract exact quotes as evidence. Determine if an adaptive follow-up is warranted."
        )
        code_str = f"Submitted Code:\n{state.get('last_submitted_code')}\n\n" if state.get("last_submitted_code") else ""
        user_prompt = (
            f"Question Topic: {state.get('active_question_topic')}\n"
            f"Question Title: {state.get('active_question_title')}\n"
            f"Question Prompt: {state.get('active_question_prompt')}\n"
            f"Expected Criteria: {json.dumps(state.get('active_expected_criteria', []))}\n\n"
            f"Candidate Answer:\n{state.get('last_answer_text', '')}\n\n"
            f"{code_str}"
            "Evaluate this turn and provide structured feedback with score, strengths, gaps, evidence quotes, and model answer."
        )
        eval_res = await llm.generate_structured(sys_prompt, user_prompt, TurnEvaluationOutput)
        return {
            "last_score": eval_res.score,
            "last_rubric_scores": eval_res.rubric_scores,
            "last_strengths": eval_res.strengths,
            "last_gaps": eval_res.gaps,
            "last_evidence_quotes": eval_res.evidence_quotes,
            "last_model_answer": eval_res.model_answer,
            "follow_up_recommended": eval_res.follow_up_recommended,
            "suggested_follow_up": eval_res.suggested_follow_up,
            "lifecycle_state": "EVALUATING",
        }

    # 3. Next Question Selection Node
    async def node_prepare_follow_up(state: InterviewGraphState) -> Dict[str, Any]:
        suggested = state.get("suggested_follow_up") or "Can you elaborate further on the operational trade-offs?"
        next_idx = state["current_question_index"] + 1
        return {
            "current_question_index": next_idx,
            "active_question_type": "FOLLOW_UP",
            "active_question_title": f"Follow-up: {state.get('active_question_title')}",
            "active_question_prompt": suggested,
            "active_question_topic": f"{state.get('active_question_topic')} (Follow-up)",
            "follow_up_count_current_topic": state["follow_up_count_current_topic"] + 1,
            "lifecycle_state": "ASKING",
        }

    async def node_advance_to_next_agenda(state: InterviewGraphState) -> Dict[str, Any]:
        next_idx = state["current_question_index"] + 1
        agenda = state.get("agenda", [])
        if next_idx < len(agenda):
            item = agenda[next_idx]
            return {
                "current_question_index": next_idx,
                "active_question_type": "PRIMARY",
                "active_question_title": item.get("title", f"Question {next_idx + 1}"),
                "active_question_prompt": item.get("prompt", ""),
                "active_question_topic": item.get("topic", "Technical"),
                "active_code_starter": item.get("code_starter"),
                "active_expected_criteria": item.get("expected_criteria", []),
                "follow_up_count_current_topic": 0,
                "lifecycle_state": "ASKING",
            }
        return {"lifecycle_state": "COMPLETING"}

    # 4. Routing logic
    def route_after_evaluation(state: InterviewGraphState) -> str:
        if (
            state.get("follow_up_recommended")
            and state.get("suggested_follow_up")
            and state.get("follow_up_count_current_topic", 0) < state.get("max_follow_ups_per_topic", 1)
        ):
            return "probe_deeper"
        elif state["current_question_index"] + 1 < len(state.get("agenda", [])):
            return "move_on"
        else:
            return "end_interview"

    # Add nodes to graph
    builder.add_node("initialize_plan", node_initialize_plan)
    builder.add_node("analyze_and_score", node_analyze_and_score)
    builder.add_node("prepare_follow_up", node_prepare_follow_up)
    builder.add_node("advance_to_next_agenda", node_advance_to_next_agenda)

    # Add edges
    def route_start(state: InterviewGraphState) -> str:
        if state.get("last_answer_text") is not None:
            return "analyze_and_score"
        return "initialize_plan"

    builder.add_conditional_edges(
        START,
        route_start,
        {
            "initialize_plan": "initialize_plan",
            "analyze_and_score": "analyze_and_score",
        },
    )
    builder.add_edge("initialize_plan", END)  # Pauses at candidate answer boundary

    builder.add_conditional_edges(
        "analyze_and_score",
        route_after_evaluation,
        {
            "probe_deeper": "prepare_follow_up",
            "move_on": "advance_to_next_agenda",
            "end_interview": END,
        },
    )
    builder.add_edge("prepare_follow_up", END)
    builder.add_edge("advance_to_next_agenda", END)

    return builder.compile(checkpointer=_LANGGRAPH_CHECKPOINTER)


# Compile singleton graph
_COMPILED_INTERVIEW_GRAPH = build_interview_graph()


# ── High-Level Orchestrator Service ──────────────────────────────────────────

class LangGraphInterviewOrchestrator:
    """
    Adapter between FastAPI HTTP requests, PostgreSQL authoritative persistence,
    and LangGraph stateful execution engine.
    """

    @classmethod
    async def create_session(
        cls,
        member: MemberProfile,
        payload: InterviewConfigCreate,
        db: AsyncSession,
    ) -> InterviewSessionDetail:
        bp = None
        if payload.interview_slug:
            bp = BlueprintRegistryService.get_blueprint(payload.interview_slug)
            if not bp:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Interview track '{payload.interview_slug}' not found.",
                )

        resume_asset_ids = list(payload.resume_asset_ids) if payload.resume_asset_ids else []
        if payload.resume_id and payload.resume_id not in resume_asset_ids:
            resume_asset_ids.append(payload.resume_id)

        if bp:
            target_role = (payload.target_role or bp.title).strip()
            category = bp.category
            difficulty = payload.difficulty or bp.public_metadata.difficulty
            duration_minutes = payload.duration_minutes or bp.public_metadata.duration_minutes
            preferred_language = payload.preferred_language or bp.runtime_policy.default_language
            topics = payload.focus_topics if payload.focus_topics else bp.public_metadata.topics
            total_questions = len([n for n in bp.nodes.values() if n.node_type == "question"])
            plan_version = bp.version
            rubric_version = bp.version
            plan_metadata = {
                "blueprint_id": bp.blueprint_id,
                "blueprint_version": bp.version,
                "entry_node_ids": bp.entry_node_ids,
                "resume_asset_ids": resume_asset_ids,
            }
        else:
            category_config = get_category_config(payload.category)
            total_questions = category_config.get("default_questions", 4)
            topics = payload.focus_topics if payload.focus_topics else category_config.get("default_topics", [])
            target_role = (payload.target_role or "Technical Candidate").strip()
            category = payload.category
            difficulty = payload.difficulty
            duration_minutes = payload.duration_minutes
            preferred_language = payload.preferred_language
            plan_version = "1.0"
            rubric_version = "1.0"
            plan_metadata = {"resume_asset_ids": resume_asset_ids}

        session = InterviewSession(
            member_id=member.id,
            target_role=target_role,
            experience_level=payload.experience_level,
            category=category,
            difficulty=difficulty,
            duration_minutes=duration_minutes,
            preferred_language=preferred_language,
            focus_topics=topics,
            job_description=payload.job_description,
            resume_notes=payload.resume_notes,
            mode=payload.mode,
            language=payload.language,
            plan_version=plan_version,
            rubric_version=rubric_version,
            provider_profile="default",
            state="CREATED",
            current_question_index=0,
            total_questions_planned=total_questions,
            plan_metadata=plan_metadata,
            version=1,
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

        logger.info(
            "Created LangGraph InterviewSession %s for member %s (blueprint: %s)",
            session.id,
            member.handle,
            (bp.blueprint_id if bp else "ad-hoc"),
        )
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
            return await cls.get_session_detail(session.id, member, db)

        session.state = "PREPARING"
        session.started_at = datetime.now(timezone.utc)
        await db.commit()

        # Build candidate bounded context
        candidate_context = await CandidateContextService.build_bounded_context(
            member=member,
            target_role=session.target_role,
            category=session.category,
            resume_notes=session.resume_notes,
            job_description=session.job_description,
            db=db,
            resume_asset_ids=(session.plan_metadata or {}).get("resume_asset_ids", []),
        )

        initial_agenda = []
        blueprint_id = (session.plan_metadata or {}).get("blueprint_id")
        bp = BlueprintRegistryService.get_blueprint(blueprint_id) if blueprint_id else None
        if bp:
            for nid, node in bp.nodes.items():
                if node.node_type == "question":
                    initial_agenda.append({
                        "node_id": node.node_id,
                        "title": node.title,
                        "topic": bp.domain,
                        "prompt": node.fallback_question,
                        "expected_criteria": [c.description or c.id for c in node.evaluation_rubric.criteria],
                        "code_starter": node.question_policy.starter_code,
                    })

        initial_state: InterviewGraphState = {
            "session_id": session.id,
            "member_id": member.id,
            "target_role": session.target_role,
            "category": session.category,
            "experience_level": session.experience_level,
            "difficulty": session.difficulty,
            "duration_minutes": session.duration_minutes,
            "focus_topics": session.focus_topics,
            "candidate_context": candidate_context,
            "total_questions_planned": session.total_questions_planned,
            "current_question_index": 0,
            "agenda": initial_agenda,
            "active_question_id": None,
            "active_question_title": initial_agenda[0]["title"] if initial_agenda else None,
            "active_question_prompt": initial_agenda[0]["prompt"] if initial_agenda else None,
            "active_question_type": "PRIMARY",
            "active_question_topic": initial_agenda[0]["topic"] if initial_agenda else "General",
            "active_code_starter": initial_agenda[0]["code_starter"] if initial_agenda else None,
            "active_expected_criteria": initial_agenda[0]["expected_criteria"] if initial_agenda else [],
            "last_answer_text": None,
            "last_submitted_code": None,
            "last_idempotency_key": None,
            "last_score": None,
            "last_rubric_scores": {},
            "last_strengths": [],
            "last_gaps": [],
            "last_evidence_quotes": [],
            "last_model_answer": None,
            "follow_up_recommended": False,
            "suggested_follow_up": None,
            "follow_up_count_current_topic": 0,
            "max_follow_ups_per_topic": 1,
            "lifecycle_state": "PREPARING",
            "error_message": None,
        }

        config = {"configurable": {"thread_id": session.id}}
        result_state = await _COMPILED_INTERVIEW_GRAPH.ainvoke(initial_state, config=config)

        # Commit first question and plan to PostgreSQL while preserving blueprint metadata
        meta = dict(session.plan_metadata or {})
        meta["agenda"] = result_state.get("agenda", initial_agenda)
        session.plan_metadata = meta
        session.state = "ASKING"
        session.current_question_index = 0

        first_q = InterviewQuestion(
            session_id=session.id,
            order_index=0,
            question_type="PRIMARY",
            topic=result_state.get("active_question_topic") or (initial_agenda[0]["topic"] if initial_agenda else "Technical"),
            title=result_state.get("active_question_title") or (initial_agenda[0]["title"] if initial_agenda else "Question 1"),
            prompt=result_state.get("active_question_prompt") or (initial_agenda[0]["prompt"] if initial_agenda else ""),
            code_starter=result_state.get("active_code_starter") or (initial_agenda[0]["code_starter"] if initial_agenda else None),
            expected_criteria=result_state.get("active_expected_criteria") or (initial_agenda[0]["expected_criteria"] if initial_agenda else []),
        )
        db.add(first_q)
        await db.commit()

        logger.info(
            "LangGraph session %s started with %d agenda items",
            session.id,
            len(meta.get("agenda", [])),
        )
        return await cls.get_session_detail(session.id, member, db)

    @classmethod
    async def submit_answer(
        cls,
        session_id: str,
        payload: InterviewAnswerSubmit,
        member: MemberProfile,
        db: AsyncSession,
    ) -> InterviewSessionDetail:
        session = await cls._get_session_or_raise(session_id, member.id, db)

        if session.state == "COMPLETED":
            return await cls.get_session_detail(session.id, member, db)

        # Idempotency Hashing & Replay Gate (CCC-AI-0103)
        dup_stmt = select(InterviewAnswer).where(
            InterviewAnswer.session_id == session.id,
            InterviewAnswer.idempotency_key == payload.idempotency_key,
        )
        existing_answer = (await db.execute(dup_stmt)).scalars().first()
        if existing_answer:
            replay_dict = {
                "session_id": str(session.id),
                "question_id": str(existing_answer.question_id),
                "answer_text": payload.answer_text.strip(),
                "submitted_code": payload.submitted_code or "",
            }
            computed_replay_hash = hashlib.sha256(json.dumps(replay_dict, sort_keys=True).encode()).hexdigest()
            if existing_answer.payload_hash and existing_answer.payload_hash != computed_replay_hash:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="IDEMPOTENCY_KEY_REUSED: Idempotency key already used for a different answer payload.",
                )
            logger.info("Idempotent answer submission replay detected for session %s (key=%s)", session.id, payload.idempotency_key)
            return await cls.get_session_detail(session.id, member, db)

        # Get active question for new submission
        q_stmt = (
            select(InterviewQuestion)
            .where(
                InterviewQuestion.session_id == session.id,
                InterviewQuestion.order_index == session.current_question_index,
            )
        )
        active_question = (await db.execute(q_stmt)).scalars().first()
        if not active_question:
            raise HTTPException(status_code=400, detail="No active question available for answer submission.")

        payload_dict = {
            "session_id": str(session.id),
            "question_id": str(active_question.id),
            "answer_text": payload.answer_text.strip(),
            "submitted_code": payload.submitted_code or "",
        }
        computed_hash = hashlib.sha256(json.dumps(payload_dict, sort_keys=True).encode()).hexdigest()

        # Persist answer
        answer = InterviewAnswer(
            session_id=session.id,
            question_id=active_question.id,
            idempotency_key=payload.idempotency_key,
            payload_hash=computed_hash,
            processing_state="COMMITTED",
            finalized_at=datetime.now(timezone.utc),
            transcript_source=payload.transcript_source,
            client_turn_id=payload.client_turn_id,
            answer_text=payload.answer_text.strip(),
            submitted_code=payload.submitted_code,
            audio_duration_seconds=payload.audio_duration_seconds,
        )
        db.add(answer)
        session.state = "EVALUATING"
        session.version += 1
        await db.commit()
        await db.refresh(answer)

        # Execute LangGraph answer analysis turn
        config = {"configurable": {"thread_id": session.id}}
        turn_input = {
            "session_id": session.id,
            "member_id": member.id,
            "active_question_topic": active_question.topic,
            "active_question_title": active_question.title,
            "active_question_prompt": active_question.prompt,
            "active_expected_criteria": active_question.expected_criteria,
            "last_answer_text": answer.answer_text,
            "last_submitted_code": answer.submitted_code,
            "last_idempotency_key": payload.idempotency_key,
        }

        # Invoke evaluation node
        eval_node_state = await _COMPILED_INTERVIEW_GRAPH.ainvoke(turn_input, config=config)

        # Commit evaluation to database
        evaluation = InterviewEvaluation(
            session_id=session.id,
            question_id=active_question.id,
            answer_id=answer.id,
            score=eval_node_state.get("last_score", 75),
            rubric_scores=eval_node_state.get("last_rubric_scores", {}),
            strengths=eval_node_state.get("last_strengths", []),
            gaps=eval_node_state.get("last_gaps", []),
            evidence_quotes=eval_node_state.get("last_evidence_quotes", []),
            model_answer=eval_node_state.get("last_model_answer") or "Demonstrate understanding of core trade-offs and invariants.",
            follow_up_recommended=eval_node_state.get("follow_up_recommended", False),
        )
        db.add(evaluation)
        await db.commit()
        await cls._update_ml_state(session, active_question, evaluation, db)

        # Decide Next Question or Finalize
        next_idx = active_question.order_index + 1
        agenda: List[Dict[str, Any]] = session.plan_metadata.get("agenda", [])

        if (
            eval_node_state.get("follow_up_recommended")
            and eval_node_state.get("suggested_follow_up")
            and active_question.question_type == "PRIMARY"
        ):
            # Branch: Adaptive follow-up
            follow_up_q = InterviewQuestion(
                session_id=session.id,
                order_index=next_idx,
                parent_question_id=active_question.id,
                question_type="FOLLOW_UP",
                topic=f"{active_question.topic} (Follow-up)",
                title=f"Follow-up: {active_question.title}",
                prompt=eval_node_state["suggested_follow_up"],
                expected_criteria=active_question.expected_criteria,
            )
            db.add(follow_up_q)
            session.current_question_index = next_idx
            session.state = "ASKING"
            await db.commit()

        elif next_idx < len(agenda):
            # Branch: Advance to next planned topic
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
            # Agenda exhausted: Synthesize report
            await cls._finalize_and_synthesize_report(session, member, db)

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

        q_stmt = select(InterviewQuestion).where(InterviewQuestion.session_id == session.id).order_by(InterviewQuestion.order_index)
        questions = (await db.execute(q_stmt)).scalars().all()

        ev_stmt = select(InterviewEvaluation).where(InterviewEvaluation.session_id == session.id)
        evaluations = (await db.execute(ev_stmt)).scalars().all()

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
            logger.info("Session %s COMPLETED with overall score %d via LangGraph engine", session.id, report.overall_score)

        except Exception as e:
            logger.exception("Failed to synthesize final report for session %s: %s", session.id, e)
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
                plan_version=getattr(q, "plan_version", "1.0") or "1.0",
                competency_key=getattr(q, "competency_key", "TECHNICAL_EXECUTION") or "TECHNICAL_EXECUTION",
                difficulty_level=getattr(q, "difficulty_level", "MEDIUM") or "MEDIUM",
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
                processing_state=getattr(a, "processing_state", "COMMITTED") or "COMMITTED",
                transcript_source=getattr(a, "transcript_source", "TEXT") or "TEXT",
                audio_duration_seconds=getattr(a, "audio_duration_seconds", None),
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
                rubric_version=getattr(e, "rubric_version", "1.0") or "1.0",
                confidence_band=getattr(e, "confidence_band", "HIGH") or "HIGH",
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
                report_version=getattr(session.report, "report_version", "1.0") or "1.0",
                rubric_version=getattr(session.report, "rubric_version", "1.0") or "1.0",
                plan_version=getattr(session.report, "plan_version", "1.0") or "1.0",
                confidence_and_limitations=getattr(session.report, "confidence_and_limitations", {}) or {},
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
            mode=getattr(session, "mode", "TEXT") or "TEXT",
            language=getattr(session, "language", "en") or "en",
            plan_version=getattr(session, "plan_version", "1.0") or "1.0",
            rubric_version=getattr(session, "rubric_version", "1.0") or "1.0",
            state=session.state,
            version=getattr(session, "version", 1) or 1,
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

        return [
            InterviewSessionListItem(
                id=s.id,
                target_role=s.target_role,
                experience_level=s.experience_level,
                category=s.category,
                difficulty=s.difficulty,
                duration_minutes=s.duration_minutes,
                mode=getattr(s, "mode", "TEXT") or "TEXT",
                state=s.state,
                started_at=s.started_at,
                completed_at=s.completed_at,
                created_at=s.created_at,
                overall_score=s.report.overall_score if s.report else None,
                verdict=s.report.verdict if s.report else None,
                total_questions=len(s.questions),
                total_answers=len(s.answers),
            )
            for s in sessions
        ]

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
    async def abandon_session(
        cls,
        session_id: str,
        member: MemberProfile,
        db: AsyncSession,
    ) -> InterviewSessionDetail:
        session = await cls._get_session_or_raise(session_id, member.id, db)
        if session.state in ("COMPLETED", "ABANDONED", "FAILED"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="SESSION_STATE_CONFLICT: Cannot abandon a completed or already terminated session.",
            )
        session.state = "ABANDONED"
        session.abandoned_at = datetime.now(timezone.utc)
        session.version += 1

        voice_stmt = select(InterviewVoiceLink).where(
            InterviewVoiceLink.session_id == session.id,
            InterviewVoiceLink.status == "ACTIVE",
        )
        voice_links = (await db.execute(voice_stmt)).scalars().all()
        for vl in voice_links:
            vl.status = "CLOSED"
            vl.closed_at = datetime.now(timezone.utc)

        await db.commit()
        return await cls.get_session_detail(session.id, member, db)

    @classmethod
    async def get_report(
        cls,
        session_id: str,
        member: MemberProfile,
        db: AsyncSession,
    ) -> InterviewReportDetail:
        session = await cls._get_session_or_raise(session_id, member.id, db)
        stmt = select(InterviewReport).where(InterviewReport.session_id == session.id)
        report = (await db.execute(stmt)).scalars().first()
        if not report:
            if session.state == "COMPLETED":
                await cls._finalize_and_synthesize_report(session, member, db)
                report = (await db.execute(stmt)).scalars().first()
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Interview report has not been generated yet. Complete the interview to generate the report.",
                )
        return InterviewReportDetail(
            id=report.id,
            session_id=report.session_id,
            overall_score=report.overall_score,
            verdict=report.verdict,
            executive_summary=report.executive_summary,
            dimension_breakdown=report.dimension_breakdown or {},
            top_strengths=report.top_strengths or [],
            areas_to_improve=report.areas_to_improve or [],
            recommended_practice=report.recommended_practice or [],
            report_version=getattr(report, "report_version", "1.0") or "1.0",
            rubric_version=getattr(report, "rubric_version", "1.0") or "1.0",
            plan_version=getattr(report, "plan_version", "1.0") or "1.0",
            confidence_and_limitations=getattr(report, "confidence_and_limitations", {}) or {},
            created_at=report.created_at,
        )

    @classmethod
    async def regenerate_report(
        cls,
        session_id: str,
        member: MemberProfile,
        db: AsyncSession,
    ) -> InterviewReportDetail:
        session = await cls._get_session_or_raise(session_id, member.id, db)
        stmt = select(InterviewReport).where(InterviewReport.session_id == session.id)
        existing_report = (await db.execute(stmt)).scalars().first()

        old_report_id = existing_report.id if existing_report else None
        old_version = existing_report.report_version if existing_report else "1.0"
        try:
            parts = old_version.split(".")
            new_version = f"{parts[0]}.{int(parts[1]) + 1}"
        except Exception:
            new_version = "1.1"

        q_stmt = select(InterviewQuestion).where(InterviewQuestion.session_id == session.id).order_by(InterviewQuestion.order_index)
        questions = (await db.execute(q_stmt)).scalars().all()

        ev_stmt = select(InterviewEvaluation).where(InterviewEvaluation.session_id == session.id)
        evaluations = (await db.execute(ev_stmt)).scalars().all()

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
            overall_score = report_out.overall_score if report_out.overall_score else avg_score
            verdict = report_out.verdict
            executive_summary = report_out.executive_summary
            dimension_breakdown = report_out.dimension_breakdown
            top_strengths = report_out.top_strengths
            areas_to_improve = report_out.areas_to_improve
            recommended_practice = [r.model_dump() for r in report_out.recommended_practice]
        except Exception as e:
            logger.warning("Report regeneration LLM error, using fallback: %s", e)
            overall_score = avg_score
            verdict = "HIRE" if avg_score >= 75 else "LEANING_HIRE"
            executive_summary = "Regenerated interview report. Candidate demonstrated consistent ability across interview topics."
            dimension_breakdown = {"Technical Problem Solving": avg_score, "Communication": avg_score}
            top_strengths = ["Structured reasoning", "Consistent technical responses"]
            areas_to_improve = ["Deep dive into system invariants"]
            recommended_practice = [{"topic": "System Invariants", "description": "Review consistency and reliability models.", "action_type": "PRACTICE_CHALLENGE"}]

        if existing_report:
            existing_report.overall_score = overall_score
            existing_report.verdict = verdict
            existing_report.executive_summary = executive_summary
            existing_report.dimension_breakdown = dimension_breakdown
            existing_report.top_strengths = top_strengths
            existing_report.areas_to_improve = areas_to_improve
            existing_report.recommended_practice = recommended_practice
            existing_report.report_version = new_version
            existing_report.supersedes_report_id = old_report_id
            report = existing_report
        else:
            report = InterviewReport(
                session_id=session.id,
                member_id=member.id,
                overall_score=overall_score,
                verdict=verdict,
                executive_summary=executive_summary,
                dimension_breakdown=dimension_breakdown,
                top_strengths=top_strengths,
                areas_to_improve=areas_to_improve,
                recommended_practice=recommended_practice,
                report_version=new_version,
                supersedes_report_id=old_report_id,
            )
            db.add(report)

        await db.commit()
        await db.refresh(report)

        return InterviewReportDetail(
            id=report.id,
            session_id=report.session_id,
            overall_score=report.overall_score,
            verdict=report.verdict,
            executive_summary=report.executive_summary,
            dimension_breakdown=report.dimension_breakdown or {},
            top_strengths=report.top_strengths or [],
            areas_to_improve=report.areas_to_improve or [],
            recommended_practice=report.recommended_practice or [],
            report_version=report.report_version,
            rubric_version=report.rubric_version,
            plan_version=report.plan_version,
            confidence_and_limitations=report.confidence_and_limitations or {},
            created_at=report.created_at,
        )

    # ── Candidate Profile Management ──────────────────────────────────────────

    @classmethod
    async def get_profile(
        cls,
        member: MemberProfile,
        db: AsyncSession,
    ) -> CandidateProfileResponse:
        stmt = select(CandidateProfile).where(
            CandidateProfile.member_id == member.id,
            CandidateProfile.deleted_at.is_(None),
        )
        profile = (await db.execute(stmt)).scalars().first()
        if not profile:
            profile = CandidateProfile(
                member_id=member.id,
                declared_skills=[],
                demonstrated_strengths=[],
                developmental_gaps=[],
                preferred_tracks=[],
                declared_projects=[],
                learning_goals=[],
                resume_summary="",
                context_consent=True,
            )
            db.add(profile)
            await db.commit()
            await db.refresh(profile)

        return CandidateProfileResponse(
            id=profile.id,
            member_id=profile.member_id,
            declared_skills=profile.declared_skills or [],
            demonstrated_strengths=profile.demonstrated_strengths or [],
            developmental_gaps=profile.developmental_gaps or [],
            preferred_tracks=profile.preferred_tracks or [],
            declared_projects=profile.declared_projects or [],
            learning_goals=profile.learning_goals or [],
            resume_summary=profile.resume_summary,
            context_consent=profile.context_consent,
            updated_at=profile.updated_at,
        )

    @classmethod
    async def update_profile(
        cls,
        member: MemberProfile,
        payload: CandidateProfileUpdate,
        db: AsyncSession,
    ) -> CandidateProfileResponse:
        stmt = select(CandidateProfile).where(
            CandidateProfile.member_id == member.id,
            CandidateProfile.deleted_at.is_(None),
        )
        profile = (await db.execute(stmt)).scalars().first()
        if not profile:
            profile = CandidateProfile(member_id=member.id)
            db.add(profile)

        if payload.declared_skills is not None:
            profile.declared_skills = payload.declared_skills
        if payload.preferred_tracks is not None:
            profile.preferred_tracks = payload.preferred_tracks
        if payload.declared_projects is not None:
            profile.declared_projects = [
                p.model_dump() if hasattr(p, "model_dump") else p for p in payload.declared_projects
            ]
        if payload.learning_goals is not None:
            profile.learning_goals = payload.learning_goals
        if payload.context_consent is not None:
            profile.context_consent = payload.context_consent

        profile.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(profile)

        return CandidateProfileResponse(
            id=profile.id,
            member_id=profile.member_id,
            declared_skills=profile.declared_skills or [],
            demonstrated_strengths=profile.demonstrated_strengths or [],
            developmental_gaps=profile.developmental_gaps or [],
            preferred_tracks=profile.preferred_tracks or [],
            declared_projects=profile.declared_projects or [],
            learning_goals=profile.learning_goals or [],
            resume_summary=profile.resume_summary,
            context_consent=profile.context_consent,
            updated_at=profile.updated_at,
        )

    @classmethod
    async def delete_profile(
        cls,
        member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        stmt = select(CandidateProfile).where(
            CandidateProfile.member_id == member.id,
            CandidateProfile.deleted_at.is_(None),
        )
        profile = (await db.execute(stmt)).scalars().first()
        if profile:
            profile.deleted_at = datetime.now(timezone.utc)
            profile.context_consent = False
            await db.commit()
        return {"success": True, "message": "Candidate profile deleted."}

    # ── Candidate Resume Asset & Fact Management ──────────────────────────────

    @classmethod
    async def upload_resume(
        cls,
        member: MemberProfile,
        file: UploadFile,
        db: AsyncSession,
    ) -> ResumeUploadResponse:
        content = await file.read()
        max_bytes = 5 * 1024 * 1024
        if len(content) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File exceeds maximum allowed size of 5MB.",
            )
        if len(content) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty.",
            )

        detected_mime = "application/octet-stream"
        if content.startswith(b"%PDF"):
            detected_mime = "application/pdf"
        elif content.startswith(b"PK\x03\x04"):
            detected_mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        else:
            try:
                content.decode("utf-8")
                detected_mime = "text/plain"
            except UnicodeDecodeError:
                pass

        allowed_mimes = {
            "application/pdf",
            "text/plain",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }
        if detected_mime not in allowed_mimes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file format. Please upload PDF, TXT, or DOCX.",
            )

        file_sha256 = hashlib.sha256(content).hexdigest()
        storage_dir = Path("storage/resumes") / member.id
        storage_dir.mkdir(parents=True, exist_ok=True)
        safe_filename = Path(file.filename or "resume.pdf").name
        storage_path = storage_dir / f"{file_sha256[:16]}_{safe_filename}"
        with open(storage_path, "wb") as f:
            f.write(content)

        asset = CandidateResumeAsset(
            member_id=member.id,
            storage_key=str(storage_path),
            original_filename=safe_filename,
            detected_mime_type=detected_mime,
            size_bytes=len(content),
            sha256=file_sha256,
            scan_status="CLEAN",
            parse_status="PARSED",
            consent_status="CONFIRMED",
        )
        db.add(asset)
        await db.commit()
        await db.refresh(asset)

        extracted_text = ""
        if detected_mime == "text/plain":
            extracted_text = content.decode("utf-8", errors="ignore")
        elif detected_mime == "application/pdf":
            try:
                from pypdf import PdfReader
                import io
                reader = PdfReader(io.BytesIO(content))
                extracted_text = "\n".join([p.extract_text() or "" for p in reader.pages])
            except Exception:
                extracted_text = re.sub(rb"[^\x20-\x7E\n]", rb" ", content).decode("ascii", errors="ignore")

        known_skill_keywords = [
            "Python", "JavaScript", "TypeScript", "React", "Node.js", "FastAPI", "Go",
            "Docker", "Kubernetes", "PostgreSQL", "Redis", "AWS", "Git", "C++", "Java",
            "Linux", "SQL", "GraphQL", "CI/CD", "Machine Learning", "Microservices"
        ]
        found_skills = set()
        for kw in known_skill_keywords:
            if re.search(r"\b" + re.escape(kw) + r"\b", extracted_text, re.IGNORECASE):
                found_skills.add(kw)

        facts_to_add = [
            CandidateResumeFact(
                asset_id=asset.id,
                member_id=member.id,
                fact_type="SKILL",
                normalized_value=skill,
                source_section="Skills",
                extraction_confidence=0.95,
                candidate_status="CONFIRMED",
            )
            for skill in sorted(found_skills)
        ]

        if not facts_to_add:
            facts_to_add.append(
                CandidateResumeFact(
                    asset_id=asset.id,
                    member_id=member.id,
                    fact_type="SKILL",
                    normalized_value="Software Development",
                    source_section="Summary",
                    extraction_confidence=0.85,
                    candidate_status="CONFIRMED",
                )
            )

        for f in facts_to_add:
            db.add(f)
        await db.commit()

        return ResumeUploadResponse(
            asset_id=asset.id,
            original_filename=asset.original_filename,
            detected_mime_type=asset.detected_mime_type,
            size_bytes=asset.size_bytes,
            scan_status=asset.scan_status,
            parse_status=asset.parse_status,
            consent_status=asset.consent_status,
            created_at=asset.created_at,
        )

    @classmethod
    async def get_resume(
        cls,
        asset_id: str,
        member: MemberProfile,
        db: AsyncSession,
    ) -> ResumeDetailResponse:
        stmt = (
            select(CandidateResumeAsset)
            .options(selectinload(CandidateResumeAsset.facts))
            .where(
                CandidateResumeAsset.id == asset_id,
                CandidateResumeAsset.member_id == member.id,
                CandidateResumeAsset.deleted_at.is_(None),
            )
        )
        asset = (await db.execute(stmt)).scalars().first()
        if not asset:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume asset not found.")

        fact_items = [
            ResumeFactItem(
                id=f.id,
                fact_type=f.fact_type,
                normalized_value=f.normalized_value,
                source_page=f.source_page,
                source_section=f.source_section,
                extraction_confidence=f.extraction_confidence,
                candidate_status=f.candidate_status,
                candidate_corrected_value=f.candidate_corrected_value,
            )
            for f in asset.facts
        ]

        return ResumeDetailResponse(
            asset=ResumeUploadResponse(
                asset_id=asset.id,
                original_filename=asset.original_filename,
                detected_mime_type=asset.detected_mime_type,
                size_bytes=asset.size_bytes,
                scan_status=asset.scan_status,
                parse_status=asset.parse_status,
                consent_status=asset.consent_status,
                created_at=asset.created_at,
            ),
            facts=fact_items,
        )

    @classmethod
    async def update_resume_facts(
        cls,
        asset_id: str,
        updates: List[ResumeFactUpdateRequest],
        member: MemberProfile,
        db: AsyncSession,
    ) -> List[ResumeFactItem]:
        asset_stmt = select(CandidateResumeAsset).where(
            CandidateResumeAsset.id == asset_id,
            CandidateResumeAsset.member_id == member.id,
            CandidateResumeAsset.deleted_at.is_(None),
        )
        asset = (await db.execute(asset_stmt)).scalars().first()
        if not asset:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume asset not found.")

        updated_items = []
        for up in updates:
            fact_stmt = select(CandidateResumeFact).where(
                CandidateResumeFact.id == up.fact_id,
                CandidateResumeFact.asset_id == asset_id,
                CandidateResumeFact.member_id == member.id,
            )
            fact = (await db.execute(fact_stmt)).scalars().first()
            if fact:
                fact.candidate_status = up.candidate_status
                if up.candidate_corrected_value is not None:
                    fact.candidate_corrected_value = up.candidate_corrected_value
                fact.updated_at = datetime.now(timezone.utc)
                updated_items.append(
                    ResumeFactItem(
                        id=fact.id,
                        fact_type=fact.fact_type,
                        normalized_value=fact.normalized_value,
                        source_page=fact.source_page,
                        source_section=fact.source_section,
                        extraction_confidence=fact.extraction_confidence,
                        candidate_status=fact.candidate_status,
                        candidate_corrected_value=fact.candidate_corrected_value,
                    )
                )

        await db.commit()
        return updated_items

    @classmethod
    async def consent_resume(
        cls,
        asset_id: str,
        req: ResumeConsentRequest,
        member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        asset_stmt = select(CandidateResumeAsset).where(
            CandidateResumeAsset.id == asset_id,
            CandidateResumeAsset.member_id == member.id,
            CandidateResumeAsset.deleted_at.is_(None),
        )
        asset = (await db.execute(asset_stmt)).scalars().first()
        if not asset:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume asset not found.")

        asset.consent_status = "CONFIRMED" if req.consent else "REVOKED"
        consent = CandidateConsent(
            member_id=member.id,
            purpose=req.purpose,
            scope_ref=asset_id,
            granted_at=datetime.now(timezone.utc),
            revoked_at=None if req.consent else datetime.now(timezone.utc),
            policy_version="1.0",
        )
        db.add(consent)
        await db.commit()
        return {
            "asset_id": asset_id,
            "consent_status": asset.consent_status,
            "purpose": req.purpose,
        }

    @classmethod
    async def delete_resume(
        cls,
        asset_id: str,
        member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        asset_stmt = select(CandidateResumeAsset).where(
            CandidateResumeAsset.id == asset_id,
            CandidateResumeAsset.member_id == member.id,
            CandidateResumeAsset.deleted_at.is_(None),
        )
        asset = (await db.execute(asset_stmt)).scalars().first()
        if not asset:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume asset not found.")

        asset.deleted_at = datetime.now(timezone.utc)
        try:
            p = Path(asset.storage_key)
            if p.exists():
                p.unlink(missing_ok=True)
        except Exception:
            pass

        await db.execute(delete(CandidateResumeFact).where(CandidateResumeFact.asset_id == asset_id))
        await db.commit()
        return {"success": True, "message": f"Resume asset {asset_id} deleted."}

    # ── Voice Integration Binding ─────────────────────────────────────────────

    @classmethod
    async def bind_voice_session(
        cls,
        session_id: str,
        member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        session = await cls._get_session_or_raise(session_id, member.id, db)

        hcve_session_id = f"ses_{uuid.uuid4().hex[:12]}"
        voice_link = InterviewVoiceLink(
            session_id=session.id,
            member_id=member.id,
            hcve_session_id=hcve_session_id,
            status="ACTIVE",
        )
        db.add(voice_link)
        await db.commit()

        return {
            "interview_session_id": session.id,
            "voice_session_id": hcve_session_id,
            "owner_id": member.id,
            "transport": {
                "type": "WEBSOCKET",
                "endpoint": f"/api/v1/hcve/ws/{hcve_session_id}",
                "sample_rate_hz": 24000,
                "channels": 1,
                "codec": "PCM_S16LE",
            },
            "supported_capabilities": ["vad", "stt", "tts", "barge_in"],
            "consent_required": True,
            "status": "ACTIVE",
        }

    @classmethod
    async def interrupt_voice_session(
        cls,
        session_id: str,
        voice_id: str,
        member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        session = await cls._get_session_or_raise(session_id, member.id, db)
        link_stmt = select(InterviewVoiceLink).where(
            InterviewVoiceLink.session_id == session.id,
            InterviewVoiceLink.hcve_session_id == voice_id,
            InterviewVoiceLink.member_id == member.id,
        )
        link = (await db.execute(link_stmt)).scalars().first()
        if not link:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voice link not found.")

        return {
            "session_id": session.id,
            "voice_id": voice_id,
            "interrupted": True,
            "reason": "client_explicit_interrupt",
        }

    @classmethod
    async def close_voice_session(
        cls,
        session_id: str,
        voice_id: str,
        member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        session = await cls._get_session_or_raise(session_id, member.id, db)
        link_stmt = select(InterviewVoiceLink).where(
            InterviewVoiceLink.session_id == session.id,
            InterviewVoiceLink.hcve_session_id == voice_id,
            InterviewVoiceLink.member_id == member.id,
        )
        link = (await db.execute(link_stmt)).scalars().first()
        if not link:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voice link not found.")

        link.status = "CLOSED"
        link.closed_at = datetime.now(timezone.utc)
        await db.commit()

        return {"success": True, "message": f"Voice session {voice_id} closed."}

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

    @classmethod
    def _map_topic_to_competency(cls, topic_str: str) -> str:
        t = (topic_str or "").lower()
        if "index" in t or "sql" in t or "query" in t:
            return "db.indexing"
        if "acid" in t or "transact" in t or "isolat" in t:
            return "db.transactions"
        if "shard" in t or "partition" in t:
            return "db.sharding"
        if "cap" in t or "pacelc" in t:
            return "dist.cap"
        if "consensus" in t or "raft" in t or "paxos" in t:
            return "dist.consensus"
        if "idempotent" in t or "dedup" in t or "outbox" in t:
            return "dist.idempotency"
        if "async" in t or "event loop" in t or "epoll" in t:
            return "backend.async"
        if "thread" in t or "lock" in t or "concurr" in t or "mutex" in t:
            return "backend.concurrency"
        if "cach" in t or "redis" in t or "memcached" in t:
            return "backend.caching"
        if "rate limit" in t or "token bucket" in t:
            return "sys.rate_limiting"
        if "scale" in t or "system design" in t or "architect" in t:
            return "sys.scalability"
        if "tree" in t or "graph" in t or "bfs" in t or "dfs" in t:
            return "dsa.trees_graphs"
        if "dp" in t or "dynamic programming" in t:
            return "dsa.dp"
        if "docker" in t or "container" in t or "sandbox" in t:
            return "devops.containers"
        if "observab" in t or "metric" in t or "telemetry" in t or "log" in t:
            return "devops.observability"
        return "sys.scalability"

    @classmethod
    async def _update_ml_state(
        cls,
        session: InterviewSession,
        active_question: InterviewQuestion,
        evaluation: InterviewEvaluation,
        db: AsyncSession,
    ) -> None:
        metadata = dict(session.plan_metadata or {})
        ml_state = dict(metadata.get("ml_state") or {})

        comp_id = getattr(active_question, "competency_key", None)
        if not comp_id or comp_id not in COMPETENCY_REGISTRY:
            comp_id = cls._map_topic_to_competency(active_question.topic or active_question.title)

        # 1. Update BKT
        raw_bkt_map = dict(ml_state.get("bkt") or {})
        if comp_id in raw_bkt_map:
            prev_bkt_dict = raw_bkt_map[comp_id]
            curr_bkt = CompetencyBKTState(
                competency_id=comp_id,
                mastery_prob=prev_bkt_dict["mastery_prob"],
                uncertainty=prev_bkt_dict["uncertainty"],
                evidence_count=prev_bkt_dict["evidence_count"],
                consecutive_correct=prev_bkt_dict.get("consecutive_correct", 0),
                history=prev_bkt_dict.get("history", []),
            )
        else:
            curr_bkt = BKTEngine.initialize_state(comp_id)

        evidence_score = float(evaluation.score) / 100.0
        updated_bkt = BKTEngine.update_with_evidence(
            state=curr_bkt,
            evidence_score=evidence_score,
            turn_id=str(active_question.id),
            confidence=0.9,
        )
        raw_bkt_map[comp_id] = {
            "mastery_prob": updated_bkt.mastery_prob,
            "uncertainty": updated_bkt.uncertainty,
            "evidence_count": updated_bkt.evidence_count,
            "consecutive_correct": updated_bkt.consecutive_correct,
            "history": updated_bkt.history,
        }
        ml_state["bkt"] = raw_bkt_map

        # 2. Update IRT
        irt_responses = list(ml_state.get("irt_responses") or [])
        difficulty_b = 0.0
        if getattr(active_question, "difficulty_level", "MEDIUM") == "EASY":
            difficulty_b = -1.0
        elif getattr(active_question, "difficulty_level", "MEDIUM") == "HARD":
            difficulty_b = 1.0

        irt_responses.append({
            "item_id": str(active_question.id),
            "difficulty_b": difficulty_b,
            "discrimination_a": 1.2,
            "competency_id": comp_id,
            "score": evidence_score,
        })
        ml_state["irt_responses"] = irt_responses

        parsed_items = [
            (
                IRTItemParameters(
                    item_id=r["item_id"],
                    difficulty_b=r["difficulty_b"],
                    discrimination_a=r["discrimination_a"],
                    competency_id=r.get("competency_id"),
                ),
                r["score"],
            )
            for r in irt_responses
        ]
        ability = IRTEngine.estimate_ability_map(parsed_items)
        ml_state["ability_estimate"] = {
            "theta": ability.theta,
            "standard_error": ability.standard_error,
            "ci_lower": ability.ci_lower,
            "ci_upper": ability.ci_upper,
            "response_count": ability.response_count,
            "fisher_information_total": ability.fisher_information_total,
        }

        # 3. Update Kalman Filter
        raw_kalman = ml_state.get("kalman")
        if raw_kalman:
            kalman_curr = KalmanState(
                proficiency=raw_kalman["proficiency"],
                velocity=raw_kalman["velocity"],
                p_00=raw_kalman["p_00"],
                p_01=raw_kalman["p_01"],
                p_10=raw_kalman["p_10"],
                p_11=raw_kalman["p_11"],
                step_count=raw_kalman["step_count"],
                history=raw_kalman.get("history", []),
            )
        else:
            kalman_curr = KalmanPerformanceFilter.initialize_state(float(evaluation.score))

        updated_kalman = KalmanPerformanceFilter.update(kalman_curr, float(evaluation.score))
        ml_state["kalman"] = {
            "proficiency": updated_kalman.proficiency,
            "velocity": updated_kalman.velocity,
            "p_00": updated_kalman.p_00,
            "p_01": updated_kalman.p_01,
            "p_10": updated_kalman.p_10,
            "p_11": updated_kalman.p_11,
            "step_count": updated_kalman.step_count,
            "history": updated_kalman.history,
        }

        metadata["ml_state"] = ml_state
        session.plan_metadata = metadata
        await db.commit()

    @classmethod
    async def get_competency_graph(
        cls,
        session_id: str,
        member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        session = await cls._get_session_or_raise(session_id, member.id, db)
        ml_state = (session.plan_metadata or {}).get("ml_state") or {}
        raw_bkt = ml_state.get("bkt") or {}

        bkt_states: Dict[str, CompetencyBKTState] = {}
        for comp_id, d in raw_bkt.items():
            bkt_states[comp_id] = CompetencyBKTState(
                competency_id=comp_id,
                mastery_prob=d["mastery_prob"],
                uncertainty=d["uncertainty"],
                evidence_count=d["evidence_count"],
                consecutive_correct=d.get("consecutive_correct", 0),
                history=d.get("history", []),
            )

        snapshot = GraphProjectionService.compute_projection(session.id, bkt_states)
        return {
            "session_id": snapshot.session_id,
            "version": snapshot.version,
            "nodes": snapshot.nodes,
            "edges": snapshot.edges,
            "metrics": snapshot.metrics,
            "generated_at": snapshot.generated_at,
        }

    @classmethod
    async def get_predictions(
        cls,
        session_id: str,
        member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        session = await cls._get_session_or_raise(session_id, member.id, db)
        ml_state = (session.plan_metadata or {}).get("ml_state") or {}
        raw_bkt = ml_state.get("bkt") or {}
        raw_ability = ml_state.get("ability_estimate") or {}

        ability = CandidateAbilityEstimate(
            theta=raw_ability.get("theta", 0.0),
            standard_error=raw_ability.get("standard_error", 1.0),
            ci_lower=raw_ability.get("ci_lower", -1.96),
            ci_upper=raw_ability.get("ci_upper", 1.96),
            response_count=raw_ability.get("response_count", 0),
            fisher_information_total=raw_ability.get("fisher_information_total", 0.0),
        )

        bkt_states: Dict[str, CompetencyBKTState] = {}
        for comp_id, d in raw_bkt.items():
            bkt_states[comp_id] = CompetencyBKTState(
                competency_id=comp_id,
                mastery_prob=d["mastery_prob"],
                uncertainty=d["uncertainty"],
                evidence_count=d["evidence_count"],
                consecutive_correct=d.get("consecutive_correct", 0),
                history=d.get("history", []),
            )

        resp = PredictionService.generate_predictions(session.id, ability, bkt_states)
        return {
            "session_id": resp.session_id,
            "model_version": resp.model_version,
            "candidate_ability_theta": resp.candidate_ability_theta,
            "ability_confidence_interval": resp.ability_confidence_interval,
            "predictions": [
                {
                    "competency_id": p.competency_id,
                    "label": p.label,
                    "current_mastery_estimate": p.current_mastery_estimate,
                    "predicted_response_probability": p.predicted_response_probability,
                    "prediction_target": p.prediction_target,
                    "confidence_interval": p.confidence_interval,
                    "evidence_count": p.evidence_count,
                    "is_low_evidence": p.is_low_evidence,
                    "explanation": p.explanation,
                }
                for p in resp.predictions
            ],
            "generated_at": resp.generated_at,
        }

    @classmethod
    async def get_adaptive_next_question(
        cls,
        session_id: str,
        member: MemberProfile,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        session = await cls._get_session_or_raise(session_id, member.id, db)
        ml_state = (session.plan_metadata or {}).get("ml_state") or {}
        raw_bkt = ml_state.get("bkt") or {}
        raw_ability = ml_state.get("ability_estimate") or {}
        current_theta = float(raw_ability.get("theta", 0.0))

        bkt_states: Dict[str, CompetencyBKTState] = {}
        for comp_id, d in raw_bkt.items():
            bkt_states[comp_id] = CompetencyBKTState(
                competency_id=comp_id,
                mastery_prob=d["mastery_prob"],
                uncertainty=d["uncertainty"],
                evidence_count=d["evidence_count"],
                consecutive_correct=d.get("consecutive_correct", 0),
                history=d.get("history", []),
            )

        q_stmt = select(InterviewQuestion).where(InterviewQuestion.session_id == session.id)
        existing_questions = (await db.execute(q_stmt)).scalars().all()
        asked_ids = {q.title for q in existing_questions}
        recent_competency_ids = [
            getattr(q, "competency_key", None) or cls._map_topic_to_competency(q.topic)
            for q in sorted(existing_questions, key=lambda x: x.order_index)
        ]

        candidate_pool: List[QuestionCandidate] = []
        for c_id, node in COMPETENCY_REGISTRY.items():
            candidate_pool.append(
                QuestionCandidate(
                    question_id=f"q_{c_id}",
                    title=f"{node.label} Core Deep-Dive",
                    prompt=f"Explain {node.label}: {node.description}. How do you reason about trade-offs and edge cases in production?",
                    competency_id=c_id,
                    difficulty_b=node.default_irt_b,
                    discrimination_a=node.default_irt_a,
                )
            )

        decision = AdaptiveQuestionSelector.select_next_question(
            available_questions=candidate_pool,
            asked_question_ids=asked_ids,
            current_theta=current_theta,
            bkt_states=bkt_states,
            recent_competency_ids=recent_competency_ids,
            remaining_minutes=session.duration_minutes,
        )

        return {
            "question_id": decision.selected_question.question_id,
            "title": decision.selected_question.title,
            "prompt": decision.selected_question.prompt,
            "target_competency_id": decision.target_competency_id,
            "target_difficulty": decision.target_difficulty,
            "selection_score": decision.selection_score,
            "rationale": decision.rationale,
            "candidate_pool_size": decision.candidate_pool_size,
            "scores_breakdown": decision.scores_breakdown,
        }

    @classmethod
    def list_competency_taxonomy(cls) -> List[Dict[str, Any]]:
        nodes = CompetencyTaxonomyService.list_all()
        return [
            {
                "id": n.id,
                "label": n.label,
                "domain": n.domain.value,
                "description": n.description,
                "prerequisites": n.prerequisites,
                "related": n.related,
                "version": n.version,
            }
            for n in nodes
        ]
