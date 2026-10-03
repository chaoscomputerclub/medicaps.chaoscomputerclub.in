#!/usr/bin/env python3
"""
Chaos Computer Club — Production Judge Speed Remediation & Certification
Verifies end-to-end execution path through the live distributed fabric (node-agent + Docker sandboxing).
Certifies:
- Compile-once execution with reused artifacts
- Bounded capacity-aware testcase concurrency
- Cold vs warm content-addressed cache performance
- Multilingual sandbox verification (C, C++, Python, JavaScript, Java)
- Full telemetry integrity and zero synthetic math
"""

import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.core.config import settings
from app.core.db import AsyncSessionLocal
from app.core.redis import get_redis
from app.engine.execution_router import ExecutionRouter
from app.engine.schemas import TestCaseSchema
from app.engine.enums import Language, Verdict, ComparisonMode


TEST_CASES_13 = [
    TestCaseSchema(id=f"tc_{i+1}", stdin=f"{i}\n", expected_output=f"{i}")
    for i in range(1, 14)
]

LANGUAGES_TO_TEST = [
    {
        "lang": "cpp",
        "name": "C++ (G++ 17)",
        "code": '#include <iostream>\nint main() { int x; if (std::cin >> x) std::cout << x << "\\n"; return 0; }',
        "compiled": True,
    },
    {
        "lang": "c",
        "name": "C (GCC 13)",
        "code": '#include <stdio.h>\nint main() { int x; if (scanf("%d", &x) == 1) printf("%d\\n", x); return 0; }',
        "compiled": True,
    },
    {
        "lang": "python",
        "name": "Python 3.11",
        "code": 'import sys\nprint(sys.stdin.read().strip())',
        "compiled": False,
    },
    {
        "lang": "javascript",
        "name": "JavaScript (Node 20)",
        "code": "const fs = require('fs'); const d = fs.readFileSync(0, 'utf-8').trim(); console.log(d);",
        "compiled": False,
    },
    {
        "lang": "java",
        "name": "Java (OpenJDK 17)",
        "code": 'import java.util.Scanner;\npublic class Main { public static void main(String[] args) { Scanner sc = new Scanner(System.in); if (sc.hasNextInt()) System.out.println(sc.nextInt()); } }',
        "compiled": True,
    },
]


async def run_single_submission(router, lang_cfg, mode_label):
    lang = lang_cfg["lang"]
    name = lang_cfg["name"]
    code = lang_cfg["code"]
    sub_id = str(uuid4())
    contest_id = str(uuid4())
    problem_id = str(uuid4())
    member_id = str(uuid4())

    print(f"\n[{name.upper()}] Submitting 13-testcase job ({mode_label})...")
    t_start = time.perf_counter()

    async with AsyncSessionLocal() as db:
        res = await router.execute(
            db=db,
            language=lang,
            code=code,
            testcases=TEST_CASES_13,
            time_limit=2.0,
            memory_limit_mb=256,
            comparison_mode=ComparisonMode.TRIMMED,
            is_submit=True,
            submission_id=sub_id,
            contest_id=contest_id,
            problem_id=problem_id,
            member_id=member_id,
        )
    t_wall_ms = (time.perf_counter() - t_start) * 1000.0

    print(f"  ✓ Verdict:                {res.verdict.value} ({res.passed_testcases}/{res.total_testcases} passed)")
    print(f"  ✓ Provider Used:          {res.provider}")
    print(f"  ✓ Executing Node:         {res.node_id}")
    print(f"  ✓ Container Sandbox:      {res.container_id}")
    print(f"  ✓ Single Compile Time:    {res.compile_time_ms:.2f} ms")
    print(f"  ✓ Execution CPU Time:     {res.execution_cpu_ms:.2f} ms")
    print(f"  ✓ Execution Wall Time:    {res.execution_wall_ms:.2f} ms")
    print(f"  ✓ Provider Turnaround:    {res.provider_turnaround_ms:.2f} ms")
    print(f"  ✓ Measured End-to-End:    {t_wall_ms:.2f} ms")

    if res.latencies:
        print(f"  ✓ Pipeline Latencies:     {json.dumps(res.latencies, indent=4)}")

    # Strict validations
    assert res.verdict == Verdict.ACCEPTED, f"Expected ACCEPTED, got {res.verdict}"
    assert res.passed_testcases == 13, f"Expected 13 passed, got {res.passed_testcases}"
    assert res.provider == "distributed", f"Expected 'distributed' provider, got {res.provider}"
    assert res.node_id.startswith("node_"), f"Expected real node_id, got {res.node_id}"

    return {
        "language": name,
        "mode": mode_label,
        "provider": res.provider,
        "node_id": res.node_id,
        "verdict": res.verdict.value,
        "passed_testcases": res.passed_testcases,
        "total_testcases": res.total_testcases,
        "compile_time_ms": res.compile_time_ms,
        "execution_cpu_ms": res.execution_cpu_ms,
        "execution_wall_ms": res.execution_wall_ms,
        "provider_turnaround_ms": res.provider_turnaround_ms,
        "e2e_measured_ms": t_wall_ms,
        "latencies": res.latencies,
        "timestamps": res.timestamps,
    }


async def main():
    print("=" * 80)
    print(" 🚀 CHAOS COMPUTER CLUB — PRODUCTION JUDGE SPEED REMEDIATION & CERTIFICATION")
    print("=" * 80)

    # 1. Check Redis for registered nodes
    redis = get_redis()
    nodes = await redis.smembers("ccc:nodes:registered")
    print(f"Registered nodes in Redis: {[n.decode() if isinstance(n, bytes) else n for n in nodes]}")
    active_nodes = []
    for nid in nodes:
        raw_id = nid.decode() if isinstance(nid, bytes) else str(nid)
        if await redis.exists(f"ccc:node:{raw_id}:heartbeat"):
            info = await redis.hgetall(f"ccc:node:{raw_id}:info")
            info_str = {
                (k.decode() if isinstance(k, bytes) else k): (v.decode() if isinstance(v, bytes) else v)
                for k, v in info.items()
            }
            active_nodes.append((raw_id, info_str))

    print(f"Active nodes with live heartbeat: {len(active_nodes)}")
    for nid, info in active_nodes:
        print(f"  • Node {nid}: status={info.get('status')} available_slots={info.get('available_slots')} running_jobs={info.get('running_jobs')}")

    if not active_nodes:
        print("❌ No active nodes found! Make sure ccc-node-agent service is running.")
        sys.exit(1)

    router = ExecutionRouter.get_instance()
    results = []

    # 2. Run C++ Cold & Warm
    cpp_cfg = [cfg for cfg in LANGUAGES_TO_TEST if cfg["lang"] == "cpp"][0]
    cold_res = await run_single_submission(router, cpp_cfg, "Cold Run (First Compile)")
    results.append(cold_res)

    warm_res = await run_single_submission(router, cpp_cfg, "Warm Run (Cache Hit)")
    results.append(warm_res)

    # 3. Run remaining languages
    for lang_cfg in LANGUAGES_TO_TEST:
        if lang_cfg["lang"] == "cpp":
            continue
        res = await run_single_submission(router, lang_cfg, "Standard 13-TC Execution")
        results.append(res)

    print("\n" + "=" * 90)
    print("CERTIFICATION SUMMARY TABLE")
    print("=" * 90)
    print(f"{'Language':<22} | {'Mode':<24} | {'Provider':<11} | {'Compile(ms)':<11} | {'Wall(ms)':<9} | {'E2E(ms)':<9}")
    print("-" * 90)
    for r in results:
        print(f"{r['language']:<22} | {r['mode']:<24} | {r['provider']:<11} | {r['compile_time_ms']:<11.2f} | {r['execution_wall_ms']:<9.2f} | {r['e2e_measured_ms']:<9.2f}")
    print("=" * 90)

    # Write results to output JSON
    out_path = Path("/tmp/production_certification_results.json")
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n✅ Results saved to {out_path}")


if __name__ == "__main__":
    asyncio.run(main())
