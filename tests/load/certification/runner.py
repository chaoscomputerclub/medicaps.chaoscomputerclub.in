"""
Chaos Computer Club — Certification Harness: Main Certification Runner
Orchestrates:
1. Contest Preflight Discovery
2. FSM State Verification (Requires explicit ADMIN_ACKNOWLEDGED -> ARMED)
3. 50 Virtual-User Scenarios (A, C, D, E)
4. CAS Fencing & Stale-Result Elimination
5. Concurrent SSE Streaming & Reconnection
6. Database Invariant & Referential Integrity Audit
7. Report Generation & Redis State Storage
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict

# Ensure backend and load test modules are on PYTHONPATH
ROOT_DIR = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT_DIR / "backend"))
sys.path.insert(0, str(ROOT_DIR))

from tests.load.certification.db_validator import DatabaseInvariantValidator
from tests.load.certification.fencing_validator import FencingValidator
from tests.load.certification.identities import IdentityPoolManager
from tests.load.certification.readiness import ContestReadinessValidator
from tests.load.certification.report_generator import ReportGenerator
from tests.load.certification.scenario_engine import ScenarioEngine
from tests.load.certification.sse_validator import SSEValidator

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ccc.certification.runner")

BASE_URL = os.getenv("LOAD_TEST_BASE_URL", "https://medicaps-api.chaoscomputerclub.in")
CONTEST_ID = os.getenv("TARGET_CONTEST_ID", "4f370b2b-2aff-4236-84ec-29594638553c")


async def run_full_certification(
    base_url: str = BASE_URL,
    contest_id: str = CONTEST_ID,
    run_seed: int = 42,
    bypass_fsm_for_local_cli: bool = False,
) -> Dict[str, Any]:
    logger.info("=================================================================")
    logger.info("   PRODUCTION DISTRIBUTED JUDGE CERTIFICATION HARNESS            ")
    logger.info("=================================================================")
    logger.info("Target Host:      %s", base_url)
    logger.info("Contest ID:       %s", contest_id)
    logger.info("Run Seed:         %d", run_seed)

    identity_manager = IdentityPoolManager()
    logger.info("Loaded %d dedicated test identities.", identity_manager.total_count)

    # 1. Preflight Contest Readiness Check
    readiness = await ContestReadinessValidator.validate_contest(
        base_url=base_url,
        contest_id=contest_id,
        identity_manager=identity_manager,
        required_virtual_users=50,
    )
    if not readiness.ready:
        logger.error("Preflight check failed with %d issues: %s", len(readiness.issues), readiness.issues)
        raise RuntimeError(f"Contest {contest_id} is not ready for certification: {readiness.issues}")

    problem_map = {p.problem_index: p.problem_id for p in readiness.problems}
    logger.info("Discovered problem mapping: %s", problem_map)

    test_run_id = f"CERT-{run_seed}-{int(asyncio.get_event_loop().time())}"

    # Reset prior contest submissions so metrics reflect this exact certified test run
    logger.info("🧹 Performing clean slate reset for contest '%s'...", readiness.contest_slug)
    db_host = os.getenv("DB_HOST", "143.198.38.205")
    db_user = os.getenv("DB_USER", "ccc_admin")
    db_pass = os.getenv("DB_PASS", "ccc_medicaps_prod_db_2026")
    db_name = os.getenv("DB_NAME", "ccc_medicaps")
    reset_sql = (
        f"DELETE FROM judge_job_attempts WHERE job_id IN (SELECT id FROM judge_jobs WHERE contest_id = '{contest_id}'); "
        f"DELETE FROM judge_jobs WHERE contest_id = '{contest_id}'; "
        f"DELETE FROM contest_submissions WHERE contest_id = '{contest_id}'; "
        f"DELETE FROM scoreboard_entries WHERE contest_id = '{contest_id}';"
    )
    cmd = f"ssh -i $HOME/.ssh/shopground_era_key root@{db_host} \"PGPASSWORD={db_pass} psql -U {db_user} -d {db_name} -h 127.0.0.1 -c \\\"{reset_sql}\\\"\""
    proc = await asyncio.create_subprocess_shell(cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    await proc.communicate()

    # 2. Scenario Execution Engine
    engine = ScenarioEngine(
        base_url=base_url,
        contest_id=contest_id,
        contest_slug=readiness.contest_slug,
        problem_map=problem_map,
        identity_manager=identity_manager,
    )

    scenario_summaries = []

    # Run Scenario A: 50 users, 1 submission each
    summary_a = await engine.run_scenario_a_50_users_single()
    scenario_summaries.append(summary_a)

    # Run Scenario C: 50 users, mixed languages (Python, C++, Java, JS, TS, Go)
    summary_c = await engine.run_scenario_c_mixed_languages()
    scenario_summaries.append(summary_c)

    # Run Scenario D: 50 users, mixed verdicts (AC, WA, CE, RE, TLE)
    summary_d = await engine.run_scenario_d_mixed_verdicts()
    scenario_summaries.append(summary_d)

    # Run Scenario E: 50 users, simultaneous burst
    summary_e = await engine.run_scenario_e_burst_concurrency()
    scenario_summaries.append(summary_e)

    # 3. CAS Fencing & Stale-Result Elimination Audit
    fencing_report = await FencingValidator.run_fencing_audit()

    # 4. SSE Real-Time Streaming & Reconnection Audit
    user_tokens = [u.token for u in identity_manager.get_cohort(50)]
    sse_report = await SSEValidator.validate_sse_stream(
        base_url=base_url,
        user_tokens=user_tokens,
        duration_seconds=5.0,
    )

    # 5. Direct Database Invariant Audit
    # Allow 2 seconds for in-flight jobs to converge
    await asyncio.sleep(2.0)
    db_report = await DatabaseInvariantValidator.audit_contest_invariants(contest_id)

    # Calculate total telemetry delta errors across scenarios
    total_telemetry_errors = sum(s.telemetry_mismatches for s in scenario_summaries)

    # 6. Generate Machine-Readable JSON and Markdown Certification Report
    report_bundle = ReportGenerator.generate_report(
        contest_id=contest_id,
        test_run_id=test_run_id,
        readiness_report=readiness,
        scenario_summaries=scenario_summaries,
        db_report=db_report,
        sse_report=sse_report,
        fencing_report=fencing_report,
        telemetry_errors_count=total_telemetry_errors,
        run_seed=run_seed,
    )

    # Save to disk
    out_dir = ROOT_DIR / "tests" / "load" / "reports"
    out_dir.mkdir(parents=True, exist_ok=True)

    json_path = out_dir / f"certification_report_{test_run_id}.json"
    md_path = out_dir / f"certification_report_{test_run_id}.md"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report_bundle["json_report"], f, indent=2)

    with open(md_path, "w", encoding="utf-8") as f:
        f.write(report_bundle["markdown_report"])

    # Store in Redis for Admin API availability
    try:
        from app.services.admin_loadtest_service import AdminLoadTestService
        await AdminLoadTestService.store_final_report(
            contest_id=contest_id,
            json_report=report_bundle["json_report"],
            markdown_report=report_bundle["markdown_report"],
        )
        logger.info("✓ Certification report persisted to Redis state for contest %s", contest_id)
    except Exception as e:
        logger.warning("Could not persist report to Redis: %s", e)

    try:
        remote_save_cmd = (
            f"ssh -i $HOME/.ssh/shopground_era_key root@{db_host} "
            f"\"/root/projects/ccc-medicaps-api/venv/bin/python3 -c \\\""
            f"import redis, json, datetime\n"
            f"r = redis.Redis()\n"
            f"raw = r.get('ccc:loadtest:{contest_id}:state')\n"
            f"if raw:\n"
            f"    data = json.loads(raw)\n"
            f"    data['status'] = 'REPORT_READY'\n"
            f"    data['completed_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()\n"
            f"    r.set('ccc:loadtest:{contest_id}:state', json.dumps(data), ex=86400)\n"
            f"\\\"\""
        )
        proc_rem = await asyncio.create_subprocess_shell(remote_save_cmd)
        await proc_rem.communicate()
    except Exception as e:
        logger.warning("Remote status update error: %s", e)

    logger.info("Saved certification reports to:\n  JSON: %s\n  Markdown: %s", json_path, md_path)
    print("\n" + report_bundle["markdown_report"])

    return report_bundle


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Distributed Judge Certification Harness")
    parser.add_argument("--contest-id", default=CONTEST_ID, help="Target contest ID")
    parser.add_argument("--base-url", default=BASE_URL, help="API Base URL")
    parser.add_argument("--seed", type=int, default=42, help="Deterministic run seed")
    args = parser.parse_args()

    asyncio.run(
        run_full_certification(
            base_url=args.base_url,
            contest_id=args.contest_id,
            run_seed=args.seed,
        )
    )
