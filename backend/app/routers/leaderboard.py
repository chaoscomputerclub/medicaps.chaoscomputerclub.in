"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Leaderboard & Star Division Ladder Router
"""

from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.models.db_models import MemberProfile, RatingHistory
from app.models.schemas import LeaderboardRow
from app.services.rating_service import get_rating_tier

router = APIRouter(prefix="/leaderboard", tags=["Leaderboards & Ratings"])


@router.get("", response_model=List[LeaderboardRow])
async def get_university_leaderboard(
    department: Optional[str] = Query(None, description="Filter: CSE, IT, AIDS, Cyber Security"),
    batch: Optional[str] = Query(None, description="Filter: 2022-26, 2023-27, 2024-28"),
    tier: Optional[str] = Query(None, description="Filter: 5_star, 4_star, 3_star, 2_star, 1_star"),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch official Medi-Caps University rating standings with star division brackets.
    Supports granular departmental and batch filters.
    """
    stmt = select(MemberProfile)

    if department:
        stmt = stmt.where(MemberProfile.department == department)
    if batch:
        stmt = stmt.where(MemberProfile.batch == batch)

    stmt = stmt.order_by(MemberProfile.rating.desc(), MemberProfile.peak_rating.desc())
    result = await db.execute(stmt)
    members = result.scalars().all()

    # Pre-fetch recent rating histories for sparkline deltas
    histories_res = await db.execute(
        select(RatingHistory).order_by(RatingHistory.contested_at.desc())
    )
    all_histories = histories_res.scalars().all()
    history_by_member: Dict[str, List[int]] = {}
    for h in all_histories:
        history_by_member.setdefault(h.member_id, []).append(h.new_rating - h.old_rating)

    rows = []
    current_rank = 1
    for m in members:
        member_tier = get_rating_tier(m.rating)
        if tier and member_tier != tier:
            continue

        attendance_rate = (
            round((m.attendance_count / m.attendance_total) * 100, 1)
            if m.attendance_total > 0
            else 0.0
        )
        recent_deltas = history_by_member.get(m.id, [])[:4]

        # Mask student PRN for privacy in public leaderboards
        masked_prn = f"{m.prn[:6]}****{m.prn[-2:]}" if len(m.prn) >= 10 else m.prn

        rows.append(
            LeaderboardRow(
                rank=current_rank,
                handle=m.handle,
                full_name=m.full_name,
                prn=masked_prn,
                department=m.department,
                batch=m.batch,
                rating=m.rating,
                peak_rating=m.peak_rating,
                attendance_rate=attendance_rate,
                tier=member_tier,
                recent_deltas=recent_deltas,
            )
        )
        current_rank += 1

    return rows


@router.get("/departments")
async def get_department_performance(db: AsyncSession = Depends(get_db)):
    """Aggregate rating and participation statistics by university department."""
    stmt = select(
        MemberProfile.department,
        func.count(MemberProfile.id).label("total_members"),
        func.avg(MemberProfile.rating).label("avg_rating"),
        func.max(MemberProfile.rating).label("top_rating"),
    ).group_by(MemberProfile.department)

    result = await db.execute(stmt)
    rows = result.all()
    return [
        {
            "department": r.department,
            "total_members": r.total_members,
            "avg_rating": round(float(r.avg_rating), 1),
            "top_rating": r.top_rating,
        }
        for r in rows
    ]
