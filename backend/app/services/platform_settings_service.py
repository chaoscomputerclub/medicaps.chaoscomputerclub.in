"""
Chaos Computer Club — Centralized Platform Settings & Audit Service
Provides typed, validated platform configuration with audit trail logging and environment overrides.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import PlatformSetting, PlatformSettingAudit
from app.models.base import get_uuid, now_utc
from app.core.config import settings as core_settings

logger = logging.getLogger("ccc.settings")

DEFAULT_SETTINGS = [
    {
        "key": "platform.name",
        "value_json": {"value": "Chaos Computer Club Arena"},
        "description": "Public branding and display name of the arena platform.",
        "category": "BRANDING",
    },
    {
        "key": "platform.base_domain",
        "value_json": {"value": core_settings.PLATFORM_BASE_DOMAIN if hasattr(core_settings, "PLATFORM_BASE_DOMAIN") else "chaoscomputerclub.in"},
        "description": "Primary base domain for apex and subdomains.",
        "category": "NETWORK",
    },
    {
        "key": "auth.allow_public_registration",
        "value_json": {"enabled": True},
        "description": "Whether any global engineer can register with personal email.",
        "category": "AUTH",
    },
    {
        "key": "auth.enforce_domain_restriction",
        "value_json": {"enabled": False},
        "description": "Whether registration is restricted to an academic domain.",
        "category": "AUTH",
    },
    {
        "key": "contests.default_duration_minutes",
        "value_json": {"minutes": 120},
        "description": "Default contest round duration.",
        "category": "CONTESTS",
    },
    {
        "key": "contests.rating_k_factor",
        "value_json": {"k_factor": 32},
        "description": "Default ELO rating velocity factor.",
        "category": "RATINGS",
    },
    {
        "key": "interviews.public_catalog_enabled",
        "value_json": {"enabled": True},
        "description": "Whether candidates can take public interview simulations globally.",
        "category": "INTERVIEWS",
    },
]


class PlatformSettingsService:
    """Service layer for platform settings and immutable audit records."""

    @classmethod
    async def sync_default_settings(cls, db: AsyncSession) -> None:
        """Seeds default platform settings into PostgreSQL."""
        try:
            for s in DEFAULT_SETTINGS:
                stmt = select(PlatformSetting).where(PlatformSetting.key == s["key"])
                res = await db.execute(stmt)
                existing = res.scalars().first()
                if not existing:
                    row = PlatformSetting(
                        id=get_uuid(),
                        key=s["key"],
                        value_json=s["value_json"],
                        description=s["description"],
                        category=s["category"],
                        updated_by="SYSTEM",
                    )
                    db.add(row)
            await db.commit()
            logger.info("Successfully synchronized %d default platform settings.", len(DEFAULT_SETTINGS))
        except Exception as e:
            await db.rollback()
            logger.warning("Notice on sync_default_settings: %s", e)

    @classmethod
    async def get_all_settings(cls, db: AsyncSession) -> Dict[str, Any]:
        """Returns map of all configured platform settings."""
        stmt = select(PlatformSetting).order_by(PlatformSetting.category, PlatformSetting.key)
        res = await db.execute(stmt)
        rows = res.scalars().all()
        return {
            r.key: {
                "value": r.value_json,
                "description": r.description,
                "category": r.category,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        }

    @classmethod
    async def get_setting(cls, key: str, default: Any = None, db: AsyncSession = None) -> Any:
        """Fetch single setting value by key."""
        if not db:
            return default
        stmt = select(PlatformSetting).where(PlatformSetting.key == key)
        res = await db.execute(stmt)
        row = res.scalars().first()
        if not row:
            return default
        val = row.value_json
        if isinstance(val, dict) and "value" in val and len(val) == 1:
            return val["value"]
        return val

    @classmethod
    async def update_setting(
        cls,
        key: str,
        value_json: Dict[str, Any],
        actor: str = "SYSTEM",
        client_ip: Optional[str] = None,
        db: AsyncSession = None,
    ) -> PlatformSetting:
        """Updates setting and appends audit trail."""
        stmt = select(PlatformSetting).where(PlatformSetting.key == key)
        res = await db.execute(stmt)
        row = res.scalars().first()

        old_val = row.value_json if row else None

        if not row:
            row = PlatformSetting(
                id=get_uuid(),
                key=key,
                value_json=value_json,
                category="CUSTOM",
                updated_by=actor,
            )
            db.add(row)
        else:
            row.value_json = value_json
            row.updated_by = actor

        # Audit
        audit = PlatformSettingAudit(
            id=get_uuid(),
            setting_key=key,
            old_value_json=old_val,
            new_value_json=value_json,
            changed_by=actor,
            client_ip=client_ip,
        )
        db.add(audit)
        await db.commit()
        return row

    @classmethod
    async def get_audit_log(cls, limit: int = 50, db: AsyncSession = None) -> List[Dict[str, Any]]:
        """Fetch recent configuration audit entries."""
        stmt = select(PlatformSettingAudit).order_by(PlatformSettingAudit.created_at.desc()).limit(limit)
        res = await db.execute(stmt)
        audits = res.scalars().all()
        return [
            {
                "id": a.id,
                "setting_key": a.setting_key,
                "old_value": a.old_value_json,
                "new_value": a.new_value_json,
                "changed_by": a.changed_by,
                "client_ip": a.client_ip,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in audits
        ]
