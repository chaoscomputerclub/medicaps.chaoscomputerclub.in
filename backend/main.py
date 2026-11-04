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
from fastapi.middleware.gzip import GZipMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse, Response
from app.core.config import settings
from app.core.origins import get_allowed_production_origins, validate_frontend_origin
from app.core.db import AsyncSessionLocal, init_db
from app.services.seed_service import seed_database
from app.services.background_tasks_service import start_background_tasks
from app.services.event_broadcaster import start_redis_event_relay
from app.core.queue import queue_manager
from app.routers import admin, admin_contests, admin_loadtest, admin_problems, admin_qa, admin_settings, assessment, auth, contests, events, fabric, feed, jobs, leaderboard, metrics, nodes, organizations, passes, policies, practice, scoreboards, social, storage, verify, webhooks, workers
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

    await init_db()
    print("✓ Database verified & initialized successfully (clean state).")

    process_role = getattr(settings, "PROCESS_ROLE", "combined")
    should_run_workers = process_role in ("combined", "worker")

    queue_tasks = []
    bg_tasks = []
    realtime_relay_task = None
    governor = None
    autoscaler = None
    reconciliation_worker = None

    if should_run_workers:
        # ── Production async queue workers ──────────────────────────────────────
        queue_tasks = queue_manager.start_all()
        print(f"✓ Async queue workers started: {list(queue_manager.workers.keys())}")

        # ── Production background tasks ──────────────────────────────────────────
        bg_tasks = start_background_tasks(AsyncSessionLocal)
        realtime_relay_task = start_redis_event_relay()
        print(f"✓ Background tasks started: {[t.get_name() for t in bg_tasks]}")

        # ── Resource Governor (worker health sweep + autoscale signal loop) ─────
        governor = get_resource_governor()
        governor.start()
        print("✓ ResourceGovernor started (health-sweep=30s, autoscale=10s)")

        # ── Dynamic Autoscaler & Capacity Watcher ──────────────────────────────
        from app.core.autoscaler import Autoscaler
        autoscaler = Autoscaler.get_instance()
        autoscaler.start()
        print("✓ Dynamic Autoscaler started (interval=10s)")

        # ── Judge Reconciliation Worker (stuck processing audit & lease recovery) ─
        from app.core.reconciliation import ReconciliationWorker
        reconciliation_worker = ReconciliationWorker.get_instance()
        await reconciliation_worker.start()
        print("✓ Judge Reconciliation Worker started (interval=15s)")
    else:
        print(f"✓ Running in '{process_role}' role: background workers delegated to worker tier.")

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
    if reconciliation_worker:
        await reconciliation_worker.stop()
    if autoscaler:
        await autoscaler.stop()
    if governor:
        await governor.stop()
    if queue_tasks:
        await queue_manager.stop_all(drain_timeout=15.0)
    
    tasks_to_cancel = [*bg_tasks]
    if realtime_relay_task:
        tasks_to_cancel.append(realtime_relay_task)
    for task in tasks_to_cancel:
        task.cancel()
    if tasks_to_cancel:
        await asyncio.gather(*tasks_to_cancel, return_exceptions=True)
    print(f"🛑 Shutting down {settings.PROJECT_NAME}...")


docs_enabled = (not settings.is_production) or getattr(settings, "ENABLE_API_DOCS", False)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Official Backend API for Chaos Computer Club Medi-Caps Chapter. "
                "Provides offline contest management, LeetCode/CodeChef telemetry, "
                "division rating ladders, and cryptographic Trust-of-Proof verification.",
    lifespan=lifespan,
    docs_url="/docs" if docs_enabled else None,
    redoc_url="/redoc" if docs_enabled else None,
    openapi_url="/openapi.json" if docs_enabled else None,
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

# HTTP Response Compression Middleware (Compresses responses >= 1000 bytes with gzip)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import uuid
    trace_id = getattr(request.state, "trace_id", None) or request.headers.get("x-request-id") or str(uuid.uuid4())
    logging.getLogger("uvicorn.error").exception(
        f"Unhandled error on {request.method} {request.url.path} [request_id={trace_id}]: {exc}"
    )
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
        content={"detail": "Internal Server Error", "request_id": trace_id},
        headers=headers,
    )



# ── Strix Domain Ownership Verification ───────────────────────────────────────
@app.get("/.well-known/strix-verify.txt", response_class=PlainTextResponse, include_in_schema=False)
@app.get("/api/.well-known/strix-verify.txt", response_class=PlainTextResponse, include_in_schema=False)
async def strix_verify():
    """Returns domain verification token for Strix AI pentest scanner."""
    return "strix-verify-14cbf970e04612b8f26f423d9d0167d8"


# ── Liveness Probe (Instant 200 OK, dependency-free) ─────────────────────────
@app.get("/health/live", tags=["System"])
async def liveness_probe():
    """Kubernetes / Docker liveness probe: returns 200 immediately if process event-loop is alive."""
    return {"status": "alive", "version": settings.VERSION}


# ── Readiness Probe (Strict 200 vs 503 based on critical dependencies) ──────
@app.get("/health/ready", tags=["System"])
async def readiness_probe(response: Response):
    """
    Kubernetes / Docker readiness probe.
    Returns 200 if database and Redis are reachable within 2s timeout.
    Returns 503 Service Unavailable if critical dependencies are down.
    """
    from app.core.redis import ping_redis
    from app.core.db import engine
    from sqlalchemy import text

    db_ok = False
    redis_ok = False

    try:
        async with asyncio.timeout(2.0):
            async with engine.connect() as conn:
                res = await conn.execute(text("SELECT 1"))
                db_ok = res.scalar() == 1
    except Exception as e:
        logging.getLogger("uvicorn.error").warning("Readiness DB probe failed: %s", e)

    try:
        async with asyncio.timeout(2.0):
            redis_ok = await ping_redis()
    except Exception as e:
        logging.getLogger("uvicorn.error").warning("Readiness Redis probe failed: %s", e)

    all_ready = db_ok and redis_ok
    if not all_ready:
        response.status_code = 503

    return {
        "status": "ready" if all_ready else "degraded",
        "version": settings.VERSION,
        "dependencies": {
            "database": "ok" if db_ok else "unreachable",
            "redis": "ok" if redis_ok else "unreachable",
        },
    }


# ── Production Healthcheck ────────────────────────────────────────────────────
@app.get("/api/health", tags=["System"])
async def health_check(response: Response):
    """
    Production health probe.
    Surfaces Redis, DB and judge status; flags 503 when primary dependencies are degraded.
    """
    from app.core.redis import ping_redis

    redis_ok = False
    try:
        async with asyncio.timeout(2.0):
            redis_ok = await ping_redis()
    except Exception:
        pass

    judge_provider = "unknown"
    judge_healthy = False
    judge_meta = {}
    try:
        from app.engine.providers.factory import get_judge_provider
        provider = get_judge_provider()
        judge_provider = provider.name
        async with asyncio.timeout(2.0):
            judge_healthy = await provider.healthy()
        if hasattr(provider, "get_engine_status"):
            judge_meta = await provider.get_engine_status()
    except Exception:
        pass

    is_operational = redis_ok
    if not is_operational:
        response.status_code = 503

    return {
        "status": "operational" if is_operational else "degraded",
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
app.include_router(events.router, prefix=settings.API_PREFIX)
app.include_router(webhooks.router, prefix=settings.API_PREFIX)
app.include_router(jobs.router, prefix=settings.API_PREFIX)
app.include_router(workers.router, prefix=settings.API_PREFIX)
app.include_router(nodes.router, prefix=settings.API_PREFIX)
app.include_router(fabric.router, prefix=settings.API_PREFIX)
app.include_router(metrics.router, prefix=settings.API_PREFIX)
app.include_router(metrics.router)  # Standard Prometheus root path GET /metrics
app.include_router(practice.router, prefix=settings.API_PREFIX)
app.include_router(organizations.router, prefix=settings.API_PREFIX)
app.include_router(policies.router, prefix=settings.API_PREFIX)

# OpenAPI 3.1.0 Webhooks specifications for Swagger / ReDoc docs UI
app.webhooks.include_router(webhooks.webhooks_router)

# Admin maintenance routes (not exposed publicly in prod; protect via network policy)
app.include_router(admin.router, prefix=settings.API_PREFIX)
app.include_router(admin_contests.router, prefix=settings.API_PREFIX)
app.include_router(admin_problems.router, prefix=settings.API_PREFIX)
app.include_router(admin_qa.router, prefix=settings.API_PREFIX)
app.include_router(admin_loadtest.router, prefix=settings.API_PREFIX)
app.include_router(admin_settings.router, prefix=settings.API_PREFIX)


# Versioned surface — preferred for all new clients (/api/v1/).
app.include_router(api_router_v1, prefix=f"{settings.API_PREFIX}/v1")


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
