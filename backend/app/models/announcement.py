"""
Chaos Computer Club — Announcements, Editorials & Bulletins Model
"""

from __future__ import annotations

from sqlalchemy import (
    Column,
    DateTime,
    String,
    Text,
)

from .base import Base, get_uuid, now_utc


class Announcement(Base):
    """Platform news, editorial bulletins, and podium results."""
    __tablename__ = "announcements"

    id = Column(String(36), primary_key=True, default=get_uuid)
    kind = Column(String(30), nullable=False)  # contest_release, editorial, podium, system
    title = Column(String(150), nullable=False)
    summary = Column(Text, nullable=False)
    published_at = Column(DateTime(timezone=True), default=now_utc, nullable=False, index=True)
    contest_slug = Column(String(80), nullable=True, index=True)
