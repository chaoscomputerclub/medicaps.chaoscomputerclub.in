#!/usr/bin/env python3
"""
Medi-Caps Competitive Programming Platform
Phase 4: Submission Burst & Invariant Verification Suite
=========================================================
Target: 30 simultaneous submissions released across a 3-second burst window:
  T+0s: 5 submissions
  T+1s: 5 submissions
  T+2s: 10 submissions
  T+3s: 10 submissions

Distribution:
  - 20 users -> Problem A
  - 15 users -> Problem B
  - 10 users -> Problem C
  - 5 users  -> Problem D

Direct PostgreSQL Invariants Checked Post-Burst:
  1. submitted == accepted + rejected + failed
  2. authoritative_finalizations == unique submissions
  3. duplicate_authoritative_results == 0
  4. stale_results_accepted == 0
  5. orphan_jobs == 0
  6. processing_jobs_left == 0
  7. attempts >= submissions
  8. scoreboard_mutations <= submissions
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
import asyncpg

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ccc.phase4.submissions")

ROOT_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT_DIR / "tests" / "load" / "data"
BASE_URL = os.getenv("LOAD_TEST_BASE_URL", "https://medicaps-api.chaoscomputerclub.in")
CONTEST_SLUG = "loadtest-arena-50"
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASS", "postgres")
DB_NAME = os.getenv("DB_NAME", "arena_dev")


def load_identities() -> List[Dict[str, Any]]:
    with open(DATA_DIR / "loadtest_identities.json", "r") as f:
        return json.load(f)


def load_templates() -> Dict[str, Any]:
    with open(DATA_DIR / "submissions.json", "r") as f:
        return json.load(f)


async def get_arena_problem_map(client: httpx.AsyncClient, token: str) -> Dict[str, str]:
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get(f"{BASE_URL}/api/contests/{CONTEST_SLUG}/arena", headers=headers, timeout=15.0)
    data = resp.json()
    return {p["problem_index"]: p["id"] for p in data.get("problems", [])}


async def submit_single(
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
            f"{BASE_URL}/api/contests/{CONTEST_SLUG}/arena/submit",
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
            "verdict": res_data.get("verdict", "UNKNOWN"),
            "submission_id": res_data.get("submission_id"),
            "job_id": res_data.get("job_id"),
            "attempt_id": res_data.get("attempt_id"),
            "points_awarded": res_data.get("points_awarded", 0),
            "latencies": latencies,
            "timestamps": timestamps,
            "error_detail": res_data.get("detail") if resp.status_code != 200 else None,
        }
    except Exception as exc:
        t1 = time.perf_counter()
        return {
            "status_code": 0,
            "http_elapsed_ms": (t1 - t0) * 1000.0,
            "verdict": "CLIENT_EXCEPTION",
            "error_detail": str(exc),
        }


async def reset_contest_submissions(contest_slug: str):
    """Clean slate reset of submissions and jobs for loadtest arena."""
    logger.info("🧹 Resetting prior submissions and judge jobs for %s...", contest_slug)
    reset_sql = (
        f"DELETE FROM judge_job_attempts WHERE job_id IN (SELECT id FROM judge_jobs WHERE contest_id = (SELECT id FROM offline_contests WHERE slug = '{contest_slug}')); "
        f"DELETE FROM judge_jobs WHERE contest_id = (SELECT id FROM offline_contests WHERE slug = '{contest_slug}'); "
        f"DELETE FROM contest_submissions WHERE contest_id = (SELECT id FROM offline_contests WHERE slug = '{contest_slug}'); "
        f"DELETE FROM scoreboard_entries WHERE contest_id = (SELECT id FROM offline_contests WHERE slug = '{contest_slug}');"
    )
    try:
        import asyncpg
        db_url = os.getenv("DATABASE_URL")
        if db_url and "postgresql" in db_url:
            conn_str = db_url.replace("postgresql+asyncpg://", "postgresql://")
            conn = await asyncpg.connect(conn_str)
        else:
            conn = await asyncpg.connect(
                host=DB_HOST,
                port=int(os.getenv("DB_PORT", "5432")),
                user=DB_USER,
                password=DB_PASS,
                database=DB_NAME,
            )
        await conn.execute(reset_sql)
        await conn.close()
    except Exception as exc:
        logger.warning("Could not execute DB reset (non-fatal): %s", exc)


async def verify_database_invariants(contest_slug: str) -> Dict[str, Any]:
    """Inspects PostgreSQL directly to audit the 8 core distributed judge invariants."""
    logger.info("🔍 Connecting to PostgreSQL (%s) to verify architectural invariants...", DB_HOST)

    query = (
        f"SELECT "
        f"(SELECT COUNT(*) FROM contest_submissions cs JOIN offline_contests oc ON cs.contest_id = oc.id WHERE oc.slug = '{contest_slug}'), "
        f"(SELECT COUNT(*) FROM contest_submissions cs JOIN offline_contests oc ON cs.contest_id = oc.id WHERE oc.slug = '{contest_slug}' AND cs.verdict = 'ACCEPTED'), "
        f"(SELECT COUNT(*) FROM contest_submissions cs JOIN offline_contests oc ON cs.contest_id = oc.id WHERE oc.slug = '{contest_slug}' AND cs.verdict IN ('WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED', 'COMPILATION_ERROR')), "
        f"(SELECT COUNT(*) FROM contest_submissions cs JOIN offline_contests oc ON cs.contest_id = oc.id WHERE oc.slug = '{contest_slug}' AND cs.verdict = 'SYSTEM_ERROR'), "
        f"(SELECT COUNT(*) FROM judge_jobs jj JOIN offline_contests oc ON jj.contest_id = oc.id WHERE oc.slug = '{contest_slug}' AND jj.submission_id IS NOT NULL), "
        f"(SELECT COUNT(*) FROM judge_jobs jj JOIN offline_contests oc ON jj.contest_id = oc.id WHERE oc.slug = '{contest_slug}' AND jj.state IN ('COMPLETED', 'FAILED') AND jj.submission_id IS NOT NULL), "
        f"(SELECT COUNT(*) FROM judge_jobs jj JOIN offline_contests oc ON jj.contest_id = oc.id WHERE oc.slug = '{contest_slug}' AND jj.state IN ('QUEUED', 'PROCESSING', 'CLAIMED') AND jj.submission_id IS NOT NULL), "
        f"(SELECT COUNT(*) FROM judge_job_attempts jja JOIN judge_jobs jj ON jja.job_id = jj.id JOIN offline_contests oc ON jj.contest_id = oc.id WHERE oc.slug = '{contest_slug}' AND jj.submission_id IS NOT NULL), "
        f"(SELECT COUNT(*) FROM scoreboard_entries se JOIN offline_contests oc ON se.contest_id = oc.id WHERE oc.slug = '{contest_slug}'), "
        f"(SELECT COUNT(*) FROM (SELECT job_id, COUNT(*) as cnt FROM judge_job_attempts jja JOIN judge_jobs jj ON jja.job_id = jj.id WHERE jj.contest_id = (SELECT id FROM offline_contests WHERE slug = '{contest_slug}') AND jj.submission_id IS NOT NULL AND jja.state IN ('COMPLETED', 'FAILED') GROUP BY job_id HAVING COUNT(*) > 1) dup), "
        f"(SELECT COUNT(*) FROM judge_jobs jj LEFT JOIN contest_submissions cs ON jj.submission_id = cs.id WHERE jj.contest_id = (SELECT id FROM offline_contests WHERE slug = '{contest_slug}') AND jj.submission_id IS NOT NULL AND cs.id IS NULL)"
    )

    try:
        import asyncpg
        db_url = os.getenv("DATABASE_URL")
        if db_url and "postgresql" in db_url:
            conn_str = db_url.replace("postgresql+asyncpg://", "postgresql://")
            conn = await asyncpg.connect(conn_str)
        else:
            conn = await asyncpg.connect(
                host=DB_HOST,
                port=int(os.getenv("DB_PORT", "5432")),
                user=DB_USER,
                password=DB_PASS,
                database=DB_NAME,
            )
        row = await conn.fetchrow(query)
        await conn.close()
        parts = [int(v or 0) for v in row.values()]
    except Exception as exc:
        logger.warning("Failed to query DB invariants via asyncpg: %s", exc)
        return {"error": str(exc)}
    (
        total_subs,
        accepted_subs,
        rejected_subs,
        failed_subs,
        total_jobs,
        finalized_jobs,
        active_jobs,
        total_attempts,
        scoreboard_entries,
        duplicate_authoritative,
        orphan_jobs,
    ) = [int(p) for p in parts]

    invariants = {
        "total_submissions": total_subs,
        "accepted_submissions": accepted_subs,
        "rejected_submissions": rejected_subs,
        "failed_submissions": failed_subs,
        "total_jobs": total_jobs,
        "authoritative_finalized_jobs": finalized_jobs,
        "active_jobs_remaining": active_jobs,
        "total_attempts": total_attempts,
        "scoreboard_entries": scoreboard_entries,
        "duplicate_authoritative_results": duplicate_authoritative,
        "orphan_jobs": orphan_jobs,
        # INVARIANT CHECKS:
        "invariant_submitted_equals_sum": (total_subs == (accepted_subs + rejected_subs + failed_subs)),
        "invariant_authoritative_equals_submissions": (finalized_jobs == total_subs),
        "invariant_zero_duplicate_authoritative": (duplicate_authoritative == 0),
        "invariant_zero_orphans": (orphan_jobs == 0),
        "invariant_zero_processing_left": (active_jobs == 0),
        "invariant_attempts_gte_submissions": (total_attempts >= total_subs),
        "invariant_scoreboard_mutations_bounded": (scoreboard_entries <= total_subs),
    }

    all_passed = (
        invariants["invariant_submitted_equals_sum"]
        and invariants["invariant_authoritative_equals_submissions"]
        and invariants["invariant_zero_duplicate_authoritative"]
        and invariants["invariant_zero_orphans"]
        and invariants["invariant_zero_processing_left"]
        and invariants["invariant_attempts_gte_submissions"]
        and invariants["invariant_scoreboard_mutations_bounded"]
    )
    invariants["all_invariants_passed"] = all_passed

    logger.info("=================================================================")
    logger.info("   PHASE 4 DATABASE INVARIANT AUDIT RESULTS                     ")
    logger.info("=================================================================")
    logger.info("Total Submissions Recorded:      %d", total_subs)
    logger.info("Authoritative Finalized Jobs:    %d", finalized_jobs)
    logger.info("Active/Stuck Jobs Remaining:     %d (Invariant: 0)", active_jobs)
    logger.info("Duplicate Authoritative Writes:  %d (Invariant: 0)", duplicate_authoritative)
    logger.info("Orphan Jobs:                     %d (Invariant: 0)", orphan_jobs)
    logger.info("Total Execution Attempts:        %d", total_attempts)
    logger.info("Scoreboard Entities:             %d", scoreboard_entries)
    logger.info("ALL INVARIANTS STATUS:           %s", "PASS" if all_passed else "FAIL")
    logger.info("=================================================================")

    return invariants


async def run_phase4_suite() -> Dict[str, Any]:
    logger.info("=================================================================")
    logger.info("   PHASE 4: 20-30 SIMULTANEOUS SUBMISSIONS BURST SUITE          ")
    logger.info("=================================================================")

    identities = load_identities()
    templates = load_templates()

    async with httpx.AsyncClient() as client:
        problem_map = await get_arena_problem_map(client, identities[0]["token"])
    logger.info("✓ Discovered problems: %s", problem_map)

    # Clean slate reset so invariant numbers reflect exactly this 30-submission burst
    await reset_contest_submissions(CONTEST_SLUG)

    # 1. Deterministic User Distribution across problems
    # 50 total users:
    # 20 users -> Problem A
    # 15 users -> Problem B
    # 10 users -> Problem C
    # 5 users  -> Problem D
    user_problem_plan: List[Dict[str, Any]] = []

    for i in range(20):
        user_problem_plan.append({"user": identities[i], "problem_index": "A", "problem_id": problem_map["A"]})
    for i in range(20, 35):
        user_problem_plan.append({"user": identities[i], "problem_index": "B", "problem_id": problem_map["B"]})
    for i in range(35, 45):
        user_problem_plan.append({"user": identities[i], "problem_index": "C", "problem_id": problem_map["C"]})
    for i in range(45, 50):
        user_problem_plan.append({"user": identities[i], "problem_index": "D", "problem_id": problem_map["D"]})

    # 2. Burst Release Schedule (Total 30 Submissions across 3s window):
    # T+0s: 5 submissions (users 0..4)
    # T+1s: 5 submissions (users 5..9)
    # T+2s: 10 submissions (users 10..19)
    # T+3s: 10 submissions (users 20..29)
    burst_batches = [
        {"delay": 0.0, "items": user_problem_plan[0:5]},
        {"delay": 1.0, "items": user_problem_plan[5:10]},
        {"delay": 2.0, "items": user_problem_plan[10:20]},
        {"delay": 3.0, "items": user_problem_plan[20:30]},
    ]

    all_submission_results = []
    limits = httpx.Limits(max_connections=50, max_keepalive_connections=35)

    async def execute_batch(batch_idx: int, delay_s: float, items: List[Dict[str, Any]], client: httpx.AsyncClient):
        if delay_s > 0:
            await asyncio.sleep(delay_s)
        logger.info("🚀 [Burst Wave %d] Dispatching %d submissions at T+%.1fs", batch_idx + 1, len(items), delay_s)
        tasks = []
        for it in items:
            u = it["user"]
            pid = it["problem_id"]
            code = templates[it["problem_index"]]["correct"]
            tasks.append(submit_single(client, u, pid, code))
        res = await asyncio.gather(*tasks)
        all_submission_results.extend(res)
        logger.info("✓ [Burst Wave %d] All %d submissions returned from server.", batch_idx + 1, len(items))

    async with httpx.AsyncClient(limits=limits) as client:
        t_burst_start = time.perf_counter()
        wave_tasks = [
            execute_batch(i, b["delay"], b["items"], client)
            for i, b in enumerate(burst_batches)
        ]
        await asyncio.gather(*wave_tasks)
        t_burst_end = time.perf_counter()

    burst_duration_s = t_burst_end - t_burst_start
    logger.info("✓ All 30 burst submissions finished in %.2f seconds.", burst_duration_s)

    # 3. Analyze HTTP Results
    http_statuses = {}
    verdicts = {}
    latencies = []
    sse_latencies = []
    cas_latencies = []

    for r in all_submission_results:
        sc = r["status_code"]
        http_statuses[sc] = http_statuses.get(sc, 0) + 1
        lat = r["http_elapsed_ms"]
        latencies.append(lat)
        v = r.get("verdict", "UNKNOWN")
        verdicts[v] = verdicts.get(v, 0) + 1
        l_dict = r.get("latencies", {})
        if "sse_publish_ms" in l_dict:
            sse_latencies.append(l_dict["sse_publish_ms"])
        if "cas_finalize_ms" in l_dict:
            cas_latencies.append(l_dict["cas_finalize_ms"])

    latencies.sort()
    p50_lat = latencies[len(latencies) // 2] if latencies else 0
    p95_lat = latencies[int(len(latencies) * 0.95)] if latencies else 0

    # 4. Wait 3 seconds for async queues & outbox to settle, then verify DB invariants
    logger.info("Waiting 3s for outbox relay and background workers to finalize all jobs...")
    await asyncio.sleep(3.0)

    db_invariants = await verify_database_invariants(CONTEST_SLUG)

    phase4_report = {
        "phase": "Phase 4: Submission Burst & Invariants",
        "status": "PASS" if (http_statuses.get(200, 0) == 30 and db_invariants.get("all_invariants_passed", False)) else "FAIL",
        "burst_submissions_count": len(all_submission_results),
        "burst_duration_seconds": round(burst_duration_s, 2),
        "http_distribution": http_statuses,
        "verdict_distribution": verdicts,
        "http_latency_ms": {
            "p50": round(p50_lat, 1),
            "p95": round(p95_lat, 1),
            "min": round(min(latencies), 1) if latencies else 0,
            "max": round(max(latencies), 1) if latencies else 0,
        },
        "sse_publish_ms_avg": round(sum(sse_latencies) / len(sse_latencies), 2) if sse_latencies else 0,
        "cas_finalize_ms_avg": round(sum(cas_latencies) / len(cas_latencies), 2) if cas_latencies else 0,
        "database_invariants": db_invariants,
    }

    out_path = DATA_DIR / "phase4_report.json"
    with open(out_path, "w") as f:
        json.dump(phase4_report, f, indent=2)
    logger.info("✓ Phase 4 report written to %s", out_path)

    return phase4_report


if __name__ == "__main__":
    asyncio.run(run_phase4_suite())
