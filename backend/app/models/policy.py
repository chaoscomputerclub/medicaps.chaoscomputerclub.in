"""
Chaos Computer Club — Versioned Platform Legal Policies & Consent Ledger ORM Models
"""

from __future__ import annotations

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .base import Base, get_uuid, now_utc


class PlatformPolicy(Base):
    """Authoritative, versioned statutory platform policies."""
    __tablename__ = "platform_policies"

    id = Column(String(36), primary_key=True, default=get_uuid)
    policy_type = Column(String(40), nullable=False, index=True)  # TERMS_OF_SERVICE, PRIVACY_POLICY, CONTEST_RULES, CODE_OF_CONDUCT, ACCEPTABLE_USE
    version = Column(String(20), default="1.0.0", nullable=False)
    locale = Column(String(10), default="en", nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    change_summary = Column(Text, default="Initial version", nullable=False)
    effective_date = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    is_published = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    __table_args__ = (
        UniqueConstraint("policy_type", "version", "locale", name="uq_policy_type_version_locale"),
    )


class UserConsent(Base):
    """Immutable audit record of user consent for a specific policy version."""
    __tablename__ = "user_consents"

    id = Column(String(36), primary_key=True, default=get_uuid)
    member_id = Column(String(36), ForeignKey("member_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    policy_id = Column(String(36), ForeignKey("platform_policies.id", ondelete="SET NULL"), nullable=True)
    policy_type = Column(String(40), nullable=False, index=True)
    version = Column(String(20), default="1.0.0", nullable=False)
    accepted_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(255), nullable=True)
    source = Column(String(40), default="SIGNUP", nullable=False)  # SIGNUP, CONTEST_REGISTRATION, MODAL_PROMPT
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    member = relationship("MemberProfile", back_populates="consents")
    policy = relationship("PlatformPolicy")
