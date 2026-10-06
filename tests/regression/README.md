# Permanent Regression Intelligence Test Suite

This directory contains executable, invariant-level regression tests derived from the production incident and git history of the CCC Medi-Caps Online Platform.

Every test in this directory is linked to a canonical `REG-XXXX` bug identifier in `docs/regression/bug-registry.json` and tracked in `tests/regression/manifest.json`.

---

## Directory Organization

```
tests/regression/
├── README.md
├── manifest.json
├── backend/
│   ├── test_cache_invalidation.py
│   ├── test_contest_lifecycle_fsm.py
│   ├── test_deployment_integrity.py
│   ├── test_general_invariants.py
│   ├── test_scoreboard_canonical.py
│   └── test_sse_ordering.py
├── concurrency/
│   └── test_request_fencing.py
├── database/
│   ├── test_rating_idempotency.py
│   ├── test_registration_acid.py
│   ├── test_schema_constraints.py
│   ├── test_transaction_rollback.py
│   └── test_transactional_outbox.py
├── distributed/
│   └── test_node_agent_coordination.py
├── fixtures/
│   ├── __init__.py
│   └── regression_fixtures.py
├── frontend/
│   ├── test_session_isolation.py
│   └── test_state_ownership.py
├── judge/
│   └── test_language_conformance.py
└── security/
    └── test_auth_boundaries.py
```

---

## Execution Commands

### Run Complete Regression Suite:
```bash
pytest tests/regression -v
```

### Run Impact-Targeted Selective Regression (based on changed files):
```bash
python3 scripts/regression/select_tests.py --run -v
```

### Re-scan Git History & Rebuild Manifest:
```bash
python3 scripts/regression/scan_git_history.py
python3 scripts/regression/build_registry.py
```

### Generate Certification Report:
```bash
python3 scripts/regression/generate_report.py
```
