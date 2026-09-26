"""
Chaos Computer Club — Single-Use Campus Entrance Pass & Attendance Model
"""

from __future__ import annotations

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .base import Base, get_uuid, now_utc


class CampusPass(Base):
    """Candidate single-use entrance pass for air-gapped lab arena finals."""
    __tablename__ = "campus_passes"

    id = Column(String(36), primary_key=True, default=get_uuid)
    member_id = Column(String(36), ForeignKey("member_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    contest_id = Column(String(36), ForeignKey("offline_contests.id", ondelete="CASCADE"), nullable=False, index=True)
    pass_code = Column(String(50), unique=True, nullable=False, index=True)
    seat_number = Column(String(20), nullable=False)
    qr_data = Column(Text, nullable=False)
    check_in_status = Column(String(20), default="issued", nullable=False)  # issued, checked_in
    issued_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    checked_in_at = Column(DateTime(timezone=True), nullable=True)
    checked_in_by = Column(String(100), nullable=True)  # Proctor name / handle

    # Relationships
    member = relationship("MemberProfile", back_populates="campus_passes", foreign_keys=[member_id])
    contest = relationship("OfflineContest", back_populates="campus_passes", foreign_keys=[contest_id])

