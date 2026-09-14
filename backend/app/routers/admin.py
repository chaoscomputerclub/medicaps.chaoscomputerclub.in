"""
Chaos Computer Club -- Admin Router
Internal maintenance endpoints (not exposed to candidates).
Intended for organiser use and operations tooling.
"""

from fastapi import APIRouter
from app.core.db import AsyncSessionLocal
from app.services.background_tasks_service import (
    _sweep_expired_sessions,
    _auto_qualify_top30,
)

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/sessions/sweep", summary="Manually sweep expired sessions")
async def admin_sweep_sessions():
    """
    Force-run the session expiry sweeper immediately.
    Auto-submits any in-progress sessions whose 120-minute timer has expired.
    """
    await _sweep_expired_sessions(AsyncSessionLocal)
    return {"status": "sweep_complete"}


@router.post("/qualify/run", summary="Manually trigger auto-qualify check")
async def admin_run_auto_qualify():
    """
    Force-run the auto-qualify Top 30 check immediately.
    Marks the Top 30 sessions when the assessment window has closed.
    """
    await _auto_qualify_top30(AsyncSessionLocal)
    return {"status": "auto_qualify_complete"}
