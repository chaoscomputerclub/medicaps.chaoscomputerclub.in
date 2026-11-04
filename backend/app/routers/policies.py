"""
Chaos Computer Club — Versioned Platform Legal Policies & Consent API Router
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.cloudflare import get_client_ip
from app.middleware.auth import get_current_member, get_current_member_optional
from app.models.member import MemberProfile
from app.services.policy_service import PolicyService

router = APIRouter(prefix="/policies", tags=["Legal Policies & User Consent"])


class AcceptPolicyRequest(BaseModel):
    policy_type: str
    version: str = "1.0.0"
    source: str = "MODAL_PROMPT"


@router.get("", summary="List all active published platform policies")
async def list_policies(db: AsyncSession = Depends(get_db)):
    """Returns summaries of all active versioned platform policies."""
    return await PolicyService.list_active_policies("en", db)


@router.get("/{policy_type}", summary="Get active policy by type")
async def get_policy(policy_type: str, db: AsyncSession = Depends(get_db)):
    """Returns complete versioned policy text and markdown content."""
    policy = await PolicyService.get_active_policy(policy_type, "en", db)
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy '{policy_type}' not found or not published.",
        )
    return {
        "id": policy.id,
        "policy_type": policy.policy_type,
        "version": policy.version,
        "locale": policy.locale,
        "title": policy.title,
        "content": policy.content,
        "change_summary": policy.change_summary,
        "effective_date": policy.effective_date.isoformat() if policy.effective_date else None,
    }


@router.post("/accept", summary="Record user consent for a specific policy version")
async def accept_policy(
    payload: AcceptPolicyRequest,
    request: Request,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Records immutable user consent for a versioned policy."""
    client_ip = get_client_ip(request)
    ua = request.headers.get("user-agent", "")
    consent = await PolicyService.record_consent(
        member_id=current_member.id,
        policy_type=payload.policy_type,
        version=payload.version,
        source=payload.source,
        ip_address=client_ip,
        user_agent=ua,
        db=db,
    )
    return {
        "success": True,
        "consent_id": consent.id,
        "policy_type": consent.policy_type,
        "version": consent.version,
        "accepted_at": consent.accepted_at.isoformat(),
    }


@router.get("/me/consents", summary="Get current user's consent ledger")
async def get_my_consents(
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Returns immutable log of all policies accepted by the authenticated member."""
    return await PolicyService.get_user_consents(current_member.id, db)
