# 🛡️ GLOBAL STATE & REAL-TIME SSE REGRESSION REGISTRY

## 1. Executive Summary
This document specifies the permanent invariant contracts and regression definitions for global state management, transactional outbox event routing, Redis pub/sub fan-out, SSE real-time synchronization, and client-side Redux/SWR state reconciliation across the CCC Medi-Caps Online Competitive Programming Platform.

---

## 2. Invariant Matrix

| Regression ID | Title | Core Invariant | Root Cause & Failure Scenario | Automated Guard |
| :--- | :--- | :--- | :--- | :--- |
| **`REG-STATE-001`** | Contest registration state diverges between list and detail | `ALL_CONTEST_VIEWS_MUST_CONVERGE_TO_THE_SAME_AUTHORITATIVE_REGISTRATION_STATE` | `register_for_contest` only deleted `cache:contest*` and `cache:*:{member_id}:*`, leaving `cache:reg_status:{contest_id}:{member_id}` intact in Redis. Navigating to detail hit stale cache returning `registered=false`. | `backend/tests/test_contest_registration_consistency.py::test_reg_state_001_cache_invalidation_on_registration` & Playwright E2E `tests/e2e/contests_flow.spec.ts::REG-STATE-001` |
| **`REG-STATE-002`** | Outbox canonical payload & immediate relay | `OUTBOX_EVENTS_MUST_CARRY_COMPLETE_IDENTITY_AND_RELAY_INSTANTLY` | `register_for_contest` wrote outbox event without immediate relay, waiting on background poller; payload lacked `contest_id`, `version`, `registered: True`. | `backend/tests/test_contest_registration_consistency.py::test_reg_state_002_outbox_canonical_payload_and_relay` |
| **`REG-STATE-003`** | Unregistration cache & outbox consistency | `UNREGISTER_MUST_PURGE_ALL_CACHE_PROJECTIONS_AND_EMIT_UNREGISTER_EVENT` | Missing `cache:reg_status*` invalidation on unregister; detail showed stale registration. | `backend/tests/test_contest_registration_consistency.py::test_reg_state_003_unregistration_cache_invalidation_and_outbox` |
| **`REG-STATE-004`** | Idempotent double registration | `CONCURRENT_OR_REPEAT_REGISTRATIONS_MUST_YIELD_IDENTICAL_AUTHORITATIVE_CONFIRMATION` | Duplicate POST requests must not increment `registered_count` multiple times or create duplicate database rows. | `backend/tests/test_contest_registration_consistency.py::test_reg_state_004_double_registration_idempotency` |
| **`REG-STATE-005`** | Single publisher invariant in admin operations | `ALL_STATE_MUTATIONS_MUST_EMIT_EVENTS_EXCLUSIVELY_VIA_TRANSACTIONAL_OUTBOX` | Admin registration previously invoked direct `broadcast_event(...)` bypassing outbox, leading to out-of-order or duplicate broadcasts. | `backend/tests/test_contest_registration_consistency.py::test_reg_state_005_admin_registration_single_publisher` |
| **`REG-STATE-006`** | REST vs. SSE request fencing | `STALE_REST_SNAPSHOTS_MUST_NEVER_OVERWRITE_NEWER_MUTATION_OR_SSE_STATE` | If a slow `GET /contests/{slug}` resolves after a user registers, timestamp fencing inside Redux `fetchContestDetailThunk.fulfilled` drops the stale response. | Redux `contestSlice.ts` timestamp fencing & `tests/e2e/zero_lag_navigation.spec.ts` |

---

## 3. Detailed Forensic Tracing

### 3.1 Failure Trace (`REG-STATE-001`)
```text
1. Cadet visits /contests (ContestsHubPage)
2. Cadet clicks "Register" on CCC Weekly 2
3. POST /contests/ccc-weekly-2/register succeeds (status: confirmed)
4. Redux contestSlice sets contestInList.registered = true
5. Toast "Successfully registered for the contest!" appears
6. ContestsHubPage renders card as "Registered"
7. Cadet clicks card and navigates to /contests/ccc-weekly-2 (ContestOverviewPage)
8. ContestOverviewPage dispatches fetchContestDetailThunk
9. Detail thunk queries GET /contests/ccc-weekly-2/registration-status
10. FastAPI get_registration_status checks Redis: cache:reg_status:101:404
11. REDIS HIT: returns cached { "registered": false } (from pre-registration read)
12. Redux receives registration payload with registered: false
13. ContestOverviewPage sets isRegistered = false
14. Screen reverts to "Register for Contest" CTA!
```

### 3.2 Repaired Canonical Flow
```text
PostgreSQL 16 (Authoritative)
    │
    ▼ (atomic transaction: ContestRegistration + OutboxEvent)
Transactional Outbox (queue="realtime", event="contest_registered")
    │
    ▼ (immediate relay_outbox_events() execution)
Redis Pub/Sub (channel="ccc:realtime:events")
    │
    ▼ (low latency broadcast)
Global SSE Multiplexer (single shared EventSource stream)
    │
    ├───────────────────────────────────────────┐
    ▼                                           ▼
Redux Canonical Projection            SWR Client Cache
(contestSlice.registrationsBySlug)    (globalSwrStore seed + invalidate)
    │                                           │
    ├───────────────────┬───────────────────────┘
    ▼                   ▼
ContestsHubPage   ContestOverviewPage (Both consume selectIsContestRegistered)
[Registered ✓]     [Registered ✓]
```

---

## 4. Operational Invariant Verification

Whenever modifying backend services or frontend state slices:
1. Run backend regression suite:
   ```bash
   PYTHONPATH=backend backend/.venv/bin/pytest backend/tests/test_contest_registration_consistency.py
   ```
2. Run frontend production compilation:
   ```bash
   npm run build
   ```
3. Run Playwright E2E verification:
   ```bash
   npx playwright test tests/e2e/contests_flow.spec.ts
   ```
