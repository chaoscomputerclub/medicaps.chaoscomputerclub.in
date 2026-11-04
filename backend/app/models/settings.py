"""
Chaos Computer Club — Centralized Platform Settings & Audit Ledger ORM Models
"""

from __future__ import annotations

from sqlalchemy import (
    Column,
    DateTime,
    JSON,
    String,
    Text,
)

from .base import Base, get_uuid, now_utc


class PlatformSetting(Base):
    """Authoritative platform configuration registry."""
    __tablename__ = "platform_settings"

    id = Column(String(36), primary_key=True, default=get_uuid)
    key = Column(String(80), unique=True, nullable=False, index=True)
    value_json = Column(JSON, default=dict, nullable=False)
    description = Column(Text, default="", nullable=False)
    category = Column(String(40), default="GENERAL", nullable=False)  # GENERAL, AUTH, BRANDING, CONTESTS, RATINGS
    updated_by = Column(String(100), default="SYSTEM", nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)


class PlatformSettingAudit(Base):
    """Immutable audit trail of all platform configuration modifications."""
    __tablename__ = "platform_settings_audit"

    id = Column(String(36), primary_key=True, default=get_uuid)
    setting_key = Column(String(80), nullable=False, index=True)
    old_value_json = Column(JSON, nullable=True)
    new_value_json = Column(JSON, nullable=False)
    changed_by = Column(String(100), default="SYSTEM", nullable=False)
    client_ip = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
