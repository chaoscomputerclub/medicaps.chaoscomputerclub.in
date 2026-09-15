from app.middleware.contest_eligibility import ContestEligibilityMiddleware
"""
Chaos Computer Club India — Medi-Caps Chapter Backend
FastAPI Main Application Entrypoint
Inspired by Desktop/sharexpress/interleet and Desktop/sharexpress/cloud.sharexpress
"""

import os
from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.db import AsyncSessionLocal, init_db
from app.services.seed_service import seed_database
from app.services.background_tasks_service import start_background_tasks
from app.routers import admin, admin_contests, assessment, auth, contests, feed, leaderboard, passes, scoreboards, social, storage, verify
from app.api.v1.router import api_router_v1


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize database tables with zero static/mock data."""
    print(f"⚡ Starting {settings.PROJECT_NAME} (v{settings.VERSION})...")
    await init_db()
    print("✓ Database verified & initialized successfully (clean state).")

    # ── Production background tasks ──────────────────────────────────────────
    bg_tasks = start_background_tasks(AsyncSessionLocal)
    print(f"✓ Background tasks started: {[t.get_name() for t in bg_tasks]}")

    # ── Prewarm Core Docker Engine sandboxes (only when docker is active) ──────
    judge_choice = os.getenv("JUDGE_PROVIDER", "codebox").strip().lower()
    if judge_choice in {"docker", "core", "native"}:
        try:
            from app.engine.docker.pool import prewarm_containers
            prewarm_containers()
            print("✓ Core Docker sandboxes verified & prewarmed.")
        except Exception as exc:
            print(f"Notice during Docker prewarm: {exc}")
    else:
        print(f"✓ Judge engine provider '{judge_choice}' active.")

    yield

    # ── Clean shutdown ────────────────────────────────────────────────────────
    for task in bg_tasks:
        task.cancel()
        try:
            import asyncio
            await asyncio.wait_for(asyncio.shield(task), timeout=5)
        except Exception:
            pass
    print(f"🛑 Shutting down {settings.PROJECT_NAME}...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Official Backend API for Chaos Computer Club Medi-Caps Chapter. "
                "Provides offline contest management, LeetCode/CodeChef telemetry, "
                "division rating ladders, and cryptographic Trust-of-Proof verification.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
# Live Contest Eligibility Middleware (Enforces Top 30 restriction on live finals)
app.add_middleware(ContestEligibilityMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|.*\.sharexpress\.in|.*\.chaoscomputerclub\.in|.*\.shaxpress\.in)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Production Healthcheck ────────────────────────────────────────────────────
@app.get("/api/health", tags=["System"])
async def health_check():
    """
    Production readiness probe.
    Returns 200 even if Redis/judge are degraded so the load-balancer stays up —
    degraded status is surfaced in the response body for observability.
    """
    from app.core.redis import ping_redis

    redis_ok = await ping_redis()
    judge_provider = "unknown"
    judge_healthy = False
    judge_meta = {}
    try:
        from app.engine.providers.factory import get_judge_provider
        provider = get_judge_provider()
        judge_provider = provider.name
        judge_healthy = await provider.healthy()
        if hasattr(provider, "get_engine_status"):
            judge_meta = await provider.get_engine_status()
    except Exception:
        pass

    return {
        "status": "operational",
        "chapter": "Chaos Computer Club — Medi-Caps University",
        "environment": "air_gapped_offline_ready",
        "version": settings.VERSION,
        "services": {
            "redis": "ok" if redis_ok else "degraded",
            "judge_provider": judge_provider,
            "judge_healthy": judge_healthy,
            "judge_meta": judge_meta,
        },
    }


# Mount API Routers
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(contests.router, prefix=settings.API_PREFIX)
app.include_router(scoreboards.router, prefix=settings.API_PREFIX)
app.include_router(leaderboard.router, prefix=settings.API_PREFIX)
app.include_router(verify.router, prefix=settings.API_PREFIX)
app.include_router(passes.router, prefix=settings.API_PREFIX)
app.include_router(feed.router, prefix=settings.API_PREFIX)
app.include_router(assessment.router, prefix=settings.API_PREFIX)
app.include_router(social.router, prefix=settings.API_PREFIX)
app.include_router(storage.router, prefix=settings.API_PREFIX)

# Admin maintenance routes (not exposed publicly in prod; protect via network policy)
app.include_router(admin.router, prefix=settings.API_PREFIX)
app.include_router(admin_contests.router, prefix=settings.API_PREFIX)

# Versioned surface — preferred for all new clients (/api/v1/).
app.include_router(api_router_v1, prefix=f"{settings.API_PREFIX}/v1")


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
