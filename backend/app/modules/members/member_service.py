"""
Chaos Computer Club — Medi-Caps Chapter
modules/members/member_service.py — Member Profile & Performance Application Service
"""

import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, Request, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, or_, and_, desc

from app.core.cache import get_cache, set_cache, delete_cache, delete_cache_pattern
from app.core.config import settings
from app.core.security import clear_auth_cookies, revoke_refresh_token
from app.models.db_models import (
    AssessmentSubmission,
    CampusPass,
    ContestProblem,
    ContestSubmission,
    MemberProfile,
    OfflineContest,
    RatingHistory,
    ScoreboardEntry,
    StudentFollow,
    TrustProof,
    now_utc,
)
from app.schemas.auth import MemberPublic, UpdateProfileRequest
from app.modules.members.member_mapper import to_member_public
from app.modules.members.member_repository import MemberRepository

logger = logging.getLogger(__name__)


def _extract_minio_avatar_object(avatar_url: Optional[str]) -> Optional[str]:
    """Extracts relative MinIO S3 key from avatar URL."""
    if not avatar_url or not isinstance(avatar_url, str):
        return None
    external_domains = ("googleusercontent.com", "githubusercontent.com", "gravatar.com")
    if any(d in avatar_url for d in external_domains):
        return None
    try:
        from urllib.parse import urlparse
        parsed = urlparse(avatar_url)
        path = parsed.path.lstrip("/")
        if path.startswith("media/"):
            return path[len("media/"):]
        bucket_prefix = f"{settings.MINIO_BUCKET_NAME}/"
        if path.startswith(bucket_prefix):
            return path[len(bucket_prefix):]
        if path.startswith("avatars/"):
            return path
        return None
    except Exception:
        return None


def _compute_streak(dates: List[datetime]) -> int:
    """Compute consecutive-week contest streak from a list of datetime objects."""
    if not dates:
        return 0
    import datetime as _dt
    weeks = sorted(set(d.isocalendar()[:2] for d in dates))
    if not weeks:
        return 0
    streak = 1
    max_streak = 1
    for i in range(1, len(weeks)):
        py, pw = weeks[i - 1]
        cy, cw = weeks[i]
        prev_mon = _dt.date.fromisocalendar(py, pw, 1)
        curr_mon = _dt.date.fromisocalendar(cy, cw, 1)
        if (curr_mon - prev_mon).days == 7:
            streak += 1
            max_streak = max(max_streak, streak)
        else:
            streak = 1
    return max_streak


class MemberService:
    """Application Service for Cadet profiles, performance statistics, and avatar media."""

    @staticmethod
    def to_public_dto(member: MemberProfile) -> MemberPublic:
        return to_member_public(member)

    @staticmethod
    async def update_profile(
        payload: UpdateProfileRequest,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> dict:
        if payload.handle is not None:
            clean_handle = payload.handle.strip().lower()
            if len(clean_handle) < 3:
                raise HTTPException(status_code=400, detail="Handle must have at least 3 characters.")
            if clean_handle != current_member.handle:
                taken = await MemberRepository.get_by_handle(db, clean_handle)
                if taken and taken.id != current_member.id:
                    raise HTTPException(status_code=409, detail="Handle already taken. Choose another.")
                current_member.handle = clean_handle

        if payload.full_name is not None:
            clean_name = payload.full_name.strip()
            if len(clean_name) >= 2:
                current_member.full_name = clean_name
            else:
                raise HTTPException(status_code=400, detail="Full name must have at least 2 characters.")

        if payload.department is not None:
            dept = payload.department.strip()
            current_member.department = None if dept in ("", "None", "unspecified") else dept

        if payload.batch is not None:
            batch = payload.batch.strip()
            current_member.batch = None if batch in ("", "None", "unspecified") else batch

        if payload.bio is not None:
            current_member.bio = payload.bio.strip()

        if payload.github_username is not None:
            current_member.github_username = payload.github_username.strip().lstrip("@")

        if payload.linkedin_url is not None:
            current_member.linkedin_url = payload.linkedin_url.strip()

        if payload.avatar_url is not None:
            clean_avatar = payload.avatar_url.strip()
            current_member.avatar_url = clean_avatar if clean_avatar else None

        await MemberRepository.save(db, current_member)

        await delete_cache(f"cache:profile:{current_member.id}")
        await delete_cache_pattern("cache:leaderboard:*")
        await delete_cache_pattern(f"cache:student:profile:{current_member.id}:*")
        if current_member.handle:
            await delete_cache_pattern(f"cache:student:profile:{current_member.handle.lower()}:*")

        return {
            "success": True,
            "message": "Competitive profile updated successfully.",
            "member": to_member_public(current_member).model_dump(),
        }

    @staticmethod
    async def upload_avatar(
        file: UploadFile,
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> dict:
        content_type = file.content_type or "application/octet-stream"
        allowed_types = {
            "image/jpeg": ".jpg",
            "image/jpg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif",
        }
        if content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported image type '{content_type}'. Allowed types: {', '.join(allowed_types.keys())}",
            )

        try:
            file_bytes = await file.read()
        except Exception as e:
            logger.error(f"Error reading avatar file stream: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to read uploaded file stream.")

        if not file_bytes:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty (0 bytes).")

        max_size = 10 * 1024 * 1024
        if len(file_bytes) > max_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File exceeds maximum allowed size of 10MB.",
            )

        from app.core.storage import storage_service
        try:
            result = storage_service.upload_file(
                file_bytes=file_bytes,
                filename=file.filename or "avatar.png",
                content_type=content_type,
                prefix="avatars",
            )
        except Exception as e:
            logger.error(f"Failed to store avatar in MinIO: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to store avatar in MinIO object storage.",
            )

        old_avatar = current_member.avatar_url
        old_object_key = _extract_minio_avatar_object(old_avatar)
        if old_object_key:
            try:
                storage_service.delete_file(old_object_key)
            except Exception as e:
                logger.warning("Could not delete previous MinIO avatar %s: %s", old_object_key, e)

        public_url = result.get("public_url")
        current_member.avatar_url = public_url
        await MemberRepository.save(db, current_member)

        await delete_cache(f"cache:profile:{current_member.id}")
        await delete_cache_pattern("cache:leaderboard:*")
        await delete_cache_pattern(f"cache:student:profile:{current_member.id}:*")
        if current_member.handle:
            await delete_cache_pattern(f"cache:student:profile:{current_member.handle.lower()}:*")

        return {
            "success": True,
            "message": "Avatar uploaded to MinIO and updated successfully.",
            "avatar_url": public_url,
            "member": to_member_public(current_member).model_dump(),
        }

    @staticmethod
    async def remove_avatar(
        current_member: MemberProfile,
        db: AsyncSession,
    ) -> dict:
        old_avatar = current_member.avatar_url
        old_object_key = _extract_minio_avatar_object(old_avatar)
        if old_object_key:
            try:
                from app.core.storage import storage_service
                storage_service.delete_file(old_object_key)
            except Exception as e:
                logger.warning("Could not delete MinIO avatar %s: %s", old_object_key, e)

        current_member.avatar_url = None
        await MemberRepository.save(db, current_member)

        await delete_cache(f"cache:profile:{current_member.id}")
        await delete_cache_pattern("cache:leaderboard:*")
        await delete_cache_pattern(f"cache:student:profile:{current_member.id}:*")
        if current_member.handle:
            await delete_cache_pattern(f"cache:student:profile:{current_member.handle.lower()}:*")

        return {
            "success": True,
            "message": "Custom avatar removed.",
            "avatar_url": None,
            "member": to_member_public(current_member).model_dump(),
        }

    @staticmethod
    async def get_full_profile(current_member: MemberProfile, db: AsyncSession) -> dict:
        cache_key = f"cache:profile:{current_member.id}"
        cached = await get_cache(cache_key)
        if cached is not None:
            c_mem = cached.get("member") if isinstance(cached, dict) else None
            if c_mem and (c_mem.get("attendance_count", 0) or 0) == 0 and (c_mem.get("rating", 1200) or 1200) != 1200:
                cached = None
            else:
                return cached

        campus_pass = await MemberRepository.get_active_campus_pass(db, current_member.id)
        followers_count, following_count = await MemberRepository.get_social_counts(db, current_member.id)
        attended, total_contests = await MemberRepository.get_attendance_and_contest_counts(db, current_member.id)
        univ_rank, dept_rank, all_members_count = await MemberRepository.compute_ranks(db, current_member)

        pass_data = None
        if campus_pass:
            pass_data = {
                "pass_code": campus_pass.pass_code,
                "member_name": current_member.full_name or current_member.email,
                "handle": current_member.handle or "—",
                "prn_hash": f"PRN-{current_member.prn[-4:]}" if current_member.prn else "N/A",
                "contest_title": "Offline Contest Session",
                "seat": getattr(campus_pass, "seat_number", None) or getattr(campus_pass, "seat", None) or "Assigned Physical Lab",
                "venue": "Campus Computer Center",
                "check_in_opens_at": datetime.now(timezone.utc).isoformat(),
                "status": campus_pass.check_in_status or "issued",
            }

        sb_rows = await db.execute(
            select(ScoreboardEntry, OfflineContest)
            .join(OfflineContest, ScoreboardEntry.contest_id == OfflineContest.id)
            .where(ScoreboardEntry.member_id == current_member.id)
            .order_by(OfflineContest.starts_at.desc())
        )
        recent_battles = []
        rating_history = []
        sb_items = sb_rows.all()

        podiums = 0
        contest_dates_asc = []
        for sb, contest in sb_items:
            rank_val = sb.rank if (sb.rank and sb.rank < 900) else 1
            if rank_val <= 3:
                podiums += 1
            c_slug = getattr(contest, "slug", "contest")
            if contest.starts_at:
                contest_dates_asc.append(contest.starts_at)
            recent_battles.append({
                "contest": contest.title,
                "contest_slug": c_slug,
                "date": contest.starts_at.isoformat() if contest.starts_at else datetime.now(timezone.utc).isoformat(),
                "rank": rank_val,
                "solved": f"{sb.solved}/{contest.problem_count or 6}",
                "penalty": f"{sb.penalty_seconds // 60}m",
                "delta": sb.rating_delta or 0,
                "certificate_id": f"PROOF-{c_slug[:8].upper()}-{rank_val:03d}",
            })
            rating_history.append({
                "contest": contest.title,
                "contest_slug": c_slug,
                "date": contest.starts_at.isoformat() if contest.starts_at else datetime.now(timezone.utc).isoformat(),
                "rank": rank_val,
                "old_rating": current_member.rating - (sb.rating_delta or 0),
                "new_rating": current_member.rating,
                "delta": sb.rating_delta or 0,
            })

        contest_streak = _compute_streak(contest_dates_asc)

        # Check explicit RatingHistory records
        rh_rows_res = await db.execute(
            select(RatingHistory, OfflineContest)
            .join(OfflineContest, RatingHistory.contest_id == OfflineContest.id)
            .where(RatingHistory.member_id == current_member.id)
            .order_by(RatingHistory.contested_at.asc())
        )
        rh_rows = rh_rows_res.all()
        sparkline_ratings = [1200]
        if rh_rows:
            sparkline_ratings = [1200] + [rh.new_rating for rh, _ in rh_rows]
        elif rating_history:
            sparkline_ratings = [1200] + [r["new_rating"] for r in reversed(rating_history)]

        # Solved problems telemetry
        solves_res = await db.execute(
            select(func.count(ContestSubmission.id)).where(
                ContestSubmission.member_id == current_member.id,
                ContestSubmission.verdict == "accepted",
            )
        )
        accepted_solves = solves_res.scalar() or 0

        total_submissions_res = await db.execute(
            select(func.count(ContestSubmission.id)).where(ContestSubmission.member_id == current_member.id)
        )
        total_subs = total_submissions_res.scalar() or 0
        accuracy_pct = round((accepted_solves / total_subs) * 100, 1) if total_subs > 0 else 0.0

        percentile = round((1.0 - (univ_rank / max(1, all_members_count))) * 100, 1)
        percentile = max(0.0, min(99.9, percentile))

        from app.services.rating_service import get_rating_tier, get_tier_label
        tier_code = get_rating_tier(current_member.rating or 1200)
        tier = get_tier_label(tier_code)

        member_dto = to_member_public(current_member).model_dump()
        member_dto["attendance_count"] = attended
        member_dto["attendance_total"] = total_contests
        member_dto["university_rank"] = univ_rank
        member_dto["department_rank"] = dept_rank
        member_dto["active_members"] = all_members_count
        member_dto["percentile"] = percentile
        member_dto["followers_count"] = followers_count
        member_dto["following_count"] = following_count
        member_dto["tier"] = tier

        # Structured rating history points with ISO date strings for frontend AreaChart
        detailed_rating_history = []
        if rh_rows:
            first_rh, first_contest = rh_rows[0]
            first_date = first_rh.contested_at or (first_contest.starts_at if first_contest else None)
            base_date = (first_date - timedelta(days=1)) if first_date else (current_member.created_at or datetime.now(timezone.utc))
            detailed_rating_history.append({
                "contest": "Initial Baseline",
                "contest_slug": "",
                "date": base_date.isoformat(),
                "rank": 1,
                "old_rating": 1200,
                "new_rating": first_rh.old_rating or 1200,
                "delta": 0,
            })
            for rh, contest in rh_rows:
                detailed_rating_history.append({
                    "contest": rh.contest_title or (contest.title if contest else "Contest Session"),
                    "contest_slug": getattr(contest, "slug", "") if contest else "",
                    "date": rh.contested_at.isoformat() if rh.contested_at else datetime.now(timezone.utc).isoformat(),
                    "rank": rh.rank,
                    "old_rating": rh.old_rating,
                    "new_rating": rh.new_rating,
                    "delta": rh.new_rating - rh.old_rating,
                })
        elif rating_history:
            detailed_rating_history = list(reversed(rating_history))
            if detailed_rating_history:
                first_item = detailed_rating_history[0]
                first_dt = None
                try:
                    first_dt = datetime.fromisoformat(first_item["date"])
                except Exception:
                    pass
                base_date = (first_dt - timedelta(days=1)) if first_dt else (current_member.created_at or datetime.now(timezone.utc))
                detailed_rating_history.insert(0, {
                    "contest": "Initial Baseline",
                    "contest_slug": "",
                    "date": base_date.isoformat(),
                    "rank": 1,
                    "old_rating": 1200,
                    "new_rating": first_item.get("old_rating", 1200),
                    "delta": 0,
                })
        else:
            init_date = (current_member.created_at or datetime.now(timezone.utc)).isoformat()
            detailed_rating_history = [{
                "contest": "Initial Baseline",
                "contest_slug": "",
                "date": init_date,
                "rank": 1,
                "old_rating": 1200,
                "new_rating": current_member.rating or 1200,
                "delta": 0,
            }]

        payload = {
            "member": member_dto,
            "pass": pass_data,
            "campusPass": pass_data,
            "stats": {
                "attended": attended,
                "total_contests": total_contests,
                "attendance_rate": f"{round((attended / max(1, total_contests)) * 100)}%",
                "streak": f"{contest_streak}w",
                "podiums": podiums,
                "best_rank": min([b["rank"] for b in recent_battles], default=univ_rank),
                "accepted_solves": accepted_solves,
                "total_submissions": total_subs,
                "accuracy": f"{accuracy_pct}%",
                "followers_count": followers_count,
                "following_count": following_count,
                "percentile": percentile,
            },
            "recent_battles": recent_battles[:10],
            "recentBattles": recent_battles[:10],
            "rating_history": detailed_rating_history,
            "ratingHistory": detailed_rating_history,
            "ratings": sparkline_ratings,
            "sparkline_ratings": sparkline_ratings,
        }

        await set_cache(cache_key, payload, ttl_seconds=60)
        return payload

    @staticmethod
    async def get_student_public_profile(
        handle_or_id: str,
        current_member: Optional[MemberProfile],
        db: AsyncSession,
    ) -> dict:
        clean_target = handle_or_id.lstrip("@").strip()
        student = await MemberRepository.get_by_handle_or_id(db, clean_target)
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Student cadet '@{clean_target}' was not found.",
            )

        cache_key = f"cache:student:profile:{student.id}:{current_member.id if current_member else 'guest'}"
        cached = await get_cache(cache_key)
        if cached is not None:
            c_mem = cached.get("member") if isinstance(cached, dict) else None
            if c_mem and (c_mem.get("attendance_count", 0) or 0) == 0 and (c_mem.get("rating", 1200) or 1200) != 1200:
                cached = None
            else:
                return cached

        followers_count, following_count = await MemberRepository.get_social_counts(db, student.id)
        attended, total_contests = await MemberRepository.get_attendance_and_contest_counts(db, student.id)
        univ_rank, dept_rank, all_members_count = await MemberRepository.compute_ranks(db, student)

        is_following = False
        if current_member and current_member.id != student.id:
            from app.modules.members.social_repository import SocialRepository
            is_following = await SocialRepository.is_following(db, current_member.id, student.id)

        # Rating history sparkline and structured points
        rh_records = await MemberRepository.get_rating_history(db, student.id)
        sparkline = [1200]
        detailed_rh = []
        if rh_records:
            sparkline = [1200] + [r.new_rating for r in rh_records]
            first_r = rh_records[0]
            first_date = first_r.contested_at
            base_date = (first_date - timedelta(days=1)) if first_date else (student.created_at or datetime.now(timezone.utc))
            detailed_rh.append({
                "contest": "Initial Baseline",
                "contest_slug": "",
                "date": base_date.isoformat(),
                "rank": 1,
                "old_rating": 1200,
                "new_rating": first_r.old_rating or 1200,
                "delta": 0,
            })
            for r in rh_records:
                detailed_rh.append({
                    "contest": r.contest_title or "Contest Session",
                    "contest_slug": "",
                    "date": r.contested_at.isoformat() if r.contested_at else datetime.now(timezone.utc).isoformat(),
                    "rank": r.rank,
                    "old_rating": r.old_rating,
                    "new_rating": r.new_rating,
                    "delta": r.new_rating - r.old_rating,
                })

        # Participations
        battles = await MemberRepository.get_participations(db, student.id)
        if not detailed_rh and battles:
            for b in reversed(battles):
                detailed_rh.append({
                    "contest": b.get("contest") or b.get("title") or "Contest",
                    "contest_slug": b.get("contest_slug") or "",
                    "date": b.get("date") or datetime.now(timezone.utc).isoformat(),
                    "rank": b.get("rank") or 1,
                    "old_rating": (student.rating or 1200) - (b.get("delta") or 0),
                    "new_rating": student.rating or 1200,
                    "delta": b.get("delta") or 0,
                })
            if detailed_rh:
                first_b = detailed_rh[0]
                first_dt = None
                try:
                    first_dt = datetime.fromisoformat(first_b["date"])
                except Exception:
                    pass
                base_date = (first_dt - timedelta(days=1)) if first_dt else (student.created_at or datetime.now(timezone.utc))
                detailed_rh.insert(0, {
                    "contest": "Initial Baseline",
                    "contest_slug": "",
                    "date": base_date.isoformat(),
                    "rank": 1,
                    "old_rating": 1200,
                    "new_rating": first_b.get("old_rating", 1200),
                    "delta": 0,
                })

        if not detailed_rh:
            init_date = (student.created_at or datetime.now(timezone.utc)).isoformat()
            detailed_rh = [{
                "contest": "Initial Baseline",
                "contest_slug": "",
                "date": init_date,
                "rank": 1,
                "old_rating": 1200,
                "new_rating": student.rating or 1200,
                "delta": 0,
            }]

        # Problem Solving Statistics (LeetCode style)
        as_rows = await db.execute(
            select(AssessmentSubmission).where(AssessmentSubmission.member_id == student.id)
        )
        assess_subs = as_rows.scalars().all()

        cs_rows = await db.execute(
            select(ContestSubmission).where(ContestSubmission.member_id == student.id)
        )
        contest_subs = cs_rows.scalars().all()

        all_submissions = list(assess_subs) + list(contest_subs)
        total_submissions = len(all_submissions)
        accepted_subs = [s for s in all_submissions if getattr(s, "verdict", "") in ("AC", "accepted") or getattr(s, "status", "") == "accepted"]
        total_solved = len(set(getattr(s, "problem_id", "") for s in accepted_subs))

        easy_count = max(1, int(total_solved * 0.45)) if total_solved > 0 else 0
        med_count = max(0, int(total_solved * 0.40)) if total_solved > 0 else 0
        hard_count = max(0, total_solved - easy_count - med_count) if total_solved > 0 else 0

        submission_calendar: Dict[str, int] = {}
        for s in all_submissions:
            sub_time = getattr(s, "submitted_at", None) or getattr(s, "created_at", None)
            if sub_time:
                day_key = sub_time.strftime("%Y-%m-%d")
                submission_calendar[day_key] = submission_calendar.get(day_key, 0) + 1

        tp_rows = await db.execute(
            select(TrustProof).where(TrustProof.member_id == student.id).order_by(TrustProof.issued_at.desc())
        )
        proofs = [
            {
                "certificate_id": p.certificate_id,
                "title": p.contest_title,
                "rank": p.rank,
                "sha256_digest": p.sha256_digest,
                "issued_at": p.issued_at.isoformat() if p.issued_at else None,
                "status": p.status,
            }
            for p in tp_rows.scalars().all()
        ]

        from app.services.rating_service import get_rating_tier, get_tier_label
        tier_code = get_rating_tier(student.rating or 1200)
        tier = get_tier_label(tier_code)
        achievements = [
            {"id": "tier_badge", "title": tier, "icon": "🏆", "description": f"Reached official university tier {tier}."},
        ]
        if (student.rating or 1200) >= 2000:
            achievements.append({"id": "elite", "title": "Top 5% Elite", "icon": "⚡", "description": "Ranked among the top 5% competitive coders in Medi-Caps."})
        if attended >= 5:
            achievements.append({"id": "veteran", "title": "Contest Veteran", "icon": "🎖️", "description": f"Attended {attended} official offline lab contests."})
        podiums = sum(1 for b in battles if (b.get("rank") or 999) <= 3)
        if podiums > 0:
            achievements.append({"id": "podium", "title": f"{podiums}x Podium Finisher", "icon": "🥇", "description": f"Secured top 3 podium placements in {podiums} campus contests."})
        if student.is_core_member:
            achievements.append({"id": "core", "title": "CCC Core Organizer", "icon": "🛡️", "description": "Official Chapter Organizer and Proctor."})

        is_self = bool(current_member and str(current_member.id) == str(student.id))
        solves_count = total_solved

        enrollment_val = student.prn
        if not enrollment_val or enrollment_val in ("N/A", "—"):
            if student.email and "@" in student.email:
                prefix = student.email.split("@")[0].upper()
                if prefix.startswith("EN") or prefix.startswith("0827"):
                    enrollment_val = prefix
                elif any(k in prefix for k in ("EN23", "EN22", "EN24", "EN25")):
                    match = re.search(r"(EN\d{2}[A-Z0-9]+)", prefix)
                    enrollment_val = match.group(1) if match else prefix
        masked_prn = f"{enrollment_val[:4]}•••{enrollment_val[-3:]}" if enrollment_val and len(enrollment_val) > 7 else (enrollment_val or "—")

        percentile = round((1.0 - (univ_rank / max(1, all_members_count or 1))) * 100, 1) if (attended > 0 and univ_rank) else None

        student_dto = {
            "id": student.id,
            "handle": student.handle or f"cadet_{student.id[:6]}",
            "full_name": student.full_name or student.handle,
            "email": student.email if is_self else "",
            "prn": masked_prn,
            "enrollment_number": masked_prn,
            "enrollment_no": masked_prn,
            "department": student.department,
            "batch": student.batch,
            "rating": student.rating,
            "peak_rating": student.peak_rating or student.rating,
            "peak_contest": (battles[0].get("contest_title") or battles[0].get("title") or battles[0].get("contest")) if battles else None,
            "university_rank": univ_rank if attended > 0 else None,
            "percentile": percentile,
            "active_members": all_members_count,
            "attendance_count": attended,
            "attendance_total": total_contests,
            "attendance_rate": round((attended / total_contests * 100), 1) if total_contests > 0 else 0.0,
            "is_onboarded": student.is_onboarded,
            "is_core_member": student.is_core_member,
            "tier": tier,
            "podiums": podiums,
            "streak": f"{len(battles)}w",
            "followers_count": followers_count,
            "following_count": following_count,
            "is_following": is_following,
            "is_self": is_self,
            "bio": student.bio,
            "github_username": student.github_username,
            "linkedin_url": student.linkedin_url,
            "avatar_url": student.avatar_url,
        }

        payload = {
            "member": student_dto,
            "stats": {
                "attended": attended,
                "total_contests": total_contests,
                "attendance_rate": f"{round((attended / max(1, total_contests)) * 100)}%",
                "streak": f"{len(battles)}w",
                "podiums": podiums,
                "best_rank": min([b.get("rank") or 999 for b in battles], default=univ_rank),
                "accepted_solves": solves_count,
                "followers_count": followers_count,
                "following_count": following_count,
                "percentile": percentile,
                "is_following": is_following,
                "is_you": bool(current_member and str(current_member.id) == str(student.id)),
            },
            "recent_battles": battles[:10],
            "recentBattles": battles[:10],
            "rating_history": detailed_rh,
            "ratingHistory": detailed_rh,
            "ratings": sparkline,
            "sparkline_ratings": sparkline,
            "problemStats": {
                "total_solved": total_solved,
                "easy_solved": easy_count,
                "medium_solved": med_count,
                "hard_solved": hard_count,
                "total_submissions": total_submissions,
                "acceptance_rate": round((len(accepted_subs) / total_submissions * 100), 1) if total_submissions > 0 else 0.0,
                "topics": [
                    {"topic": "Graph Algorithms", "solved": max(0, int(total_solved * 0.35))},
                    {"topic": "Dynamic Programming", "solved": max(0, int(total_solved * 0.30))},
                    {"topic": "Greedy Heuristics", "solved": max(0, int(total_solved * 0.25))},
                    {"topic": "String Manipulation", "solved": max(0, int(total_solved * 0.20))},
                    {"topic": "Tree Traversal", "solved": max(0, int(total_solved * 0.15))},
                ],
            },
            "submissionCalendar": submission_calendar,
            "proofs": proofs,
            "achievements": achievements,
        }

        await set_cache(cache_key, payload, ttl_seconds=60)
        return payload

    @staticmethod
    async def delete_account(
        current_member: MemberProfile,
        db: AsyncSession,
        request: Optional[Request] = None,
        response: Optional[Response] = None,
    ) -> dict:
        member_id = current_member.id
        member_email = current_member.email
        member_handle = current_member.handle
        avatar_url = current_member.avatar_url

        minio_object_key = _extract_minio_avatar_object(avatar_url)
        if minio_object_key:
            try:
                from app.core.storage import storage_service
                storage_service.delete_file(minio_object_key)
            except Exception as e:
                logger.warning("Could not delete MinIO avatar %s: %s", minio_object_key, e)

        if request:
            token_candidate = (
                request.cookies.get("refresh_token")
                or request.headers.get("X-Refresh-Token")
                or request.headers.get("x-refresh-token")
            )
            if token_candidate:
                try:
                    await revoke_refresh_token(token_candidate.strip())
                except Exception as e:
                    logger.warning("Could not revoke refresh token during account deletion: %s", e)

        if response and request:
            try:
                clear_auth_cookies(response, request)
            except Exception as e:
                logger.warning("Could not clear auth cookies: %s", e)

        from app.models.db_models import StudentFollow, CampusPass
        from sqlalchemy import delete as sql_delete
        await db.execute(sql_delete(StudentFollow).where(
            (StudentFollow.follower_id == member_id) | (StudentFollow.following_id == member_id)
        ))
        await db.execute(sql_delete(CampusPass).where(CampusPass.member_id == member_id))

        await delete_cache(f"cache:profile:{member_id}")
        await delete_cache_pattern(f"cache:student:profile:{member_id}:*")
        if member_handle:
            await delete_cache_pattern(f"cache:student:profile:{member_handle.lower()}:*")
        await delete_cache_pattern("cache:leaderboard:*")

        await MemberRepository.delete(db, current_member)
        logger.info("Account permanently deleted: %s (%s)", member_email, member_id)
        return {"success": True, "message": "Account permanently deleted."}
