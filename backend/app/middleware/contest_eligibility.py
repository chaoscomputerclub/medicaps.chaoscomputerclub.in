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

        # Only inspect API routes targeting specific contest resources
        # e.g. /api/contests/{slug}, /api/assessment/{slug}, /api/scoreboards/{slug}
        slug: Optional[str] = None

        if path.startswith("/api/contests/"):
            parts = path[len("/api/contests/"):].strip("/").split("/")
            first_segment = parts[0] if parts else None
            # Exclude non-slug sub-routes
            if first_segment and first_segment not in ["my"]:
                slug = first_segment
        elif path.startswith("/api/assessment/"):
            parts = path[len("/api/assessment/"):].strip("/").split("/")
            first_segment = parts[0] if parts else None
            if first_segment and first_segment not in ["run", "submit", "telemetry"]:
                slug = first_segment
        elif path.startswith("/api/scoreboards/"):
            parts = path[len("/api/scoreboards/"):].strip("/").split("/")
            first_segment = parts[0] if parts else None
            if first_segment:
                slug = first_segment

        # If this request is targeting a specific slug, check if that contest is LIVE
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
                                    "detail": "Access restricted: Live contest is strictly restricted to Top 30 qualified cadets. Please sign in with an eligible account.",
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
                        require_checked_in = (
                            "/arena" in path
                            or path.endswith("/problems")
                            or path.startswith("/api/assessment/")
                        )
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
