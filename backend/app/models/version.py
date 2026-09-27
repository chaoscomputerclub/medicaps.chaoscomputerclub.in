"""
Chaos Computer Club — Monotonic Resource Version Entity
Provides authoritative PostgreSQL-backed sequence versioning for domain resources.
"""

from sqlalchemy import BigInteger, Column, DateTime, String
from .base import Base, now_utc


class ResourceVersion(Base):
    """
    Authoritative PostgreSQL-backed monotonic resource version tracker.
    Used by CacheSyncEngine to guarantee strict monotonicity across database transactions.
    """
    __tablename__ = "resource_versions"

    resource_id = Column(String(120), primary_key=True)
    version = Column(BigInteger, default=1, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
