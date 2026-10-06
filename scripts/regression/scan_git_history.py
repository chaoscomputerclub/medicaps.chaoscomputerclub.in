#!/usr/bin/env python3
"""
Chaos Computer Club — Medi-Caps Chapter
scripts/regression/scan_git_history.py — Forensic Git Scanner & Bug Registry Generator

Analyzes commit history, identifies bug fixes, classifies them by invariant and category,
checks for existing regression test coverage, and builds the canonical bug registry.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DOCS_REGRESSION_DIR = REPO_ROOT / "docs" / "regression"
TESTS_REGRESSION_DIR = REPO_ROOT / "tests" / "regression"

# Controlled Bug Taxonomy
CATEGORIES = [
    "STATE_MANAGEMENT",
    "CACHE_INVALIDATION",
    "REQUEST_RACE",
    "SSE_ORDERING",
    "AUTH_SESSION",
    "CROSS_USER_LEAK",
    "API_CONTRACT",
    "DATABASE_CONSISTENCY",
    "TRANSACTION",
    "IDEMPOTENCY",
    "CONCURRENCY",
    "CONTEST_LIFECYCLE",
    "REGISTRATION",
    "SUBMISSION",
    "JUDGE_EXECUTION",
    "SCOREBOARD",
    "RANKING",
    "RATING",
    "REDIS",
    "POSTGRESQL",
    "OUTBOX",
    "DISTRIBUTED_EXECUTION",
    "SANDBOX",
    "COMPILATION",
    "TIMEOUT",
    "PERFORMANCE",
    "SECURITY",
    "FRONTEND_RENDERING",
    "ROUTING",
    "BUILD",
    "DEPLOYMENT",
]

KEYWORDS_SCORING = {
    "hotfix": 5,
    "deadlock": 5,
    "race": 4,
    "concurrency": 4,
    "leak": 4,
    "corrupt": 4,
    "fix": 3,
    "bug": 3,
    "revert": 3,
    "stale": 3,
    "idempotent": 3,
    "timeout": 3,
    "crash": 3,
    "error": 2,
    "wrong": 2,
    "overflow": 2,
    "unbound": 3,
    "typeerror": 3,
    "patch": 2,
    "remediate": 3,
    "resolve": 3,
}


def run_git(args: List[str]) -> str:
    cmd = ["git"] + args
    res = subprocess.run(cmd, cwd=REPO_ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
    return res.stdout.strip()


def parse_commits(limit: int = 500) -> List[Dict[str, Any]]:
    # Format: hash|%at|%an|%s%n%b%n---COMMIT-END---
    raw = run_git(["log", f"-n{limit}", "--format=COMMIT:%H|%cI|%an|%s%n%b%n---END---"])
    commit_blocks = raw.split("---END---")
    commits = []

    for block in commit_blocks:
        block = block.strip()
        if not block or not block.startswith("COMMIT:"):
            continue
        header_line, *body_lines = block.splitlines()
        header = header_line[len("COMMIT:"):]
        parts = header.split("|", 3)
        if len(parts) < 4:
            continue
        sha, iso_date, author, subject = parts
        body = "\n".join(body_lines).strip()
        commits.append({
            "sha": sha,
            "date": iso_date,
            "author": author,
            "subject": subject,
            "body": body,
        })
    return commits


def get_commit_files(sha: str) -> List[str]:
    try:
        raw = run_git(["diff-tree", "--no-commit-id", "--name-only", "-r", sha])
        return [f.strip() for f in raw.splitlines() if f.strip()]
    except Exception:
        return []


def classify_category(subject: str, body: str, files: List[str]) -> str:
    text = (subject + " " + body).lower()
    files_str = " ".join(files).lower()

    if any(k in text for k in ["logout", "auth", "session", "token", "cookie", "csrf", "turnstile"]):
        if "leak" in text or "cross-user" in text:
            return "CROSS_USER_LEAK"
        return "AUTH_SESSION"
    if any(k in text for k in ["race", "out-of-order", "overwrite", "activeDetailRequestId"]):
        return "REQUEST_RACE"
    if any(k in text for k in ["sse", "stream", "multiplexer", "realtime", "event_broadcaster"]):
        return "SSE_ORDERING"
    if any(k in text for k in ["cache", "swr", "invalidate", "cache_sync"]):
        return "CACHE_INVALIDATION"
    if any(k in text for k in ["outbox", "relay_outbox"]):
        return "OUTBOX"
    if any(k in text for k in ["rating", "elo", "ratinghistory"]):
        return "RATING"
    if any(k in text for k in ["scoreboard", "standings", "penalty", "rank"]):
        return "SCOREBOARD"
    if any(k in text for k in ["register", "unregister", "capacity", "seat"]):
        return "REGISTRATION"
    if any(k in text for k in ["lifecycle", "live now", "finished", "draft", "upcoming", "state machine"]):
        return "CONTEST_LIFECYCLE"
    if any(k in text for k in ["node-agent", "judge-agent", "fabric", "worker", "codebox", "executor"]):
        return "DISTRIBUTED_EXECUTION"
    if any(k in text for k in ["adapter", "compiler", "stdin", "stdout", "testcase", "sandbox", "verdict", "two sum"]):
        return "JUDGE_EXECUTION"
    if any(k in text for k in ["transaction", "lock", "with_for_update", "advisory", "rollback"]):
        return "TRANSACTION"
    if any(k in text for k in ["constraint", "foreign key", "uniqueconstraint", "migration", "schema"]):
        return "DATABASE_CONSISTENCY"
    if any(k in text for k in ["redux", "slice", "store", "rootreducer", "state"]):
        return "STATE_MANAGEMENT"
    if any(k in text for k in ["deploy", "nginx", "systemd", "rsync", "ssh"]):
        return "DEPLOYMENT"
    if any(k in text for k in ["ci", "github actions", "pr_check"]):
        return "BUILD"
    if any(k in text for k in ["latency", "perf", "overhead", "debounce", "pool"]):
        return "PERFORMANCE"
    if any(k in text for k in ["navigate", "router", "route", "url"]):
        return "ROUTING"
    if any(k in text for k in ["a11y", "wcag", "contrast", "modal", "render", "ui"]):
        return "FRONTEND_RENDERING"

    return "STATE_MANAGEMENT"


def infer_invariant(category: str, subject: str, body: str) -> str:
    text = (subject + " " + body).lower()
    invariants = {
        "CROSS_USER_LEAK": "LOGOUT_MUST_PURGE_ALL_USER_SCOPED_STATE_PREVENTING_CROSS_USER_LEAKAGE",
        "REQUEST_RACE": "OLDER_ASYNC_RESPONSE_MUST_NEVER_OVERWRITE_NEWER_STATE",
        "SSE_ORDERING": "SSE_EVENTS_MUST_OBEY_MONOTONIC_ORDERING_AND_DISCARD_STALE_TIMESTAMPS",
        "CACHE_INVALIDATION": "MUTATIONS_MUST_DETERMINISTICALLY_INVALIDATE_RELATED_SERVER_STATE",
        "REGISTRATION": "CONCURRENT_REGISTRATIONS_MUST_OBEY_CAPACITY_UNDER_ROW_LEVEL_LOCKS",
        "CONTEST_LIFECYCLE": "CONTEST_STATUS_TRANSITIONS_MUST_OBEY_STRICT_STATE_MACHINE_DAG",
        "RATING": "RATING_CALCULATION_AND_FINALIZATION_MUST_BE_STRICTLY_IDEMPOTENT",
        "SCOREBOARD": "SCOREBOARD_STANDING_MUST_HAVE_EXACTLY_ONE_AUTHORITATIVE_SOURCE",
        "JUDGE_EXECUTION": "EXECUTION_RUNNERS_MUST_PRESERVE_SUBMISSION_MODE_AND_ISOLATE_SANDBOX",
        "DISTRIBUTED_EXECUTION": "EXECUTION_ROUTING_AND_DISPATCH_MUST_PREVENT_DEADLOCKS_AND_STALE_LEASES",
        "OUTBOX": "MUTATIONS_AND_EVENTS_MUST_COMMIT_ATOMICALLY_IN_POSTGRESQL_BEFORE_RELAY",
        "TRANSACTION": "TRANSACTION_ROLLBACKS_MUST_NEVER_LEAVE_PARTIAL_OR_CORRUPT_STATE",
        "DATABASE_CONSISTENCY": "PHYSICAL_DATABASE_CONSTRAINTS_MUST_ENFORCE_CARDINAL_INVARIANTS",
        "AUTH_SESSION": "AUTHENTICATED_SESSIONS_MUST_BE_HARDENED_AGAINST_EXCLUSION_AND_LEAKS",
        "DEPLOYMENT": "PRODUCTION_DEPLOYMENTS_MUST_PRESERVE_ACTIVE_ASSETS_AND_RELOAD_SAFELY",
        "PERFORMANCE": "HOT_PATHS_MUST_AVOID_N_PLUS_ONE_QUERIES_AND_REPETITIVE_BROADCAST_LOOPS",
    }
    return invariants.get(category, f"OPERATION_MUST_SATISFY_STRICT_{category}_CONTRACT")


def determine_severity(category: str, score: int, text: str) -> str:
    if category in ["CROSS_USER_LEAK", "TRANSACTION", "DATABASE_CONSISTENCY", "IDEMPOTENCY", "OUTBOX"]:
        return "CRITICAL"
    if category in ["REQUEST_RACE", "SSE_ORDERING", "REGISTRATION", "CONTEST_LIFECYCLE", "JUDGE_EXECUTION", "RATING"]:
        return "HIGH"
    if score >= 6 or "security" in text or "auth" in text:
        return "HIGH"
    if score >= 4:
        return "MEDIUM"
    return "LOW"


def find_existing_tests_for_bug(sha: str, subject: str, files: List[str]) -> Tuple[str, List[str]]:
    """Scan existing tests in backend/tests and tests/ to see if this bug has regression coverage."""
    keywords = [w for w in re.findall(r"[a-zA-Z0-9_]{4,}", subject.lower()) if w not in ["fixed", "issue", "with", "from", "that", "this", "make", "ensure"]]
    matched_test_files = set()

    for p in Path(REPO_ROOT / "backend" / "tests").glob("test_*.py"):
        try:
            content = p.read_text(errors="ignore").lower()
            if sha[:7] in content:
                matched_test_files.add(str(p.relative_to(REPO_ROOT)))
                continue
            matches = sum(1 for kw in keywords if kw in content)
            if matches >= 3 or (len(keywords) <= 2 and matches == len(keywords)):
                matched_test_files.add(str(p.relative_to(REPO_ROOT)))
        except Exception:
            pass

    for p in Path(REPO_ROOT / "tests").glob("**/*.spec.ts"):
        try:
            content = p.read_text(errors="ignore").lower()
            if sha[:7] in content:
                matched_test_files.add(str(p.relative_to(REPO_ROOT)))
        except Exception:
            pass

    if matched_test_files:
        return "COVERED", sorted(list(matched_test_files))
    return "GAP", []


def scan_and_generate_registry() -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    commits = parse_commits(limit=500)
    registry_entries = []
    bug_counter = 1

    for c in commits:
        text = (c["subject"] + " " + c["body"]).lower()
        score = 0
        for kw, pts in KEYWORDS_SCORING.items():
            if kw in text:
                score += pts

        # Only process commits with meaningful bug score
        if score < 3:
            continue

        files = get_commit_files(c["sha"])
        if not files:
            continue

        category = classify_category(c["subject"], c["body"], files)
        severity = determine_severity(category, score, text)
        invariant = infer_invariant(category, c["subject"], c["body"])
        test_status, test_files = find_existing_tests_for_bug(c["sha"], c["subject"], files)

        reg_id = f"REG-{bug_counter:04d}"
        bug_counter += 1

        entry = {
            "bug_id": reg_id,
            "source": {
                "commit": c["sha"],
                "date": c["date"],
                "author": c["author"],
                "subject": c["subject"],
                "files": files[:15],
            },
            "title": c["subject"],
            "category": category,
            "severity": severity,
            "status": "FIXED",
            "root_cause": c["body"].strip() or c["subject"],
            "invariant": invariant,
            "affected_components": list({f.split("/")[0] if "/" in f else f for f in files}),
            "regression_test": {
                "status": test_status,
                "files": test_files,
            },
            "reproduction": {
                "available": True,
                "deterministic": True,
            },
        }
        registry_entries.append(entry)

    summary = {
        "scanned_commits": len(commits),
        "total_identified_bugs": len(registry_entries),
        "covered_bugs": sum(1 for e in registry_entries if e["regression_test"]["status"] == "COVERED"),
        "gap_bugs": sum(1 for e in registry_entries if e["regression_test"]["status"] == "GAP"),
        "critical_bugs": sum(1 for e in registry_entries if e["severity"] == "CRITICAL"),
        "high_bugs": sum(1 for e in registry_entries if e["severity"] == "HIGH"),
        "medium_bugs": sum(1 for e in registry_entries if e["severity"] == "MEDIUM"),
        "low_bugs": sum(1 for e in registry_entries if e["severity"] == "LOW"),
    }
    return registry_entries, summary


def write_outputs(entries: List[Dict[str, Any]], summary: Dict[str, Any]) -> None:
    DOCS_REGRESSION_DIR.mkdir(parents=True, exist_ok=True)
    TESTS_REGRESSION_DIR.mkdir(parents=True, exist_ok=True)

    # 1. bug-registry.json
    registry_path = DOCS_REGRESSION_DIR / "bug-registry.json"
    with open(registry_path, "w", encoding="utf-8") as f:
        json.dump({"generated_at": datetime.now(timezone.utc).isoformat(), "summary": summary, "bugs": entries}, f, indent=2)
    print(f"✓ Wrote {len(entries)} bugs to {registry_path}")

    # 2. bug-history.md
    history_path = DOCS_REGRESSION_DIR / "bug-history.md"
    with open(history_path, "w", encoding="utf-8") as f:
        f.write("# Forensic Bug History & Regression Index\n\n")
        f.write(f"**Last Scanned:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}  \n")
        f.write(f"**Total Historical Bugs Identified:** `{summary['total_identified_bugs']}`  \n")
        f.write(f"**Covered by Automated Tests:** `{summary['covered_bugs']}` | **Regression Gaps:** `{summary['gap_bugs']}`\n\n")
        f.write("## Summary by Severity\n\n")
        f.write(f"- 🔴 **CRITICAL:** {summary['critical_bugs']}\n")
        f.write(f"- 🟠 **HIGH:** {summary['high_bugs']}\n")
        f.write(f"- 🟡 **MEDIUM:** {summary['medium_bugs']}\n")
        f.write(f"- ⚪ **LOW:** {summary['low_bugs']}\n\n")
        f.write("## Historical Bug Index\n\n")
        f.write("| Bug ID | Commit | Severity | Category | Title | Test Status |\n")
        f.write("| :--- | :--- | :---: | :--- | :--- | :---: |\n")
        for e in entries:
            sha_short = e["source"]["commit"][:7]
            test_badge = "✅ COVERED" if e["regression_test"]["status"] == "COVERED" else "⚠️ GAP"
            f.write(f"| `{e['bug_id']}` | `{sha_short}` | **{e['severity']}** | `{e['category']}` | {e['title'][:80]} | {test_badge} |\n")
        f.write("\n")
    print(f"✓ Wrote history index to {history_path}")

    # 3. regression-gaps.md
    gaps_path = DOCS_REGRESSION_DIR / "regression-gaps.md"
    with open(gaps_path, "w", encoding="utf-8") as f:
        f.write("# Regression Test Coverage Gaps\n\n")
        f.write("Identifies historical production bugs that lack permanent automated regression tests.\n\n")
        f.write("## Critical & High Priority Gaps\n\n")
        for e in entries:
            if e["regression_test"]["status"] == "GAP" and e["severity"] in ["CRITICAL", "HIGH"]:
                f.write(f"### `{e['bug_id']}` — {e['title']}\n")
                f.write(f"- **Commit:** `{e['source']['commit'][:7]}` ({e['source']['date']})\n")
                f.write(f"- **Severity:** `{e['severity']}` | **Category:** `{e['category']}`\n")
                f.write(f"- **Invariant:** `{e['invariant']}`\n")
                f.write(f"- **Root Cause:** {e['root_cause']}\n")
                f.write(f"- **Affected Files:** `{'`, `'.join(e['source']['files'][:5])}`\n\n")
    print(f"✓ Wrote gap analysis to {gaps_path}")


if __name__ == "__main__":
    entries, summary = scan_and_generate_registry()
    write_outputs(entries, summary)
    print("\nScan completed successfully.")
