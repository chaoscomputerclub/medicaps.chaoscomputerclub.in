"""
Chaos Computer Club — Organizations & Workspaces API Router
Provides endpoints for discovering workspaces, querying organizations, and managing memberships.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.middleware.auth import get_current_member, get_current_member_optional
from app.models.member import MemberProfile
from app.services.organization_service import OrganizationService

router = APIRouter(prefix="/organizations", tags=["Organizations & Workspaces"])


class OrganizationSummary(BaseModel):
    id: str
    slug: str
    name: str
    description: str
    organization_type: str
    logo_url: Optional[str] = None
    website: Optional[str] = None
    is_verified: bool = False


@router.get("", response_model=List[OrganizationSummary], summary="List all verified organization workspaces")
async def list_organizations(db: AsyncSession = Depends(get_db)):
    """Returns list of public and verified organization workspaces."""
    return await OrganizationService.list_organizations(db)


@router.get("/{slug}", response_model=OrganizationSummary, summary="Get organization workspace details")
async def get_organization(slug: str, db: AsyncSession = Depends(get_db)):
    """Fetch workspace profile by slug."""
    org = await OrganizationService.get_by_slug(slug, db)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Organization '{slug}' not found.")
    return {
        "id": org.id,
        "slug": org.slug,
        "name": org.name,
        "description": org.description,
        "organization_type": org.organization_type,
        "logo_url": org.logo_url,
        "website": org.website,
        "is_verified": org.is_verified,
    }


@router.get("/me/memberships", summary="Get current user's organization memberships")
async def get_my_memberships(
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Returns all active organization workspaces the current user belongs to."""
    return await OrganizationService.get_user_organizations(current_member.id, db)


@router.post("/{slug}/join", summary="Join an open organization workspace")
async def join_organization(
    slug: str,
    current_member: MemberProfile = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Joins an organization workspace."""
    try:
        return await OrganizationService.join_organization(current_member.id, slug, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
