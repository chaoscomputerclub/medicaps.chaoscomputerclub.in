"""
Chaos Computer Club — Offline Contests, Problems, Submissions & Scoreboards
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
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .base import Base, get_uuid, now_utc


class OfflineContest(Base):
    """Main Campus Contest Entity."""
    __tablename__ = "offline_contests"

    id = Column(String(36), primary_key=True, default=get_uuid)
    slug = Column(String(80), unique=True, nullable=False, index=True)
    title = Column(String(120), nullable=False)
    season = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, index=True)  # live, upcoming, finished
    division = Column(String(30), nullable=False)  # division_1, division_2, division_3, open
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    check_in_opens_at = Column(DateTime(timezone=True), nullable=False)
    venue = Column(String(120), nullable=False)
    seat_capacity = Column(Integer, nullable=False)
    registered_count = Column(Integer, default=0, nullable=False)
    problem_count = Column(Integer, nullable=False)
    environment = Column(String(120), nullable=False)  # e.g. Air-gapped LAN, GCC 14 / Clang 18
    chief_proctors = Column(JSON, default=list, nullable=False)
    prize_pool = Column(String(80), nullable=True)
    sponsor = Column(String(80), nullable=True)
    summary = Column(Text, nullable=False)
    rules = Column(JSON, default=list, nullable=False)
    cadence = Column(String(20), default="weekly", nullable=False)  # weekly, biweekly, special
    edition = Column(Integer, nullable=True)  # e.g. 42, 18
    banner_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    assessment = relationship("Assessment", back_populates="contest", uselist=False, cascade="all, delete-orphan", passive_deletes=True)
    problems = relationship("ContestProblem", back_populates="contest", cascade="all, delete-orphan", passive_deletes=True)
    scoreboard_entries = relationship("ScoreboardEntry", back_populates="contest", cascade="all, delete-orphan", passive_deletes=True)
    registrations = relationship("ContestRegistration", back_populates="contest", cascade="all, delete-orphan", passive_deletes=True)
    rating_histories = relationship("RatingHistory", back_populates="contest", cascade="all, delete-orphan", passive_deletes=True)
    trust_proofs = relationship("TrustProof", back_populates="contest", cascade="all, delete-orphan", passive_deletes=True)
    campus_passes = relationship("CampusPass", back_populates="contest", cascade="all, delete-orphan", passive_deletes=True)
    submissions = relationship("ContestSubmission", back_populates="contest", cascade="all, delete-orphan", passive_deletes=True)


class ContestProblem(Base):
    """Problems assigned to an offline contest arena."""
    __tablename__ = "contest_problems"

    id = Column(String(36), primary_key=True, default=get_uuid)
    contest_id = Column(String(36), ForeignKey("offline_contests.id", ondelete="CASCADE"), nullable=False, index=True)
    problem_index = Column(String(5), nullable=False)  # A, B, C, D, E, F
    title = Column(String(120), nullable=False)
    topic = Column(String(60), nullable=False)
    points = Column(Integer, nullable=False)
    solved_count = Column(Integer, default=0, nullable=False)
    first_ac_seconds = Column(Integer, nullable=True)
    editorial_summary = Column(Text, nullable=True)

    # Rich Arena Problem Fields
    difficulty = Column(String(20), default="MEDIUM", nullable=True)
    description = Column(Text, nullable=True)
    input_format = Column(Text, nullable=True)
    output_format = Column(Text, nullable=True)
    constraints = Column(Text, nullable=True)
    time_limit = Column(Float, default=2.0, nullable=True)
    memory_limit = Column(Integer, default=256, nullable=True)
    starter_codes = Column(JSON, default=dict, nullable=True)
    sample_testcases = Column(JSON, default=list, nullable=True)
    hidden_testcases = Column(JSON, default=list, nullable=True)

    # Relationships
    contest = relationship("OfflineContest", back_populates="problems")
    submissions = relationship("ContestSubmission", back_populates="problem", cascade="all, delete-orphan", passive_deletes=True)


class ContestSubmission(Base):
    """Live Contest Arena Solution Code Submission."""
    __tablename__ = "contest_submissions"

    id = Column(String(36), primary_key=True, default=get_uuid)
    contest_id = Column(String(36), ForeignKey("offline_contests.id", ondelete="CASCADE"), nullable=False, index=True)
    problem_id = Column(String(36), ForeignKey("contest_problems.id", ondelete="CASCADE"), nullable=False, index=True)
    member_id = Column(String(36), ForeignKey("member_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    handle = Column(String(50), nullable=False)
    language = Column(String(20), nullable=False)
    code = Column(Text, nullable=False)
    verdict = Column(String(30), nullable=False)
    passed_testcases = Column(Integer, default=0, nullable=False)
    total_testcases = Column(Integer, default=0, nullable=False)
    execution_time = Column(Float, default=0.0, nullable=False)
    memory_used = Column(Integer, default=0, nullable=False)
    points_awarded = Column(Integer, default=0, nullable=False)
    submitted_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    contest = relationship("OfflineContest", back_populates="submissions")
    problem = relationship("ContestProblem", back_populates="submissions")
    member = relationship("MemberProfile", back_populates="contest_submissions")


class ScoreboardEntry(Base):
    """Ranked leaderboard placement for completed offline contest."""
    __tablename__ = "scoreboard_entries"

    id = Column(String(36), primary_key=True, default=get_uuid)
    contest_id = Column(String(36), ForeignKey("offline_contests.id", ondelete="CASCADE"), nullable=False, index=True)
    member_id = Column(String(36), ForeignKey("member_profiles.id", ondelete="SET NULL"), nullable=True, index=True)
    rank = Column(Integer, nullable=False, index=True)
    handle = Column(String(50), nullable=False)
    full_name = Column(String(100), nullable=False)
    department = Column(String(50), nullable=False)
    batch = Column(String(20), nullable=False)
    division = Column(String(30), nullable=False)
    score = Column(Integer, nullable=False)
    solved = Column(Integer, nullable=False)
    penalty_seconds = Column(Integer, nullable=False)
    rating_delta = Column(Integer, nullable=True)
    telemetry = Column(JSON, default=list, nullable=False)

    # Relationships
    contest = relationship("OfflineContest", back_populates="scoreboard_entries")
    member = relationship("MemberProfile", back_populates="scoreboard_entries")


class ContestRegistration(Base):
    """Candidate workstation registration for an offline contest & screening assessment."""
    __tablename__ = "contest_registrations"

    id = Column(String(36), primary_key=True, default=get_uuid)
    contest_id = Column(String(36), ForeignKey("offline_contests.id", ondelete="CASCADE"), nullable=False, index=True)
    member_id = Column(String(36), ForeignKey("member_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    registered_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    status = Column(String(20), default="confirmed", nullable=False)
    assessment_taken = Column(Boolean, default=False, nullable=False)
    assessment_score = Column(Float, nullable=True)
    assessment_rank = Column(Integer, nullable=True)
    is_top_30_qualified = Column(Boolean, default=False, nullable=False)
    campus_pass_code = Column(String(30), nullable=True)
    seat_assigned = Column(String(20), nullable=True)
    checked_in_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("contest_id", "member_id", name="uq_contest_member_reg"),
    )

    # Relationships
    contest = relationship("OfflineContest", back_populates="registrations")
    member = relationship("MemberProfile", back_populates="contest_registrations")
