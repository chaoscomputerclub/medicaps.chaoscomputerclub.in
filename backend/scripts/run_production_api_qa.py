#!/usr/bin/env python3
"""
Chaos Computer Club — Production API QA Automation Runner & GSD Sync Engine
Executes exhaustive test suites for all endpoints, comparing Expected vs Actual responses,
benchmarking latencies, checking cache layers, and writing reports to the GSD Framework (.planning/qa/).
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# Project root for GSD planning records
PROJECT_ROOT = BASE_DIR.parent
PLANNING_QA_DIR = PROJECT_ROOT / ".planning" / "qa"
PLANNING_QA_SUMMARY = PROJECT_ROOT / ".planning" / "QA.md"

from app.services.qa_test_service import ProductionQAService
from app.core.db import init_db


async def main():
    parser = argparse.ArgumentParser(description="Chaos Computer Club Production API QA Suite")
    parser.add_argument(
        "--url",
        type=str,
        default=None,
        help="Target base URL (e.g., http://127.0.0.1:8002 or https://medicaps-api.chaoscomputerclub.in). Defaults to in-process ASGI runner.",
    )
    parser.add_argument(
        "--token",
        type=str,
        default=None,
        help="Optional custom Bearer token for authenticated runs.",
    )
    args = parser.parse_args()

    print("=" * 80)
    print(" 🛡️  CHAOS COMPUTER CLUB — PRODUCTION API QA AUDIT & VERIFICATION HARNESS")
    print(f"    Target URL: {args.url or 'In-Process ASGI Test Engine'}")
    print("=" * 80)

    # 1. Initialize schema and run migrations
    await init_db()

    # 2. Run full QA audit
    report = await ProductionQAService.run_full_qa_audit(
        base_url=args.url,
        custom_token=args.token,
    )

    # 2. Terminal Output Formatting
    print(f"\nAudit ID: {report.audit_id}")
    print(f"Timestamp: {report.timestamp_utc}")
    print(f"Total Tests: {report.total_tests} | Passed: {report.passed_tests} | Failed: {report.failed_tests}")
    print(f"Success Rate: {report.overall_success_rate_percent}% | Total Latency: {report.total_execution_time_ms}ms\n")

    print("-" * 80)
    print(f"{'ID':<12} {'METHOD':<7} {'STATUS':<10} {'LATENCY':<10} {'CACHE':<8} {'TEST NAME'}")
    print("-" * 80)

    for r in report.test_results:
        status_str = f"{r.actual_status} (Exp: {r.expected_status})"
        cache_str = r.cache_header or "-"
        pass_badge = "✓" if r.passed else "✖"
        color = "\033[92m" if r.passed else "\033[91m"
        reset = "\033[0m"

        print(
            f"{color}{pass_badge} {r.test_id:<10}{reset} {r.method:<7} {status_str:<10} "
            f"{r.latency_ms:>6.1f}ms   {cache_str:<8} {r.name[:35]}"
        )
        if not r.passed:
            print(f"    └── {color}{r.diff_notes}{reset}")

    print("\n" + "=" * 80)
    print(" 📊 CATEGORY PERFORMANCE SUMMARY")
    print("=" * 80)
    print(f"{'CATEGORY':<28} {'TOTAL':<8} {'PASSED':<8} {'SUCCESS RATE':<15} {'AVG LATENCY'}")
    print("-" * 80)
    for c in report.categories:
        c_badge = "\033[92m✓\033[0m" if c.failed_tests == 0 else "\033[91m✖\033[0m"
        print(
            f"{c_badge} {c.category:<26} {c.total_tests:<8} {c.passed_tests:<8} "
            f"{c.success_rate_percent:>6.1f}%          {c.avg_latency_ms:>6.1f}ms"
        )
    print("=" * 80)

    # 3. Save artifacts into GSD Framework directory
    PLANNING_QA_DIR.mkdir(parents=True, exist_ok=True)
    json_path = PLANNING_QA_DIR / "api_qa_report.json"
    md_path = PLANNING_QA_DIR / "API_QA_REPORT.md"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report.model_dump(), f, indent=2, ensure_ascii=False)

    md_content = ProductionQAService.generate_markdown_report(report)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)

    # Update top-level .planning/QA.md summary
    with open(PLANNING_QA_SUMMARY, "w", encoding="utf-8") as f:
        f.write(md_content)

    print(f"\n✓ GSD Framework QA Artifacts Saved:")
    print(f"  - JSON Report: {json_path}")
    print(f"  - Markdown Report: {md_path}")
    print(f"  - GSD Summary: {PLANNING_QA_SUMMARY}")

    # 4. Clean up transient test bot accounts to prevent database pollution
    try:
        from app.core.db import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            await ProductionQAService.cleanup_qa_data(session)
    except Exception as e:
        print(f"Notice on QA cleanup: {e}")

    if report.failed_tests > 0:
        print(f"\n⚠ Warning: {report.failed_tests} tests failed assertion checks. Review report details above.")
        sys.exit(1)
    else:
        print(f"\n🎉 ALL {report.total_tests} API TESTS PASSED WITH 100% PRODUCTION COMPLIANCE!\n")


if __name__ == "__main__":
    asyncio.run(main())
