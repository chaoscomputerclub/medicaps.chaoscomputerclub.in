"""
Chaos Computer Club — Online Screening Assessment ORM Models
"""

from __future__ import annotations

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .base import Base, get_uuid, now_utc


class Assessment(Base):
    """Phase 1 Online Screening Assessment for an Offline Contest."""
    __tablename__ = "assessments"

    id = Column(String(36), primary_key=True, default=get_uuid)
    contest_id = Column(String(36), ForeignKey("offline_contests.id", ondelete="CASCADE"), nullable=True)
    slug = Column(String(80), unique=True, nullable=False, index=True)
    title = Column(String(120), nullable=False)
    summary = Column(Text, nullable=False)
    duration_minutes = Column(Integer, default=90, nullable=False)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    max_violations = Column(Integer, default=3, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    contest = relationship("OfflineContest", back_populates="assessment")
    problems = relationship("AssessmentProblem", back_populates="assessment", cascade="all, delete-orphan")
    sessions = relationship("AssessmentSession", back_populates="assessment", cascade="all, delete-orphan")


class AssessmentProblem(Base):
    """Problems assigned to an online screening assessment round."""
    __tablename__ = "assessment_problems"

    id = Column(String(36), primary_key=True, default=get_uuid)
    assessment_id = Column(String(36), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False)
    problem_index = Column(String(5), nullable=False)  # A, B, C, D
    title = Column(String(120), nullable=False)
    difficulty = Column(String(20), default="MEDIUM", nullable=False)  # EASY, MEDIUM, HARD
    description = Column(Text, nullable=False)
    input_format = Column(Text, nullable=True)
    output_format = Column(Text, nullable=True)
    constraints = Column(Text, nullable=True)
    points = Column(Integer, default=100, nullable=False)
    time_limit = Column(Float, default=2.0, nullable=False)
    memory_limit = Column(Integer, default=256, nullable=False)
    starter_codes = Column(JSON, default=dict, nullable=False)
    sample_testcases = Column(JSON, default=list, nullable=False)
    hidden_testcases = Column(JSON, default=list, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    assessment = relationship("Assessment", back_populates="problems")


class AssessmentSession(Base):
    """Candidate's active assessment attempt & anti-cheat metrics."""
    __tablename__ = "assessment_sessions"

    id = Column(String(36), primary_key=True, default=get_uuid)
    assessment_id = Column(String(36), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False)
    member_id = Column(String(36), ForeignKey("member_profiles.id", ondelete="CASCADE"), nullable=False)
    handle = Column(String(50), nullable=False, index=True)
    full_name = Column(String(100), nullable=False)
    department = Column(String(50), nullable=False)
    batch = Column(String(20), nullable=False)
    started_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), default="in_progress", nullable=False)  # in_progress, submitted, disqualified
    total_score = Column(Float, default=0.0, nullable=False)
    total_penalty_seconds = Column(Integer, default=0, nullable=False)
    anti_cheat_violations = Column(Integer, default=0, nullable=False)
    is_top_30_qualified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    assessment = relationship("Assessment", back_populates="sessions")
    submissions = relationship("AssessmentSubmission", back_populates="session", cascade="all, delete-orphan")


class AssessmentSubmission(Base):
    """Candidate's solution code submission for an assessment challenge."""
    __tablename__ = "assessment_submissions"

    id = Column(String(36), primary_key=True, default=get_uuid)
    session_id = Column(String(36), ForeignKey("assessment_sessions.id", ondelete="CASCADE"), nullable=False)
    problem_id = Column(String(36), ForeignKey("assessment_problems.id", ondelete="CASCADE"), nullable=False)
    member_id = Column(String(36), ForeignKey("member_profiles.id", ondelete="CASCADE"), nullable=False)
    language = Column(String(20), nullable=False)
    code = Column(Text, nullable=False)
    verdict = Column(String(30), nullable=False)
    score = Column(Float, default=0.0, nullable=False)
    runtime_ms = Column(Float, default=0.0, nullable=False)
    memory_mb = Column(Float, default=0.0, nullable=False)
    testcase_results = Column(JSON, default=list, nullable=False)
    submitted_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    session = relationship("AssessmentSession", back_populates="submissions")
