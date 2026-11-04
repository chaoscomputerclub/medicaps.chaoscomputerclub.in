"""
Chaos Computer Club — Global Organization & Workspace ORM Models
Provides institution-neutral workspace modeling: Universities, Companies, Bootcamps, Communities.
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


class Organization(Base):
    """Optional institution, university, enterprise, or community workspace."""
    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True, default=get_uuid)
    slug = Column(String(60), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, default="", nullable=False)
    organization_type = Column(String(30), default="COMMUNITY", nullable=False)  # UNIVERSITY, COMPANY, BOOTCAMP, COMMUNITY, OTHER
    logo_url = Column(String(500), nullable=True)
    website = Column(String(255), nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    # Relationships
    domains = relationship("OrganizationDomain", back_populates="organization", cascade="all, delete-orphan", passive_deletes=True)
    memberships = relationship("OrganizationMembership", back_populates="organization", cascade="all, delete-orphan", passive_deletes=True)
    invitations = relationship("OrganizationInvitation", back_populates="organization", cascade="all, delete-orphan", passive_deletes=True)
    contests = relationship("OfflineContest", back_populates="organization")


class OrganizationDomain(Base):
    """Verified domain claim for optional workspace discovery (never a hard platform signup gate)."""
    __tablename__ = "organization_domains"

    id = Column(String(36), primary_key=True, default=get_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    domain = Column(String(100), unique=True, nullable=False, index=True)  # e.g. medicaps.ac.in, mit.edu
    is_verified = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    organization = relationship("Organization", back_populates="domains")


class OrganizationMembership(Base):
    """User membership within an organization workspace (Many-to-Many)."""
    __tablename__ = "organization_memberships"

    id = Column(String(64), primary_key=True, default=get_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    member_id = Column(String(36), ForeignKey("member_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(30), default="MEMBER", nullable=False)  # MEMBER, COORDINATOR, ADMIN
    status = Column(String(30), default="ACTIVE", nullable=False)  # ACTIVE, INVITED, SUSPENDED
    joined_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    invited_by = Column(String(36), ForeignKey("member_profiles.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="memberships")
    member = relationship("MemberProfile", foreign_keys=[member_id], back_populates="organization_memberships")

    __table_args__ = (
        UniqueConstraint("organization_id", "member_id", name="uq_organization_member"),
    )


class OrganizationInvitation(Base):
    """Cryptographically hashed workspace invitations."""
    __tablename__ = "organization_invitations"

    id = Column(String(36), primary_key=True, default=get_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(120), nullable=False, index=True)
    role = Column(String(30), default="MEMBER", nullable=False)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String(36), ForeignKey("member_profiles.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    organization = relationship("Organization", back_populates="invitations")
