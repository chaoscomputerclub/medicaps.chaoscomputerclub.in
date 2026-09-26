"""
Chaos Computer Club — Medi-Caps Chapter
controllers/leaderboard_controller.py — University Leaderboard & Star Division Ladder Orchestrator
"""

from typing import Dict, List, Optional, Any
from fastapi import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cache, set_cache
from app.models.db_models import MemberProfile, RatingHistory, ScoreboardEntry, OfflineContest
from app.models.schemas import LeaderboardRow
from app.services.rating_service import get_rating_tier
from app.lib.cache_keys import leaderboard_cache_key, TTL_LEADERBOARD
from app.lib.pagination import normalize_pagination, inject_pagination_headers
from app.lib.chunking import chunked_in_query



class LeaderboardController:
    """Orchestrator for university leaderboard, rating distributions, and department metrics."""

    @staticmethod
    async def get_university_leaderboard(
        response: Response,
        department: Optional[str],
        batch: Optional[str],
        tier: Optional[str],
        limit: Optional[int],
        offset: Optional[int],
        db: AsyncSession,
    ) -> List[LeaderboardRow]:
        safe_limit, safe_offset = normalize_pagination(limit, offset, default_limit=50, max_limit=500)
        cache_key = leaderboard_cache_key(department, batch, tier, safe_limit, safe_offset)
        cached = await get_cache(cache_key)
        if cached is not None:
            response.headers["X-Cache"] = "HIT"
            response.headers["Cache-Control"] = f"public, max-age={TTL_LEADERBOARD}, stale-while-revalidate=30"
            if isinstance(cached, dict) and "items" in cached:
                inject_pagination_headers(response, cached.get("total", len(cached["items"])), safe_limit, safe_offset)
                return cached["items"]
            elif isinstance(cached, list):
                inject_pagination_headers(response, len(cached), safe_limit, safe_offset)
                return cached
            return cached

        stmt = select(MemberProfile).where(
            MemberProfile.is_onboarded.is_(True),
            MemberProfile.handle.isnot(None),
            ~MemberProfile.email.like("qa.%"),
            ~MemberProfile.handle.like("qa_%"),
        )
        count_stmt = select(func.count(MemberProfile.id)).where(
            MemberProfile.is_onboarded.is_(True),
            MemberProfile.handle.isnot(None),
            ~MemberProfile.email.like("qa.%"),
            ~MemberProfile.handle.like("qa_%"),
        )

        if department:
            stmt = stmt.where(MemberProfile.department == department)
            count_stmt = count_stmt.where(MemberProfile.department == department)
        if batch:
            stmt = stmt.where(MemberProfile.batch == batch)
            count_stmt = count_stmt.where(MemberProfile.batch == batch)

        if tier:
            if tier == "5_star":
                stmt = stmt.where(MemberProfile.rating >= 2000)
                count_stmt = count_stmt.where(MemberProfile.rating >= 2000)
            elif tier == "4_star":
                stmt = stmt.where((MemberProfile.rating >= 1800) & (MemberProfile.rating < 2000))
                count_stmt = count_stmt.where((MemberProfile.rating >= 1800) & (MemberProfile.rating < 2000))
            elif tier == "3_star":
                stmt = stmt.where((MemberProfile.rating >= 1600) & (MemberProfile.rating < 1800))
                count_stmt = count_stmt.where((MemberProfile.rating >= 1600) & (MemberProfile.rating < 1800))
            elif tier == "2_star":
                stmt = stmt.where((MemberProfile.rating >= 1400) & (MemberProfile.rating < 1600))
                count_stmt = count_stmt.where((MemberProfile.rating >= 1400) & (MemberProfile.rating < 1600))
            elif tier == "1_star":
                stmt = stmt.where(MemberProfile.rating < 1400)
                count_stmt = count_stmt.where(MemberProfile.rating < 1400)

        total_count = await db.scalar(count_stmt) or 0

        stmt = (
            stmt.order_by(MemberProfile.rating.desc(), MemberProfile.peak_rating.desc(), MemberProfile.id.asc())
            .limit(safe_limit)
            .offset(safe_offset)
        )
        result = await db.execute(stmt)
        members = result.scalars().all()

        page_member_ids = [m.id for m in members]
        history_by_member: Dict[str, List[int]] = {}
        latest_rating_by_member: Dict[str, int] = {}
        peak_rating_by_member: Dict[str, int] = {}
        # Live attendance count per member from ScoreboardEntry (avoids stale denormalized column)
        live_attendance_by_member: Dict[str, int] = {}
        if page_member_ids:
            histories = await chunked_in_query(
                session=db,
                model=RatingHistory,
                column=RatingHistory.member_id,
                values=page_member_ids,
                chunk_size=100,
                order_by_col=RatingHistory.contested_at.desc(),
            )
            for h in histories:
                history_by_member.setdefault(h.member_id, []).append(h.new_rating - h.old_rating)
                if h.member_id not in latest_rating_by_member:
                    latest_rating_by_member[h.member_id] = h.new_rating
                curr_peak = peak_rating_by_member.get(h.member_id, 1200)
                if h.new_rating > curr_peak:
                    peak_rating_by_member[h.member_id] = h.new_rating

            # Batch attendance count: one query, zero N+1
            sb_count_rows = await db.execute(
                select(ScoreboardEntry.member_id, func.count(ScoreboardEntry.id).label("cnt"))
                .where(ScoreboardEntry.member_id.in_(page_member_ids))
                .group_by(ScoreboardEntry.member_id)
            )
            for member_id, cnt in sb_count_rows.all():
                live_attendance_by_member[member_id] = cnt

        # Total active or concluded official contests for attendance_total denominator
        total_finished_contests = await db.scalar(
            select(func.count(OfflineContest.id)).where(OfflineContest.status.in_(["finished", "live"]))
        ) or 0

        needs_commit = False
        rows = []
        for idx, m in enumerate(members):
            current_rank = safe_offset + idx + 1

            # Sync latest verified rating from RatingHistory ledger to avoid stale profile discrepancies
            verified_rating = latest_rating_by_member.get(m.id, m.rating if m.rating is not None else 1200)
            verified_peak = max(
                m.peak_rating if m.peak_rating is not None else 1200,
                peak_rating_by_member.get(m.id, 1200),
                verified_rating
            )
            if m.rating != verified_rating or m.peak_rating != verified_peak:
                m.rating = verified_rating
                m.peak_rating = verified_peak
                needs_commit = True

            member_tier = get_rating_tier(verified_rating)

            # Use live ScoreboardEntry count; fall back to denormalized column only as last resort
            attendance_count = live_attendance_by_member.get(m.id) or m.attendance_count or 0
            attendance_total = total_finished_contests or m.attendance_total or (1 if attendance_count > 0 else 1)
            attendance_rate = (
                round((attendance_count / attendance_total) * 100, 1)
                if attendance_total > 0
                else 0.0
            )
            recent_deltas = history_by_member.get(m.id, [])[:4]

            prn_str = m.prn or ""
            masked_prn = f"{prn_str[:6]}****{prn_str[-2:]}" if len(prn_str) >= 10 else (prn_str or "—")

            m_rating = verified_rating
            sparkline = [m_rating]
            running_rating = m_rating
            for delta in recent_deltas:
                running_rating -= delta
                sparkline.append(running_rating)
            sparkline.reverse()

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
                    previous_rank=None,
                    handle=handle,
                    full_name=full_name,
                    prn=masked_prn,
                    department=dept,
                    batch=batch_val,
                    rating=m_rating,
                    peak_rating=verified_peak,
                    attendance_rate=attendance_rate,
                    attendance_count=attendance_count,
                    attendance_total=attendance_total,
                    tier=member_tier,
                    ratings=sparkline,
                    recent_deltas=recent_deltas,
                    country="IN",
                    verified=bool(m.is_onboarded),
                    is_core_member=bool(getattr(m, "is_core_member", False)),
                )
            )

        if needs_commit:
            try:
                await db.commit()
            except Exception:
                await db.rollback()

        inject_pagination_headers(response, total_count, safe_limit, safe_offset)

        rows_data = [r.model_dump() for r in rows]
        await set_cache(cache_key, {"items": rows_data, "total": total_count}, ttl_seconds=TTL_LEADERBOARD)
        response.headers["X-Cache"] = "MISS"
        response.headers["Cache-Control"] = f"public, max-age={TTL_LEADERBOARD}, stale-while-revalidate=30"
        return rows

    @staticmethod
    async def get_rating_distribution(
        response: Response,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        cache_key = "cache:leaderboard:distribution"
        cached = await get_cache(cache_key)
        if cached is not None:
            response.headers["X-Cache"] = "HIT"
            response.headers["Cache-Control"] = "public, max-age=120, stale-while-revalidate=60"
            return cached

        result = await db.execute(
            select(MemberProfile.rating).where(
                MemberProfile.is_onboarded.is_(True),
                MemberProfile.handle.isnot(None),
                ~MemberProfile.email.like("qa.%"),
                ~MemberProfile.handle.like("qa_%"),
            )
        )
        ratings = [r for (r,) in result.all() if r is not None]

        buckets = []
        for lo in range(1000, 2400, 50):
            hi = lo + 50
            count = sum(1 for r in ratings if lo <= r < hi)
            buckets.append({"min": lo, "max": hi, "count": count})

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

    @staticmethod
    async def get_department_performance(
        response: Response,
        db: AsyncSession,
    ) -> List[Dict[str, Any]]:
        cache_key = "cache:leaderboard:departments"
        cached = await get_cache(cache_key)
        if cached is not None:
            response.headers["X-Cache"] = "HIT"
            response.headers["Cache-Control"] = "public, max-age=120, stale-while-revalidate=60"
            return cached

        stmt = (
            select(
                MemberProfile.department,
                func.count(MemberProfile.id).label("total_members"),
                func.avg(MemberProfile.rating).label("avg_rating"),
                func.max(MemberProfile.rating).label("top_rating"),
            )
            .where(
                MemberProfile.is_onboarded.is_(True),
                MemberProfile.handle.isnot(None),
                ~MemberProfile.email.like("qa.%"),
                ~MemberProfile.handle.like("qa_%"),
            )
            .group_by(MemberProfile.department)
        )

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
