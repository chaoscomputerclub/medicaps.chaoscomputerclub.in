# Regression Intelligence & Testing Strategy

## 1. Vision & Architecture
The CCC Medi-Caps Online Platform maintains a self-learning regression intelligence pipeline. Whenever a production incident or bug fix occurs, the root cause must be codified into an executable invariant test. Future agents and developers modifying the codebase are strictly prevented from re-introducing previously resolved regressions.

```
                    ┌─────────────────────────┐
                    │ Production Bug/Incident │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Root Cause Analysis     │
                    │ & Invariant Definition  │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Assign Stable REG-XXXX  │
                    │ in bug-registry.json    │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Write Invariant Test    │
                    │ in tests/regression/    │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Update manifest.json    │
                    │ & CI Quality Gate       │
                    └─────────────────────────┘
```

---

## 2. Invariant-First Testing Philosophy
Tests must never simply replicate one arbitrary set of inputs. Instead, every regression test must enforce the universal invariant that was violated:

| Bug Class | Bad Test Pattern | Proper Invariant Pattern |
|---|---|---|
| **Stale Async Overwrite** | `test_profile_call()` | `test_older_response_must_never_overwrite_newer_state()` |
| **Registration Race** | `test_register_single_user()` | `test_concurrent_registrations_cannot_exceed_capacity()` |
| **Double Rating** | `test_rating_calculation()` | `test_rating_finalization_is_strictly_idempotent()` |
| **SSE Count Drift** | `test_sse_event_arrives()` | `test_older_sse_timestamp_cannot_resurrect_superseded_count()` |
| **Session Leak** | `test_logout_button()` | `test_logout_purges_all_user_scoped_browser_and_store_state()` |

---

## 3. Test Placement Hierarchy
Tests must be placed at the cheapest architectural layer that deterministically reproduces the invariant failure:

1. **Pure Domain Logic & Schema Validation** $\rightarrow$ `Unit Test` (`pytest` / `vitest`)
2. **API & Service Endpoints** $\rightarrow$ `Service Integration Test` (`pytest` async DB + client)
3. **Database ACID & Row-Level Locks** $\rightarrow$ `Database Concurrency Test` (`asyncio.gather` with real PostgreSQL)
4. **Distributed Queue & Node Agent** $\rightarrow$ `Distributed Sandbox Test` (`RedisQueueEngine` + `JudgeEngine`)
5. **Session Isolation & Real-Time Sync** $\rightarrow$ `End-to-End Test` (`Playwright` / `Frontend Test`)

---

## 4. Change-Impact Test Selection
During local feature development, developers and agents run affected regression subsets determined by `scripts/regression/select_tests.py`:

- **Modified `src/store/**` or `src/features/**`**:
  Executes `STATE_MANAGEMENT`, `REQUEST_RACE`, `AUTH_SESSION`, `CROSS_USER_LEAK`.
- **Modified `backend/app/modules/contests/**`**:
  Executes `REGISTRATION`, `CONTEST_LIFECYCLE`, `SCOREBOARD`, `RATING`, `TRANSACTION`.
- **Modified `backend/app/engine/**` or `node-agent/**`**:
  Executes `JUDGE_EXECUTION`, `DISTRIBUTED_EXECUTION`, `SANDBOX`.

**CI Requirement:** While local runs use selective impact targeting for speed, GitHub Actions CI executes the 100% complete regression suite on every pull request and push to `main`.

---

## 5. Mutation Verification Policy
For any `CRITICAL` or `HIGH` severity regression test:
1. Temporarily revert the architectural fix or inject the faulty behavior (a controlled mutant).
2. Execute the regression test $\rightarrow$ **MUST FAIL**.
3. Re-apply the architectural fix.
4. Execute the regression test $\rightarrow$ **MUST PASS**.

---

## 6. Flaky Test Governance
A test that passes intermittently is a false safeguard:
- Critical invariant tests cannot be quarantined. If flaky, the underlying concurrency or timing race must be corrected with deterministic clocks or synchronization primitives.
- Any non-critical test undergoing flakiness must be marked in `manifest.json` as `"quarantine": true` with an associated tracking issue, and reviewed weekly.
