"""
Chaos Computer Club — Admin Platform Settings & Audit Ledger API Router
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.cloudflare import get_client_ip
from app.middleware.auth import require_admin_or_core
from app.models.member import MemberProfile
from app.services.platform_settings_service import PlatformSettingsService

router = APIRouter(prefix="/admin/settings", tags=["Admin Platform Settings"])


class UpdateSettingRequest(BaseModel):
    value_json: Dict[str, Any]


@router.get("", summary="Get all platform settings (Admin only)")
async def get_all_settings(
    admin: MemberProfile = Depends(require_admin_or_core),
    db: AsyncSession = Depends(get_db),
):
    """Returns all current platform configuration settings."""
    return await PlatformSettingsService.get_all_settings(db)


@router.put("/{key}", summary="Update platform setting (Admin only)")
async def update_setting(
    key: str,
    payload: UpdateSettingRequest,
    request: Request,
    admin: MemberProfile = Depends(require_admin_or_core),
    db: AsyncSession = Depends(get_db),
):
    """Updates a platform setting and writes an immutable audit record."""
    client_ip = get_client_ip(request)
    setting = await PlatformSettingsService.update_setting(
        key=key,
        value_json=payload.value_json,
        actor=admin.handle or admin.email,
        client_ip=client_ip,
        db=db,
    )
    return {
        "success": True,
        "key": setting.key,
        "value": setting.value_json,
        "updated_at": setting.updated_at.isoformat(),
    }


@router.get("/audit", summary="Get platform settings audit log (Admin only)")
async def get_settings_audit_log(
    limit: int = 50,
    admin: MemberProfile = Depends(require_admin_or_core),
    db: AsyncSession = Depends(get_db),
):
    """Returns recent immutable configuration audit entries."""
    return await PlatformSettingsService.get_audit_log(limit=limit, db=db)
