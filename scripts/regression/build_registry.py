#!/usr/bin/env python3
"""
Chaos Computer Club — Medi-Caps Chapter
scripts/regression/build_registry.py — Regression Manifest Builder

Reads docs/regression/bug-registry.json, links executable regression tests,
and compiles tests/regression/manifest.json as the authoritative test contract.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DOCS_REGISTRY = REPO_ROOT / "docs" / "regression" / "bug-registry.json"
MANIFEST_PATH = REPO_ROOT / "tests" / "regression" / "manifest.json"


def build_manifest() -> Dict[str, Any]:
    if not DOCS_REGISTRY.exists():
        raise FileNotFoundError(f"Bug registry not found at {DOCS_REGISTRY}. Run scan_git_history.py first.")

    with open(DOCS_REGISTRY, "r", encoding="utf-8") as f:
        data = json.load(f)

    bugs: List[Dict[str, Any]] = data.get("bugs", [])
    manifest_tests: List[Dict[str, Any]] = []

    # Map categories to designated test files in tests/regression/
    category_to_test_file = {
        "CROSS_USER_LEAK": "tests/regression/frontend/test_session_isolation.py",
        "REQUEST_RACE": "tests/regression/concurrency/test_request_fencing.py",
        "STATE_MANAGEMENT": "tests/regression/frontend/test_state_ownership.py",
        "SSE_ORDERING": "tests/regression/backend/test_sse_ordering.py",
        "CACHE_INVALIDATION": "tests/regression/backend/test_cache_invalidation.py",
        "REGISTRATION": "tests/regression/database/test_registration_acid.py",
        "CONTEST_LIFECYCLE": "tests/regression/backend/test_contest_lifecycle_fsm.py",
        "RATING": "tests/regression/database/test_rating_idempotency.py",
        "SCOREBOARD": "tests/regression/backend/test_scoreboard_canonical.py",
        "JUDGE_EXECUTION": "tests/regression/judge/test_language_conformance.py",
        "DISTRIBUTED_EXECUTION": "tests/regression/distributed/test_node_agent_coordination.py",
        "OUTBOX": "tests/regression/database/test_transactional_outbox.py",
        "TRANSACTION": "tests/regression/database/test_transaction_rollback.py",
        "DATABASE_CONSISTENCY": "tests/regression/database/test_schema_constraints.py",
        "AUTH_SESSION": "tests/regression/security/test_auth_boundaries.py",
        "DEPLOYMENT": "tests/regression/backend/test_deployment_integrity.py",
    }

    for b in bugs:
        cat = b.get("category", "STATE_MANAGEMENT")
        sev = b.get("severity", "MEDIUM")
        test_path = category_to_test_file.get(cat, "tests/regression/backend/test_general_invariants.py")

        manifest_tests.append({
            "bug_id": b["bug_id"],
            "title": b["title"],
            "category": cat,
            "severity": sev,
            "source_commit": b["source"]["commit"][:7],
            "invariant": b["invariant"],
            "test_target": test_path,
            "status": "ACTIVE",
            "quarantined": False,
        })

    manifest = {
        "version": 1,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "total_rules": len(manifest_tests),
        "tests": manifest_tests,
    }

    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"✓ Successfully compiled {len(manifest_tests)} rules into {MANIFEST_PATH}")
    return manifest


if __name__ == "__main__":
    build_manifest()
