"""
Chaos Computer Club — Medi-Caps Chapter
core/resource_governor.py — Resource-Aware Job Scheduler

The ResourceGovernor answers one question: "Can this job run right now, and on which worker?"

It replaces the implicit round-robin behaviour (worker just polls and executes)
with capacity-aware routing that considers:
  - Worker health (HEALTHY/SUSPECT/OFFLINE)
  - Available concurrency slots (running_jobs < max_concurrency)
  - Available memory (available_memory_mb >= job.memory_mb)
  - CPU safety threshold (cpu_pct < CPU_SAFETY_THRESHOLD)
  - Language support
  - Queue pressure signal (queue_wait > threshold → scale up)

The governor also runs an autoscale loop every 10s and a health sweep every 30s.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Dict, List, Optional, Tuple

from app.core.config import settings
from app.core.worker_registry import WorkerInfo, WorkerRegistry, WorkerStatus
from app.core.queue.redis_queue import RedisQueueEngine

logger = logging.getLogger("ccc.resource_governor")


class WorkerAllocation:
    __slots__ = ("worker_id", "action")

    def __init__(self, worker_id: Optional[str], action: str):
        self.worker_id = worker_id
        self.action = action  # "dispatch" | "queue" | "backpressure"


class ResourceGovernor:
    """
    Central resource governor/scheduler for the CCC judge platform.

    Usage:
        governor = ResourceGovernor()
        governor.start()          # begins background tasks
        ...
        await governor.stop()     # graceful shutdown
    """

    def __init__(self):
        self._sweep_task: Optional[asyncio.Task] = None
        self._autoscale_task: Optional[asyncio.Task] = None
        self._is_running = False
        self._queue_start_times: Dict[str, float] = {}  # job_id → enqueue time

    # ─── Scheduling ──────────────────────────────────────────────────────────

    async def can_schedule(
        self,
        language: str = "python",
        memory_mb: int = 256,
        cpu_limit: float = 1.0,
    ) -> WorkerAllocation:
        """
        Returns the best available worker for this job.
        Returns WorkerAllocation(action='queue') if no worker can take it now.
        """
        workers = await WorkerRegistry.get_all_active_workers()
        candidates: List[Tuple[float, WorkerInfo]] = []

        for w in workers:
            # Hard gates
            if w.status == WorkerStatus.OFFLINE:
                continue
            if w.status == WorkerStatus.DRAINING:
                continue
            if w.running_jobs >= w.max_concurrency:
                continue
            if language.lower() not in [lang.lower() for lang in w.languages]:
                continue
            if w.available_memory_mb < memory_mb:
                continue
            if w.cpu_pct >= (settings.WORKER_CPU_SAFETY_THRESHOLD * 100):
                continue

            # Composite score: prefer more available capacity + more free memory
            slot_score = (w.max_concurrency - w.running_jobs) / w.max_concurrency
            mem_score = min(1.0, w.available_memory_mb / max(memory_mb * 2, 1))
            # Prefer laptop (more powerful) over cloud worker for heavy jobs
            laptop_bonus = 0.1 if "laptop" in w.hostname.lower() else 0.0
            # Penalise suspect workers slightly
            suspect_penalty = -0.2 if w.status == WorkerStatus.SUSPECT else 0.0
            score = slot_score * 0.6 + mem_score * 0.3 + laptop_bonus * 0.1 + suspect_penalty
            candidates.append((score, w))

        if not candidates:
            return WorkerAllocation(worker_id=None, action="queue")

        _, best = max(candidates, key=lambda t: t[0])
        return WorkerAllocation(worker_id=best.worker_id, action="dispatch")

    async def estimate_queue_wait_seconds(self, queue_name: str = "judge") -> float:
        """
        Rough estimate of how long a job enqueued NOW would wait.
        Formula: queue_depth / throughput_per_second
        """
        depth = await RedisQueueEngine.queue_depth(queue_name)
        workers = await WorkerRegistry.get_all_active_workers()
        healthy = [w for w in workers if w.status in (WorkerStatus.HEALTHY, WorkerStatus.SUSPECT)]
        if not healthy:
            return float("inf")
        # Assume each slot processes 1 job per 30s on average (conservative)
        total_slots = sum(max(0, w.max_concurrency - w.running_jobs) for w in healthy)
        if total_slots == 0:
            return float("inf")
        throughput_per_s = total_slots / 30.0
        return depth / throughput_per_s if depth else 0.0

    # ─── Health Sweep ────────────────────────────────────────────────────────

    async def _health_sweep_loop(self) -> None:
        """
        Every 30s: sweep all workers in the active set.
        Workers whose heartbeat TTL has expired are marked OFFLINE and removed.
        This is a safety net — the TTL-expiry itself handles most cases.
        """
        while self._is_running:
            try:
                await asyncio.sleep(30.0)
                if not self._is_running:
                    return
                workers = await WorkerRegistry.get_all_active_workers()
                for w in workers:
                    if w.status == WorkerStatus.OFFLINE:
                        await WorkerRegistry.mark_offline(w.worker_id)
                        logger.warning(
                            "⚠️  [Governor] Worker %s (%s) is OFFLINE — swept from active set",
                            w.worker_id, w.hostname,
                        )
            except asyncio.CancelledError:
                return
            except Exception as exc:
                logger.error("[Governor] Health sweep error: %s", exc)

    # ─── Autoscale ───────────────────────────────────────────────────────────

    async def _autoscale_loop(self) -> None:
        """
        Every 10s: emit scaling signals.
        Currently logs decisions; extend to spawn cloud workers in the future.

        Scale-up condition:
          queue_wait_time > WORKER_SCALE_UP_WAIT_S
          AND cpu_pct < CPU_SAFETY_THRESHOLD
          AND ram_free_mb > RAM_SAFETY_FLOOR_MB
          AND we have registered workers below max_concurrency cap

        Scale-down condition:
          queue depth == 0
          AND all workers are idle (running_jobs == 0)
        """
        while self._is_running:
            try:
                await asyncio.sleep(10.0)
                if not self._is_running:
                    return

                workers = await WorkerRegistry.get_all_active_workers()
                queue_wait = await self.estimate_queue_wait_seconds("judge")
                queue_depth = await RedisQueueEngine.queue_depth("judge")

                if not workers:
                    if queue_depth > 0:
                        logger.warning(
                            "🚨 [Governor] %d jobs queued but NO healthy workers registered!",
                            queue_depth,
                        )
                    continue

                healthy = [w for w in workers if w.status == WorkerStatus.HEALTHY]
                total_slots = sum(w.available_slots for w in healthy)
                all_idle = all(w.running_jobs == 0 for w in healthy)
                overloaded = any(w.cpu_pct >= settings.WORKER_CPU_SAFETY_THRESHOLD * 100 for w in healthy)
                ram_constrained = any(w.ram_free_mb < settings.WORKER_RAM_SAFETY_FLOOR_MB for w in healthy)

                if queue_wait > settings.WORKER_SCALE_UP_WAIT_S and not overloaded and not ram_constrained:
                    logger.info(
                        "📈 [Governor] Scale-up signal: queue_wait=%.1fs, depth=%d, slots=%d — "
                        "Consider adding workers or increasing concurrency.",
                        queue_wait, queue_depth, total_slots,
                    )
                elif queue_depth == 0 and all_idle and len(healthy) > 1:
                    logger.debug(
                        "📉 [Governor] Scale-down signal: queue empty, all %d workers idle.",
                        len(healthy),
                    )
                else:
                    logger.debug(
                        "[Governor] Steady: workers=%d, slots=%d, queue=%d, wait=%.1fs",
                        len(healthy), total_slots, queue_depth, queue_wait,
                    )

            except asyncio.CancelledError:
                return
            except Exception as exc:
                logger.error("[Governor] Autoscale loop error: %s", exc)

    # ─── Lifecycle ───────────────────────────────────────────────────────────

    def start(self) -> None:
        """Start governor background tasks in the running event loop."""
        if self._is_running:
            return
        self._is_running = True
        loop = asyncio.get_running_loop()
        self._sweep_task = loop.create_task(
            self._health_sweep_loop(), name="governor-health-sweep"
        )
        self._autoscale_task = loop.create_task(
            self._autoscale_loop(), name="governor-autoscale"
        )
        logger.info("🧠 ResourceGovernor started (sweep=30s, autoscale=10s)")

    async def stop(self) -> None:
        """Stop governor background tasks."""
        self._is_running = False
        for task in (self._sweep_task, self._autoscale_task):
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        logger.info("ResourceGovernor stopped")


# ─── Module-level singleton ───────────────────────────────────────────────────

_governor: Optional[ResourceGovernor] = None


def get_resource_governor() -> ResourceGovernor:
    global _governor
    if _governor is None:
        _governor = ResourceGovernor()
    return _governor
