#!/usr/bin/env python3
"""
Chaos Computer Club — Medi-Caps Chapter
scripts/regression/select_tests.py — Change-Impact Regression Test Selector

Determines which regression tests must be executed based on git working tree modifications.
Can execute pytest directly with targeted test files.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path
from typing import List, Set

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
TESTS_REGRESSION_DIR = REPO_ROOT / "tests" / "regression"

# Component mapping rules to regression test suites
FILE_PATTERNS_TO_TESTS = {
    "src/store": [
        "tests/regression/frontend/test_session_isolation.py",
        "tests/regression/frontend/test_state_ownership.py",
        "tests/regression/concurrency/test_request_fencing.py",
    ],
    "src/features": [
        "tests/regression/frontend/test_session_isolation.py",
        "tests/regression/backend/test_cache_invalidation.py",
    ],
    "src/lib/realtime.ts": [
        "tests/regression/backend/test_sse_ordering.py",
        "tests/regression/frontend/test_session_isolation.py",
    ],
    "src/lib/auth.ts": [
        "tests/regression/frontend/test_session_isolation.py",
        "tests/regression/security/test_auth_boundaries.py",
    ],
    "backend/app/modules/contests": [
        "tests/regression/database/test_registration_acid.py",
        "tests/regression/backend/test_contest_lifecycle_fsm.py",
        "tests/regression/backend/test_scoreboard_canonical.py",
        "tests/regression/database/test_transactional_outbox.py",
    ],
    "backend/app/services/dynamic_contest_service.py": [
        "tests/regression/backend/test_contest_lifecycle_fsm.py",
        "tests/regression/database/test_rating_idempotency.py",
        "tests/regression/backend/test_scoreboard_canonical.py",
    ],
    "backend/app/engine": [
        "tests/regression/judge/test_language_conformance.py",
    ],
    "node-agent": [
        "tests/regression/distributed/test_node_agent_coordination.py",
        "tests/regression/judge/test_language_conformance.py",
    ],
    "judge-agent": [
        "tests/regression/distributed/test_node_agent_coordination.py",
        "tests/regression/judge/test_language_conformance.py",
    ],
    "backend/app/models": [
        "tests/regression/database/test_schema_constraints.py",
        "tests/regression/database/test_transaction_rollback.py",
        "tests/regression/database/test_rating_idempotency.py",
    ],
    "backend/app/core/queue/outbox.py": [
        "tests/regression/database/test_transactional_outbox.py",
    ],
}


def get_changed_files() -> List[str]:
    try:
        # Check uncommitted changes + staged changes
        res = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=REPO_ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True,
        )
        files = []
        for line in res.stdout.splitlines():
            line = line.strip()
            if len(line) > 3:
                files.append(line[3:].split(" -> ")[-1])

        # Also check changes in the latest commit if working tree is clean
        if not files:
            res_commit = subprocess.run(
                ["git", "diff", "--name-only", "HEAD~1", "HEAD"],
                cwd=REPO_ROOT,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            files = [f.strip() for f in res_commit.stdout.splitlines() if f.strip()]
        return files
    except Exception:
        return []


def select_tests(changed_files: List[str], run_all: bool = False) -> List[str]:
    all_tests = sorted([
        str(p.relative_to(REPO_ROOT))
        for p in TESTS_REGRESSION_DIR.glob("**/*.py")
        if p.name.startswith("test_")
    ])

    if run_all or not changed_files:
        return all_tests

    selected: Set[str] = set()
    for cf in changed_files:
        matched = False
        for pattern, test_targets in FILE_PATTERNS_TO_TESTS.items():
            if pattern in cf:
                for t in test_targets:
                    if (REPO_ROOT / t).exists():
                        selected.add(t)
                matched = True
        if not matched:
            # If an unmapped backend or frontend file changed, run corresponding general invariants
            if cf.startswith("backend/"):
                selected.add("tests/regression/database/test_schema_constraints.py")
            elif cf.startswith("src/"):
                selected.add("tests/regression/frontend/test_state_ownership.py")

    return sorted(list(selected)) if selected else all_tests


def main():
    parser = argparse.ArgumentParser(description="Select and run affected regression tests.")
    parser.add_argument("--all", action="store_true", help="Select all regression tests.")
    parser.add_argument("--run", action="store_true", help="Execute pytest with the selected tests.")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose pytest output.")
    args = parser.parse_args()

    changed = get_changed_files()
    selected = select_tests(changed, run_all=args.all)

    print(f"→ Detected {len(changed)} changed files.")
    print(f"→ Selected {len(selected)} regression test suites:")
    for t in selected:
        print(f"   • {t}")

    if args.run:
        if not selected:
            print("No regression tests selected.")
            sys.exit(0)
        pytest_cmd = [
            str(REPO_ROOT / "backend" / ".venv" / "bin" / "pytest"),
            "-v" if args.verbose else "-q",
        ] + selected
        env = os.environ.copy()
        env["PYTHONPATH"] = str(REPO_ROOT / "backend")
        print(f"\n→ Executing: {' '.join(pytest_cmd)}\n")
        res = subprocess.run(pytest_cmd, cwd=REPO_ROOT, env=env)
        sys.exit(res.returncode)


if __name__ == "__main__":
    main()
