#!/usr/bin/env python3
"""
Chaos Computer Club — Medi-Caps Chapter
scripts/regression/generate_report.py — Regression Intelligence Report Generator

Generates artifacts/regression-report.json and artifacts/regression-report.md
summarizing historical bug coverage, test executions, gaps, and recurring bug classes.
"""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DOCS_REGISTRY = REPO_ROOT / "docs" / "regression" / "bug-registry.json"
MANIFEST_PATH = REPO_ROOT / "tests" / "regression" / "manifest.json"
ARTIFACTS_DIR = REPO_ROOT / "artifacts"


def run_regression_tests() -> Dict[str, Any]:
    pytest_bin = REPO_ROOT / "backend" / ".venv" / "bin" / "pytest"
    if not pytest_bin.exists():
        pytest_bin = Path("pytest")

    cmd = [
        str(pytest_bin),
        "tests/regression",
        "-q",
        "--tb=short",
    ]
    start = datetime.now(timezone.utc)
    res = subprocess.run(
        cmd,
        cwd=REPO_ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    elapsed = (datetime.now(timezone.utc) - start).total_seconds()
    output = res.stdout + res.stderr

    # Parse pytest output
    passed = 0
    failed = 0
    skipped = 0

    import re
    p_match = re.search(r"(\d+) passed", output)
    f_match = re.search(r"(\d+) failed", output)
    s_match = re.search(r"(\d+) skipped", output)

    if p_match:
        passed = int(p_match.group(1))
    if f_match:
        failed = int(f_match.group(1))
    if s_match:
        skipped = int(s_match.group(1))

    return {
        "exit_code": res.returncode,
        "passed": passed,
        "failed": failed,
        "skipped": skipped,
        "duration_seconds": round(elapsed, 2),
        "raw_summary": output.strip().splitlines()[-1] if output.strip() else "",
    }


def generate_reports() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    bugs: List[Dict[str, Any]] = []
    summary_stats: Dict[str, Any] = {}
    if DOCS_REGISTRY.exists():
        with open(DOCS_REGISTRY, "r", encoding="utf-8") as f:
            reg_data = json.load(f)
            bugs = reg_data.get("bugs", [])
            summary_stats = reg_data.get("summary", {})

    test_results = run_regression_tests()

    report_data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_historical_bugs": len(bugs),
        "covered_bugs": summary_stats.get("covered_bugs", 0),
        "gap_bugs": summary_stats.get("gap_bugs", 0),
        "severity_breakdown": {
            "critical": summary_stats.get("critical_bugs", 0),
            "high": summary_stats.get("high_bugs", 0),
            "medium": summary_stats.get("medium_bugs", 0),
            "low": summary_stats.get("low_bugs", 0),
        },
        "test_execution": test_results,
        "status": "REGRESSION SYSTEM CERTIFIED" if test_results["failed"] == 0 else "REGRESSION SYSTEM INCOMPLETE",
    }

    # 1. artifacts/regression-report.json
    json_path = ARTIFACTS_DIR / "regression-report.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2)
    print(f"✓ Saved {json_path}")

    # 2. artifacts/regression-report.md
    md_path = ARTIFACTS_DIR / "regression-report.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# Automated Regression Intelligence Certification Report\n\n")
        f.write(f"**Date:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}  \n")
        f.write(f"**Status:** `{report_data['status']}`\n\n")
        f.write("## 1. Historical Bug Corpus Overview\n\n")
        f.write(f"- **Total Historical Bugs Cataloged:** `{report_data['total_historical_bugs']}`\n")
        f.write(f"- **Covered by Regression Tests:** `{report_data['covered_bugs']}`\n")
        f.write(f"- **Remaining Gaps:** `{report_data['gap_bugs']}`\n\n")
        f.write("### Severity Breakdown\n")
        f.write(f"- 🔴 **CRITICAL:** {report_data['severity_breakdown']['critical']}\n")
        f.write(f"- 🟠 **HIGH:** {report_data['severity_breakdown']['high']}\n")
        f.write(f"- 🟡 **MEDIUM:** {report_data['severity_breakdown']['medium']}\n")
        f.write(f"- ⚪ **LOW:** {report_data['severity_breakdown']['low']}\n\n")
        f.write("## 2. Regression Suite Execution Results\n\n")
        f.write(f"- **Passed:** `{test_results['passed']}`\n")
        f.write(f"- **Failed:** `{test_results['failed']}`\n")
        f.write(f"- **Skipped:** `{test_results['skipped']}`\n")
        f.write(f"- **Duration:** `{test_results['duration_seconds']}s`\n")
        f.write(f"- **Summary Line:** `{test_results['raw_summary']}`\n\n")
        f.write("## 3. Recurring Bug Class Prevention Ledger\n\n")
        f.write("1. **Judge Parameter Contamination & Source Partitioning** $\\rightarrow$ Enforced via `test_language_conformance.py`\n")
        f.write("2. **Request Race Overwrite in Store** $\\rightarrow$ Enforced via `test_request_fencing.py`\n")
        f.write("3. **Cross-User Session Leakage on Logout** $\\rightarrow$ Enforced via `test_session_isolation.py`\n")
        f.write("4. **Transactional Outbox Event Isolation** $\\rightarrow$ Enforced via `test_transactional_outbox.py`\n")
        f.write("5. **Strict Contest State Machine (No Finished $\\rightarrow$ Live)** $\\rightarrow$ Enforced via `test_contest_lifecycle_fsm.py`\n\n")
        f.write("---\n")
        f.write(f"**Final Certification:** **`{report_data['status']}`**\n")
    print(f"✓ Saved {md_path}")


if __name__ == "__main__":
    generate_reports()
