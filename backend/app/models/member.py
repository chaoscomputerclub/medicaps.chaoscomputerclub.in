"""
Chaos Computer Club — Member, Identity & Social ORM Models
"""

from __future__ import annotations

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .base import Base, get_uuid, now_utc


class MemberProfile(Base):
    """Core Cadet & Member Profile Model."""
    __tablename__ = "member_profiles"

    id = Column(String(36), primary_key=True, default=get_uuid)
    handle = Column(String(50), unique=True, nullable=True, index=True)        # null until onboarding
    full_name = Column(String(100), nullable=True)                              # null until onboarding
    email = Column(String(120), unique=True, nullable=False, index=True)
    prn = Column(String(30), unique=True, nullable=True, index=True)            # Medi-Caps Enrollment ID
    department = Column(String(50), nullable=True)                              # CSE, IT, AIDS, Cyber Security
    batch = Column(String(20), nullable=True)                                   # 2022-26, 2023-27, 2024-28
    rating = Column(Integer, default=1200, nullable=False)
    peak_rating = Column(Integer, default=1200, nullable=False)
    attendance_count = Column(Integer, default=0, nullable=False)
    attendance_total = Column(Integer, default=0, nullable=False)
    is_core_member = Column(Boolean, default=False, nullable=False)
    is_onboarded = Column(Boolean, default=False, nullable=False)               # False until handle/PRN collected
    hashed_password = Column(String(255), nullable=True)                        # null for Google-only users
    google_id = Column(String(120), unique=True, nullable=True, index=True)     # Google sub ID
    avatar_url = Column(String(500), nullable=True)                             # Google profile picture
    bio = Column(String(500), nullable=True)                                    # Student bio / tagline
    github_username = Column(String(100), nullable=True)                       # GitHub handle
    linkedin_url = Column(String(200), nullable=True)                          # LinkedIn profile / handle
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    rating_history = relationship("RatingHistory", back_populates="member", cascade="all, delete-orphan")
    contest_registrations = relationship("ContestRegistration", back_populates="member", cascade="all, delete-orphan")


class OTPStore(Base):
    """Ephemeral table for short-lived email OTP verification codes."""
    __tablename__ = "otp_store"

    id = Column(String(36), primary_key=True, default=get_uuid)
    email = Column(String(120), nullable=False, index=True)
    code = Column(String(6), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)


class RatingHistory(Base):
    """Competitive Elo Rating trajectory ledger."""
    __tablename__ = "rating_history"

    id = Column(String(36), primary_key=True, default=get_uuid)
    member_id = Column(String(36), ForeignKey("member_profiles.id", ondelete="CASCADE"), nullable=False)
    contest_id = Column(String(36), nullable=True)
    contest_title = Column(String(120), nullable=False)
    contested_at = Column(DateTime(timezone=True), nullable=False)
    old_rating = Column(Integer, nullable=False)
    new_rating = Column(Integer, nullable=False)
    rank = Column(Integer, nullable=False)

    # Relationships
    member = relationship("MemberProfile", back_populates="rating_history")


class StudentFollow(Base):
    """Peer follow relationship between two Medi-Caps students."""
    __tablename__ = "student_follows"

    id = Column(String(36), primary_key=True, default=get_uuid)
    follower_id = Column(String(36), ForeignKey("member_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    following_id = Column(String(36), ForeignKey("member_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    __table_args__ = (
        UniqueConstraint("follower_id", "following_id", name="uq_student_follower_following"),
    )

    follower = relationship("MemberProfile", foreign_keys=[follower_id], backref="following_relations")
    following = relationship("MemberProfile", foreign_keys=[following_id], backref="follower_relations")
