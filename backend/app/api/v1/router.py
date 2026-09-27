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
    jobs,
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
    jobs.router,
):
    api_router_v1.include_router(domain_router)


@api_router_v1.get("/meta", tags=["System"], summary="API surface metadata")
async def api_meta():
    return {
        "version": "v1",
        "contest_model": "pure_online_arena",
        "duration_minutes": 120,
    }
