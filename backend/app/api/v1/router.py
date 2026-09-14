"""
Versioned API surface (/api/v1).

Every domain router is aggregated here exactly once, so mounting a new API
version — or deprecating an old one — is a single-file change. The legacy
unversioned prefix stays mounted in main.py for already deployed clients.
"""

from fastapi import APIRouter

from app.routers import (
    assessment,
    auth,
    contests,
    feed,
    leaderboard,
    passes,
    scoreboards,
    social,
    storage,
    verify,
)

api_router_v1 = APIRouter()

for domain_router in (
    auth.router,
    contests.router,
    assessment.router,
    scoreboards.router,
    leaderboard.router,
    passes.router,
    verify.router,
    feed.router,
    social.router,
    storage.router,
):
    api_router_v1.include_router(domain_router)


@api_router_v1.get("/meta", tags=["System"], summary="API surface metadata")
async def api_meta():
    from app.services.contest_lifecycle_service import (
        ASSESSMENT_DURATION_MINUTES,
        ASSESSMENT_WINDOW_HOURS,
        FINALIST_SEATS,
    )

    return {
        "version": "v1",
        "contest_model": "two_round_funnel",
        "assessment_window_hours": ASSESSMENT_WINDOW_HOURS,
        "assessment_duration_minutes": ASSESSMENT_DURATION_MINUTES,
        "finalist_seats": FINALIST_SEATS,
    }
