"""
Chaos Computer Club — Medi-Caps Chapter
app.models.interview — Relational Database Models for AI Interview Practice
Implements CCC-AI-0101, DATA_AND_MIGRATION_SPEC & VOICE_INTEGRATION_CONTRACT:
- Hardened relational entities for interview sessions, questions, answers, evaluations, reports.
- Optimistic concurrency versioning on sessions.
- Idempotency hashing, turn state & fencing tokens on answers.
- Candidate resume assets, provenance-tagged facts, candidate consents.
- Authenticated HCVE voice links.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
    JSON,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship
from app.core.db import Base


def _gen_uuid() -> str:
    return str(uuid.uuid4())


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class InterviewSession(Base):
    """Authoritative durable record of an AI interview simulation."""
    __tablename__ = "interview_sessions"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    member_id = Column(String(36), ForeignKey("member_profiles.id", ondelete="CASCADE"), nullable=False, index=True)

    target_role = Column(String(100), nullable=False)
    experience_level = Column(String(20), nullable=False, default="ENTRY_LEVEL")
    category = Column(String(40), nullable=False, default="TECHNICAL")
    difficulty = Column(String(20), nullable=False, default="MEDIUM")
    duration_minutes = Column(Integer, nullable=False, default=30)
    preferred_language = Column(String(30), nullable=False, default="python")
    focus_topics = Column(JSON, nullable=False, default=list)
    job_description = Column(Text, nullable=True)
    resume_notes = Column(Text, nullable=True)

    # Protocol & Governance Modes
    mode = Column(String(20), nullable=False, default="TEXT")  # TEXT, VOICE
    language = Column(String(10), nullable=False, default="en")
    plan_version = Column(String(20), nullable=False, default="1.0")
    rubric_version = Column(String(20), nullable=False, default="1.0")
    provider_profile = Column(String(50), nullable=False, default="default")

    # State Machine: CREATED, PREPARING, ASKING, AWAITING_ANSWER, EVALUATING, SELECTING_NEXT_QUESTION, PAUSED, COMPLETING, COMPLETED, FAILED
    state = Column(String(30), nullable=False, default="CREATED", index=True)
    current_question_index = Column(Integer, nullable=False, default=0)
    total_questions_planned = Column(Integer, nullable=False, default=4)
    plan_metadata = Column(JSON, nullable=False, default=dict)

    # Concurrency & Operational Fault Handling
    version = Column(Integer, nullable=False, default=1)  # Optimistic concurrency token
    failure_code = Column(String(50), nullable=True)
    failure_at = Column(DateTime(timezone=True), nullable=True)
    abandoned_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)

    started_at = Column(DateTime(timezone=True), nullable=True)
    paused_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now, index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now, onupdate=_utc_now)

    # Composite indexes for high-throughput pagination
    __table_args__ = (
        Index("ix_interview_sessions_member_created", "member_id", "created_at"),
        Index("ix_interview_sessions_member_state", "member_id", "state", "updated_at"),
    )

    # Relationships
    questions = relationship("InterviewQuestion", back_populates="session", cascade="all, delete-orphan", order_by="InterviewQuestion.order_index")
    answers = relationship("InterviewAnswer", back_populates="session", cascade="all, delete-orphan")
    evaluations = relationship("InterviewEvaluation", back_populates="session", cascade="all, delete-orphan")
    report = relationship("InterviewReport", back_populates="session", uselist=False, cascade="all, delete-orphan")
    voice_links = relationship("InterviewVoiceLink", back_populates="session", cascade="all, delete-orphan")


class InterviewQuestion(Base):
    """An individual question or follow-up formulated by the AI interviewer."""
    __tablename__ = "interview_questions"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    session_id = Column(String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    order_index = Column(Integer, nullable=False, default=0)
    parent_question_id = Column(String(36), ForeignKey("interview_questions.id", ondelete="SET NULL"), nullable=True)

    # PRIMARY, FOLLOW_UP, CODING_CHALLENGE, SYSTEM_DESIGN
    question_type = Column(String(30), nullable=False, default="PRIMARY")
    topic = Column(String(80), nullable=False)
    title = Column(String(200), nullable=False)
    prompt = Column(Text, nullable=False)
    code_starter = Column(Text, nullable=True)
    judge_problem_slug = Column(String(100), nullable=True)
    expected_criteria = Column(JSON, nullable=False, default=list)

    plan_version = Column(String(20), nullable=False, default="1.0")
    competency_key = Column(String(50), nullable=False, default="TECHNICAL_EXECUTION")
    difficulty_level = Column(String(20), nullable=False, default="MEDIUM")
    committed_at = Column(DateTime(timezone=True), nullable=True)
    metadata_json = Column("metadata", JSON, nullable=False, default=dict)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now)

    __table_args__ = (
        Index("ix_interview_questions_session_order", "session_id", "order_index"),
    )

    # Relationships
    session = relationship("InterviewSession", back_populates="questions")
    answers = relationship("InterviewAnswer", back_populates="question", cascade="all, delete-orphan")
    evaluations = relationship("InterviewEvaluation", back_populates="question", cascade="all, delete-orphan")


class InterviewAnswer(Base):
    """Student answer response to a delivered interview question."""
    __tablename__ = "interview_answers"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    session_id = Column(String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(String(36), ForeignKey("interview_questions.id", ondelete="CASCADE"), nullable=False, index=True)
    idempotency_key = Column(String(64), nullable=False, unique=True, index=True)

    answer_text = Column(Text, nullable=False)
    submitted_code = Column(Text, nullable=True)
    judge_result = Column(JSON, nullable=True)
    audio_duration_seconds = Column(Float, nullable=True)

    # Idempotency Hashing & Turn Processing Metadata
    payload_hash = Column(String(64), nullable=True)
    processing_state = Column(String(20), nullable=False, default="COMMITTED")  # RECEIVED, PROCESSING, COMMITTED, FAILED
    finalized_at = Column(DateTime(timezone=True), nullable=True)
    transcript_source = Column(String(20), nullable=False, default="TEXT")
    transcript_confidence = Column(Float, nullable=True)
    client_turn_id = Column(String(36), nullable=True)
    worker_fence = Column(String(36), nullable=True)
    provider_usage = Column(JSON, nullable=False, default=dict)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now)

    __table_args__ = (
        UniqueConstraint("session_id", "idempotency_key", name="uq_interview_answers_session_idempotency"),
        Index("ix_interview_answers_session_created", "session_id", "created_at"),
    )

    # Relationships
    session = relationship("InterviewSession", back_populates="answers")
    question = relationship("InterviewQuestion", back_populates="answers")
    evaluation = relationship("InterviewEvaluation", back_populates="answer", uselist=False, cascade="all, delete-orphan")


class InterviewEvaluation(Base):
    """Objective rubric evaluation for a finalized question-answer turn."""
    __tablename__ = "interview_evaluations"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    session_id = Column(String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(String(36), ForeignKey("interview_questions.id", ondelete="CASCADE"), nullable=False, index=True)
    answer_id = Column(String(36), ForeignKey("interview_answers.id", ondelete="CASCADE"), nullable=False, index=True)

    score = Column(Integer, nullable=False, default=0)
    rubric_scores = Column(JSON, nullable=False, default=dict)
    strengths = Column(JSON, nullable=False, default=list)
    gaps = Column(JSON, nullable=False, default=list)
    evidence_quotes = Column(JSON, nullable=False, default=list)
    model_answer = Column(Text, nullable=False)
    follow_up_recommended = Column(Boolean, nullable=False, default=False)

    rubric_version = Column(String(20), nullable=False, default="1.0")
    evaluation_version = Column(String(20), nullable=False, default="1.0")
    confidence_band = Column(String(20), nullable=False, default="HIGH")
    limitations = Column(JSON, nullable=False, default=list)
    created_by = Column(String(50), nullable=False, default="MODEL")

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now)

    # Relationships
    session = relationship("InterviewSession", back_populates="evaluations")
    question = relationship("InterviewQuestion", back_populates="evaluations")
    answer = relationship("InterviewAnswer", back_populates="evaluation")


class InterviewReport(Base):
    """Comprehensive post-interview coaching and dimensional analysis report."""
    __tablename__ = "interview_reports"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    session_id = Column(String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    member_id = Column(String(36), ForeignKey("member_profiles.id", ondelete="CASCADE"), nullable=False, index=True)

    overall_score = Column(Integer, nullable=False, default=0)
    verdict = Column(String(40), nullable=False, default="PRACTICE_MILESTONE")
    executive_summary = Column(Text, nullable=False)
    dimension_breakdown = Column(JSON, nullable=False, default=dict)
    top_strengths = Column(JSON, nullable=False, default=list)
    areas_to_improve = Column(JSON, nullable=False, default=list)
    recommended_practice = Column(JSON, nullable=False, default=list)

    report_version = Column(String(20), nullable=False, default="1.0")
    rubric_version = Column(String(20), nullable=False, default="1.0")
    plan_version = Column(String(20), nullable=False, default="1.0")
    supersedes_report_id = Column(String(36), nullable=True)
    confidence_and_limitations = Column(JSON, nullable=False, default=dict)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now)

    __table_args__ = (
        UniqueConstraint("session_id", "report_version", name="uq_interview_reports_session_version"),
    )

    # Relationships
    session = relationship("InterviewSession", back_populates="report")


class CandidateProfile(Base):
    """Candidate skills, declared projects, and developmental focus areas."""
    __tablename__ = "candidate_profiles"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    member_id = Column(String(36), ForeignKey("member_profiles.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    declared_skills = Column(JSON, nullable=False, default=list)
    demonstrated_strengths = Column(JSON, nullable=False, default=list)
    developmental_gaps = Column(JSON, nullable=False, default=list)
    preferred_tracks = Column(JSON, nullable=False, default=list)
    declared_projects = Column(JSON, nullable=False, default=list)
    learning_goals = Column(JSON, nullable=False, default=list)
    resume_summary = Column(Text, nullable=True)
    context_consent = Column(Boolean, nullable=False, default=True)

    deleted_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now, onupdate=_utc_now)


class CandidateResumeAsset(Base):
    """Uploaded resume asset stored privately with extraction lifecycle."""
    __tablename__ = "candidate_resume_assets"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    member_id = Column(String(36), ForeignKey("member_profiles.id", ondelete="CASCADE"), nullable=False, index=True)

    storage_key = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    detected_mime_type = Column(String(100), nullable=False, default="application/pdf")
    size_bytes = Column(Integer, nullable=False)
    sha256 = Column(String(64), nullable=False)

    scan_status = Column(String(30), nullable=False, default="CLEAN")  # PENDING, CLEAN, FLAGGED
    parse_status = Column(String(30), nullable=False, default="PARSED")  # PENDING, PARSED, FAILED
    consent_status = Column(String(30), nullable=False, default="CONFIRMED")  # UNREVIEWED, CONFIRMED, REVOKED

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now, index=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    retention_expires_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_candidate_resume_assets_member_created", "member_id", "created_at"),
    )

    # Relationships
    facts = relationship("CandidateResumeFact", back_populates="asset", cascade="all, delete-orphan")


class CandidateResumeFact(Base):
    """Provenance-tagged fact extracted from a candidate resume asset."""
    __tablename__ = "candidate_resume_facts"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    asset_id = Column(String(36), ForeignKey("candidate_resume_assets.id", ondelete="CASCADE"), nullable=False, index=True)
    member_id = Column(String(36), ForeignKey("member_profiles.id", ondelete="CASCADE"), nullable=False, index=True)

    fact_type = Column(String(30), nullable=False)  # SKILL, PROJECT, EXPERIENCE, EDUCATION, ACHIEVEMENT
    normalized_value = Column(Text, nullable=False)
    source_page = Column(Integer, nullable=True)
    source_section = Column(String(100), nullable=True)
    extraction_confidence = Column(Float, nullable=False, default=1.0)
    candidate_status = Column(String(30), nullable=False, default="CONFIRMED")  # UNREVIEWED, CONFIRMED, CORRECTED, REJECTED
    candidate_corrected_value = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now, onupdate=_utc_now)

    # Relationships
    asset = relationship("CandidateResumeAsset", back_populates="facts")


class CandidateConsent(Base):
    """Auditable candidate consent grant/revocation for AI interview features."""
    __tablename__ = "candidate_consents"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    member_id = Column(String(36), ForeignKey("member_profiles.id", ondelete="CASCADE"), nullable=False, index=True)

    purpose = Column(String(50), nullable=False)  # RESUME_PARSE, USE_RESUME_IN_INTERVIEW, VOICE_CAPTURE, STORE_TRANSCRIPT
    scope_ref = Column(String(100), nullable=True)
    granted_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    policy_version = Column(String(20), nullable=False, default="1.0")


class InterviewVoiceLink(Base):
    """Authenticated link between an interview session and an HCVE voice session."""
    __tablename__ = "interview_voice_links"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    session_id = Column(String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    member_id = Column(String(36), ForeignKey("member_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    hcve_session_id = Column(String(64), nullable=False, unique=True, index=True)

    status = Column(String(20), nullable=False, default="ACTIVE")  # ACTIVE, CLOSED, EXPIRED
    consent_id = Column(String(36), ForeignKey("candidate_consents.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    session = relationship("InterviewSession", back_populates="voice_links")


# ─── DATABASE-DRIVEN DOMAIN CATALOG & TRAINING BLUEPRINTS ────────────────────

class InterviewDomain(Base):
    """
    Authoritative domain catalog record in the database.
    Any active domain with a published blueprint appears automatically in the catalog.
    """
    __tablename__ = "interview_domains"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    slug = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(30), nullable=False, default="TECHNICAL")  # TECHNICAL, OTHER
    icon_key = Column(String(50), nullable=False, default="code")
    display_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True, index=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now, onupdate=_utc_now)

    # Relationships
    blueprints = relationship("InterviewBlueprintModel", back_populates="domain", cascade="all, delete-orphan")


class InterviewBlueprintModel(Base):
    """
    Relational blueprint root linking a domain to its version history.
    Stores the pointer to the active published version.
    """
    __tablename__ = "interview_blueprints"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    domain_id = Column(String(36), ForeignKey("interview_domains.id", ondelete="CASCADE"), nullable=False, index=True)
    slug = Column(String(50), unique=True, nullable=False, index=True)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="DRAFT", index=True)  # DRAFT, VALIDATING, PUBLISHED, RETIRED
    active_version_id = Column(String(36), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now, onupdate=_utc_now)

    # Relationships
    domain = relationship("InterviewDomain", back_populates="blueprints")
    versions = relationship("InterviewBlueprintVersionModel", back_populates="blueprint", cascade="all, delete-orphan")


class InterviewBlueprintVersionModel(Base):
    """
    Immutable versioned snapshot of an authored interview blueprint graph.
    Contains full graph data, policies, rubrics, public metadata, and validation reports.
    """
    __tablename__ = "interview_blueprint_versions"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    blueprint_id = Column(String(36), ForeignKey("interview_blueprints.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(String(20), nullable=False, default="1.0.0")
    schema_version = Column(String(20), nullable=False, default="1.0.0")
    curriculum_version = Column(String(20), nullable=False, default="1.0.0")
    taxonomy_version = Column(String(20), nullable=False, default="1.0.0")
    prompt_pack_version = Column(String(20), nullable=False, default="1.0.0")
    evaluation_pack_version = Column(String(20), nullable=False, default="1.0.0")

    status = Column(String(30), nullable=False, default="DRAFT", index=True)  # DRAFT, APPROVED, PUBLISHED, RETIRED
    checksum = Column(String(64), nullable=True)
    graph_data = Column(JSON, nullable=False, default=dict)
    public_metadata = Column(JSON, nullable=False, default=dict)
    validation_report = Column(JSON, nullable=False, default=dict)
    coverage_report = Column(JSON, nullable=False, default=dict)

    published_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String(50), nullable=False, default="SYSTEM")

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now, onupdate=_utc_now)

    __table_args__ = (
        UniqueConstraint("blueprint_id", "version", name="uq_interview_blueprint_versions_bp_ver"),
    )

    # Relationships
    blueprint = relationship("InterviewBlueprintModel", back_populates="versions")
    datasets = relationship("InterviewDomainDataset", back_populates="blueprint_version", cascade="all, delete-orphan")


class InterviewDomainDataset(Base):
    """
    Dataset artifact associated with a domain blueprint version:
    synthetic response examples, gold test cases, adversarial cases, or question banks.
    """
    __tablename__ = "interview_domain_datasets"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    blueprint_version_id = Column(String(36), ForeignKey("interview_blueprint_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    dataset_type = Column(String(40), nullable=False)  # SYNTHETIC_EXAMPLES, GOLD_CASES, ADVERSARIAL_CASES, QUESTION_BANK
    records_count = Column(Integer, nullable=False, default=0)
    data_records = Column(JSON, nullable=False, default=list)
    checksum = Column(String(64), nullable=True)
    status = Column(String(30), nullable=False, default="DRAFT")  # DRAFT, LOCKED_GOLD, APPROVED
    evaluation_report = Column(JSON, nullable=False, default=dict)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utc_now, onupdate=_utc_now)

    # Relationships
    blueprint_version = relationship("InterviewBlueprintVersionModel", back_populates="datasets")
