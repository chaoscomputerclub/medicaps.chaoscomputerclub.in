# SSE & REDUX STATE CONSISTENCY FORENSIC AUDIT
**Platform:** Chaos Computer Club (CCC) — Medi-Caps Chapter  
**Scope:** Concurrency, Race Conditions, Reconnection Lifecycles, and Out-of-Order Handling  
**Status:** FORENSIC AUDIT COMPLETE  

---

## 1. Concurrency Scenarios & Race Condition Analysis

### Scenario 1: The "API GET vs. SSE Event" Race Condition
**Sequence:**
1. Cadet opens Contest Lobby. React component triggers `fetchContestDetailThunk("weekly-01")`. HTTP GET leaves the browser.
2. Chief Proctor clicks "Start Contest" in Admin Console. Server commits `status = "live"` to PostgreSQL.
3. SSE event `contest_status_changed` (`new_status: "live"`) arrives at browser `GlobalSseMultiplexer`.
4. `AppRoutes.tsx` dispatches `applyRealtimeEvent`, immediately updating Redux `state.currentContest.status = "live"`.
5. The slow HTTP GET request from Step 1 finally arrives, returning the stale snapshot `{ status: "upcoming" }`.
6. Does the stale HTTP response overwrite the newer SSE live state?

**Codebase Forensic Finding:**
- **PROTECTED via Request Fencing (`activeDetailRequestId` & `activeDetailSlug`)**:
  In [`src/store/slices/contestSlice.ts`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/store/slices/contestSlice.ts#L400-L415):
  ```typescript
  builder.addCase(fetchContestDetailThunk.pending, (state, action) => {
    state.activeDetailRequestId = action.meta.requestId;
    state.activeDetailSlug = action.meta.arg;
  });
  builder.addCase(fetchContestDetailThunk.fulfilled, (state, action) => {
    // Only accept result if requestId matches latest user intent
    if (state.activeDetailRequestId !== action.meta.requestId) return;
    // ...
  });
  ```
  However, if the request ID *did* match because only one fetch was in-flight, an older REST response could theoretically overwrite an SSE field *unless* guarded by timestamp checks.
- **Timestamp Fencing in `applyRealtimeEvent`**:
  [`contestSlice.ts`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/store/slices/contestSlice.ts#L252-L261) records `lastEventTimestamps[slug] = eventTime`. When REST responses arrive, `fetchContestDetailThunk.fulfilled` sets `state.currentContest = action.payload.contest`. If the REST query was processed before the mutation committed, `currentContest.status` could temporarily revert until the next debounced revalidation.
- **Debounced Self-Healing**:
  In [`AppRoutes.tsx`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/AppRoutes.tsx#L117-L123), receiving `contest_status_changed` debounces `fetchContestsThunk(true)` by 500ms, which refetches the fresh state from PostgreSQL after the mutation has stabilized.

---

### Scenario 2: Out-of-Order SSE Events (Event A arrives after Event B)
**Sequence:**
- Event B (`version=42`, `timestamp=T+100ms`) arrives before Event A (`version=41`, `timestamp=T`).

**Codebase Forensic Finding:**
- **PROTECTED on Backend via Atomic Redis Lua CAS**:
  In [`backend/app/core/cache/atomic_cas.py`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/backend/app/core/cache/atomic_cas.py#L57-L66):
  ```lua
  if inc_ver <= cur_ver then
      return cjson.encode({ status = "stale", current_version = cur_ver, incoming_version = inc_ver })
  end
  ```
  Stale events are unconditionally dropped by Redis CAS, preventing cache inversion.
- **PROTECTED on Frontend via Monotonic Timestamp Fencing**:
  In [`src/store/slices/contestSlice.ts`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/store/slices/contestSlice.ts#L252-L261):
  ```typescript
  const eventTime = event.timestamp ? new Date(event.timestamp).getTime() : 0;
  if (slug && eventTime > 0) {
    const lastTime = state.lastEventTimestamps?.[slug] || 0;
    if (eventTime < lastTime) {
      return; // Dropped out-of-order event!
    }
    state.lastEventTimestamps[slug] = eventTime;
  }
  ```

---

### Scenario 3: Browser Disconnect & Missed Events Reconnection
**Sequence:**
- Laptop lid closes or mobile network switches.
- Events 45, 46, 47 occur on server.
- Laptop reconnects.

**Codebase Forensic Finding:**
- **Two Recovery Gates**:
  1. **Fast-Path Replay via `Last-Event-ID`**:
     [`backend/app/modules/events/events_service.py`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/backend/app/modules/events/events_service.py#L79-L88) reads `Last-Event-ID` header and queries `get_replay_events(channel, last_event_id)` from Redis circular ZSET (`ccc:sse:replay:{channel}`). Missed events in the window are replayed in order.
  2. **Snapshot Resync (`resync_required`)**:
     If client was disconnected longer than the buffer capacity (100 events), the backend emits `event: resync_required`.
     [`src/lib/realtime.ts`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/lib/realtime.ts#L433) detects `resync_required` and invokes `invalidateContestCaches(true)`.
     This purges all SWR memory and session caches and forces cold HTTP GET queries against PostgreSQL.
  3. **Reconnect Hook**:
     [`realtime.ts:248`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/lib/realtime.ts#L248): When `EventSource.onopen` fires and `reconnectAttempts > 0`, it unconditionally calls `invalidateContestCaches(true)`.

---

### Scenario 4: Contest Becomes LIVE but Client Misses SSE
**Sequence:**
- Cadet is sitting on Contest Lobby page.
- Contest auto-start background task sets status to `"live"`.
- If SSE packet is lost during packet retransmission:
  - Is the cadet permanently stranded on the Lobby page?

**Codebase Forensic Finding:**
- **Dual Fallback Defense**:
  1. The page uses `useCountdown()` hook based on `contest.starts_at`. When countdown hits zero, the client checks if starts_at has passed.
  2. Background worker [`backend/app/services/background_tasks_service.py:_auto_start_contests`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/backend/app/services/background_tasks_service.py#L307) runs periodically every 15s.
  3. SWR default stale time is 30s. Any tab focus or window interaction triggers background SWR revalidation.

---

### Scenario 5: Multi-Store Inconsistency on Submission Accepted
**Sequence:**
- Submission evaluated `ACCEPTED`.
- Scoreboard, Elo ratings, member solved count, and problem statistics all mutate.
- Do multiple client stores become desynchronized?

**Codebase Forensic Finding:**
- In [`backend/app/modules/contests/contest_execution_service.py:880-920`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/backend/app/modules/contests/contest_execution_service.py#L880-L920):
  All mutations (submission row, scoreboard entry, re-ranking, problem solved count, outbox event) are executed inside **ONE atomic PostgreSQL transaction** under `SELECT pg_advisory_xact_lock(hashtext('scoreboard:cid'))`.
  It is physically impossible for the submission to commit without the scoreboard updating in PostgreSQL.
- On client side:
  Receiving `submission_evaluated` in `ContestArenaPage.tsx` sets local `solvedProblemIds` and problem output tab immediately, while `invalidateContestCaches()` invalidates `scoreboard:*` SWR queries. The next render of the Scoreboard fetches the atomically re-ranked PostgreSQL scoreboard.
