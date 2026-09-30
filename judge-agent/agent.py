#!/usr/bin/env python3
"""
Chaos Computer Club — Portable Node Fabric
agent.py — Universal Self-Adapting Compute Node Agent

Bootstraps from any USB drive onto any host computer:
1. Discovers hardware (CPU, RAM, architecture, container runtime)
2. Adapts local concurrency dynamically
3. Connects securely via outbound HTTPS to central control plane
4. Claims and executes judge jobs in isolated RAM-backed Docker containers
5. Handles network disconnections and graceful draining cleanly
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import signal
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional, Set

import httpx

from discovery import HardwareDiscovery
from executor import DockerExecutor
from network_manager import NetworkManager
from resource_governor import LocalResourceGovernor

# ─── Configuration & Defaults ────────────────────────────────────────────────

BASE_DIR = Path(__file__).resolve().parent
STORAGE_DIR = Path(os.environ.get("CCC_STORAGE_DIR", str(BASE_DIR)))
CLOUD_API_URL = os.environ.get("CLOUD_API_URL", "https://medicaps.chaoscomputerclub.in/api/v1").rstrip("/")
JUDGE_AGENT_SECRET = os.environ.get("JUDGE_AGENT_SECRET", "ccc-agent-dev-secret")
REDIS_URL = os.environ.get("REDIS_URL", "")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  [NodeFabric] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("ccc.node.agent")


class PortableNodeAgent:
    """Master node agent orchestrating discovery, telemetry, and distributed execution."""

    def __init__(self):
        self.storage_dir = STORAGE_DIR
        self.api_url = CLOUD_API_URL
        self.secret = JUDGE_AGENT_SECRET
        self.node_id = ""
        self.capabilities: Dict[str, Any] = {}
        
        self.network = NetworkManager(target_url=self.api_url)
        self.executor = DockerExecutor()
        self.governor = LocalResourceGovernor(base_concurrency=4, max_concurrency=12)
        
        self._http_client: Optional[httpx.AsyncClient] = None
        self._is_running = True
        self._is_draining = False
        self._active_tasks: Set[asyncio.Task] = set()

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.secret:
            headers["Authorization"] = f"Bearer {self.secret}"
        return headers

    async def register(self) -> bool:
        """Discover host capabilities and register with central control plane."""
        self.capabilities = HardwareDiscovery.collect_capabilities(
            storage_dir=self.storage_dir,
            target_host=self.api_url.split("://")[-1].split("/")[0],
        )
        self.node_id = self.capabilities["node_id"]
        self.governor.base_concurrency = self.capabilities["max_concurrency"]
        self.governor.current_concurrency = self.capabilities["max_concurrency"]

        logger.info(
            "🔍 [Discovery] Host: %s (%s, %d logical threads, %d MB RAM, max_concurrency=%d)",
            self.capabilities["hostname"],
            self.capabilities["cpu"]["model"],
            self.capabilities["cpu"]["logical_cores"],
            self.capabilities["memory"]["total_mb"],
            self.capabilities["max_concurrency"],
        )

        reg_url = f"{self.api_url}/nodes/register"
        try:
            resp = await self._http_client.post(reg_url, json=self.capabilities, headers=self._headers())
            if resp.status_code in {200, 201}:
                data = resp.json()
                self.node_id = data.get("node_id", self.node_id)
                logger.info("🛸 [Fabric] Node successfully registered with ID: %s", self.node_id)
                return True
            else:
                logger.error("Registration failed with status %d: %s", resp.status_code, resp.text)
        except Exception as exc:
            logger.error("Failed to connect to %s for registration: %s", reg_url, exc)
        return False

    async def _heartbeat_loop(self) -> None:
        """Send high-frequency resource telemetry to control plane every 5s."""
        hb_url = f"{self.api_url}/nodes/{self.node_id}/heartbeat"
        while self._is_running:
            try:
                self.governor.active_jobs = len(self._active_tasks)
                self.governor.adjust_concurrency()
                telemetry = self.governor.get_telemetry()
                
                payload = {
                    "cpu_usage_pct": telemetry["cpu_usage_pct"],
                    "memory_usage_pct": telemetry["memory_usage_pct"],
                    "available_memory_mb": telemetry["available_memory_mb"],
                    "running_jobs": telemetry["running_jobs"],
                    "available_slots": telemetry["available_slots"],
                    "network_status": "healthy" if self.network.is_connected else "disconnected",
                    "docker_status": "healthy",
                }

                resp = await self._http_client.post(hb_url, json=payload, headers=self._headers())
                if resp.status_code == 404:
                    logger.warning("Node not recognized by control plane — re-registering...")
                    await self.register()

            except asyncio.CancelledError:
                return
            except Exception as exc:
                logger.debug("Heartbeat error: %s", exc)

            await asyncio.sleep(5.0)

    async def _claim_and_execute_loop(self) -> None:
        """Poll outbound REST claim endpoint and dispatch sandboxed executions."""
        claim_url = f"{self.api_url}/nodes/{self.node_id}/claim"
        result_url = f"{self.api_url}/nodes/{self.node_id}/result"

        while self._is_running and not self._is_draining:
            if not self.governor.can_accept_job():
                await asyncio.sleep(0.5)
                continue

            try:
                resp = await self._http_client.post(
                    claim_url,
                    json={"timeout_seconds": 2.0},
                    headers=self._headers(),
                )
                if resp.status_code == 200:
                    data = resp.json()
                    job = data.get("job")
                    if job:
                        task = asyncio.create_task(
                            self._handle_single_job(job, result_url),
                            name=f"job-{job.get('id', 'unk')[:8]}",
                        )
                        self._active_tasks.add(task)
                        task.add_done_callback(self._active_tasks.discard)
                    else:
                        # Queue empty — brief pause
                        await asyncio.sleep(0.4)
                else:
                    await asyncio.sleep(1.0)

            except asyncio.CancelledError:
                return
            except Exception as exc:
                logger.debug("Job claim loop warning: %s", exc)
                await asyncio.sleep(2.0)

    async def _handle_single_job(self, job: Dict[str, Any], result_url: str) -> None:
        """Run sandboxed job and report verdict back to control plane."""
        job_id = job.get("id", "unk")
        payload = job.get("payload", {})
        payload["job_id"] = job_id
        
        logger.info("⚡ [Worker] Starting execution for job %s [%s]", job_id, payload.get("language"))
        start_time = time.time()
        
        try:
            exec_result = await self.executor.execute_submission(payload)
            verdict = exec_result.get("verdict", "INTERNAL_ERROR")
            runtime_ms = exec_result.get("runtime_ms", 0.0)
            mem_mb = exec_result.get("memory_mb", 0.0)
            tc_results = exec_result.get("testcase_results", [])

            # Submit result back
            result_payload = {
                "job_id": job_id,
                "verdict": verdict,
                "runtime_ms": runtime_ms,
                "memory_mb": mem_mb,
                "testcase_results": tc_results,
            }
            await self._http_client.post(result_url, json=result_payload, headers=self._headers())
            elapsed = round((time.time() - start_time) * 1000.0, 1)
            logger.info("✓ [Worker] Job %s completed in %.1fms (Verdict: %s)", job_id, elapsed, verdict)

        except Exception as exc:
            logger.error("Job %s execution failed: %s", job_id, exc)
            try:
                await self._http_client.post(
                    result_url,
                    json={"job_id": job_id, "verdict": "SYSTEM_ERROR", "error": str(exc)},
                    headers=self._headers(),
                )
            except Exception:
                pass

    async def drain(self) -> None:
        """Gracefully drain running jobs before shutdown."""
        self._is_draining = True
        logger.info("🛑 [Fabric] Entering DRAINING mode — stopping new jobs...")
        
        try:
            await self._http_client.post(f"{self.api_url}/nodes/{self.node_id}/drain", headers=self._headers())
        except Exception:
            pass

        if self._active_tasks:
            logger.info("Waiting for %d in-flight job(s) to finish...", len(self._active_tasks))
            await asyncio.gather(*self._active_tasks, return_exceptions=True)

        try:
            await self._http_client.post(f"{self.api_url}/nodes/{self.node_id}/unregister", headers=self._headers())
        except Exception:
            pass

        logger.info("✓ [Fabric] Node %s cleanly shut down.", self.node_id)

    async def run(self) -> None:
        """Main lifecycle entrypoint."""
        self._http_client = httpx.AsyncClient(timeout=10.0)
        
        # Wait for control plane reachability
        await self.network.wait_for_connectivity()

        # Register hardware
        registered = await self.register()
        while not registered and self._is_running:
            logger.warning("Retrying node registration in 5 seconds...")
            await asyncio.sleep(5.0)
            registered = await self.register()

        hb_task = asyncio.create_task(self._heartbeat_loop(), name="heartbeat")
        claim_task = asyncio.create_task(self._claim_and_execute_loop(), name="claim-loop")

        # Keep alive until shutdown signal
        try:
            while self._is_running:
                await asyncio.sleep(1.0)
        finally:
            hb_task.cancel()
            claim_task.cancel()
            await self.drain()
            await self._http_client.aclose()


# ─── Process Bootstrap ───────────────────────────────────────────────────────

def main():
    agent = PortableNodeAgent()

    def handle_signal(sig, frame):
        logger.info("Received signal %s — initiating shutdown", sig)
        agent._is_running = False

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    try:
        asyncio.run(agent.run())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
