# Recurring Bug Classes & Architectural Escalation Ledger

## 1. Recurring Bug Escalation Policy
When the same underlying invariant fails across two or more separate components or sessions, it is **strictly forbidden** to merely append another isolated unit test.

Instead, the failure must be escalated to an **Architectural Hardening Invariant**:
```
  Repeated Invariant Violation
               │
               ▼
  Escalate to Architecture Invariant
               │
               ▼
  Implement System-Wide Structural Guard (e.g., Row Lock / Monotonic Fence / Root Reducer Reset / DB Constraint)
               │
               ▼
  Codify Invariant in tests/regression/
```

---

## 2. Identified Recurring Bug Classes

### Class 1: Judge Stdin/Parameter Extraction & Contamination
- **Incidents:** `7dea5c2`, `c4f1e8d`, `3c2c09c`, `78055fd`, `eeeccbc`, `7e27a42`, `e49f6ad`
- **Pattern:** Multiple language adapters (Python, JS, TS, Rust, C++) had subtle parameter-parsing variations, resulting in parameter contamination, stringified `undefined` conversions, or stdout prefixes in stderr.
- **Architectural Escalation:** Built `test_multilanguage_conformance_contract.py` and canonical `SourceBuildPlan` enforcing identical behavior across all 7 languages.

### Class 2: Request Race Conditions & Stale Async Overwrites
- **Incidents:** `a967950`, `cb9eafe`, `2ede91f`, `23db681`
- **Pattern:** Rapid user navigation between contest pages or problem tabs caused out-of-order API responses to overwrite newer UI state.
- **Architectural Escalation:** Centralized `activeDetailRequestId` generation check in `contestSlice` and request fencing in the API client layer.

### Class 3: Cross-User Browser State Leakage on Logout
- **Incidents:** `a967950`, `af39c27`, `e55fe81`
- **Pattern:** Dispatching logout only cleared authentication tokens while keeping contest, assessment, and social state cached in Redux or `localStorage`.
- **Architectural Escalation:** Integrated a universal `rootReducer` reset to `undefined` in Redux, user-scoped storage keys (`${memberId}`), and automatic SSE stream teardown on `ccc:auth-changed`.

### Class 4: Dual Event Publication & Outbox Bypass
- **Incidents:** `a967950`, `287bd31`, `7211ba5`
- **Pattern:** Mutations directly called `broadcast_event(...)` post-commit while also saving outbox events, causing duplicate SSE broadcasts and feedback loops.
- **Architectural Escalation:** Single Publish Path Invariant: mutations write to `outbox_events` within the active PostgreSQL transaction and flush via `relay_outbox_events(db)`.

### Class 5: Deployment Remote Git Drift
- **Incidents:** `97ee49f`, `d4c96e3`, `cd7a74f`, `3c5989c`, `0735994`
- **Pattern:** `git pull origin main` on the remote server failed due to untracked/dirty files from manual testing or outdated environment variables.
- **Architectural Escalation:** Hardened deploy pipelines to use `git fetch origin main && git reset --hard origin/main` and automated `.env` version synchronization.
