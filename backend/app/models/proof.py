"""
Chaos Computer Club — Cryptographic Trust-of-Proof Certificate Model
"""

from __future__ import annotations

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from .base import Base, get_uuid, now_utc


class TrustProof(Base):
    """Immutable Cryptographic Result Certificate Proof."""
    __tablename__ = "trust_proofs"

    id = Column(String(36), primary_key=True, default=get_uuid)
    certificate_id = Column(String(50), unique=True, nullable=False, index=True)
    contest_id = Column(String(36), ForeignKey("offline_contests.id", ondelete="CASCADE"), nullable=False, index=True)
    member_id = Column(String(36), ForeignKey("member_profiles.id", ondelete="SET NULL"), nullable=True, index=True)
    member_handle = Column(String(50), nullable=False, index=True)
    contest_title = Column(String(120), nullable=False)
    session_uuid = Column(String(36), nullable=False)
    prn_hash = Column(String(64), nullable=False)
    sha256_digest = Column(String(64), unique=True, nullable=False, index=True)
    proctor_stamp = Column(String(120), nullable=False)
    attendance_stamp = Column(String(120), nullable=False)
    score = Column(Integer, nullable=False)
    rank = Column(Integer, nullable=False)
    issued_at = Column(DateTime(timezone=True), default=now_utc, nullable=False, index=True)
    status = Column(String(20), default="verified", nullable=False)

    # Relationships
    contest = relationship("OfflineContest", back_populates="trust_proofs")
    member = relationship("MemberProfile", back_populates="trust_proofs")
