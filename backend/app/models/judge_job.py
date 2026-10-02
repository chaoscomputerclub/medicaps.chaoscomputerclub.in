"""
Chaos Computer Club — Judge Jobs & Execution Attempts ORM Models
Authoritative PostgreSQL tracking for multi-attempt execution, distributed leases, and strict result fencing.
"""

from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .base import Base, get_uuid, now_utc


class JudgeJob(Base):
    """
    Authoritative state of an execution job.
    One submission may have multiple execution attempts (e.g. distributed node timeout -> Codebox fallback).
    Only the active_attempt_id is allowed to finalize the job.
    """
    __tablename__ = "judge_jobs"

    id = Column(String(36), primary_key=True, default=get_uuid)
    submission_id = Column(String(36), nullable=True, index=True)
    contest_id = Column(String(36), nullable=True, index=True)
    problem_id = Column(String(36), nullable=True, index=True)
    member_id = Column(String(36), nullable=True, index=True)
    
    # Execution state: QUEUED, PROCESSING, COMPLETED, FAILED, TIMED_OUT, CANCELLED
    state = Column(String(20), default="QUEUED", nullable=False, index=True)
    
    # Primary provider assigned
    provider = Column(String(30), nullable=True)
    attempt_number = Column(Integer, default=0, nullable=False)
    
    # CRITICAL: Strict fencing pointer. Any finalization update MUST match active_attempt_id.
    active_attempt_id = Column(String(36), nullable=True, index=True)
    
    # Queue-aware dominant deadline
    deadline_at = Column(DateTime(timezone=True), nullable=True)
    
    # Machine-readable error code if failed
    failure_code = Column(String(50), nullable=True)
    
    # Execution Decision Record (JSON telemetry)
    execution_decision = Column(JSON, nullable=True)
    result_payload = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    queued_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    attempts = relationship(
        "JudgeJobAttempt",
        back_populates="job",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="JudgeJobAttempt.attempt_number",
    )

    __table_args__ = (
        Index("ix_judge_jobs_state_deadline", "state", "deadline_at"),
        Index("ix_judge_jobs_contest_problem", "contest_id", "problem_id"),
    )


class JudgeJobAttempt(Base):
    """
    Individual execution attempt for a JudgeJob.
    Represents an attempt on a specific provider (distributed node, Codebox, local Docker).
    """
    __tablename__ = "judge_job_attempts"

    id = Column(String(36), primary_key=True, default=get_uuid)
    job_id = Column(
        String(36),
        ForeignKey("judge_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    attempt_number = Column(Integer, nullable=False)
    provider = Column(String(30), nullable=False)  # distributed, codebox, docker
    node_id = Column(String(50), nullable=True)     # specific node if distributed
    lease_id = Column(String(100), nullable=True, index=True)
    
    # Attempt state: STARTED, COMPLETED, FAILED, EXPIRED, STALE
    state = Column(String(20), default="STARTED", nullable=False, index=True)
    
    started_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    heartbeat_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Queue-aware latency breakdowns (ms)
    queue_time_ms = Column(Float, default=0.0, nullable=False)
    compile_time_ms = Column(Float, default=0.0, nullable=False)
    execution_time_ms = Column(Float, default=0.0, nullable=False)
    total_time_ms = Column(Float, default=0.0, nullable=False)
    
    result_hash = Column(String(64), nullable=True)
    error_code = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    job = relationship("JudgeJob", back_populates="attempts")

    __table_args__ = (
        Index("ix_judge_attempts_job_attempt", "job_id", "attempt_number"),
        Index("ix_judge_attempts_lease", "lease_id"),
    )
