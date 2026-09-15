"""
Chaos Computer Club India — Medi-Caps Chapter Backend
Leaderboard & Star Division Ladder Router
"""

from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, Query, Response
from app.core.cache import get_cache, set_cache
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.models.db_models import MemberProfile, RatingHistory
from app.models.schemas import LeaderboardRow
from app.services.rating_service import get_rating_tier

router = APIRouter(prefix="/leaderboard", tags=["Leaderboards & Ratings"])


@router.get("", response_model=List[LeaderboardRow])
async def get_university_leaderboard(
    response: Response,
    department: Optional[str] = Query(None, description="Filter: CSE, IT, AIDS, Cyber Security"),
    batch: Optional[str] = Query(None, description="Filter: 2022-26, 2023-27, 2024-28"),
    tier: Optional[str] = Query(None, description="Filter: 5_star, 4_star, 3_star, 2_star, 1_star"),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch official Medi-Caps University rating standings with star division brackets.
    Supports granular departmental and batch filters.
    Protected by 60s Redis Cache-Aside with conditional HTTP headers.
    """
    cache_key = f"cache:leaderboard:{department or 'all'}:{batch or 'all'}:{tier or 'all'}"
    cached = await get_cache(cache_key)
    if cached is not None:
        response.headers["X-Cache"] = "HIT"
        response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=30"
        return cached
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

        attendance_count = m.attendance_count if m.attendance_count is not None else 0
        attendance_total = m.attendance_total if m.attendance_total is not None else 0
        attendance_rate = (
            round((attendance_count / attendance_total) * 100, 1)
            if attendance_total > 0
            else 0.0
        )
        recent_deltas = history_by_member.get(m.id, [])[:4]

        # Mask student PRN for privacy in public leaderboards
        prn_str = m.prn or ""
        masked_prn = f"{prn_str[:6]}****{prn_str[-2:]}" if len(prn_str) >= 10 else (prn_str or "—")

        # Generate historical rating sparkline points from recent deltas
        m_rating = m.rating if m.rating is not None else 1200
        sparkline = [m_rating]
        running_rating = m_rating
        for delta in recent_deltas:
            running_rating -= delta
            sparkline.append(running_rating)
        sparkline.reverse()
        # Single-point sparkline is valid — frontend handles flat render

        handle = m.handle or (m.email.split("@")[0] if m.email else f"cadet_{current_rank}")
        full_name = m.full_name or handle
        dept = m.department or "CSE"
        batch_val = m.batch or "2024-28"

        rows.append(
            LeaderboardRow(
                id=m.id,
                avatar_url=m.avatar_url,
                rank=current_rank,
                university_rank=current_rank,
                previous_rank=None,  # No fake rank movement — only set after a contest
                handle=handle,
                full_name=full_name,
                prn=masked_prn,
                department=dept,
                batch=batch_val,
                rating=m_rating,
                peak_rating=m.peak_rating if m.peak_rating is not None else m_rating,
                attendance_rate=attendance_rate,
                attendance_count=attendance_count,
                attendance_total=attendance_total,
                tier=member_tier,
                ratings=sparkline,
                recent_deltas=recent_deltas,
            )
        )
        current_rank += 1

    rows_data = [r.model_dump() for r in rows]
    await set_cache(cache_key, rows_data, ttl_seconds=60)
    response.headers["X-Cache"] = "MISS"
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=30"
    return rows



@router.get("/distribution")
async def get_rating_distribution(response: Response, db: AsyncSession = Depends(get_db)):
    """
    Return the real rating distribution histogram from the DB.
    Each bucket spans 50 rating points (1000-1050, ..., 2350-2400+).
    Count is the actual number of members whose rating falls in that range.
    Protected by 120s Redis Cache-Aside.
    """
    cache_key = "cache:leaderboard:distribution"
    cached = await get_cache(cache_key)
    if cached is not None:
        response.headers["X-Cache"] = "HIT"
        response.headers["Cache-Control"] = "public, max-age=120, stale-while-revalidate=60"
        return cached

    result = await db.execute(select(MemberProfile.rating))
    ratings = [r for (r,) in result.all() if r is not None]

    # Define 28 buckets covering 1000 to 2400
    buckets = []
    for lo in range(1000, 2400, 50):
        hi = lo + 50
        count = sum(1 for r in ratings if lo <= r < hi)
        buckets.append({"min": lo, "max": hi, "count": count})

    # Final overflow bucket: >= 2400
    buckets.append({
        "min": 2400,
        "max": 9999,
        "count": sum(1 for r in ratings if r >= 2400),
    })

    total = len(ratings)
    payload = {"total": total, "buckets": buckets}
    await set_cache(cache_key, payload, ttl_seconds=120)
    response.headers["X-Cache"] = "MISS"
    response.headers["Cache-Control"] = "public, max-age=120, stale-while-revalidate=60"
    return payload


@router.get("/departments")
async def get_department_performance(response: Response, db: AsyncSession = Depends(get_db)):
    """Aggregate rating and participation statistics by university department. Protected by 120s Redis Cache."""
    cache_key = "cache:leaderboard:departments"
    cached = await get_cache(cache_key)
    if cached is not None:
        response.headers["X-Cache"] = "HIT"
        response.headers["Cache-Control"] = "public, max-age=120, stale-while-revalidate=60"
        return cached

    stmt = select(
        MemberProfile.department,
        func.count(MemberProfile.id).label("total_members"),
        func.avg(MemberProfile.rating).label("avg_rating"),
        func.max(MemberProfile.rating).label("top_rating"),
    ).group_by(MemberProfile.department)

    result = await db.execute(stmt)
    rows = result.all()
    payload = [
        {
            "department": r.department,
            "total_members": r.total_members,
            "avg_rating": round(float(r.avg_rating), 1),
            "top_rating": r.top_rating,
        }
        for r in rows
    ]
    await set_cache(cache_key, payload, ttl_seconds=120)
    response.headers["X-Cache"] = "MISS"
    response.headers["Cache-Control"] = "public, max-age=120, stale-while-revalidate=60"
    return payload
