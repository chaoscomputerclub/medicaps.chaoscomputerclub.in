"""
Chaos Computer Club -- Admin Router
Internal maintenance endpoints (not exposed to candidates).
Delegates to app.controllers.admin_controller.AdminController
"""

from fastapi import APIRouter
from app.controllers.admin_controller import AdminController

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/sessions/sweep", summary="Manually sweep expired sessions")
async def admin_sweep_sessions():
    """
    Force-run the session expiry sweeper immediately.
    Auto-submits any in-progress sessions whose 120-minute timer has expired.
    """
    return await AdminController.sweep_sessions()


@router.post("/qualify/run", summary="Manually trigger auto-qualify check")
async def admin_run_auto_qualify():
    """
    Force-run the auto-qualify Top 30 check immediately.
    Marks the Top 30 sessions when the assessment window has closed.
    """
    return await AdminController.run_auto_qualify()
