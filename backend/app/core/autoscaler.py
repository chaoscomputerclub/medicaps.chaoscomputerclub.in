"""
Chaos Computer Club — Medi-Caps Chapter
core/autoscaler.py — Dynamic Worker Autoscaler & Capacity Watcher

Phase 4 Scale-Out Engine:
- Monitors queue depth (pending + in-flight) vs available compute capacity across all workers
- Emits scale-up/scale-down directives with dampening / cool-down hysteresis (prevents oscillation)
- Dynamically scales local judge worker capacity between BASE_CONCURRENCY and MAX_CONCURRENCY
- Telemetry queryable via get_autoscale_status() and Prometheus /metrics
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import asdict, dataclass
from typing import Any, Dict, Optional

from app.core.config import settings
from app.core.queue.redis_queue import RedisQueueEngine
from app.core.worker_registry import WorkerRegistry

logger = logging.getLogger("ccc.autoscaler")

# ─── Scaling Thresholds ────────────────────────────────────────────────────────

SCALE_UP_DEPTH_THRESHOLD = 15          # If pending > 15 jobs, trigger scale-up
SCALE_UP_PRESSURE_RATIO = 1.5          # pending / total_capacity > 1.5
SCALE_DOWN_IDLE_SECONDS = 30.0         # 30s of empty queue before scaling down
AUTOSCALER_INTERVAL_SECONDS = 10.0     # Evaluation loop frequency
BASE_LOCAL_CONCURRENCY = 4             # Baseline judge concurrency
MAX_LOCAL_CONCURRENCY = 8              # Peak local judge concurrency


@dataclass
class AutoscaleState:
    current_concurrency: int = BASE_LOCAL_CONCURRENCY
    base_concurrency: int = BASE_LOCAL_CONCURRENCY
    max_concurrency: int = MAX_LOCAL_CONCURRENCY
    last_scale_action: str = "INIT"
    last_scale_time: float = 0.0
    pending_jobs: int = 0
    processing_jobs: int = 0
    registered_workers: int = 0
    healthy_capacity: int = 0
    pressure_ratio: float = 0.0
    scaling_alert_active: bool = False


class Autoscaler:
    """
    Capacity-aware autoscale coordinator.
    Runs as a singleton background task managed by FastAPI lifespan.
    """

    _instance: Optional[Autoscaler] = None

    def __init__(self) -> None:
        self.state = AutoscaleState(last_scale_time=time.time())
        self._loop_task: Optional[asyncio.Task] = None
        self._is_running = False

    @classmethod
    def get_instance(cls) -> Autoscaler:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def start(self) -> asyncio.Task:
        if self._loop_task is not None and not self._loop_task.done():
            return self._loop_task
        self._is_running = True
        self._loop_task = asyncio.create_task(self._monitor_loop(), name="ccc-autoscaler")
        logger.info("⚡ [Autoscaler] Dynamic capacity watcher started (interval=%.0fs)", AUTOSCALER_INTERVAL_SECONDS)
        return self._loop_task

    async def stop(self) -> None:
        self._is_running = False
        if self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
        logger.info("🛑 [Autoscaler] Dynamic capacity watcher stopped")

    async def evaluate_once(self) -> AutoscaleState:
        """Run a single evaluation pass across queue metrics and worker capacity."""
        now = time.time()
        judge_metrics = await RedisQueueEngine.get_queue_metrics("judge")
        pending = judge_metrics.get("pending", 0)
        processing = judge_metrics.get("processing", 0)

        # Worker Registry capacity
        active_workers = await WorkerRegistry.list_active()
        total_healthy_capacity = sum(
            w.max_concurrent_jobs for w in active_workers if w.status == "HEALTHY"
        )
        # Always assume at least local base capacity if registry is empty
        effective_capacity = max(self.state.current_concurrency, total_healthy_capacity)
        pressure_ratio = pending / max(1, effective_capacity)

        self.state.pending_jobs = pending
        self.state.processing_jobs = processing
        self.state.registered_workers = len(active_workers)
        self.state.healthy_capacity = total_healthy_capacity
        self.state.pressure_ratio = round(pressure_ratio, 2)

        # Scale-Up Condition
        should_scale_up = (
            pending >= SCALE_UP_DEPTH_THRESHOLD or pressure_ratio >= SCALE_UP_PRESSURE_RATIO
        )
        # Scale-Down Condition: Queue completely drained for > SCALE_DOWN_IDLE_SECONDS
        should_scale_down = (
            pending == 0
            and processing < self.state.base_concurrency
            and (now - self.state.last_scale_time) >= SCALE_DOWN_IDLE_SECONDS
        )

        if should_scale_up and self.state.current_concurrency < self.state.max_concurrency:
            new_concurrency = min(self.state.max_concurrency, self.state.current_concurrency + 2)
            self.state.current_concurrency = new_concurrency
            self.state.last_scale_action = "SCALE_UP"
            self.state.last_scale_time = now
            self.state.scaling_alert_active = True
            logger.warning(
                "🚀 [Autoscaler] SCALE_UP: Queue pressure %.2f (pending=%d) → Boosted concurrency to %d",
                pressure_ratio, pending, new_concurrency,
            )

        elif should_scale_down and self.state.current_concurrency > self.state.base_concurrency:
            new_concurrency = max(self.state.base_concurrency, self.state.current_concurrency - 2)
            self.state.current_concurrency = new_concurrency
            self.state.last_scale_action = "SCALE_DOWN"
            self.state.last_scale_time = now
            self.state.scaling_alert_active = False
            logger.info(
                "📉 [Autoscaler] SCALE_DOWN: Queue clear (idle %.0fs) → Scaled concurrency to %d",
                now - self.state.last_scale_time, new_concurrency,
            )

        return self.state

    async def _monitor_loop(self) -> None:
        while self._is_running:
            try:
                await asyncio.sleep(AUTOSCALER_INTERVAL_SECONDS)
                if self._is_running:
                    await self.evaluate_once()
            except asyncio.CancelledError:
                return
            except Exception as exc:
                logger.error("Autoscaler evaluation cycle failed: %s", exc)

    def get_status(self) -> Dict[str, Any]:
        return asdict(self.state)
