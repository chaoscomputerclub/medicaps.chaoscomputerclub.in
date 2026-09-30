"""
Chaos Computer Club — Portable Node Fabric
network_manager.py — Adaptive Network Observer & Reconnection Engine

Monitors control-plane connectivity, handles Wi-Fi dropouts, and executes
safe exponential backoff without crashing the node agent.
"""

from __future__ import annotations

import asyncio
import logging
import random
import time
from enum import Enum
from typing import Optional

import httpx

logger = logging.getLogger("ccc.node.network")


class ConnectionState(str, Enum):
    INITIALIZING = "INITIALIZING"
    CONNECTING = "CONNECTING"
    CONNECTED = "CONNECTED"
    DEGRADED = "DEGRADED"
    DISCONNECTED = "DISCONNECTED"
    RECONNECTING = "RECONNECTING"


class NetworkManager:
    """Manages resilient network connectivity to the central control plane."""

    def __init__(self, target_url: str, check_interval_s: float = 10.0):
        self.target_url = target_url.rstrip("/")
        self.check_interval_s = check_interval_s
        self.state = ConnectionState.INITIALIZING
        self._consecutive_failures = 0
        self._is_running = False
        self._lock = asyncio.Lock()

    @property
    def is_connected(self) -> bool:
        return self.state in {ConnectionState.CONNECTED, ConnectionState.DEGRADED}

    async def check_reachability(self) -> bool:
        """Probe cloud control plane health endpoint."""
        url = f"{self.target_url}/health"
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(url)
                if resp.status_code < 500:
                    self._consecutive_failures = 0
                    self.state = ConnectionState.CONNECTED
                    return True
        except Exception as exc:
            self._consecutive_failures += 1
            logger.debug("Control plane probe failed (%s): %s", self._consecutive_failures, exc)

        if self._consecutive_failures >= 3:
            self.state = ConnectionState.DISCONNECTED
        else:
            self.state = ConnectionState.DEGRADED
        return False

    async def wait_for_connectivity(self, max_delay_s: float = 30.0) -> None:
        """
        Block with exponential backoff + jitter until the control plane is reachable.
        Guarantees that temporary Wi-Fi drops do not kill the agent.
        """
        delay = 1.0
        while True:
            reachable = await self.check_reachability()
            if reachable:
                logger.info("✅ Connection established with control plane: %s", self.target_url)
                return

            self.state = ConnectionState.RECONNECTING
            jitter = random.uniform(0.1, 0.5)
            sleep_duration = min(delay + jitter, max_delay_s)
            logger.warning(
                "📡 [NetworkManager] Control plane unreachable. Retrying in %.1fs (attempt %d)...",
                sleep_duration, self._consecutive_failures
            )
            await asyncio.sleep(sleep_duration)
            delay = min(delay * 2.0, max_delay_s)
