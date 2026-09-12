"""
Chaos Computer Club India — Medi-Caps Chapter Backend
FastAPI Main Application Entrypoint
Inspired by Desktop/sharexpress/interleet and Desktop/sharexpress/cloud.sharexpress
"""

from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.db import AsyncSessionLocal, init_db
from app.routers import auth, contests, feed, leaderboard, passes, scoreboards, verify
from app.services.seed_service import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize database tables and seed realistic data on start."""
    print(f"⚡ Starting {settings.PROJECT_NAME} (v{settings.VERSION})...")
    await init_db()
    async with AsyncSessionLocal() as session:
        await seed_database(session)
    print("✓ Database verified & initialized successfully.")
    yield
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Healthcheck
@app.get("/api/health", tags=["System"])
async def health_check():
    return {
        "status": "operational",
        "chapter": "Chaos Computer Club — Medi-Caps University",
        "environment": "air_gapped_offline_ready",
        "version": settings.VERSION,
    }


# Mount API Routers
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(contests.router, prefix=settings.API_PREFIX)
app.include_router(scoreboards.router, prefix=settings.API_PREFIX)
app.include_router(leaderboard.router, prefix=settings.API_PREFIX)
app.include_router(verify.router, prefix=settings.API_PREFIX)
app.include_router(passes.router, prefix=settings.API_PREFIX)
app.include_router(feed.router, prefix=settings.API_PREFIX)


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
