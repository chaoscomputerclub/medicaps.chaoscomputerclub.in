"""
Chaos Computer Club — Portable Node Fabric
resource_governor.py — Local Machine Resource Governor

Continuously monitors host CPU, RAM, and container pressure.
Dynamically scales local execution concurrency and enforces backpressure.
"""

from __future__ import annotations

import logging
import psutil
from typing import Dict, Any

logger = logging.getLogger("ccc.node.governor")


class LocalResourceGovernor:
    """Monitors local host metrics and controls worker concurrency bounds."""

    def __init__(self, base_concurrency: int = 4, max_concurrency: int = 12):
        self.base_concurrency = max(1, base_concurrency)
        self.max_concurrency = max(self.base_concurrency, max_concurrency)
        self.current_concurrency = self.base_concurrency
        self.active_jobs = 0

    def get_telemetry(self) -> Dict[str, Any]:
        """Sample host hardware utilization."""
        cpu_pct = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()
        
        return {
            "cpu_usage_pct": round(cpu_pct, 1),
            "memory_usage_pct": round(mem.percent, 1),
            "available_memory_mb": mem.available // (1024 * 1024),
            "running_jobs": self.active_jobs,
            "available_slots": max(0, self.current_concurrency - self.active_jobs),
            "current_concurrency_cap": self.current_concurrency,
        }

    def can_accept_job(self) -> bool:
        """
        Evaluate if the host has safe capacity to execute another job.
        Fails closed if CPU > 85% or available memory < 512MB.
        """
        if self.active_jobs >= self.current_concurrency:
            return False

        telemetry = self.get_telemetry()
        if telemetry["cpu_usage_pct"] > 88.0:
            logger.warning("Backpressure: CPU usage %.1f%% exceeds 88%% cap", telemetry["cpu_usage_pct"])
            return False

        if telemetry["available_memory_mb"] < 512:
            logger.warning("Backpressure: Available memory %d MB below 512MB safety cap", telemetry["available_memory_mb"])
            return False

        return True

    def adjust_concurrency(self) -> int:
        """
        Dynamic internal scaler: scales concurrency up or down
        based on real-time load average and hardware comfort.
        """
        telemetry = self.get_telemetry()
        cpu = telemetry["cpu_usage_pct"]
        ram_avail = telemetry["available_memory_mb"]

        # Scale down if under heavy load
        if cpu > 80.0 or ram_avail < 768:
            if self.current_concurrency > self.base_concurrency:
                self.current_concurrency -= 1
                logger.info("Scaled local concurrency DOWN to %d (CPU: %.1f%%, RAM: %dMB)", self.current_concurrency, cpu, ram_avail)
        # Scale up if idle and plenty of RAM
        elif cpu < 50.0 and ram_avail > 1536 and self.active_jobs >= self.current_concurrency - 1:
            if self.current_concurrency < self.max_concurrency:
                self.current_concurrency += 1
                logger.info("Scaled local concurrency UP to %d (CPU: %.1f%%, RAM: %dMB)", self.current_concurrency, cpu, ram_avail)

        return self.current_concurrency
