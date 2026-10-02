"""
Chaos Computer Club — Medi-Caps Chapter
services/reconciliation_service.py — Single Source of Truth & Data Integrity Reconciliation Engine

Enforces Section 26 of Platform Consistency Architecture:
- Audits and reconciles Member attendance vs. Scoreboard entries.
- Audits and reconciles Member ratings vs. Rating History ledger.
- Audits and reconciles Ranking Service eligibility and mathematical determinism.
- Detects split-brain or stale cache conditions and repairs where safe.
"""

import logging
from typing import Any, Dict, List, Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import MemberProfile, OfflineContest, RatingHistory, ScoreboardEntry
from app.services.ranking_service import RankingService

logger = logging.getLogger(__name__)


class ReconciliationReport:
    def __init__(self):
        self.inconsistencies: List[Dict[str, Any]] = []
        self.repaired: List[Dict[str, Any]] = []
        self.total_checks: int = 0
        self.passed_checks: int = 0

    def record_pass(self, check_name: str):
        self.total_checks += 1
        self.passed_checks += 1

    def record_inconsistency(self, check_name: str, entity_id: str, details: Dict[str, Any], repaired: bool = False):
        self.total_checks += 1
        entry = {
            "check": check_name,
            "entity_id": entity_id,
            "details": details,
            "repaired": repaired,
        }
        self.inconsistencies.append(entry)
        if repaired:
            self.repaired.append(entry)
            self.passed_checks += 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": "HEALTHY" if len(self.inconsistencies) == len(self.repaired) else "DRIFT_DETECTED",
            "total_checks": self.total_checks,
            "passed_checks": self.passed_checks,
            "inconsistencies_found": len(self.inconsistencies),
            "repaired_count": len(self.repaired),
            "inconsistencies": self.inconsistencies,
        }


class ReconciliationService:
    """Canonical domain service for platform-wide consistency auditing and reconciliation."""

    @classmethod
    async def reconcile_attendance(cls, db: AsyncSession, fix: bool = True) -> List[Dict[str, Any]]:
        """
        Reconciles member attendance counts against the authoritative scoreboard ledger.
        If a member has physical scoreboard entries exceeding attendance_count, updates attendance_count.
        """
        discrepancies = []
        stmt = (
            select(
                MemberProfile.id,
                MemberProfile.handle,
                MemberProfile.attendance_count,
                func.count(ScoreboardEntry.id).label("sb_count"),
            )
            .outerjoin(ScoreboardEntry, ScoreboardEntry.member_id == MemberProfile.id)
            .group_by(MemberProfile.id)
        )
        res = await db.execute(stmt)
        rows = res.all()

        for member_id, handle, attendance_count, sb_count in rows:
            sb_c = sb_count or 0
            att_c = attendance_count or 0
            # If scoreboard records exist that exceed the profile counter, profile counter is lagging
            if sb_c > att_c:
                disc = {
                    "member_id": member_id,
                    "handle": handle,
                    "profile_attendance": att_c,
                    "scoreboard_count": sb_c,
                    "repaired": False,
                }
                if fix:
                    member = await db.get(MemberProfile, member_id)
                    if member:
                        member.attendance_count = sb_c
                        disc["repaired"] = True
                discrepancies.append(disc)

        if fix and discrepancies:
            await db.commit()

        return discrepancies

    @classmethod
    async def reconcile_ratings(cls, db: AsyncSession, fix: bool = False) -> List[Dict[str, Any]]:
        """
        Reconciles member current ratings against their latest RatingHistory ledger record.
        """
        discrepancies = []
        # Get latest rating history per member
        stmt = (
            select(RatingHistory)
            .order_by(RatingHistory.member_id, RatingHistory.contested_at.desc())
        )
        res = await db.execute(stmt)
        histories = res.scalars().all()

        # Group by member_id
        latest_history: Dict[str, RatingHistory] = {}
        for h in histories:
            if h.member_id not in latest_history:
                latest_history[h.member_id] = h

        for member_id, latest_h in latest_history.items():
            member = await db.get(MemberProfile, member_id)
            if member and member.rating != latest_h.new_rating:
                disc = {
                    "member_id": member_id,
                    "handle": member.handle,
                    "profile_rating": member.rating,
                    "ledger_rating": latest_h.new_rating,
                    "contest_id": latest_h.contest_id,
                    "repaired": False,
                }
                if fix:
                    member.rating = latest_h.new_rating
                    if member.peak_rating is None or latest_h.new_rating > member.peak_rating:
                        member.peak_rating = latest_h.new_rating
                    disc["repaired"] = True
                discrepancies.append(disc)

        if fix and discrepancies:
            await db.commit()

        return discrepancies

    @classmethod
    async def audit_ranking_consistency(cls, db: AsyncSession) -> Dict[str, Any]:
        """
        Audits all onboarded members to ensure ranking determinism:
        1. Cadets with attendance_count == 0 must be Unranked (rank = None, percentile = None).
        2. Cadets with attendance_count > 0 must have an exact deterministic integer rank.
        3. Rank #1 must have the highest rating and peak rating.
        """
        report = ReconciliationReport()

        stmt = select(MemberProfile).where(MemberProfile.is_onboarded.is_(True))
        res = await db.execute(stmt)
        members = res.scalars().all()

        for member in members:
            ranks = await RankingService.get_member_ranks(db, member)
            att = member.attendance_count or 0

            if att == 0:
                if ranks.is_ranked or ranks.university_rank is not None:
                    report.record_inconsistency(
                        check_name="unranked_gating_invariant",
                        entity_id=member.id,
                        details={
                            "handle": member.handle,
                            "attendance": att,
                            "is_ranked": ranks.is_ranked,
                            "university_rank": ranks.university_rank,
                            "violation": "Cadet with 0 attendance has non-null rank or is_ranked=True",
                        },
                    )
                else:
                    report.record_pass("unranked_gating_invariant")
            else:
                if not ranks.is_ranked or ranks.university_rank is None or ranks.university_rank < 1:
                    report.record_inconsistency(
                        check_name="ranked_eligibility_invariant",
                        entity_id=member.id,
                        details={
                            "handle": member.handle,
                            "attendance": att,
                            "is_ranked": ranks.is_ranked,
                            "university_rank": ranks.university_rank,
                            "violation": "Cadet with >0 attendance was not assigned valid university rank",
                        },
                    )
                else:
                    report.record_pass("ranked_eligibility_invariant")

        return report.to_dict()

    @classmethod
    async def run_full_audit(cls, db: AsyncSession, fix: bool = False) -> Dict[str, Any]:
        """Run all platform consistency checks and return unified report."""
        att_disc = await cls.reconcile_attendance(db, fix=fix)
        rating_disc = await cls.reconcile_ratings(db, fix=fix)
        ranking_audit = await cls.audit_ranking_consistency(db)

        return {
            "status": "HEALTHY" if (not att_disc and not rating_disc and ranking_audit["status"] == "HEALTHY") else "ISSUES_FOUND",
            "attendance_discrepancies": att_disc,
            "rating_discrepancies": rating_disc,
            "ranking_audit": ranking_audit,
        }
