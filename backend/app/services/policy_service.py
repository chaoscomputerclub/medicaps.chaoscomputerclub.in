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
        "title": "Platform Terms of Service",
        "change_summary": "Comprehensive global platform terms of service.",
        "content": """# Terms of Service

**Effective Date:** November 4, 2026  
**Platform Version:** 1.0.0 (Global Edition)  
**Applicable Domain:** `chaoscomputerclub.in` and authorized global endpoints

---

### 1. Acceptance of Terms & Global Scope
Welcome to **Chaos Computer Club Arena** ("Platform", "we", "us", or "our"), operated by the Chaos Computer Club engineering collective. These Terms of Service ("Terms") constitute a legally binding agreement between you ("User", "Competitor", "Candidate", or "Administrator") and Chaos Computer Club governing your access to and use of our competitive programming arena, automated judge engines, AI technical interview simulations, community leaderboards, and related APIs.

By registering an account, authenticating via OAuth or one-time verification, accessing our APIs, submitting code to sandboxed judges, participating in tournaments, or undergoing AI technical interview sessions, you acknowledge that you have read, understood, and agree to be bound by these Terms and our companion statutory policies (including our Privacy Policy, Contest Rules, Code of Conduct, and Acceptable Use Policy). If you do not agree with these Terms, you must immediately discontinue use of the Platform.

### 2. User Eligibility & Global Authentication
1. **Open Global Access:** The Platform is accessible worldwide to students, software engineers, researchers, and technology practitioners of all skill levels. Participation is not restricted by geography, institutional affiliation, or university enrollment.
2. **Account Types:** Users may register individual accounts using personal, academic, or corporate email domains.
3. **Single Identity Rule:** Each competitor is entitled to maintain exactly one individual account on the Platform. Creating multiple accounts ("smurfing", "multi-accounting") to manipulate Elo ratings, bypass contest tier restrictions, or harvest contest problem sets is strictly prohibited.
4. **Credential Security:** You are responsible for maintaining the confidentiality of your session tokens, one-time authentication passcodes, and API credentials. You agree to notify us immediately at `security@chaoscomputerclub.in` upon discovering any unauthorized access to your account.

### 3. Sandboxed Execution, CodeBox Engine & Security Boundaries
1. **Isolated Execution Environment:** All algorithmic solutions, user scripts, and testcase runs execute inside unprivileged, ephemeral execution sandboxes isolated via Linux namespaces, `cgroups v2` resource controllers, memory limits, CPU quotas, and `seccomp-bpf` syscall filters.
2. **Prohibited System Operations:** Users agree never to:
   - Attempt container escape, privilege escalation, or kernel exploitation.
   - Initiate network egress, socket connections, or external DNS requests from within execution sandboxes.
   - Execute denial-of-service payloads, fork bombs, or infinite memory exhaustion scripts intended to degrade worker nodes.
   - Tamper with, hook, or snoop on grading harnesses, judge orchestrators, or hidden testcase data.
3. **Automated Enforcement:** Any submission detected violating system call limits or exhibiting hostile payloads will result in immediate execution termination, automated security flagging, and account suspension.

### 4. Competitive Integrity, Fair Play & Anti-Cheat Protocol
1. **Original Work Requirement:** All code submitted during live official rounds, hackathons, and rated contests must represent your own original work authored in real time during the contest window.
2. **Anti-Collusion & Plagiarism:** You must not copy, transmit, publish, or discuss solutions or partial algorithms with other participants while an active round is underway.
3. **Automated Tooling & AI Assistance:** Unless explicitly designated as an "AI-augmented" contest, the use of generative AI tools, auto-complete bots, or pre-authored external libraries during active rated rounds is strictly prohibited.
4. **Algorithmic Auditing:** The Platform employs automated syntax tree (AST) tokenization, semantic similarity analysis, and keystroke/focus telemetry to identify cheating. The Chief Proctor desk and Contest Jury hold final, unappealable authority on all disqualifications, score revocations, and rating adjustments.

### 5. AI Technical Interview Arena & Telemetry
1. **Adaptive Interview Practice:** The Platform provides AI-driven technical interview simulations featuring voice interaction, dynamic question adaptation, real-time code execution, and rubric-based evaluation.
2. **Audio & Code Processing:** By initiating an AI interview, you consent to the processing and transcription of your audio input, code edits, and interaction logs solely for the purpose of generating evaluation dossiers and feedback scoring.
3. **Confidentiality of Candidate Dossiers:** Your detailed interview transcripts, competency heatmaps, and coaching dossiers remain strictly private to your account unless you explicitly choose to share your verified dossier with a prospective employer, recruiter, or organization administrator.

### 6. Organization Workspaces & Institutional Tenancy
1. **Multi-Tenant Architecture:** Educational institutions, enterprise engineering teams, coding clubs, and developer communities may establish distinct organization workspaces within the Platform.
2. **Workspace Independence:** An individual user account exists independently of any organization. Joining an organization workspace grants access to that organization's private contests, custom problem sets, and internal leaderboards without relinquishing personal account ownership or global arena ratings.
3. **Organization Coordinator Duties:** Organization administrators and proctors are responsible for managing internal memberships, supervising internal contests, and enforcing ethical testing standards within their designated workspaces.

### 7. Intellectual Property & Code Licensing
1. **User Ownership:** You retain full intellectual property ownership and copyright of original algorithms, solution implementations, and code snippets you compose on the Platform.
2. **Evaluation License to the Platform:** By submitting code to public practice problems, tournaments, or AI interviews, you grant Chaos Computer Club a worldwide, non-exclusive, royalty-free, perpetual license to compile, execute, benchmark, store, and analyze your submissions solely for grading, anti-cheat detection, leaderboard calculation, and platform enhancement.
3. **Platform Assets:** All Platform trademarks, brand emblems, the Mako mascot design, software architectures, UI components, proprietary judge engines, problem statements, and testcase suites are the exclusive intellectual property of Chaos Computer Club.

### 8. API Fair Use & Automated Access
1. **Rate Limiting:** Access to Platform REST APIs, SSE event streams, and WebSocket feeds is rate-limited to preserve service stability for all users.
2. **Scraping Prohibition:** Systematic bulk scraping of problem descriptions, leaderboard data, or participant profiles via automated crawlers or headless browsers without prior written authorization is strictly prohibited.

### 9. Disclaimer of Warranties
THE PLATFORM, EXECUTION ENGINES, PROBLEM SETS, AND AI INTERVIEWS ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT GUARANTEE UNINTERRUPTED AVAILABILITY, ZERO LATENCY DURING CONTEST COUNTDOWNS, OR FLAWLESS SUBMISSION JUDGING UNDER ADVERSE NETWORK CONDITIONS.

### 10. Limitation of Liability
TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, CHAOS COMPUTER CLUB, ITS DIRECTORS, MAINTAINERS, PROCTORS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, USE, GOODWILL, OR CONTEST RATINGS, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE PLATFORM.

### 11. Suspension, Termination & Rating Forfeiture
We reserve the right to suspend, terminate, or restrict access to any account, with or without prior notice, in the event of:
- Breach of these Terms, the Acceptable Use Policy, or Contest Integrity rules.
- Malicious cyber attacks, unauthorized probing, or deliberate platform degradation.
- Documented academic dishonesty, solution leakage, or harassment of community members.
Upon termination for cause, all accumulated Elo ratings, badges, and contest standings may be permanently forfeited.

### 12. Policy Versioning, Consent & Modifications
1. **Version Tracking:** Material amendments to these Terms will be published with an updated version number and effective date.
2. **Immutable Consent Ledger:** User acceptance of revised terms is cryptographically recorded in an immutable database ledger with timestamp, user ID, IP address, and client user-agent.
3. **Continued Use:** Your continued use of the Platform following the publication of revised terms constitutes acceptance of the updated Terms.

### 13. Governing Law & Contact Information
These Terms shall be governed by and construed in accordance with standard international commercial law principles. For inquiries regarding these Terms, policy enforcement, or corporate workspaces, contact the platform administration at:

- **Legal Inquiries:** `legal@chaoscomputerclub.in`
- **Security & Vulnerability Reports:** `security@chaoscomputerclub.in`
- **General Support:** `support@chaoscomputerclub.in`
- **Web Portal:** `https://chaoscomputerclub.in`
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
                else:
                    existing.title = p["title"]
                    existing.content = p["content"]
                    existing.change_summary = p["change_summary"]
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
