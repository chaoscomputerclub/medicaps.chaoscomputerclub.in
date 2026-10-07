from app.middleware.contest_eligibility import ContestEligibilityMiddleware
from app.middleware.cloudflare_security import CloudflareSecurityMiddleware
from app.middleware.trace_id import TraceIdMiddleware
"""
Chaos Computer Club India — Medi-Caps Chapter Backend
FastAPI Main Application Entrypoint
Inspired by Desktop/sharexpress/interleet and Desktop/sharexpress/cloud.sharexpress
"""

import asyncio
import os
import logging
from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse
from app.core.config import settings
from app.core.origins import get_allowed_production_origins, validate_frontend_origin
from app.core.db import AsyncSessionLocal, init_db
from app.services.seed_service import seed_database
from app.services.background_tasks_service import start_background_tasks
from app.services.event_broadcaster import start_redis_event_relay
from app.core.queue import queue_manager
from app.routers import admin, admin_contests, admin_loadtest, admin_problems, admin_qa, assessment, auth, contests, events, fabric, feed, jobs, leaderboard, metrics, nodes, passes, peer_fabric, scoreboards, social, storage, verify, webhooks, workers
from app.api.v1.router import api_router_v1
from app.core.resource_governor import get_resource_governor



@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize database tables with zero static/mock data."""
    print(f"⚡ Starting {settings.PROJECT_NAME} (v{settings.VERSION})...")

    # ── Environment & Origin Integrity Verification ──────────────────────────
    from app.core.origins import is_localhost_origin
    if settings.ENVIRONMENT.lower() == "production":
        if is_localhost_origin(settings.FRONTEND_URL):
            print(
                f"⚠ Warning: FRONTEND_URL was configured to localhost ('{settings.FRONTEND_URL}') in production. "
                "Auto-correcting to canonical 'https://medicaps.chaoscomputerclub.in'."
            )
            settings.FRONTEND_URL = "https://medicaps.chaoscomputerclub.in"
        print(f"✓ Production environment verified: FRONTEND_URL={settings.FRONTEND_URL}")

    # ── Service Mode Topology Execution ─────────────────────────────────────
    service_mode = os.getenv("SERVICE_MODE", "all").strip().lower()
    print(f"✓ Initializing backend in mode: '{service_mode}'")

    bg_tasks = []
    realtime_relay_task = None
    queue_tasks = []
    governor = None
    autoscaler = None
    reconciliation_worker = None

    # Database schema check only on API / Worker / All
    if service_mode in ("api", "worker", "all"):
        await init_db()
        print("✓ Database verified & initialized successfully (clean state).")

    # 1. Background worker tasks (ccc-worker or monolithic dev)
    if service_mode in ("worker", "all"):
        queue_tasks = queue_manager.start_all()
        print(f"✓ Async queue workers started: {list(queue_manager.workers.keys())}")
        bg_tasks = start_background_tasks(AsyncSessionLocal)
        print(f"✓ Background tasks started: {[t.get_name() for t in bg_tasks]}")

        governor = get_resource_governor()
        governor.start()
        print("✓ ResourceGovernor started (health-sweep=30s, autoscale=10s)")

        from app.core.autoscaler import Autoscaler
        autoscaler = Autoscaler.get_instance()
        autoscaler.start()
        print("✓ Dynamic Autoscaler started (interval=10s)")

        from app.core.reconciliation import ReconciliationWorker
        reconciliation_worker = ReconciliationWorker.get_instance()
        await reconciliation_worker.start()
        print("✓ Judge Reconciliation Worker started (interval=15s)")

        # Prewarm Docker only if explicitly permitted
        judge_choice = os.getenv("JUDGE_PROVIDER", "codebox").strip().lower()
        if judge_choice in {"docker", "core", "native"}:
            try:
                from app.engine.docker.pool import prewarm_containers
                prewarm_containers()
                print("✓ Core Docker sandboxes verified & prewarmed.")
            except Exception as exc:
                print(f"Notice during Docker prewarm: {exc}")

    # 2. Realtime SSE distribution (ccc-realtime or monolithic dev)
    if service_mode in ("realtime", "all"):
        realtime_relay_task = start_redis_event_relay()
        print("✓ Realtime Redis Pub/Sub SSE relay task started.")

    # 3. P2P Service Fabric Autonomous Enrollment & Telemetry
    peer_agent = None
    try:
        from app.engine.peer_fabric.agent import PeerAgent
        peer_agent = PeerAgent.get_instance()
        await peer_agent.start()
    except Exception as e:
        print(f"Notice during P2P fabric agent initialization: {e}")

    yield

    # ── Clean shutdown ────────────────────────────────────────────────────────
    if peer_agent:
        await peer_agent.stop()
    if reconciliation_worker:
        await reconciliation_worker.stop()
    if autoscaler:
        await autoscaler.stop()
    if governor:
        await governor.stop()
    if queue_tasks:
        await queue_manager.stop_all(drain_timeout=15.0)
    tasks_to_cancel = [t for t in [*bg_tasks, realtime_relay_task] if t is not None]
    for task in tasks_to_cancel:
        task.cancel()
    if tasks_to_cancel:
        await asyncio.gather(*tasks_to_cancel, return_exceptions=True)
    print(f"🛑 Shutting down {settings.PROJECT_NAME} (mode: {service_mode})...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Official Backend API for Chaos Computer Club Medi-Caps Chapter. "
                "Provides online competitive programming contest management, "
                "LeetCode/CodeChef telemetry, division rating ladders, and cryptographic Trust-of-Proof verification.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# End-to-End Distributed Trace ID Middleware (Generates/propagates X-Request-ID)
app.add_middleware(TraceIdMiddleware)

# Cloudflare Edge & Client Security (Real IP, HSTS, COOP, Permissions, CF-Ray)
app.add_middleware(CloudflareSecurityMiddleware)

# Live Contest Eligibility Middleware (Enforces Top 30 restriction on live finals)
app.add_middleware(ContestEligibilityMiddleware)

allowed_origins = set(settings.cors_origins_list or [])
if settings.is_production:
    allowed_origins.update(get_allowed_production_origins())
else:
    allowed_origins.update({
        "http://localhost:8081",
        "http://localhost:8082",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:8082",
    })

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.getLogger("uvicorn.error").exception(f"Unhandled error on {request.method} {request.url.path}: {exc}")
    origin = request.headers.get("origin")
    valid_origin = validate_frontend_origin(origin)

    headers = {}
    if valid_origin:
        headers["Access-Control-Allow-Origin"] = valid_origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Methods"] = "*"
        headers["Access-Control-Allow-Headers"] = "*"

    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
        headers=headers,
    )



# ── Strix Domain Ownership Verification ───────────────────────────────────────
@app.get("/.well-known/strix-verify.txt", response_class=PlainTextResponse, include_in_schema=False)
@app.get("/api/.well-known/strix-verify.txt", response_class=PlainTextResponse, include_in_schema=False)
async def strix_verify():
    """Returns domain verification token for Strix AI pentest scanner."""
    return "strix-verify-14cbf970e04612b8f26f423d9d0167d8"


# ── Production Healthcheck & System Probe ────────────────────────────────────
@app.get("/health", tags=["System"], include_in_schema=False)
@app.get("/api/health", tags=["System"])
async def health_check():
    """
    Production readiness probe.
    Returns 200 even if Redis/judge/db are degraded so the load-balancer stays up —
    degraded status is surfaced in the response body for observability.
    """
    from app.core.redis import ping_redis

    redis_ok = await ping_redis()
    db_ok = False
    try:
        from sqlalchemy import text
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

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
        "status": "operational" if (db_ok or redis_ok) else "degraded",
        "chapter": "Chaos Computer Club — Medi-Caps University",
        "environment": settings.ENVIRONMENT,
        "version": settings.VERSION,
        "services": {
            "database": "ok" if db_ok else "degraded",
            "redis": "ok" if redis_ok else "degraded",
            "judge_provider": judge_provider,
            "judge_healthy": judge_healthy,
            "judge_meta": judge_meta,
        },
    }


@app.get("/", tags=["System"], include_in_schema=False)
async def root_probe():
    """Root entrypoint for container health probes."""
    return {
        "service": "CCC Medi-Caps Distributed Backend",
        "version": settings.VERSION,
        "docs": f"{settings.API_PREFIX}/docs",
        "health": f"{settings.API_PREFIX}/health",
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
app.include_router(events.router, prefix=settings.API_PREFIX)
app.include_router(webhooks.router, prefix=settings.API_PREFIX)
app.include_router(jobs.router, prefix=settings.API_PREFIX)
app.include_router(workers.router, prefix=settings.API_PREFIX)
app.include_router(nodes.router, prefix=settings.API_PREFIX)
app.include_router(peer_fabric.router)
app.include_router(fabric.router, prefix=settings.API_PREFIX)
app.include_router(metrics.router, prefix=settings.API_PREFIX)
app.include_router(metrics.router)  # Standard Prometheus root path GET /metrics

# OpenAPI 3.1.0 Webhooks specifications for Swagger / ReDoc docs UI
app.webhooks.include_router(webhooks.webhooks_router)

# Admin maintenance routes (not exposed publicly in prod; protect via network policy)
app.include_router(admin.router, prefix=settings.API_PREFIX)
app.include_router(admin_contests.router, prefix=settings.API_PREFIX)
app.include_router(admin_problems.router, prefix=settings.API_PREFIX)
app.include_router(admin_problems.router)  # Direct /admin/problems mount
app.include_router(admin_qa.router, prefix=settings.API_PREFIX)
app.include_router(admin_loadtest.router, prefix=settings.API_PREFIX)


# Versioned surface — preferred for all new clients (/api/v1/).
app.include_router(api_router_v1, prefix=f"{settings.API_PREFIX}/v1")


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
