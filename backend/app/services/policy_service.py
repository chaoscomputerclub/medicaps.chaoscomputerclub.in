"""
Chaos Computer Club — Versioned Platform Legal Policies & Consent Service
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.policy import PlatformPolicy, UserConsent
from app.models.base import get_uuid, now_utc

logger = logging.getLogger("ccc.policies")

# Default policy seeds
DEFAULT_POLICIES = [
    {
        "policy_type": "TERMS_OF_SERVICE",
        "version": "1.0.0",
        "locale": "en",
        "title": "Terms of Service",
        "change_summary": "Initial global platform terms of service.",
        "content": """# Terms of Service

Last Updated: November 4, 2026

Welcome to Chaos Computer Club Arena ("Platform", "we", "us"). By accessing or using our websites, APIs, coding environments, or AI interview simulations, you agree to be bound by these Terms of Service.

## 1. Global Eligibility & Individual Accounts
- The Platform is globally accessible to all software engineers, students, and technology practitioners.
- You do not need an academic affiliation or institutional email to create an account or participate in public challenges, interviews, or contests.
- You are responsible for safeguarding your login credentials and for all activities that occur under your account.

## 2. Organization Workspaces
- Organizations (universities, colleges, enterprises, bootcamps, and coding clubs) may maintain workspaces on the Platform.
- Users may belong to zero, one, or multiple organization workspaces.
- Organization administrators are responsible for managing internal workspace permissions.

## 3. Platform Intellectual Property & Submissions
- You retain ownership of code and original solutions you submit to the Platform.
- By submitting code to public contests or practice arenas, you grant the Platform a license to execute, analyze, compile, and benchmark your code for evaluation, anti-cheat auditing, and leaderboard ranking.

## 4. Prohibited Conduct
- You must not reverse-engineer, exploit, or attempt to break out of our judge execution sandboxes.
- You must not deploy automated bots, denial-of-service tools, or unauthorized automated scrapers against Platform APIs.

## 5. Limitation of Liability
The Platform and all simulations are provided "as-is" without warranty of any kind.
""",
    },
    {
        "policy_type": "PRIVACY_POLICY",
        "version": "1.0.0",
        "locale": "en",
        "title": "Privacy Policy",
        "change_summary": "Initial global privacy policy.",
        "content": """# Privacy Policy

Last Updated: November 4, 2026

We value your privacy and are committed to safeguarding your personal data in accordance with international standards.

## 1. Data We Collect
- **Identity & Contact Data:** Email address, display name, handle, avatar URL, optional bio, GitHub handle, LinkedIn URL.
- **Performance & Arena Data:** Problem submissions, compilation output, execution timing, memory consumption, ELO rating trajectory.
- **AI Interview Telemetry:** Transcribed candidate dialogue, code written during interviews, competency graphs, and evaluation reports.
- **Technical & Security Data:** IP address, browser user-agent, session tokens, and security audit logs.

## 2. How We Use Your Data
- To authenticate you and preserve your competitive progress across sessions.
- To execute your code inside isolated execution sandboxes and calculate scores.
- To power adaptive AI interview simulations and generate personalized competency reports.
- To detect and prevent malicious abuse, automated bots, and unauthorized access.

## 3. Data Sharing & Visibility
- **Public Profile:** Your handle, avatar, rating, and public badges are visible globally.
- **Interview Reports:** Detailed interview session telemetry and transcripts are strictly private to you and authorized reviewers.
- **Organization Workspaces:** If you join an organization, workspace coordinators can view your participation within that organization's private challenges.

## 4. Your Rights
You may request data export, profile updates, or account deletion at any time by contacting support.
""",
    },
    {
        "policy_type": "CONTEST_RULES",
        "version": "1.0.0",
        "locale": "en",
        "title": "Official Contest Rules & Integrity Standard",
        "change_summary": "Initial global contest rules and anti-cheat standards.",
        "content": """# Official Contest Rules & Integrity Standard

Last Updated: November 4, 2026

All participants in official tournaments, weekly rounds, and hackathons must adhere strictly to these rules.

## 1. Single Account Policy
- Each participant may register and compete using only one account.
- Operating multiple accounts to bypass rating tiers or leak problem sets is strictly prohibited and results in immediate disqualification.

## 2. Fair Play & Anti-Cheat
- All submitted code must be authored by the participant during the contest window.
- Sharing solutions, testcase inputs, or algorithm hints with other competitors during an active round is strictly banned.
- All submissions are subjected to automated similarity analysis and semantic AST comparison.

## 3. Sandboxing & Runtime Integrity
- Submissions must not attempt network egress, filesystem snooping, or subversion of the evaluation harness.
- Compiler manipulation or intentional crashes of the grading worker will lead to permanent disqualification.

## 4. Dispute Resolution
Decisions made by the Chief Proctors and Contest Jury regarding ratings, scoring penalties, and disqualifications are final.
""",
    },
    {
        "policy_type": "CODE_OF_CONDUCT",
        "version": "1.0.0",
        "locale": "en",
        "title": "Community Code of Conduct",
        "change_summary": "Initial community code of conduct.",
        "content": """# Community Code of Conduct

Last Updated: November 4, 2026

We are committed to providing a friendly, safe, and welcoming environment for all participants, regardless of experience level, background, gender, or identity.

- **Be Respectful:** Treat peers, proctors, and community members with dignity.
- **Constructive Collaboration:** Critique code and design decisions constructively. Harassment, derogatory comments, and toxic behavior are not tolerated.
- **Reporting Violations:** If you witness misconduct, report it directly to the moderation team.
""",
    },
    {
        "policy_type": "ACCEPTABLE_USE",
        "version": "1.0.0",
        "locale": "en",
        "title": "Acceptable Use Policy",
        "change_summary": "Initial acceptable use policy.",
        "content": """# Acceptable Use Policy

Last Updated: November 4, 2026

Defines security boundaries for all interactions with Platform infrastructure, execution runners, and API endpoints.

- Do not attempt unauthorized privilege escalation or bypass kernel cgroups/seccomp containers.
- Do not probe or scan undocumented internal network ports or daemon endpoints.
- Report discovered security vulnerabilities responsibly through our coordinated disclosure process.
""",
    },
]


class PolicyService:
    """Service layer for versioned platform policies and user consent tracking."""

    @classmethod
    async def sync_default_policies(cls, db: AsyncSession) -> None:
        """Seeds default published platform policies at version 1.0.0."""
        try:
            for p in DEFAULT_POLICIES:
                stmt = select(PlatformPolicy).where(
                    PlatformPolicy.policy_type == p["policy_type"],
                    PlatformPolicy.version == p["version"],
                    PlatformPolicy.locale == p["locale"],
                )
                res = await db.execute(stmt)
                existing = res.scalars().first()
                if not existing:
                    pol = PlatformPolicy(
                        id=f"pol-{p['policy_type'].lower()}-{p['version']}",
                        policy_type=p["policy_type"],
                        version=p["version"],
                        locale=p["locale"],
                        title=p["title"],
                        content=p["content"],
                        change_summary=p["change_summary"],
                        effective_date=now_utc(),
                        is_published=True,
                    )
                    db.add(pol)
            await db.commit()
            logger.info("Successfully synchronized %d default platform policies.", len(DEFAULT_POLICIES))
        except Exception as e:
            await db.rollback()
            logger.warning("Notice on sync_default_policies: %s", e)

    @classmethod
    async def get_active_policy(cls, policy_type: str, locale: str = "en", db: AsyncSession = None) -> Optional[PlatformPolicy]:
        """Fetch the latest active published policy of a given type."""
        stmt = (
            select(PlatformPolicy)
            .where(
                PlatformPolicy.policy_type == policy_type.upper(),
                PlatformPolicy.locale == locale,
                PlatformPolicy.is_published == True,
            )
            .order_by(PlatformPolicy.effective_date.desc())
        )
        res = await db.execute(stmt)
        return res.scalars().first()

    @classmethod
    async def list_active_policies(cls, locale: str = "en", db: AsyncSession = None) -> List[Dict[str, Any]]:
        """List summaries of all active policies."""
        stmt = (
            select(PlatformPolicy)
            .where(
                PlatformPolicy.locale == locale,
                PlatformPolicy.is_published == True,
            )
            .order_by(PlatformPolicy.policy_type)
        )
        res = await db.execute(stmt)
        policies = res.scalars().all()
        return [
            {
                "id": p.id,
                "policy_type": p.policy_type,
                "version": p.version,
                "locale": p.locale,
                "title": p.title,
                "change_summary": p.change_summary,
                "effective_date": p.effective_date.isoformat() if p.effective_date else None,
            }
            for p in policies
        ]

    @classmethod
    async def record_consent(
        cls,
        member_id: str,
        policy_type: str,
        version: str,
        source: str = "SIGNUP",
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        db: AsyncSession = None,
    ) -> UserConsent:
        """Records immutable user acceptance of a specific policy version."""
        # Find matching policy ID if exists
        stmt = select(PlatformPolicy).where(
            PlatformPolicy.policy_type == policy_type.upper(),
            PlatformPolicy.version == version,
        )
        res = await db.execute(stmt)
        pol = res.scalars().first()

        consent = UserConsent(
            id=get_uuid(),
            member_id=member_id,
            policy_id=pol.id if pol else None,
            policy_type=policy_type.upper(),
            version=version,
            accepted_at=now_utc(),
            ip_address=ip_address,
            user_agent=user_agent[:255] if user_agent else None,
            source=source,
        )
        db.add(consent)
        await db.commit()
        return consent

    @classmethod
    async def get_user_consents(cls, member_id: str, db: AsyncSession) -> List[Dict[str, Any]]:
        """Fetch all recorded policy consents for a member."""
        stmt = select(UserConsent).where(UserConsent.member_id == member_id).order_by(UserConsent.accepted_at.desc())
        res = await db.execute(stmt)
        consents = res.scalars().all()
        return [
            {
                "id": c.id,
                "policy_type": c.policy_type,
                "version": c.version,
                "accepted_at": c.accepted_at.isoformat() if c.accepted_at else None,
                "source": c.source,
            }
            for c in consents
        ]
