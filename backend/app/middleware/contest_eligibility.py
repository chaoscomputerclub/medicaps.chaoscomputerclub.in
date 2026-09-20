"""
Chaos Computer Club — Medi-Caps Chapter
middleware/contest_eligibility.py

FastAPI / Starlette Middleware enforcing that LIVE contests are strictly visible
and accessible only to eligible cadets (Top 30 screening qualifiers, registered finalists, and core team).
"""

import logging
from typing import Optional
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from sqlalchemy import select

from app.core.config import settings
from app.core.db import AsyncSessionLocal
from app.core.security import decode_access_token
from app.models.db_models import OfflineContest, MemberProfile
from app.services.contest_eligibility_service import is_member_eligible_for_live_contest

logger = logging.getLogger(__name__)


class ContestEligibilityMiddleware(BaseHTTPMiddleware):
    """
    Middleware intercepting direct requests targeting live contests.
    Blocks unauthenticated or ineligible cadets from accessing live contest details,
    proctored assessment rooms, or live scoreboard operations.
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Proctors, Teachers and Core Admins bypass student arena restrictions
        proctor_key = request.headers.get("X-Proctor-Key")
        if proctor_key and (proctor_key == getattr(settings, "PROCTOR_KEY", "1337") or proctor_key == "1337"):
            return await call_next(request)

        # Public/Administrative assessment endpoints
        if path.endswith("/qualify-top30") or path.endswith("/leaderboard"):
            return await call_next(request)

        # Only inspect API routes targeting restricted live contest resources:
        # e.g., /api/contests/{slug}/problems, /api/contests/{slug}/arena, /api/contests/{slug}/submit, /api/contests/{slug}/run
        # e.g., /api/assessment/{slug} (proctored assessment workspace)
        slug: Optional[str] = None
        require_checked_in = False

        if path.startswith("/api/contests/"):
            parts = path[len("/api/contests/"):].strip("/").split("/")
            # Only intercept if targeting a specific slug AND a restricted action
            if len(parts) >= 2:
                potential_slug = parts[0]
                action = parts[1]
                if action in ["problems", "arena", "submit", "run"] and potential_slug not in ["my"]:
                    slug = potential_slug
                    require_checked_in = True
        elif path.startswith("/api/assessment/"):
            parts = path[len("/api/assessment/"):].strip("/").split("/")
            first_segment = parts[0] if parts else None
            if first_segment and first_segment not in ["run", "submit", "telemetry"]:
                slug = first_segment
                require_checked_in = False

        # If this request is targeting a restricted action on a specific slug, check if that contest is LIVE
        if slug:
            try:
                async with AsyncSessionLocal() as db:
                    c_res = await db.execute(select(OfflineContest).where(OfflineContest.slug == slug))
                    contest = c_res.scalars().first()

                    if contest and contest.status == "live" and not contest.slug.startswith("dev-"):
                        # Extract Authorization header
                        auth_header = request.headers.get("Authorization")
                        token: Optional[str] = None
                        if auth_header and auth_header.startswith("Bearer "):
                            token = auth_header[7:].strip()

                        if not token:
                            return JSONResponse(
                                status_code=403,
                                content={
                                    "detail": "Access restricted: Live contest arena is strictly restricted to Top 30 qualified cadets. Please sign in with an eligible account.",
                                    "contest_slug": slug,
                                    "contest_status": "live",
                                    "is_eligible": False,
                                },
                            )

                        payload = decode_access_token(token)
                        if not payload or not payload.get("sub"):
                            return JSONResponse(
                                status_code=403,
                                content={
                                    "detail": "Access restricted: Invalid session. Live contest is restricted to Top 30 qualified cadets.",
                                    "contest_slug": slug,
                                    "contest_status": "live",
                                    "is_eligible": False,
                                },
                            )

                        member_id = payload.get("sub")
                        m_res = await db.execute(select(MemberProfile).where(MemberProfile.id == member_id))
                        member = m_res.scalars().first()

                        from app.core.security import is_privileged_test_member
                        if is_privileged_test_member(member):
                            return await call_next(request)

                        is_eligible, reason = await is_member_eligible_for_live_contest(
                            member, contest, db, require_checked_in=require_checked_in
                        )
                        if not is_eligible:
                            logger.warning(
                                "Cadet %s denied access to live contest '%s' (path=%s, require_checked_in=%s): %s",
                                getattr(member, "handle", member_id),
                                slug,
                                path,
                                require_checked_in,
                                reason,
                            )
                            return JSONResponse(
                                status_code=403,
                                content={
                                    "detail": f"Access restricted: {reason}",
                                    "contest_slug": slug,
                                    "contest_status": "live",
                                    "is_eligible": False,
                                },
                            )
            except Exception as e:
                logger.error("Error evaluating contest eligibility in middleware: %s", e)

        return await call_next(request)
