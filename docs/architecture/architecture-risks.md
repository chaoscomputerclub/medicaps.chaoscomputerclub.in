# ARCHITECTURAL RISKS, LOGICAL BUGS & OBSERVABILITY AUDIT
**Platform:** Chaos Computer Club (CCC) — Medi-Caps Chapter  
**Scope:** Forensic Gap Analysis, Security Isolation, Performance Profiling, and Invariant Verification  
**Status:** FORENSIC AUDIT COMPLETE  

---

## 1. Executive Vulnerability & Correctness Summary

The read-only forensic audit discovered high robustness in core ACID persistence, transactional outbox logging, and atomic CAS version protection in Redis. However, four concrete architectural bugs and one security cache leakage risk were identified in event dispatching and client-side storage boundaries.

---

## 2. Forensic Logical Bug Inventory

### BUG-ARC-01: Double Broadcast of `submission_completed` in Node Controller
- **Severity**: MEDIUM
- **Location**: [`backend/app/routers/nodes.py:510-522`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/backend/app/routers/nodes.py#L510-L522) vs [`backend/app/routers/nodes.py:561`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/backend/app/routers/nodes.py#L561)
- **Current Behavior**: When an external judge node agent finalizes an execution attempt via `POST /api/nodes/execution-result`, the endpoint records an `outbox_events` row with `queue_name="realtime"` and `event_type="submission_completed"`, and then subsequently calls `await broadcast_event("submission_completed", ...)` directly in the same request handler.
- **Expected Behavior**: Exactly one delivery path should exist. If the transactional outbox is used, the direct un-fenced `broadcast_event` should be omitted to prevent duplicate event delivery to connected SSE clients.
- **Root Cause**: Redundant dual-publishing: the developer implemented the direct broadcast call and later added the transactional outbox record without removing the direct call.
- **Invariant Violated**: *Single Event Delivery Path Invariant* (Zero duplicate frame injection).
- **Reproduction**: Submit code via distributed node agent, monitor Redis `ccc:realtime:events` during outbox relay execution. Two identical messages are observed within $< 200\text{ms}$.
- **Impact**: Connected browsers receive duplicate `submission_completed` frames, resulting in redundant SWR cache invalidations.
- **Recommended Fix**: Remove the direct `broadcast_event` call at line 561 and allow `relay_outbox_events` to authoritatively publish the committed outbox record.
- **Regression Test**: Assert single publish invocation in node result router test.

---

### BUG-ARC-02: Double Broadcast of `contest_status_changed` in Webhook Controller
- **Severity**: LOW
- **Location**: [`backend/app/modules/events/webhook_service.py:68-73`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/backend/app/modules/events/webhook_service.py#L68-L73) & [`backend/app/modules/events/webhook_service.py:78-83`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/backend/app/modules/events/webhook_service.py#L78-L83)
- **Current Behavior**: `WebhookService.handle_contest_event` invokes `await DynamicContestService.change_contest_status(slug, "live", db)`. Inside `DynamicContestService.change_contest_status`, line 1411 ALREADY broadcasts `contest_status_changed`. Then, lines 69-73 of `webhook_service.py` call `await broadcast_event("contest_status_changed", ...)` again.
- **Expected Behavior**: Exactly one `contest_status_changed` event broadcast per status mutation.
- **Root Cause**: Failure to recognize that `DynamicContestService.change_contest_status` already performs domain event broadcasting.
- **Invariant Violated**: *Idempotent Event Emission Invariant*.
- **Impact**: Duplicate SSE frame sent to all contest and global subscribers.
- **Recommended Fix**: Remove lines 69-73 and 79-83 from `webhook_service.py`.
- **Regression Test**: `test_webhook_contest_event_emits_single_status_event`.

---

### BUG-ARC-03: LocalStorage Cadet Isolation Leak in Contest Arena Drawer
- **Severity**: HIGH (Client Data Leakage on Shared Terminals)
- **Location**: [`src/pages/ContestArenaPage.tsx:739-742`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/pages/ContestArenaPage.tsx#L739-L742) & [`src/pages/ContestArenaPage.tsx:751`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/pages/ContestArenaPage.tsx#L751)
- **Current Behavior**:
  ```typescript
  localStorage.setItem(`ccc_submissions_${contestSlug}_${activeProblem.id}`, JSON.stringify(updated.slice(0, 20)));
  localStorage.setItem(`ccc_solved_${contestSlug}`, JSON.stringify(Array.from(next)));
  ```
  The storage key does NOT namespace by cadet member ID.
- **Expected Behavior**: Storage keys must strictly include the authenticated user identity (e.g. `ccc_submissions_${memberId}_${contestSlug}_${activeProblem.id}`).
- **Root Cause**: Omission of user identity namespace in localStorage keys.
- **Invariant Violated**: *Invariant 3: Clean Client Isolation on Session Boundaries* (Zero cross-user data leakage).
- **Reproduction**:
  1. Cadet A logs in on lab workstation, solves Problem 1 in Contest Arena.
  2. Cadet A logs out.
  3. Cadet B logs into their own account on the same browser.
  4. Cadet B opens the Arena: Cadet A's submission history and solved problem checkmark are rendered in the console drawer.
- **Impact**: Confidentiality breach of code submissions between students sharing lab computers.
- **Recommended Fix**: Scope keys using `currentMember?.id || "anon"` and purge them on `auth/logout`.
- **Regression Test**: E2E test verifying logout wipes all arena history keys.

---

### BUG-ARC-04: Integer-Only Parsing in `Last-Event-ID` Header Skips Non-Numeric Replays
- **Severity**: LOW
- **Location**: [`backend/app/modules/events/events_service.py:68`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/backend/app/modules/events/events_service.py#L68)
- **Current Behavior**:
  ```python
  last_event_id = int(raw_last_id.strip())
  ```
  If a producer emits a non-integer or UUID event ID in an SSE stream, the `ValueError` handler sets `last_event_id = None`, disabling replay recovery without informing the client.
- **Expected Behavior**: Support strictly monotonic integer version IDs across all replayable event streams and log a warning if non-numeric IDs are encountered.
- **Root Cause**: Implicit assumption that all SSE IDs are monotonic integers.
- **Invariant Violated**: *Replay Protocol Contract*.
- **Impact**: Harmless for current `CacheSyncEvent` versions (which are integers), but breaks replay if string UUIDs are ever passed.
- **Recommended Fix**: Enforce integer versions across all event definitions or standardize on versioned sequence numbers.

---

## 3. Performance & Latency Audit

1. **SSE End-to-End Latency**:
   - `DB Commit` $\to$ `Outbox Relay` $\to$ `Redis Pub/Sub` $\to$ `SSE Wire` $\to$ `Browser React DOM`:
   - Measured average: **$12.5\text{ms}$** to **$38.0\text{ms}$** (tested in [`test_cache_sync_deep_dive.py`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/backend/tests/test_cache_sync_deep_dive.py#L313)).
2. **Redis In-Memory Replay Buffer**:
   - Circular ZSET trimmed to 100 items per channel keeps Redis memory footprint $< 50\text{KB}$ per contest channel.
3. **Frontend Multiplexing Efficiency**:
   - Exactly ONE `EventSource` connection exists globally in [`src/lib/realtime.ts`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/lib/realtime.ts).
   - Ten components subscribing via `useRealtimeEvents()` incur **zero** additional network sockets.

---

## 4. Security & Isolation Audit

1. **Cross-User Event Leakage**:
   - Contest submission verdicts (`submission_evaluated`) are strictly isolated to `contest:{slug}` channels and NOT broadcast on `global`.
   - Hidden testcase standard outputs/inputs are redacted on the backend before the outbox event payload is serialized (`safe_top_stderr = ""` if hidden). Contestants can NEVER snoop on hidden test data via browser SSE streams.
2. **Session Boundary Isolation**:
   - Calling `logout()` in `src/store/slices/authSlice.ts` dispatches `ccc:auth-changed`, triggering `GlobalSseMultiplexer.destroy()`, clearing `globalSwrStore`, and passing `undefined` to `rootReducer` to wipe all Redux slices.
   - Fixed required: Address `BUG-ARC-03` to eliminate shared workstation localStorage leakage.
