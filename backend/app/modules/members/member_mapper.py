"""
Chaos Computer Club — Medi-Caps Chapter
modules/members/member_mapper.py — Member Profile DTO & Serialization Mappers
"""

import re
from typing import Optional
from app.models.db_models import MemberProfile
from app.schemas.auth import MemberPublic


def to_member_public(member: MemberProfile) -> MemberPublic:
    """Transform MemberProfile ORM entity into public MemberPublic DTO."""
    enrollment = member.prn
    if not enrollment or enrollment in ("N/A", "—"):
        if member.email and "@" in member.email:
            prefix = member.email.split("@")[0].upper()
            if prefix.startswith("EN") or prefix.startswith("0827"):
                enrollment = prefix
            elif any(k in prefix for k in ("EN23", "EN22", "EN24", "EN25")):
                match = re.search(r"(EN\d{2}[A-Z0-9]+)", prefix)
                enrollment = match.group(1) if match else prefix

    is_core = bool(getattr(member, "is_core_member", False))

    return MemberPublic(
        id=member.id,
        handle=member.handle,
        full_name=member.full_name,
        email=member.email,
        prn=enrollment or "—",
        department=member.department,
        batch=member.batch,
        rating=member.rating,
        peak_rating=getattr(member, "peak_rating", member.rating),
        is_core_member=is_core,
        is_onboarded=member.is_onboarded,
        avatar_url=getattr(member, "avatar_url", None),
        bio=getattr(member, "bio", None),
        github_username=getattr(member, "github_username", None),
        linkedin_url=getattr(member, "linkedin_url", None),
    )
