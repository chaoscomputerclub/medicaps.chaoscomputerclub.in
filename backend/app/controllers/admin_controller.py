"""
Chaos Computer Club — Medi-Caps Chapter
controllers/admin_controller.py — Admin Operations & Maintenance Orchestration Controller
"""

from typing import Any, Dict
from app.core.db import AsyncSessionLocal
from app.services.background_tasks_service import (
    _sweep_expired_sessions,
    _auto_qualify_top30,
)


class AdminController:
    """Orchestrator for internal maintenance sweeps and auto-qualification triggers."""

    @staticmethod
    async def sweep_sessions() -> Dict[str, Any]:
        await _sweep_expired_sessions(AsyncSessionLocal)
        return {"status": "sweep_complete"}

    @staticmethod
    async def run_auto_qualify() -> Dict[str, Any]:
        await _auto_qualify_top30(AsyncSessionLocal)
        return {"status": "auto_qualify_complete"}
