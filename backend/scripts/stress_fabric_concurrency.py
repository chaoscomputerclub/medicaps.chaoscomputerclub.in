#!/usr/bin/env python3
"""
Chaos Computer Club — Medi-Caps Chapter
Global Distributed Fabric — Deep Dive Heavy Concurrency Stress Test Suite

Orchestrates multi-phase, high-concurrency workloads against the distributed
execution fabric (Cloud Control Plane <-> Distributed Compute Worker Nodes).

Measures:
- End-to-end RTT latency (Cloudflare Edge -> Cloud Run -> Redis -> Node Agent Docker -> Client)
- Execution container wall time inside in-memory RAM tmpfs
- Concurrency scaling & queue drain dynamics (5, 15, and 30 parallel bursts)
- Multi-language coverage (Python 3.11, GCC 13 C++, Node 20)
- Edge cases & intentional fault injection (Runtime Errors, Compile Errors, Wrong Answers)
- Telemetry & resource retention check on worker nodes
"""

import asyncio
import json
import math
import os
import subprocess
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
import urllib.request
import urllib.error

API_BASE_URL = os.getenv("FABRIC_DISPATCH_URL", "https://medicaps-api.chaoscomputerclub.in/api/v1/nodes/dispatch-test")
REMOTE_HOST = os.getenv("BENCHMARK_REMOTE_HOST", "127.0.0.1")

# ── Test Payloads ──────────────────────────────────────────────────────────

WORKLOAD_TEMPLATES = [
    {
        "name": "Python: Prime Sieve (Math/CPU)",
        "language": "python",
        "code": """
def count_primes(n):
    is_prime = [True] * (n + 1)
    is_prime[0] = is_prime[1] = False
    for i in range(2, int(n**0.5) + 1):
        if is_prime[i]:
            for j in range(i*i, n + 1, i):
                is_prime[j] = False
    return sum(is_prime)

print(count_primes(3000))
""",
        "stdin": "",
        "expected_output": "430",
        "expected_verdict": "ACCEPTED",
    },
    {
        "name": "C++: QuickSort Array (Compile + Run)",
        "language": "cpp",
        "code": """
#include <iostream>
#include <vector>
#include <algorithm>
#include <numeric>

int main() {
    std::vector<int> v;
    for (int i = 1000; i >= 1; --i) v.push_back(i);
    std::sort(v.begin(), v.end());
    long long sum = std::accumulate(v.begin(), v.end(), 0LL);
    std::cout << v.front() << " " << v.back() << " " << sum << "\\n";
    return 0;
}
""",
        "stdin": "",
        "expected_output": "1 1000 500500",
        "expected_verdict": "ACCEPTED",
    },
    {
        "name": "Node.js: Object Processing & Filter (EventLoop)",
        "language": "javascript",
        "code": """
const items = Array.from({ length: 500 }, (_, i) => ({ id: i, val: (i * 7) % 100 }));
const filtered = items.filter(x => x.val > 50).reduce((acc, x) => acc + x.val, 0);
console.log(filtered);
""",
        "stdin": "",
        "expected_output": "18375",
        "expected_verdict": "ACCEPTED",
    },
    {
        "name": "Python: Factorial Matrix (High Recursion/Iteration)",
        "language": "python",
        "code": """
import sys
def fact(n):
    res = 1
    for i in range(2, n + 1):
        res = (res * i) % 1000000007
    return res

total = sum(fact(x) for x in range(1, 200))
print(total % 1000000007)
""",
        "stdin": "",
        "expected_output": "741500159",
        "expected_verdict": "ACCEPTED",
    },
    {
        "name": "Fault Injection: Python ZeroDivision (Expect RUNTIME_ERROR)",
        "language": "python",
        "code": """
x = 10 / 0
print(x)
""",
        "stdin": "",
        "expected_output": "0",
        "expected_verdict": "RUNTIME_ERROR",
    },
    {
        "name": "Fault Injection: C++ Syntax Error (Expect COMPILATION_ERROR)",
        "language": "cpp",
        "code": """
#include <iostream>
int main() {
    this_is_an_invalid_token_designed_to_fail_compilation
    return 0;
}
""",
        "stdin": "",
        "expected_output": "",
        "expected_verdict": "COMPILATION_ERROR",
    },
    {
        "name": "Fault Injection: Wrong Answer (Expect WRONG_ANSWER)",
        "language": "python",
        "code": """
print("intentional_wrong_output_9999")
""",
        "stdin": "",
        "expected_output": "correct_expected_output_0000",
        "expected_verdict": "WRONG_ANSWER",
    },
]

@dataclass
class JobRecord:
    task_id: int
    name: str
    language: str
    expected_verdict: str
    start_time: float
    end_time: float = 0.0
    rtt_ms: float = 0.0
    container_wall_ms: float = 0.0
    verdict: str = "PENDING"
    success: bool = False
    status_code: int = 0
    error: Optional[str] = None
    stdout: str = ""
    stderr: str = ""

def get_remote_telemetry() -> Dict[str, Any]:
    """Execute telemetry probe on worker node or return clean baseline stats."""
    if os.getenv("BENCHMARK_SSH_ENABLED", "").lower() == "true":
        ssh_user = os.getenv("BENCHMARK_SSH_USER", "node-runner")
        ssh_key = os.getenv("BENCHMARK_SSH_KEY")
        key_arg = f"-i '{ssh_key}'" if ssh_key else ""
        cmd = f"ssh -o StrictHostKeyChecking=no {key_arg} {ssh_user}@{REMOTE_HOST} 'docker ps --format \"{{{{.ID}}}} {{{{.Image}}}}\"'"
        try:
            res = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=8)
            return {"raw": res.stdout.strip(), "ok": True}
        except Exception as e:
            return {"raw": str(e), "ok": False}
    return {"raw": "Simulated node worker telemetry: healthy", "ok": True}

async def execute_stress_job(session_pool: asyncio.Semaphore, record: JobRecord, payload: dict) -> JobRecord:
    async with session_pool:
        record.start_time = time.time()
        json_data = json.dumps({
            "language": payload["language"],
            "code": payload["code"],
            "stdin": payload.get("stdin", ""),
            "expected_output": payload.get("expected_output", ""),
            "time_limit_seconds": 2.0,
        }).encode("utf-8")

        loop = asyncio.get_running_loop()
        
        def _do_post():
            req = urllib.request.Request(
                API_BASE_URL,
                data=json_data,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                    "Accept": "application/json",
                },
                method="POST"
            )
            try:
                with urllib.request.urlopen(req, timeout=30.0) as resp:
                    code = resp.getcode()
                    body = resp.read().decode("utf-8")
                    return code, body, None
            except urllib.error.HTTPError as he:
                body = he.read().decode("utf-8") if he.fp else ""
                return he.code, body, str(he)
            except Exception as e:
                return 0, "", str(e)

        code, body, err = await loop.run_in_executor(None, _do_post)
        record.end_time = time.time()
        record.rtt_ms = round((record.end_time - record.start_time) * 1000.0, 1)
        record.status_code = code

        if err or code != 200:
            record.error = err or f"HTTP {code}: {body[:150]}"
            record.verdict = "NETWORK_ERROR"
            record.success = False
            return record

        try:
            data = json.loads(body)
            record.verdict = data.get("verdict", "UNKNOWN")
            tcs = data.get("testcases", [])
            if tcs:
                record.container_wall_ms = float(tcs[0].get("wall_time_ms", 0.0))
                record.stdout = tcs[0].get("stdout", "")
                record.stderr = tcs[0].get("stderr", "")
            
            # Success logic: did the verdict match expectation?
            # For positive workloads, ACCEPTED matches.
            # For injected faults, matching expected_verdict means the sandbox correctly caught the fault!
            if record.expected_verdict == record.verdict:
                record.success = True
            elif record.expected_verdict == "ACCEPTED" and data.get("success") is True:
                record.success = True
            else:
                record.success = False
                record.error = f"Expected {record.expected_verdict}, got {record.verdict}"
        except Exception as parse_err:
            record.error = f"JSON parse error: {parse_err}"
            record.verdict = "PARSE_ERROR"
            record.success = False

        return record

def compute_percentiles(values: List[float]) -> Dict[str, float]:
    if not values:
        return {"p50": 0, "p90": 0, "p95": 0, "p99": 0, "min": 0, "max": 0, "mean": 0, "std": 0}
    s = sorted(values)
    n = len(s)
    
    def _pct(p: float) -> float:
        idx = int(math.ceil(p / 100.0 * n)) - 1
        return s[max(0, min(idx, n - 1))]

    mean = sum(s) / n
    variance = sum((x - mean) ** 2 for x in s) / n
    std = math.sqrt(variance)

    return {
        "min": round(s[0], 1),
        "p50": round(_pct(50), 1),
        "p75": round(_pct(75), 1),
        "p90": round(_pct(90), 1),
        "p95": round(_pct(95), 1),
        "p99": round(_pct(99), 1),
        "max": round(s[-1], 1),
        "mean": round(mean, 1),
        "std": round(std, 1),
    }

async def run_stress_phase(phase_name: str, total_jobs: int, concurrency_limit: int) -> List[JobRecord]:
    print(f"\n================================================================================")
    print(f"🔥 [STAGE] {phase_name.upper()}")
    print(f"   Total Submissions: {total_jobs} | Simultaneous Concurrency: {concurrency_limit}")
    print(f"================================================================================")

    sem = asyncio.Semaphore(concurrency_limit)
    tasks = []
    records = []

    for i in range(total_jobs):
        template = WORKLOAD_TEMPLATES[i % len(WORKLOAD_TEMPLATES)]
        rec = JobRecord(
            task_id=i + 1,
            name=template["name"],
            language=template["language"],
            expected_verdict=template["expected_verdict"],
            start_time=0.0
        )
        records.append(rec)
        tasks.append(execute_stress_job(sem, rec, template))

    phase_start = time.time()
    await asyncio.gather(*tasks)
    phase_duration = time.time() - phase_start

    rtts = [r.rtt_ms for r in records if r.rtt_ms > 0]
    wall_times = [r.container_wall_ms for r in records if r.container_wall_ms > 0]
    successes = sum(1 for r in records if r.success)
    failures = len(records) - successes

    stats_rtt = compute_percentiles(rtts)
    stats_wall = compute_percentiles(wall_times)
    throughput = len(records) / phase_duration if phase_duration > 0 else 0

    print(f"⏱️  Duration:        {phase_duration:.2f}s  |  Throughput: {throughput:.2f} jobs/sec")
    print(f"🎯 Success Rate:    {successes}/{len(records)} ({successes/len(records)*100.0:.1f}%)")
    print(f"📊 End-to-End RTT:  Min: {stats_rtt['min']}ms | p50: {stats_rtt['p50']}ms | p90: {stats_rtt['p90']}ms | p99: {stats_rtt['p99']}ms | Max: {stats_rtt['max']}ms")
    print(f"🐳 Container Wall:  Min: {stats_wall['min']}ms | p50: {stats_wall['p50']}ms | p90: {stats_wall['p90']}ms | Max: {stats_wall['max']}ms")

    # Sample output of verdicts
    verdict_counts: Dict[str, int] = {}
    for r in records:
        verdict_counts[r.verdict] = verdict_counts.get(r.verdict, 0) + 1
    print(f"🏷️  Verdicts:        {dict(sorted(verdict_counts.items()))}")

    if failures > 0:
        print(f"⚠️  Sample Failures:")
        for r in [x for x in records if not x.success][:3]:
            print(f"    - Task #{r.task_id} ({r.name}): {r.error}")

    return records

async def main():
    print("=" * 80)
    print("🚀 CCC GLOBAL DISTRIBUTED FABRIC — DEEP DIVE HEAVY CONCURRENCY STRESS TEST")
    print(f"📅 Timestamp: {datetime.now().isoformat()}")
    print(f"🌐 Target:    {API_BASE_URL}")
    print(f"💻 Node:      {REMOTE_USER}@{REMOTE_HOST} (12th Gen Intel i5, 10 cores, 7 bounded slots)")
    print("=" * 80)

    print("\n🔍 Checking initial remote node telemetry...")
    pre_telemetry = get_remote_telemetry()
    print(pre_telemetry.get("raw", "SSH failed"))

    all_records: List[JobRecord] = []

    # ── Phase 1: Warmup & Concurrency Baseline (7 parallel jobs = 1 per slot) ──
    p1_records = await run_stress_phase("Phase 1: Slot Saturation Baseline", total_jobs=7, concurrency_limit=7)
    all_records.extend(p1_records)
    await asyncio.sleep(1.0)

    # ── Phase 2: Medium Burst Load (15 jobs with 10 concurrency) ───────────────
    p2_records = await run_stress_phase("Phase 2: Over-Subscription Wave", total_jobs=15, concurrency_limit=10)
    all_records.extend(p2_records)
    await asyncio.sleep(1.0)

    # ── Phase 3: Heavy Stress Concurrency (25 jobs burst with 20 concurrency) ──
    p3_records = await run_stress_phase("Phase 3: Heavy Stress Concurrency Burst", total_jobs=25, concurrency_limit=20)
    all_records.extend(p3_records)

    print("\n" + "=" * 80)
    print("🏁 FINAL AGGREGATE SUMMARY ACROSS ALL PHASES")
    print("=" * 80)
    total_count = len(all_records)
    total_success = sum(1 for r in all_records if r.success)
    all_rtts = [r.rtt_ms for r in all_records if r.rtt_ms > 0]
    all_walls = [r.container_wall_ms for r in all_records if r.container_wall_ms > 0]
    overall_rtt = compute_percentiles(all_rtts)
    overall_wall = compute_percentiles(all_walls)

    print(f"📦 Total Workloads Executed: {total_count}")
    print(f"✅ Successful Sandboxed Runs: {total_success} / {total_count} ({total_success/total_count*100.0:.2f}%)")
    print(f"⚡ End-to-End Latency Profile:")
    print(f"    - Min:     {overall_rtt['min']} ms")
    print(f"    - Median:  {overall_rtt['p50']} ms")
    print(f"    - p90:     {overall_rtt['p90']} ms")
    print(f"    - p95:     {overall_rtt['p95']} ms")
    print(f"    - p99:     {overall_rtt['p99']} ms")
    print(f"    - Max:     {overall_rtt['max']} ms")
    print(f"    - Mean:    {overall_rtt['mean']} ms ± {overall_rtt['std']} ms")
    print(f"🐳 Container Execution Profile (RAM tmpfs):")
    print(f"    - Median:  {overall_wall['p50']} ms")
    print(f"    - p90:     {overall_wall['p90']} ms")
    print(f"    - Max:     {overall_wall['max']} ms")

    print("\n🔍 Checking post-stress remote node telemetry & resource cleanup...")
    post_telemetry = get_remote_telemetry()
    print(post_telemetry.get("raw", "SSH failed"))

if __name__ == "__main__":
    asyncio.run(main())
