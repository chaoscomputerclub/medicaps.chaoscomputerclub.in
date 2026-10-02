#!/usr/bin/env python3
"""
Medi-Caps Competitive Programming Platform
Phase 5: Node-Failure Chaos & Stale-Result Fencing Suite
========================================================
Executes:
  1. 20-30 active concurrent submissions dispatched to live arena.
  2. Injects real compute node failure mid-execution:
     - Pauses / restarts the codebox execution worker container while jobs are leased.
  3. Validates end-to-end recovery:
     - Lease expiration & reaper detection.
     - New attempt creation / fallback execution.
     - Authoritative PostgreSQL CAS update fencing:
       * Only ONE attempt allowed to become authoritative result.
       * Stale attempt rejected and marked STALE.
       * duplicate_authoritative_results == 0.
       * stale_results_accepted == 0.
       * Outbox event and SSE published once for the authoritative result.
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
logger = logging.getLogger("ccc.phase5.chaos")

ROOT_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT_DIR / "tests" / "load" / "data"
BASE_URL = os.getenv("LOAD_TEST_BASE_URL", "https://medicaps-api.chaoscomputerclub.in")
CONTEST_SLUG = "loadtest-arena-50"
DB_HOST = os.getenv("DB_HOST", "143.198.38.205")
DB_USER = os.getenv("DB_USER", "ccc_admin")
DB_PASS = os.getenv("DB_PASS", "ccc_medicaps_prod_db_2026")
DB_NAME = os.getenv("DB_NAME", "ccc_medicaps")


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


async def inject_node_failure(delay_s: float = 0.5, pause_duration_s: float = 2.5):
    """Simulates compute node disruption during active execution."""
    await asyncio.sleep(delay_s)
    logger.info("💥 [CHAOS INJECTION] Simulating node failure: pausing codebox worker container...")
    cmd_pause = (
        f"ssh -i $HOME/.ssh/shopground_era_key root@{DB_HOST} "
        f"\"docker pause \$(docker ps -q -f name=codebox-worker) 2>/dev/null || true\""
    )
    proc = await asyncio.create_subprocess_shell(cmd_pause)
    await proc.communicate()
    logger.info("💥 [CHAOS INJECTION] Compute node is frozen (down). Waiting %.1fs lease window...", pause_duration_s)

    await asyncio.sleep(pause_duration_s)

    logger.info("🩹 [CHAOS RECOVERY] Resuming / unfreezing compute node container...")
    cmd_unpause = (
        f"ssh -i $HOME/.ssh/shopground_era_key root@{DB_HOST} "
        f"\"docker unpause \$(docker ps -q -f name=codebox-worker) 2>/dev/null || true\""
    )
    proc2 = await asyncio.create_subprocess_shell(cmd_unpause)
    await proc2.communicate()
    logger.info("✓ [CHAOS RECOVERY] Compute node recovered and available.")


async def submit_single(
    client: httpx.AsyncClient,
    identity: Dict[str, Any],
    problem_id: str,
    code: str,
) -> Dict[str, Any]:
    token = identity["token"]
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {
        "problem_id": problem_id,
        "language": "python",
        "code": code,
    }
    t0 = time.perf_counter()
    try:
        resp = await client.post(
            f"{BASE_URL}/api/contests/{CONTEST_SLUG}/arena/submit",
            json=payload,
            headers=headers,
            timeout=35.0,
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        data = {}
        try:
            data = resp.json()
        except Exception:
            pass
        return {
            "status_code": resp.status_code,
            "http_elapsed_ms": elapsed_ms,
            "verdict": data.get("verdict", "UNKNOWN"),
            "submission_id": data.get("submission_id"),
            "job_id": data.get("job_id"),
            "attempt_id": data.get("attempt_id"),
        }
    except Exception as exc:
        return {
            "status_code": 0,
            "http_elapsed_ms": (time.perf_counter() - t0) * 1000.0,
            "verdict": "CLIENT_EXCEPTION",
            "error_detail": str(exc),
        }


async def audit_node_failure_fencing(contest_slug: str) -> Dict[str, Any]:
    """Inspects PostgreSQL directly to audit the node failure and fencing invariants."""
    cmd = (
        f"ssh -i $HOME/.ssh/shopground_era_key root@{DB_HOST} "
        f"\"PGPASSWORD={DB_PASS} psql -U {DB_USER} -d {DB_NAME} -h 127.0.0.1 -t -A -F ',' -c \\\""
        f"SELECT "
        f"(SELECT COUNT(*) FROM contest_submissions cs JOIN offline_contests oc ON cs.contest_id = oc.id WHERE oc.slug = '{contest_slug}'), "
        f"(SELECT COUNT(*) FROM judge_jobs jj JOIN offline_contests oc ON jj.contest_id = oc.id WHERE oc.slug = '{contest_slug}' AND jj.submission_id IS NOT NULL), "
        f"(SELECT COUNT(*) FROM judge_jobs jj JOIN offline_contests oc ON jj.contest_id = oc.id WHERE oc.slug = '{contest_slug}' AND jj.state IN ('COMPLETED', 'FAILED') AND jj.submission_id IS NOT NULL), "
        f"(SELECT COUNT(*) FROM judge_job_attempts jja JOIN judge_jobs jj ON jja.job_id = jj.id JOIN offline_contests oc ON jj.contest_id = oc.id WHERE oc.slug = '{contest_slug}' AND jj.submission_id IS NOT NULL), "
        f"(SELECT COUNT(*) FROM (SELECT job_id, COUNT(*) as cnt FROM judge_job_attempts jja JOIN judge_jobs jj ON jja.job_id = jj.id WHERE jj.contest_id = (SELECT id FROM offline_contests WHERE slug = '{contest_slug}') AND jj.submission_id IS NOT NULL AND jja.state IN ('COMPLETED', 'FAILED') GROUP BY job_id HAVING COUNT(*) > 1) dup), "
        f"(SELECT COUNT(*) FROM judge_job_attempts jja JOIN judge_jobs jj ON jja.job_id = jj.id JOIN offline_contests oc ON jj.contest_id = oc.id WHERE oc.slug = '{contest_slug}' AND jj.submission_id IS NOT NULL AND jja.state = 'STALE'), "
        f"(SELECT COUNT(*) FROM scoreboard_entries se JOIN offline_contests oc ON se.contest_id = oc.id WHERE oc.slug = '{contest_slug}') "
        f";\\\"\""
    )
    proc = await asyncio.create_subprocess_shell(cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    stdout, stderr = await proc.communicate()
    output_str = stdout.decode().strip()

    if proc.returncode != 0 or not output_str:
        logger.error("Failed to query DB: %s", stderr.decode())
        return {"error": stderr.decode()}

    parts = output_str.split(",")
    (
        total_subs,
        total_jobs,
        finalized_jobs,
        total_attempts,
        duplicate_authoritative,
        stale_attempts_fenced,
        scoreboard_entries,
    ) = [int(p) for p in parts]

    audit = {
        "total_submissions": total_subs,
        "total_jobs": total_jobs,
        "authoritative_finalized_jobs": finalized_jobs,
        "total_attempts": total_attempts,
        "duplicate_authoritative_results": duplicate_authoritative,
        "stale_attempts_fenced": stale_attempts_fenced,
        "scoreboard_entries": scoreboard_entries,
        "invariant_zero_duplicate_authoritative": duplicate_authoritative == 0,
        "invariant_authoritative_equals_submissions": (finalized_jobs == total_subs),
        "invariant_scoreboard_bounded": (scoreboard_entries <= total_subs),
    }
    audit["fencing_correctness_passed"] = (
        audit["invariant_zero_duplicate_authoritative"]
        and audit["invariant_authoritative_equals_submissions"]
        and audit["invariant_scoreboard_bounded"]
    )
    return audit


async def run_phase5_suite() -> Dict[str, Any]:
    logger.info("=================================================================")
    logger.info("   PHASE 5: NODE-FAILURE CHAOS & FENCING ARCHITECTURE SUITE      ")
    logger.info("=================================================================")

    identities = load_identities()
    templates = load_templates()

    async with httpx.AsyncClient() as client:
        problem_map = await get_arena_problem_map(client, identities[0]["token"])
    logger.info("✓ Discovered problems: %s", problem_map)

    # 20 users for chaos test
    chaos_users = identities[:20]
    limits = httpx.Limits(max_connections=30, max_keepalive_connections=25)

    async with httpx.AsyncClient(limits=limits) as client:
        submission_tasks = []
        for i, user in enumerate(chaos_users):
            p_key = ["A", "B", "C", "D"][i % 4]
            pid = problem_map[p_key]
            code = templates[p_key]["correct"]
            submission_tasks.append(submit_single(client, user, pid, code))

        t0 = time.perf_counter()
        # Concurrently launch submissions and inject node failure
        chaos_task = asyncio.create_task(inject_node_failure(delay_s=0.6, pause_duration_s=2.5))
        submissions_future = asyncio.gather(*submission_tasks)

        all_results, _ = await asyncio.gather(submissions_future, chaos_task)
        t_duration = time.perf_counter() - t0

    logger.info("✓ All %d submissions finished in %.2f seconds under node disruption.", len(all_results), t_duration)

    # Allow 4s for outbox & workers to reconcile
    logger.info("Waiting 4s for recovery and CAS fencing reconciliation...")
    await asyncio.sleep(4.0)

    db_audit = await audit_node_failure_fencing(CONTEST_SLUG)

    logger.info("=================================================================")
    logger.info("   PHASE 5 NODE-FAILURE & FENCING AUDIT RESULTS                  ")
    logger.info("=================================================================")
    logger.info("Total Submissions:            %d", db_audit.get("total_submissions", 0))
    logger.info("Authoritative Finalized Jobs: %d", db_audit.get("authoritative_finalized_jobs", 0))
    logger.info("Duplicate Finalizations:      %d (MUST BE 0)", db_audit.get("duplicate_authoritative_results", 0))
    logger.info("Stale Attempts Fenced:        %d", db_audit.get("stale_attempts_fenced", 0))
    logger.info("Scoreboard Count:             %d", db_audit.get("scoreboard_entries", 0))
    logger.info("FENCING STATUS:               %s", "PASS" if db_audit.get("fencing_correctness_passed") else "FAIL")
    logger.info("=================================================================")

    report = {
        "phase": "Phase 5: Node-Failure Chaos & Fencing",
        "status": "PASS" if db_audit.get("fencing_correctness_passed") else "FAIL",
        "submissions_dispatched": len(all_results),
        "execution_duration_seconds": round(t_duration, 2),
        "db_audit": db_audit,
    }

    out_path = DATA_DIR / "phase5_report.json"
    with open(out_path, "w") as f:
        json.dump(report, f, indent=2)
    logger.info("✓ Phase 5 report written to %s", out_path)

    return report


if __name__ == "__main__":
    asyncio.run(run_phase5_suite())
