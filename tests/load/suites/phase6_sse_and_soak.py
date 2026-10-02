#!/usr/bin/env python3
"""
Medi-Caps Competitive Programming Platform
Phase 6: SSE Validation & Production Soak Test Suite
=====================================================
Executes:
  1. SSE Realtime Stream Validation (50 virtual students):
     - Tracks per-student telemetry:
       * connections
       * successful_connections
       * disconnects
       * reconnects
       * last_event_id_sent
       * last_event_id_received
       * duplicate_event_count
       * out_of_order_event_count
       * missed_event_count
     - Injects intentional client disconnects during active scoreboard updates.
     - Tests Last-Event-ID replay and snapshot reconciliation.
  2. Extended Soak Test:
     - Continuous realistic student concurrency (20-50 users).
     - Mixed workload: Arena browsing, Run-Code, Submissions, Leaderboard polls.
     - Host resource telemetry monitoring (DB connections, memory, CPU, Redis).
     - Invariant verification: queue convergence, zero orphan jobs, zero duplicate CAS.
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional
import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ccc.phase6.sse_soak")

ROOT_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT_DIR / "tests" / "load" / "data"
BASE_URL = os.getenv("LOAD_TEST_BASE_URL", "https://medicaps-api.chaoscomputerclub.in")
CONTEST_SLUG = "loadtest-arena-50"
DB_HOST = os.getenv("DB_HOST", "143.198.38.205")
DB_USER = os.getenv("DB_USER", "ccc_admin")
DB_PASS = os.getenv("DB_PASS", "ccc_medicaps_prod_db_2026")
DB_NAME = os.getenv("DB_NAME", "ccc_medicaps")


@dataclass
class StudentSSETelemetry:
    user_handle: str
    connections: int = 0
    successful_connections: int = 0
    disconnects: int = 0
    reconnects: int = 0
    last_event_id_sent: Optional[int] = None
    last_event_id_received: Optional[int] = None
    duplicate_event_count: int = 0
    out_of_order_event_count: int = 0
    missed_event_count: int = 0
    resync_required_count: int = 0
    events_received: List[Dict[str, Any]] = field(default_factory=list)
    reconciled_leaderboard_rank: Optional[int] = None


def load_identities() -> List[Dict[str, Any]]:
    with open(DATA_DIR / "loadtest_identities.json", "r") as f:
        return json.load(f)


def load_templates() -> Dict[str, Any]:
    with open(DATA_DIR / "submissions.json", "r") as f:
        return json.load(f)


async def sse_listener_task(
    identity: Dict[str, Any],
    telemetry: StudentSSETelemetry,
    stop_event: asyncio.Event,
    intentional_disconnect_delay: Optional[float] = None,
):
    """
    Simulates a student maintaining an SSE connection to the contest stream.
    Supports disconnect injection, Last-Event-ID reconnection, and state reconciliation.
    """
    handle = identity["handle"]
    token = identity["token"]
    stream_url = f"{BASE_URL}/api/events/contest/{CONTEST_SLUG}/stream"

    client_timeout = httpx.Timeout(connect=10.0, read=40.0, write=10.0, pool=10.0)

    while not stop_event.is_set():
        telemetry.connections += 1
        if telemetry.connections > 1:
            telemetry.reconnects += 1
            telemetry.last_event_id_sent = telemetry.last_event_id_received

        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "text/event-stream",
            "Cache-Control": "no-cache",
        }
        if telemetry.last_event_id_sent is not None:
            headers["Last-Event-ID"] = str(telemetry.last_event_id_sent)

        connect_time = time.time()
        try:
            async with httpx.AsyncClient(timeout=client_timeout) as client:
                async with client.stream("GET", stream_url, headers=headers) as resp:
                    if resp.status_code == 200:
                        telemetry.successful_connections += 1

                    current_event_id: Optional[int] = None
                    current_event_type = "message"
                    current_data_lines: List[str] = []

                    async for line in resp.aiter_lines():
                        if stop_event.is_set():
                            break

                        # Check for intentional disconnect injection
                        if (
                            intentional_disconnect_delay
                            and (time.time() - connect_time) > intentional_disconnect_delay
                            and telemetry.disconnects == 0
                        ):
                            logger.info("✂️ [SSE Chaos] Intentionally disconnecting %s mid-stream", handle)
                            telemetry.disconnects += 1
                            break  # Close stream to trigger reconnect

                        if not line:
                            # End of SSE block
                            if current_data_lines:
                                raw_body = "\n".join(current_data_lines)
                                try:
                                    parsed = json.loads(raw_body)
                                except Exception:
                                    parsed = {"raw": raw_body}

                                # Process event ID sequence
                                if current_event_id is not None:
                                    if telemetry.last_event_id_received is not None:
                                        if current_event_id <= telemetry.last_event_id_received:
                                            telemetry.duplicate_event_count += 1
                                        elif current_event_id > telemetry.last_event_id_received + 1:
                                            diff = current_event_id - (telemetry.last_event_id_received + 1)
                                            telemetry.missed_event_count += diff
                                            telemetry.out_of_order_event_count += 1
                                    telemetry.last_event_id_received = current_event_id

                                if current_event_type == "resync_required":
                                    telemetry.resync_required_count += 1

                                telemetry.events_received.append({
                                    "id": current_event_id,
                                    "event": current_event_type,
                                    "data": parsed,
                                    "timestamp": time.time(),
                                })
                                current_data_lines = []
                            continue

                        if line.startswith(":"):
                            # Comment or heartbeat
                            continue
                        elif line.startswith("id:"):
                            try:
                                current_event_id = int(line[3:].strip())
                            except ValueError:
                                pass
                        elif line.startswith("event:"):
                            current_event_type = line[6:].strip()
                        elif line.startswith("data:"):
                            current_data_lines.append(line[5:].strip())

        except Exception as exc:
            pass

        telemetry.disconnects += 1
        if stop_event.is_set():
            break
        # Reconnection backoff
        await asyncio.sleep(1.0)

    # State reconciliation via REST if reconnected or missed events detected
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = {"Authorization": f"Bearer {token}"}
            lb_resp = await client.get(f"{BASE_URL}/api/scoreboards/{CONTEST_SLUG}", headers=headers)
            if lb_resp.status_code == 200:
                entries = lb_resp.json()
                for rank, row in enumerate(entries, start=1):
                    if row.get("handle") == handle or row.get("member_handle") == handle:
                        telemetry.reconciled_leaderboard_rank = rank
                        break
    except Exception:
        pass


async def get_server_metrics() -> Dict[str, Any]:
    """Captures CPU, memory, DB connections, and Redis status from remote host."""
    cmd = (
        f"ssh -i $HOME/.ssh/shopground_era_key root@{DB_HOST} "
        f"\"bash -c '"
        f"echo -n DB_CONNS:; PGPASSWORD={DB_PASS} psql -U {DB_USER} -d {DB_NAME} -h 127.0.0.1 -t -c \\\"SELECT count(*) FROM pg_stat_activity;\\\" | tr -d \\\" \\n\\\"; "
        f"echo -n ,MEM_FREE_MB:; free -m | awk \\\"/Mem:/ {{print \\\$4}}\\\"; "
        f"echo -n ,LOAD_1M:; uptime | awk -F\\\"load average:\\\" \\\"{{print \\\$2}}\\\" | cut -d, -f1 | tr -d \\\" \\\"; "
        f"echo -n ,REDIS_CONNS:; redis-cli info clients | awk -F: \\\"/connected_clients/ {{print \\\$2}}\\\" | tr -d \\\"\\r\\n\\\"; "
        f"'\""
    )
    try:
        proc = await asyncio.create_subprocess_shell(cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        stdout, stderr = await proc.communicate()
        raw = stdout.decode().strip()
        parts = dict(item.split(":") for item in raw.split(",") if ":" in item)
        return {
            "db_connections": int(parts.get("DB_CONNS", 0)),
            "free_memory_mb": int(parts.get("MEM_FREE_MB", 0)),
            "load_1m": float(parts.get("LOAD_1M", 0.0)),
            "redis_connections": int(parts.get("REDIS_CONNS", 0)),
        }
    except Exception as exc:
        return {"error": str(exc)}


async def run_sse_validation_subphase(identities: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Runs Phase 6 Part A: 50-student SSE streaming with intentional disconnects & recovery."""
    logger.info("=================================================================")
    logger.info("   PHASE 6.1: 50-STUDENT REALTIME SSE PROTOCOL VALIDATION         ")
    logger.info("=================================================================")

    stop_event = asyncio.Event()
    telemetry_map: Dict[str, StudentSSETelemetry] = {}
    listener_tasks = []

    # Connect all 50 virtual students
    for i, user in enumerate(identities[:50]):
        handle = user["handle"]
        telem = StudentSSETelemetry(user_handle=handle)
        telemetry_map[handle] = telem
        # Intentionally disconnect first 15 students after 2.0s
        disc_delay = 2.0 if i < 15 else None
        listener_tasks.append(asyncio.create_task(sse_listener_task(user, telem, stop_event, disc_delay)))

    logger.info("✓ Connected 50 virtual student SSE streams to contest arena.")
    await asyncio.sleep(1.5)

    # Dispatch live submissions while students are listening to generate real SSE broadcasts
    templates = load_templates()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/api/contests/{CONTEST_SLUG}/arena",
            headers={"Authorization": f"Bearer {identities[0]['token']}"},
            timeout=15.0,
        )
        data = resp.json()
        problem_id = data.get("problems", [])[0]["id"]

    logger.info("🚀 Disagreeing / dispatching burst of 5 submissions to drive scoreboard SSE...")
    sub_tasks = []
    async with httpx.AsyncClient(limits=httpx.Limits(max_connections=10)) as client:
        for user in identities[20:25]:
            sub_tasks.append(
                client.post(
                    f"{BASE_URL}/api/contests/{CONTEST_SLUG}/arena/submit",
                    json={"problem_id": problem_id, "language": "python", "code": templates["A"]["correct"]},
                    headers={"Authorization": f"Bearer {user['token']}"},
                    timeout=20.0,
                )
            )
        await asyncio.gather(*sub_tasks, return_exceptions=True)

    logger.info("✓ Submissions processed. Allowing 5s for SSE propagation & reconnection...")
    await asyncio.sleep(5.0)

    # Stop all streams
    stop_event.set()
    await asyncio.gather(*listener_tasks, return_exceptions=True)

    # Tally metrics
    total_conns = sum(t.connections for t in telemetry_map.values())
    total_success = sum(t.successful_connections for t in telemetry_map.values())
    total_reconnects = sum(t.reconnects for t in telemetry_map.values())
    total_duplicates = sum(t.duplicate_event_count for t in telemetry_map.values())
    total_out_of_order = sum(t.out_of_order_event_count for t in telemetry_map.values())
    total_missed = sum(t.missed_event_count for t in telemetry_map.values())
    reconciled_count = sum(1 for t in telemetry_map.values() if t.reconciled_leaderboard_rank is not None)

    sse_result = {
        "virtual_students": len(telemetry_map),
        "total_connections_attempted": total_conns,
        "successful_connections": total_success,
        "reconnects": total_reconnects,
        "intentional_disconnects_injected": 15,
        "duplicate_event_count": total_duplicates,
        "out_of_order_event_count": total_out_of_order,
        "missed_event_count": total_missed,
        "state_reconciled_students": reconciled_count,
        "sse_ordering_passed": (total_duplicates == 0 and total_out_of_order == 0),
        "sse_connectivity_passed": (total_success >= 50),
    }

    logger.info("-----------------------------------------------------------------")
    logger.info("SSE Protocol Audit: Connections=%d, Success=%d, Reconnects=%d", total_conns, total_success, total_reconnects)
    logger.info("Duplicates: %d | Out-of-Order: %d | Missed: %d", total_duplicates, total_out_of_order, total_missed)
    logger.info("SSE ORDERING STATUS: %s", "PASS" if sse_result["sse_ordering_passed"] else "FAIL")
    logger.info("-----------------------------------------------------------------")

    return sse_result


async def run_soak_subphase(identities: List[Dict[str, Any]], duration_minutes: float = 5.0) -> Dict[str, Any]:
    """
    Runs Phase 6 Part B: Sustained Concurrency Soak.
    Executes continuous rounds of Run-Code, Submissions, Leaderboard polls, and Host telemetry.
    """
    logger.info("=================================================================")
    logger.info("   PHASE 6.2: SUSTAINED STABILITY SOAK TEST (%.1f MIN)           ", duration_minutes)
    logger.info("=================================================================")

    duration_seconds = duration_minutes * 60.0
    t_end = time.time() + duration_seconds

    templates = load_templates()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/api/contests/{CONTEST_SLUG}/arena",
            headers={"Authorization": f"Bearer {identities[0]['token']}"},
            timeout=15.0,
        )
        p_map = {p["problem_index"]: p["id"] for p in resp.json().get("problems", [])}

    request_counts = {"run_code": 0, "submit": 0, "leaderboard": 0, "arena": 0}
    status_counts: Dict[int, int] = {}
    latencies: List[float] = []
    host_samples: List[Dict[str, Any]] = []

    round_idx = 0
    limits = httpx.Limits(max_connections=40, max_keepalive_connections=30)

    async with httpx.AsyncClient(limits=limits) as client:
        while time.time() < t_end:
            round_idx += 1
            t_round_start = time.time()

            # Dispatch mixed batch from 15 active students
            tasks = []
            selected_users = identities[(round_idx * 5) % 35 : (round_idx * 5) % 35 + 15]

            for i, user in enumerate(selected_users):
                token = user["token"]
                headers = {"Authorization": f"Bearer {token}"}

                if i % 3 == 0:
                    # Run Code
                    payload = {
                        "problem_id": p_map["A"],
                        "language": "python",
                        "code": templates["A"]["correct"],
                    }
                    tasks.append(("run_code", client.post(f"{BASE_URL}/api/contests/{CONTEST_SLUG}/arena/run", json=payload, headers=headers, timeout=25.0)))
                elif i % 3 == 1:
                    # Submit Code
                    p_key = ["A", "B", "C", "D"][i % 4]
                    payload = {
                        "problem_id": p_map[p_key],
                        "language": "python",
                        "code": templates[p_key]["correct"],
                    }
                    tasks.append(("submit", client.post(f"{BASE_URL}/api/contests/{CONTEST_SLUG}/arena/submit", json=payload, headers=headers, timeout=30.0)))
                else:
                    # Scoreboard Poll
                    tasks.append(("leaderboard", client.get(f"{BASE_URL}/api/scoreboards/{CONTEST_SLUG}", headers=headers, timeout=10.0)))

            # Execute batch
            results = await asyncio.gather(*(t[1] for t in tasks), return_exceptions=True)

            for (op, _), res in zip(tasks, results):
                request_counts[op] += 1
                if isinstance(res, httpx.Response):
                    code = res.status_code
                    status_counts[code] = status_counts.get(code, 0) + 1
                    latencies.append(res.elapsed.total_seconds() * 1000.0)
                else:
                    status_counts[0] = status_counts.get(0, 0) + 1

            # Sample server health every 30s
            if round_idx % 3 == 0:
                metrics = await get_server_metrics()
                metrics["timestamp"] = time.time()
                host_samples.append(metrics)
                logger.info(
                    "📊 [Soak Progress] Round %d (Elapsed %.1fs/%.1fs) | 200s: %d, 5xx: %d | Host: DB_Conns=%s, FreeMem=%sMB, Load=%s",
                    round_idx,
                    time.time() - (t_end - duration_seconds),
                    duration_seconds,
                    status_counts.get(200, 0),
                    status_counts.get(500, 0) + status_counts.get(502, 0) + status_counts.get(503, 0),
                    metrics.get("db_connections"),
                    metrics.get("free_memory_mb"),
                    metrics.get("load_1m"),
                )

            # Rest 3.0s between waves
            await asyncio.sleep(3.0)

    # Post-soak invariant audit
    logger.info("✓ Soak test completed. Performing post-soak database & queue audit...")
    cmd_audit = (
        f"ssh -i $HOME/.ssh/shopground_era_key root@{DB_HOST} "
        f"\"PGPASSWORD={DB_PASS} psql -U {DB_USER} -d {DB_NAME} -h 127.0.0.1 -t -A -F ',' -c \\\""
        f"SELECT "
        f"(SELECT COUNT(*) FROM contest_submissions cs JOIN offline_contests oc ON cs.contest_id = oc.id WHERE oc.slug = '{CONTEST_SLUG}'), "
        f"(SELECT COUNT(*) FROM judge_jobs jj JOIN offline_contests oc ON jj.contest_id = oc.id WHERE oc.slug = '{CONTEST_SLUG}' AND jj.state IN ('COMPLETED', 'FAILED') AND jj.submission_id IS NOT NULL), "
        f"(SELECT COUNT(*) FROM judge_jobs jj JOIN offline_contests oc ON jj.contest_id = oc.id WHERE oc.slug = '{CONTEST_SLUG}' AND jj.state IN ('QUEUED', 'PROCESSING') AND jj.submission_id IS NOT NULL), "
        f"(SELECT COUNT(*) FROM (SELECT job_id, COUNT(*) FROM judge_job_attempts jja JOIN judge_jobs jj ON jja.job_id = jj.id WHERE jj.contest_id = (SELECT id FROM offline_contests WHERE slug = '{CONTEST_SLUG}') AND jja.state IN ('COMPLETED', 'FAILED') GROUP BY job_id HAVING COUNT(*) > 1) d), "
        f"(SELECT COUNT(*) FROM scoreboard_entries se JOIN offline_contests oc ON se.contest_id = oc.id WHERE oc.slug = '{CONTEST_SLUG}') "
        f";\\\"\""
    )
    proc = await asyncio.create_subprocess_shell(cmd_audit, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    stdout, _ = await proc.communicate()
    parts = [int(p) for p in stdout.decode().strip().split(",")]
    total_subs, final_jobs, active_left, dup_authoritative, sc_count = parts

    total_requests = sum(request_counts.values())
    total_200 = status_counts.get(200, 0)
    http_reliability_pct = (total_200 / total_requests * 100.0) if total_requests else 0.0

    latencies.sort()
    p50 = latencies[int(len(latencies) * 0.50)] if latencies else 0.0
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0.0
    p99 = latencies[int(len(latencies) * 0.99)] if latencies else 0.0

    soak_summary = {
        "soak_duration_minutes": duration_minutes,
        "total_requests": total_requests,
        "operations": request_counts,
        "status_distribution": status_counts,
        "http_reliability_pct": round(http_reliability_pct, 2),
        "latency_p50_ms": round(p50, 1),
        "latency_p95_ms": round(p95, 1),
        "latency_p99_ms": round(p99, 1),
        "host_telemetry_samples": host_samples,
        "db_invariants": {
            "total_submissions": total_subs,
            "finalized_jobs": final_jobs,
            "active_jobs_left": active_left,
            "duplicate_authoritative": dup_authoritative,
            "scoreboard_entries": sc_count,
            "queue_converged": active_left == 0,
            "authoritative_exact": (final_jobs == total_subs),
            "zero_duplicates": dup_authoritative == 0,
        },
        "soak_stability_passed": (
            http_reliability_pct >= 99.0
            and active_left == 0
            and dup_authoritative == 0
            and final_jobs == total_subs
        ),
    }

    logger.info("=================================================================")
    logger.info("   SOAK TEST INVARIANT VERIFICATION SUMMARY                      ")
    logger.info("=================================================================")
    logger.info("Total Requests Executed:    %d", total_requests)
    logger.info("HTTP Reliability:           %.2f%%", http_reliability_pct)
    logger.info("Total Submissions:          %d", total_subs)
    logger.info("Finalized Jobs:             %d", final_jobs)
    logger.info("Active Jobs Left in Queue:  %d (MUST BE 0)", active_left)
    logger.info("Duplicate Authoritative:    %d (MUST BE 0)", dup_authoritative)
    logger.info("Scoreboard Total:           %d", sc_count)
    logger.info("SOAK STABILITY STATUS:      %s", "PASS" if soak_summary["soak_stability_passed"] else "FAIL")
    logger.info("=================================================================")

    return soak_summary


async def run_phase6_suite(soak_minutes: float = 5.0) -> Dict[str, Any]:
    logger.info("Starting Phase 6 (SSE Protocol Validation & Sustained Soak Test)...")

    identities = load_identities()

    # Part A: SSE Stream Validation
    sse_report = await run_sse_validation_subphase(identities)

    # Part B: Soak Test
    soak_report = await run_soak_subphase(identities, duration_minutes=soak_minutes)

    full_report = {
        "phase": "Phase 6: SSE Validation & Production Soak",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sse_report": sse_report,
        "soak_report": soak_report,
        "overall_phase6_passed": sse_report["sse_ordering_passed"] and soak_report["soak_stability_passed"],
    }

    out_path = DATA_DIR / "phase6_report.json"
    with open(out_path, "w") as f:
        json.dump(full_report, f, indent=2)
    logger.info("✓ Phase 6 report written to %s", out_path)

    return full_report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Phase 6: SSE Validation and Production Soak Suite")
    parser.add_argument("--soak-minutes", type=float, default=3.0, help="Duration of concurrency soak in minutes")
    args = parser.parse_args()

    asyncio.run(run_phase6_suite(soak_minutes=args.soak_minutes))
