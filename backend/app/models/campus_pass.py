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

from .base import Base, get_uuid, now_utc


class CampusPass(Base):
    """Candidate single-use entrance pass for air-gapped lab arena finals."""
    __tablename__ = "campus_passes"

    id = Column(String(36), primary_key=True, default=get_uuid)
    member_id = Column(String(36), ForeignKey("member_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    contest_id = Column(String(36), ForeignKey("offline_contests.id", ondelete="CASCADE"), nullable=False)
    pass_code = Column(String(30), unique=True, nullable=False, index=True)
    seat_number = Column(String(20), nullable=False)
    qr_data = Column(Text, nullable=False)
    check_in_status = Column(String(20), default="issued", nullable=False)
    issued_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
