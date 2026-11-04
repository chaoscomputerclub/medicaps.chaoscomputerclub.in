"""
Chaos Computer Club — Organization & Workspace Management Service
Manages multi-tenant workspace modeling, memberships, and domain-based discovery.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import (
    Organization,
    OrganizationDomain,
    OrganizationMembership,
    OrganizationInvitation,
)
from app.models.member import MemberProfile

logger = logging.getLogger("ccc.organizations")


class OrganizationService:
    """Service layer for organization workspaces and member affiliations."""

    @classmethod
    async def sync_default_organizations(cls, db: AsyncSession) -> None:
        """
        Backfills default Medi-Caps University organization and verified domain claim,
        preserving all historical campus records with zero data loss.
        """
        try:
            # 1. Ensure Medi-Caps University workspace exists
            stmt = select(Organization).where(Organization.slug == "medicaps-university")
            res = await db.execute(stmt)
            org = res.scalars().first()

            if not org:
                org = Organization(
                    id="org-medicaps-university-default",
                    slug="medicaps-university",
                    name="Medi-Caps University",
                    description="Official academic chapter and competitive programming workspace for Medi-Caps University.",
                    organization_type="UNIVERSITY",
                    website="https://www.medicaps.ac.in",
                    is_verified=True,
                )
                db.add(org)
                await db.flush()

            # 2. Ensure domain claim exists
            dom_stmt = select(OrganizationDomain).where(OrganizationDomain.domain == "medicaps.ac.in")
            dom_res = await db.execute(dom_stmt)
            dom_obj = dom_res.scalars().first()

            if not dom_obj:
                dom_obj = OrganizationDomain(
                    id="dom-medicaps-ac-in-default",
                    organization_id=org.id,
                    domain="medicaps.ac.in",
                    is_verified=True,
                )
                db.add(dom_obj)
                await db.flush()

            # 3. Backfill memberships for existing @medicaps.ac.in cadets
            await db.execute(text("""
                INSERT INTO organization_memberships (id, organization_id, member_id, role, status, joined_at)
                SELECT 
                    md5('mem-' || id),
                    :org_id,
                    id,
                    CASE WHEN is_core_member THEN 'ADMIN' ELSE 'MEMBER' END,
                    'ACTIVE',
                    created_at
                FROM member_profiles
                WHERE email ILIKE '%@medicaps.ac.in'
                ON CONFLICT (organization_id, member_id) DO NOTHING;
            """), {"org_id": org.id})

            # 4. Scope legacy campus contests to this organization
            await db.execute(text("""
                UPDATE offline_contests
                SET 
                    organization_id = :org_id,
                    visibility = 'organization_private'
                WHERE (slug ILIKE '%medicaps%' OR title ILIKE '%medi-caps%')
                  AND organization_id IS NULL;
            """), {"org_id": org.id})

            await db.commit()
            logger.info("Successfully synchronized default organization and backfilled historical data.")
        except Exception as e:
            await db.rollback()
            logger.warning("Notice on sync_default_organizations: %s", e)

    @classmethod
    async def list_organizations(cls, db: AsyncSession) -> List[Dict[str, Any]]:
        """Returns list of all active verified organizations."""
        stmt = select(Organization).order_by(Organization.name)
        res = await db.execute(stmt)
        orgs = res.scalars().all()
        return [
            {
                "id": o.id,
                "slug": o.slug,
                "name": o.name,
                "description": o.description,
                "organization_type": o.organization_type,
                "logo_url": o.logo_url,
                "website": o.website,
                "is_verified": o.is_verified,
            }
            for o in orgs
        ]

    @classmethod
    async def get_by_slug(cls, slug: str, db: AsyncSession) -> Optional[Organization]:
        """Fetch organization by URL slug."""
        stmt = select(Organization).where(Organization.slug == slug.strip().lower())
        res = await db.execute(stmt)
        return res.scalars().first()

    @classmethod
    async def get_user_organizations(cls, member_id: str, db: AsyncSession) -> List[Dict[str, Any]]:
        """Returns all organizations that the candidate or member belongs to."""
        stmt = (
            select(OrganizationMembership, Organization)
            .join(Organization, OrganizationMembership.organization_id == Organization.id)
            .where(OrganizationMembership.member_id == member_id)
            .where(OrganizationMembership.status == "ACTIVE")
        )
        res = await db.execute(stmt)
        results = []
        for mem, org in res.all():
            results.append({
                "membership_id": mem.id,
                "role": mem.role,
                "status": mem.status,
                "joined_at": mem.joined_at.isoformat() if mem.joined_at else None,
                "organization": {
                    "id": org.id,
                    "slug": org.slug,
                    "name": org.name,
                    "organization_type": org.organization_type,
                    "logo_url": org.logo_url,
                    "is_verified": org.is_verified,
                }
            })
        return results

    @classmethod
    async def join_organization(cls, member_id: str, slug: str, db: AsyncSession) -> Dict[str, Any]:
        """User joins an open organization workspace."""
        org = await cls.get_by_slug(slug, db)
        if not org:
            raise ValueError(f"Organization '{slug}' not found.")

        # Check existing
        stmt = select(OrganizationMembership).where(
            OrganizationMembership.organization_id == org.id,
            OrganizationMembership.member_id == member_id,
        )
        res = await db.execute(stmt)
        existing = res.scalars().first()
        if existing:
            return {"status": "already_member", "membership_id": existing.id, "role": existing.role}

        from app.models.base import get_uuid, now_utc
        membership = OrganizationMembership(
            id=get_uuid(),
            organization_id=org.id,
            member_id=member_id,
            role="MEMBER",
            status="ACTIVE",
            joined_at=now_utc(),
        )
        db.add(membership)
        await db.commit()
        return {"status": "joined", "membership_id": membership.id, "role": "MEMBER"}

    @classmethod
    async def auto_associate_by_email_domain(cls, member_id: str, email: str, db: AsyncSession) -> Optional[str]:
        """
        Auto-associates member with an organization if their email domain is verified.
        Does not enforce or restrict public signup; purely provides seamless workspace discovery.
        """
        if not email or "@" not in email:
            return None
        domain = email.strip().lower().split("@")[1]

        stmt = select(OrganizationDomain).where(OrganizationDomain.domain == domain, OrganizationDomain.is_verified == True)
        res = await db.execute(stmt)
        claimed_domain = res.scalars().first()
        if not claimed_domain:
            return None

        # Check existing membership
        mem_stmt = select(OrganizationMembership).where(
            OrganizationMembership.organization_id == claimed_domain.organization_id,
            OrganizationMembership.member_id == member_id,
        )
        mem_res = await db.execute(mem_stmt)
        if mem_res.scalars().first():
            return claimed_domain.organization_id

        from app.models.base import get_uuid, now_utc
        membership = OrganizationMembership(
            id=get_uuid(),
            organization_id=claimed_domain.organization_id,
            member_id=member_id,
            role="MEMBER",
            status="ACTIVE",
            joined_at=now_utc(),
        )
        db.add(membership)
        await db.commit()
        logger.info("Auto-associated member %s with organization %s via domain %s", member_id, claimed_domain.organization_id, domain)
        return claimed_domain.organization_id
