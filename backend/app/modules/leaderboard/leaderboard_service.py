"""
Chaos Computer Club — Medi-Caps Chapter
modules/leaderboard/leaderboard_service.py — University Leaderboard & Department Analytics Service
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cache, set_cache, single_flight
from app.models.schemas import LeaderboardRow
from app.services.rating_service import get_rating_tier
from app.lib.cache_keys import leaderboard_cache_key, TTL_LEADERBOARD
from app.lib.pagination import normalize_pagination, inject_pagination_headers
from app.modules.leaderboard.leaderboard_repository import LeaderboardRepository

logger = logging.getLogger(__name__)


class LeaderboardService:
    """Provides high-performance, cached university leaderboard views and performance histograms."""

    @staticmethod
    async def get_university_leaderboard(
        response: Response,
        department: Optional[str],
        batch: Optional[str],
        tier: Optional[str],
        limit: Optional[int],
        offset: Optional[int],
        db: AsyncSession,
        request: Optional[Any] = None,
        fresh: bool = False,
    ) -> List[LeaderboardRow]:
        safe_limit, safe_offset = normalize_pagination(limit, offset, default_limit=50, max_limit=500)
        cache_key = leaderboard_cache_key(department, batch, tier, safe_limit, safe_offset)

        is_no_cache = fresh or (
            request is not None and (
                request.headers.get("cache-control") == "no-cache" or
                request.headers.get("pragma") == "no-cache" or
                "no-cache" in (request.headers.get("cache-control") or "")
            )
        )

        if not is_no_cache:
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

        async def _fetch():
            members, total_count = await LeaderboardRepository.get_university_leaderboard_members(
                db,
                department=department,
                batch=batch,
                tier=tier,
                limit=safe_limit,
                offset=safe_offset,
            )

            page_member_ids = [m.id for m in members]
            (
                history_by_member,
                latest_rating_by_member,
                peak_rating_by_member,
                live_attendance_by_member,
            ) = await LeaderboardRepository.get_page_ratings_and_attendance(db, page_member_ids)

            total_finished_contests = await LeaderboardRepository.get_total_finished_contests(db)

            needs_commit = False
            rows = []
            for idx, m in enumerate(members):
                current_rank = safe_offset + idx + 1

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

            rows_data = [r.model_dump() for r in rows]
            res_payload = {"items": rows_data, "total": total_count}
            await set_cache(cache_key, res_payload, ttl_seconds=TTL_LEADERBOARD)
            return res_payload

        data = await single_flight.execute(cache_key, _fetch)
        total = data.get("total", len(data.get("items", [])))
        inject_pagination_headers(response, total, safe_limit, safe_offset)
        response.headers["X-Cache"] = "MISS"
        response.headers["Cache-Control"] = f"public, max-age={TTL_LEADERBOARD}, stale-while-revalidate=30"
        return [LeaderboardRow.model_validate(r) for r in data.get("items", [])]

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

        async def _fetch():
            ratings = await LeaderboardRepository.get_all_active_ratings(db)

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
            return payload

        data = await single_flight.execute(cache_key, _fetch)
        response.headers["X-Cache"] = "MISS"
        response.headers["Cache-Control"] = "public, max-age=120, stale-while-revalidate=60"
        return data

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

        async def _fetch():
            rows = await LeaderboardRepository.get_department_aggregates(db)
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
            return payload

        data = await single_flight.execute(cache_key, _fetch)
        response.headers["X-Cache"] = "MISS"
        response.headers["Cache-Control"] = "public, max-age=120, stale-while-revalidate=60"
        return data
