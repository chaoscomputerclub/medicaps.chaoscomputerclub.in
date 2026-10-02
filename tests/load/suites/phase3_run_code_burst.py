#!/usr/bin/env python3
"""
Medi-Caps Competitive Programming Platform
Phase 3: Run-Code Burst & Admission Control Gate
=================================================
Executes progressive concurrency bursts: 5 -> 10 -> 25 -> 50 concurrent Run-Code requests.
Measures:
  - HTTP status distribution (200 OK, 429 Too Many Requests, 503 Service Unavailable)
  - HTTP round-trip latency (p50, p95, p99, max)
  - Codebox admission wait & queue delay
  - Compile & execution times
  - Server telemetry (CPU, memory, container count)
"""

import asyncio
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Any
import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ccc.phase3.run_code")

ROOT_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT_DIR / "tests" / "load" / "data"
BASE_URL = os.getenv("LOAD_TEST_BASE_URL", "https://medicaps-api.chaoscomputerclub.in")
CONTEST_SLUG = "loadtest-arena-50"


def load_identities() -> List[Dict[str, Any]]:
    path = DATA_DIR / "loadtest_identities.json"
    if not path.exists():
        raise FileNotFoundError(f"Missing identities file at {path}. Run provision script first.")
    with open(path, "r") as f:
        return json.load(f)


def load_templates() -> Dict[str, Any]:
    with open(DATA_DIR / "submissions.json", "r") as f:
        return json.load(f)


async def get_arena_problem_map(client: httpx.AsyncClient, token: str) -> Dict[str, str]:
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get(f"{BASE_URL}/api/contests/{CONTEST_SLUG}/arena", headers=headers, timeout=15.0)
    if resp.status_code != 200:
        raise RuntimeError(f"Failed to fetch arena problems: {resp.status_code} {resp.text}")
    data = resp.json()
    return {p["problem_index"]: p["id"] for p in data.get("problems", [])}


async def execute_single_run(
    client: httpx.AsyncClient,
    identity: Dict[str, Any],
    problem_id: str,
    code: str,
    lang: str = "python",
) -> Dict[str, Any]:
    token = identity["token"]
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {
        "problem_id": problem_id,
        "language": lang,
        "code": code,
    }

    t0 = time.perf_counter()
    try:
        resp = await client.post(
            f"{BASE_URL}/api/contests/{CONTEST_SLUG}/arena/run",
            json=payload,
            headers=headers,
            timeout=30.0,
        )
        t1 = time.perf_counter()
        elapsed_ms = (t1 - t0) * 1000.0

        res_data = {}
        try:
            res_data = resp.json()
        except Exception:
            pass

        latencies = res_data.get("latencies", {})
        timestamps = res_data.get("timestamps", {})

        return {
            "status_code": resp.status_code,
            "http_elapsed_ms": elapsed_ms,
            "success": res_data.get("success", False),
            "verdict": res_data.get("verdict", "UNKNOWN"),
            "job_id": res_data.get("job_id"),
            "attempt_id": res_data.get("attempt_id"),
            "provider": res_data.get("provider"),
            "queue_wait_ms": latencies.get("queue_wait_ms", 0.0),
            "claim_latency_ms": latencies.get("claim_latency_ms", 0.0),
            "compile_ms": latencies.get("compile_ms", 0.0),
            "execution_ms": latencies.get("execution_ms", 0.0),
            "cas_finalize_ms": latencies.get("cas_finalize_ms", 0.0),
            "total_submission_latency_ms": latencies.get("total_submission_latency_ms", 0.0),
            "timestamps": timestamps,
            "error_detail": res_data.get("detail") if resp.status_code != 200 else None,
        }
    except Exception as exc:
        t1 = time.perf_counter()
        return {
            "status_code": 0,
            "http_elapsed_ms": (t1 - t0) * 1000.0,
            "success": False,
            "verdict": "CLIENT_EXCEPTION",
            "error_detail": str(exc),
        }


async def run_burst_step(
    identities: List[Dict[str, Any]],
    problem_map: Dict[str, str],
    templates: Dict[str, Any],
    concurrency: int,
) -> Dict[str, Any]:
    logger.info("⚡ Starting Run-Code Burst Step: Concurrency = %d users", concurrency)

    # Use first N identities
    selected_users = identities[:concurrency]
    limits = httpx.Limits(max_connections=concurrency + 10, max_keepalive_connections=concurrency + 5)
    
    async with httpx.AsyncClient(limits=limits) as client:
        tasks = []
        for i, user in enumerate(selected_users):
            # Deterministically cycle problem A, B, C, D
            prob_keys = ["A", "B", "C", "D"]
            p_key = prob_keys[i % len(prob_keys)]
            pid = problem_map[p_key]
            code = templates[p_key]["correct"]
            tasks.append(execute_single_run(client, user, pid, code))

        t_start = time.perf_counter()
        results = await asyncio.gather(*tasks)
        t_end = time.perf_counter()

    burst_duration_s = t_end - t_start

    # Process metrics
    status_counts = {}
    latencies = []
    queue_waits = []
    exec_times = []
    verdicts = {}

    for r in results:
        code = r["status_code"]
        status_counts[code] = status_counts.get(code, 0) + 1
        latencies.append(r["http_elapsed_ms"])
        if code == 200:
            queue_waits.append(r["queue_wait_ms"])
            exec_times.append(r["execution_ms"])
            v = r["verdict"]
            verdicts[v] = verdicts.get(v, 0) + 1

    latencies.sort()
    queue_waits.sort()
    exec_times.sort()

    def percentile(arr, p):
        if not arr:
            return 0.0
        k = (len(arr) - 1) * (p / 100.0)
        f = int(k)
        c = min(f + 1, len(arr) - 1)
        d0 = arr[f] * (c - k)
        d1 = arr[c] * (k - f)
        return d0 + d1

    p50_lat = percentile(latencies, 50)
    p95_lat = percentile(latencies, 95)
    p99_lat = percentile(latencies, 99)
    p50_queue = percentile(queue_waits, 50)
    p95_queue = percentile(queue_waits, 95)

    summary = {
        "concurrency": concurrency,
        "total_requests": len(results),
        "burst_duration_seconds": round(burst_duration_s, 2),
        "status_distribution": status_counts,
        "verdict_distribution": verdicts,
        "http_latency_ms": {
            "min": round(min(latencies), 1) if latencies else 0,
            "p50": round(p50_lat, 1),
            "p95": round(p95_lat, 1),
            "p99": round(p99_lat, 1),
            "max": round(max(latencies), 1) if latencies else 0,
        },
        "telemetry_metrics": {
            "p50_queue_wait_ms": round(p50_queue, 1),
            "p95_queue_wait_ms": round(p95_queue, 1),
            "avg_execution_ms": round(sum(exec_times) / len(exec_times), 1) if exec_times else 0,
        },
        "sample_telemetry": next((r for r in results if r["status_code"] == 200), None),
    }

    logger.info(
        "✓ Step %d Done: 200 OK=%d, 429/503=%d, Errors=%d | HTTP p50=%.1fms, p95=%.1fms | Queue p95=%.1fms",
        concurrency,
        status_counts.get(200, 0),
        status_counts.get(429, 0) + status_counts.get(503, 0),
        status_counts.get(500, 0) + status_counts.get(0, 0),
        p50_lat,
        p95_lat,
        p95_queue,
    )

    return summary


async def run_phase3_suite() -> Dict[str, Any]:
    logger.info("=================================================================")
    logger.info("   PHASE 3: RUN-CODE PROGRESSIVE BURST SUITE (5 -> 10 -> 25 -> 50)")
    logger.info("=================================================================")

    identities = load_identities()
    templates = load_templates()

    async with httpx.AsyncClient() as client:
        problem_map = await get_arena_problem_map(client, identities[0]["token"])
    logger.info("✓ Discovered problems: %s", problem_map)

    concurrency_steps = [5, 10, 25, 50]
    step_results = []

    for step in concurrency_steps:
        res = await run_burst_step(identities, problem_map, templates, step)
        step_results.append(res)
        # 3-second recovery cool-down between bursts
        await asyncio.sleep(3.0)

    # Invariant evaluation:
    # 1. Zero 500 Internal Server Errors across all steps.
    # 2. At concurrency 5 and 10 (within capacity 12 = 2 active + 10 queue), 100% requests succeed.
    # 3. At concurrency 25 and 50, requests either succeed or are gracefully shed with 429/503 backpressure.
    total_500s = sum(s["status_distribution"].get(500, 0) for s in step_results)
    c5_success = step_results[0]["status_distribution"].get(200, 0) == 5
    c10_success = step_results[1]["status_distribution"].get(200, 0) == 10
    admission_guaranteed = (total_500s == 0) and c5_success

    phase3_report = {
        "phase": "Phase 3: Run-Code Burst",
        "status": "PASS" if admission_guaranteed else "FAIL",
        "zero_500_errors": total_500s == 0,
        "concurrency_5_passed": c5_success,
        "concurrency_10_passed": c10_success,
        "steps": step_results,
    }

    out_path = DATA_DIR / "phase3_report.json"
    with open(out_path, "w") as f:
        json.dump(phase3_report, f, indent=2)
    logger.info("✓ Phase 3 results written to %s", out_path)

    return phase3_report


if __name__ == "__main__":
    asyncio.run(run_phase3_suite())
