"""
Chaos Computer Club — Master Problem Domain, Versioning, and Cryptographic Testcase Vault
Defines production models for algorithmic challenges, immutable version snapshots,
and visible/hidden testcases.
"""

from __future__ import annotations

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .base import Base, get_uuid, now_utc


class Problem(Base):
    """
    Master Problem Challenge Entity.
    Supports LeetCode-style FUNCTION execution contract and legacy STDIN_STDOUT modes.
    """
    __tablename__ = "problems"

    id = Column(String(36), primary_key=True, default=get_uuid)
    problem_index = Column(String(5), default="A", nullable=False)
    title = Column(String(120), nullable=False)
    slug = Column(String(80), unique=True, nullable=False, index=True)
    difficulty = Column(String(20), default="MEDIUM", nullable=False)  # EASY, MEDIUM, HARD
    topic = Column(String(60), default="Algorithms", nullable=False)
    points = Column(Integer, default=100, nullable=False)
    description = Column(Text, nullable=False)
    constraints = Column(Text, nullable=True)
    input_format = Column(Text, nullable=True)
    output_format = Column(Text, nullable=True)

    # Execution & Contract Architecture
    execution_mode = Column(String(20), default="FUNCTION", nullable=False)  # FUNCTION, STDIN_STDOUT
    function_signature = Column(JSON, default=dict, nullable=False)  # {name: str, parameters: [...], return_type: str}
    starter_code = Column(JSON, default=dict, nullable=False)  # {python: "...", cpp: "...", java: "...", javascript: "..."}
    time_limit = Column(Float, default=2.0, nullable=False)  # seconds
    memory_limit = Column(Integer, default=256, nullable=False)  # MB
    evaluation_config = Column(JSON, default=dict, nullable=False)  # match_type, float_tolerance, etc.
    sandbox_config = Column(JSON, default=dict, nullable=False)  # network, processes, etc.
    reference_solution = Column(JSON, default=dict, nullable=True)  # {python: "...", cpp: "..."}

    # Lifecycle State Machine: DRAFT -> VALIDATING -> VALIDATED -> REVIEW -> PUBLISHED -> LOCKED -> ARCHIVED
    status = Column(String(20), default="DRAFT", nullable=False, index=True)
    version = Column(Integer, default=1, nullable=False)

    created_by = Column(String(36), nullable=True)
    updated_by = Column(String(36), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    __table_args__ = (
        Index("ix_problems_status_slug", "status", "slug"),
        Index("ix_problems_topic_difficulty", "topic", "difficulty"),
    )

    # Relationships
    testcases = relationship(
        "ProblemTestCase",
        back_populates="problem",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    versions = relationship(
        "ProblemVersion",
        back_populates="problem",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ProblemVersion(Base):
    """
    Immutable Version Snapshot of a Published Problem.
    Contests reference a specific (problem_id, version) to ensure reproducibility.
    """
    __tablename__ = "problem_versions"

    id = Column(String(36), primary_key=True, default=get_uuid)
    problem_id = Column(String(36), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    title = Column(String(120), nullable=False)
    slug = Column(String(80), nullable=False)
    difficulty = Column(String(20), nullable=False)
    topic = Column(String(60), nullable=False)
    points = Column(Integer, nullable=False)
    description = Column(Text, nullable=False)
    constraints = Column(Text, nullable=True)
    input_format = Column(Text, nullable=True)
    output_format = Column(Text, nullable=True)
    execution_mode = Column(String(20), nullable=False)
    function_signature = Column(JSON, nullable=False)
    starter_code = Column(JSON, nullable=False)
    time_limit = Column(Float, nullable=False)
    memory_limit = Column(Integer, nullable=False)
    evaluation_config = Column(JSON, nullable=False)
    sandbox_config = Column(JSON, nullable=False)
    reference_solution = Column(JSON, nullable=True)

    created_by = Column(String(36), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    __table_args__ = (
        UniqueConstraint("problem_id", "version", name="uq_problem_versions_id_version"),
        Index("ix_problem_versions_slug_ver", "slug", "version"),
    )

    # Relationships
    problem = relationship("Problem", back_populates="versions")


class ProblemTestCase(Base):
    """
    Individual Testcase Vault Item (Visible Example or Hidden Edge Case).
    Hidden testcases must NEVER be exposed to contestants via public APIs.
    """
    __tablename__ = "problem_testcases"

    id = Column(String(36), primary_key=True, default=get_uuid)
    problem_id = Column(String(36), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(Integer, default=1, nullable=False, index=True)
    testcase_id = Column(String(50), nullable=False)  # e.g. "SAMPLE-01", "TC-01"
    input_data = Column(JSON, nullable=False)  # Structured mapping: {param_name: value}
    expected_output = Column(JSON, nullable=False)  # Expected return value
    explanation = Column(Text, nullable=True)
    weight = Column(Float, default=1.0, nullable=False)
    is_hidden = Column(Boolean, default=True, nullable=False, index=True)
    order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    content_hash = Column(String(64), nullable=True)  # SHA-256 of canonical input/output
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    __table_args__ = (
        UniqueConstraint("problem_id", "version", "testcase_id", name="uq_problem_testcase_id_ver"),
        Index("ix_problem_testcase_lookup", "problem_id", "version", "is_hidden", "is_active"),
    )

    # Relationships
    problem = relationship("Problem", back_populates="testcases")
