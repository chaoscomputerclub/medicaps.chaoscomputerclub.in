"""
Chaos Computer Club India — Medi-Caps Chapter Backend
SQLAlchemy Declarative ORM Database Models
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from app.core.db import Base


def get_uuid() -> str:
    return str(uuid.uuid4())


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class MemberProfile(Base):
    __tablename__ = "member_profiles"

    id = Column(String(36), primary_key=True, default=get_uuid)
    handle = Column(String(50), unique=True, nullable=False, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, nullable=False, index=True)
    prn = Column(String(30), unique=True, nullable=False, index=True)  # Medi-Caps Enrollment ID
    department = Column(String(50), nullable=False)  # CSE, IT, AIDS, Cyber Security
    batch = Column(String(20), nullable=False)  # 2022-26, 2023-27, 2024-28
    rating = Column(Integer, default=1200, nullable=False)
    peak_rating = Column(Integer, default=1200, nullable=False)
    attendance_count = Column(Integer, default=0, nullable=False)
    attendance_total = Column(Integer, default=0, nullable=False)
    is_core_member = Column(Boolean, default=False, nullable=False)
    hashed_password = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=now_utc, nullable=False)

    # Relationships
    rating_history = relationship("RatingHistory", back_populates="member", cascade="all, delete-orphan")


class OfflineContest(Base):
    __tablename__ = "offline_contests"

    id = Column(String(36), primary_key=True, default=get_uuid)
    slug = Column(String(80), unique=True, nullable=False, index=True)
    title = Column(String(120), nullable=False)
    season = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, index=True)  # live, upcoming, finished
    division = Column(String(30), nullable=False)  # division_1, division_2, division_3, open
    starts_at = Column(DateTime, nullable=False)
    ends_at = Column(DateTime, nullable=False)
    check_in_opens_at = Column(DateTime, nullable=False)
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
    created_at = Column(DateTime, default=now_utc, nullable=False)

    # Relationships
    problems = relationship("ContestProblem", back_populates="contest", cascade="all, delete-orphan")
    scoreboard_entries = relationship("ScoreboardEntry", back_populates="contest", cascade="all, delete-orphan")


class ContestProblem(Base):
    __tablename__ = "contest_problems"

    id = Column(String(36), primary_key=True, default=get_uuid)
    contest_id = Column(String(36), ForeignKey("offline_contests.id", ondelete="CASCADE"), nullable=False)
    problem_index = Column(String(5), nullable=False)  # A, B, C, D, E, F
    title = Column(String(120), nullable=False)
    topic = Column(String(60), nullable=False)
    points = Column(Integer, nullable=False)
    solved_count = Column(Integer, default=0, nullable=False)
    first_ac_seconds = Column(Integer, nullable=True)
    editorial_summary = Column(Text, nullable=True)

    # Relationships
    contest = relationship("OfflineContest", back_populates="problems")


class ScoreboardEntry(Base):
    __tablename__ = "scoreboard_entries"

    id = Column(String(36), primary_key=True, default=get_uuid)
    contest_id = Column(String(36), ForeignKey("offline_contests.id", ondelete="CASCADE"), nullable=False)
    member_id = Column(String(36), nullable=True)
    rank = Column(Integer, nullable=False)
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


class RatingHistory(Base):
    __tablename__ = "rating_history"

    id = Column(String(36), primary_key=True, default=get_uuid)
    member_id = Column(String(36), ForeignKey("member_profiles.id", ondelete="CASCADE"), nullable=False)
    contest_id = Column(String(36), nullable=True)
    contest_title = Column(String(120), nullable=False)
    contested_at = Column(DateTime, nullable=False)
    old_rating = Column(Integer, nullable=False)
    new_rating = Column(Integer, nullable=False)
    rank = Column(Integer, nullable=False)

    # Relationships
    member = relationship("MemberProfile", back_populates="rating_history")


class TrustProof(Base):
    __tablename__ = "trust_proofs"

    id = Column(String(36), primary_key=True, default=get_uuid)
    certificate_id = Column(String(50), unique=True, nullable=False, index=True)
    contest_id = Column(String(36), nullable=False)
    member_id = Column(String(36), nullable=True)
    member_handle = Column(String(50), nullable=False, index=True)
    contest_title = Column(String(120), nullable=False)
    session_uuid = Column(String(36), nullable=False)
    prn_hash = Column(String(64), nullable=False)
    sha256_digest = Column(String(64), unique=True, nullable=False, index=True)
    proctor_stamp = Column(String(120), nullable=False)
    attendance_stamp = Column(String(120), nullable=False)
    score = Column(Integer, nullable=False)
    rank = Column(Integer, nullable=False)
    issued_at = Column(DateTime, default=now_utc, nullable=False)
    status = Column(String(20), default="verified", nullable=False)


class CampusPass(Base):
    __tablename__ = "campus_passes"

    id = Column(String(36), primary_key=True, default=get_uuid)
    member_id = Column(String(36), nullable=False, index=True)
    contest_id = Column(String(36), nullable=False)
    pass_code = Column(String(30), unique=True, nullable=False, index=True)
    seat_number = Column(String(20), nullable=False)
    qr_data = Column(Text, nullable=False)
    check_in_status = Column(String(20), default="issued", nullable=False)
    issued_at = Column(DateTime, default=now_utc, nullable=False)


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(String(36), primary_key=True, default=get_uuid)
    kind = Column(String(30), nullable=False)  # contest_release, editorial, podium, system
    title = Column(String(150), nullable=False)
    summary = Column(Text, nullable=False)
    published_at = Column(DateTime, default=now_utc, nullable=False)
    contest_slug = Column(String(80), nullable=True)
