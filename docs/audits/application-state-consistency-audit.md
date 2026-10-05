# APPLICATION STATE & DATA CONSISTENCY FORENSIC AUDIT
**Platform:** Chaos Computer Club (CCC) — Medi-Caps Chapter  
**System Profile:** Online Competitive Programming Arena (LeetCode-Model)  
**Target Git Branch:** `audit/state-consistency-hardening`  
**Date of Audit:** October 5, 2026  
**Auditor:** Automated Forensic Agentic Architecture Suite  

---

## EXECUTIVE SUMMARY

A forensic, end-to-end investigation across the frontend (React 19 / Vite / Redux Toolkit / Custom SWR), backend (FastAPI / PostgreSQL 16 / SQLAlchemy 2.0 Async / Redis 7 / Distributed Fabric / Judge0 / Codebox), background workers, and distributed agents (`judge-agent`, `node-agent`) was performed.

The platform is strictly an **online, distributed competitive programming platform**. Physical attendance, paper-based seating, lab gate QR check-ins, and offline-only contest states have been decommissioned. However, residues of those models previously contaminated client Redux slices, database models, lifecycle state machines, and rating routines.

This document inventories every domain state component, maps canonical sources of truth, identifies state ownership violations, race conditions, mutation non-idempotency, transaction boundary failures, and specifies the hardening remediation plan.

---

## 1. COMPREHENSIVE APPLICATION STATE INVENTORY (20 TIERS)

### Tier 1: Frontend Architecture
- **Owner:** Browser DOM / React 19 Client Runtime
- **Source of Truth:** Server responses / URL Route Parameters
- **Cache:** Vite Bundler Chunks / Preloaded Route Modules / Memory Cache
- **Mutation Path:** React Router DOM navigation (`useNavigate`, `<Link>`)
- **Read Path:** `useLocation()`, `useParams()`, `<Routes>` matching in [AppRoutes.tsx](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/AppRoutes.tsx)
- **Invalidation Path:** Page unmount / Browser Navigation
- **Event Source:** User clicks, Browser popstate, SSE Navigation redirects
- **Lifetime:** Tab session / Browser lifetime
- **Authorization Boundary:** Client-side `<AuthGuard>`, `<GuestGuard>`

---

### Tier 2: Redux Architecture
- **Owner:** Redux Store ([store/index.ts](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/store/index.ts))
- **Source of Truth:** Client Redux Slices:
  - `auth` ([authSlice.ts](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/store/slices/authSlice.ts))
  - `contest` ([contestSlice.ts](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/store/slices/contestSlice.ts))
  - `assessment` ([assessmentSlice.ts](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/store/slices/assessmentSlice.ts))
  - `social` ([socialSlice.ts](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/store/slices/socialSlice.ts))
  - `portal` ([portalSlice.ts](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/store/slices/portalSlice.ts))
  - `ui` ([uiSlice.ts](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/store/slices/uiSlice.ts))
- **Cache:** In-memory Redux state tree; partial hydration from `localStorage`
- **Mutation Path:** Synchronous action reducers & RTK Async Thunks
- **Read Path:** `useAppSelector(selector)`
- **Invalidation Path:** Slice reducers (e.g. `clearArenaResults`, `resetContestState`), `auth/logout`
- **Event Source:** UI user actions, SSE callbacks via `applyRealtimeEvent`
- **Lifetime:** Tab lifetime / In-memory
- **Authorization Boundary:** Session authentication token; slices must clear on logout

---

### Tier 3: Local Component State
- **Owner:** React Virtual DOM Fiber tree
- **Source of Truth:** `useState`, `useRef`, `useReducer` inside view components
- **Cache:** Component instance memory
- **Mutation Path:** Component state setters (`setState`)
- **Read Path:** Component render execution
- **Invalidation Path:** Component unmount
- **Event Source:** Local DOM events (typing, clicking, modal toggling)
- **Lifetime:** Component mount lifecycle
- **Authorization Boundary:** Component scope

---

### Tier 4: Server-State Cache (Custom SWR)
- **Owner:** `globalSwrStore` ([lib/cache/swrCache.ts](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/lib/cache/swrCache.ts))
- **Source of Truth:** PostgreSQL database via REST API
- **Cache:** In-memory `Map<string, CacheRecord<T>>` + `sessionStorage` (`__ccc_swr_cache_${identity}__`)
- **Mutation Path:** `swrFetch()`, `invalidateSwrCache()`, `globalSwrStore.set()`
- **Read Path:** `useSwrData()`, `globalSwrStore.get()`
- **Invalidation Path:** `invalidateSwrCache(pattern)`, `ccc:auth-changed` event
- **Event Source:** Component mount, window refocus, SSE invalidation event
- **Lifetime:** Configurable TTL (default 5m) + stale-time (30s)
- **Authorization Boundary:** Scoped by member ID; cleared completely on logout

---

### Tier 5: API Client
- **Owner:** HTTP Transport Layer ([lib/auth.ts](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/lib/auth.ts))
- **Source of Truth:** Browser `fetch()` API
- **Cache:** Request deduplication via `SingleFlight` / in-flight promise map
- **Mutation Path:** `apiFetch()`, `fetch()`, Axios calls
- **Read Path:** Response body parsing (JSON)
- **Invalidation Path:** `AbortController` cancellation, 401 Unauthorized handling
- **Event Source:** Network sockets
- **Lifetime:** Ephemeral per HTTP exchange
- **Authorization Boundary:** `Authorization: Bearer <jwt>` HTTP header + HttpOnly cookie

---

### Tier 6: Authentication State
- **Owner:** Server Session / JWT Issuer
- **Source of Truth:** PostgreSQL `member_profiles` + RSA256 Private Key
- **Cache:** Browser `localStorage` (`ccc_medicaps_token`, `ccc_medicaps_member`)
- **Mutation Path:** `POST /api/auth/verify-otp`, `POST /api/auth/complete-onboarding`, `POST /api/auth/logout`
- **Read Path:** `GET /api/auth/me`, `getToken()`
- **Invalidation Path:** Token expiry (15m access / 30d refresh), explicit logout, 401 HTTP response
- **Event Source:** Auth forms, Turnstile challenge, OAuth redirect
- **Lifetime:** 15 minutes access JWT, 30 days refresh cookie
- **Authorization Boundary:** RSA256 signature verification in `get_current_member` dependency

---

### Tier 7: Contest State
- **Owner:** PostgreSQL `offline_contests` table (Authoritative)
- **Source of Truth:** PostgreSQL database
- **Cache:** Redis (`cache:contest:detail:{slug}`, `cache:contests:list`), Redux `contestSlice.contests`
- **Mutation Path:** `POST /api/admin/contests`, `PATCH /api/contests/{slug}/status`, `DynamicContestService`
- **Read Path:** `GET /api/contests`, `GET /api/contests/{slug}`
- **Invalidation Path:** `delete_cache_pattern("cache:contest*")`, outbox `contest_updated` event
- **Event Source:** Admin operations, scheduled background lifecycle worker
- **Lifetime:** Permanent database record
- **Authorization Boundary:** Admin/Core for mutations; public for published contests

---

### Tier 8: Registration State
- **Owner:** PostgreSQL `contest_registrations` table
- **Source of Truth:** PostgreSQL `(contest_id, member_id)` unique row
- **Cache:** Redis `cache:reg_status:{slug}:{member_id}`, Redux `contestSlice.registration`
- **Mutation Path:** `POST /api/contests/{slug}/register`, `POST /api/contests/{slug}/unregister`
- **Read Path:** `GET /api/contests/{slug}/registration-status`
- **Invalidation Path:** `delete_cache_pattern(f"cache:reg_status:{slug}:{member_id}*")`, SSE `contest_registered`
- **Event Source:** Competitor user action
- **Lifetime:** Duration of contest lifecycle
- **Authorization Boundary:** Authenticated member registering own account only

---

### Tier 9: Problem State
- **Owner:** PostgreSQL `problems`, `problem_versions`, `contest_problems`, `problem_testcases`
- **Source of Truth:** PostgreSQL database
- **Cache:** Redis (`cache:contest:problems:{slug}`), compilation cache
- **Mutation Path:** `POST /api/admin/problems`, `PUT /api/admin/contests/{slug}/problems/{index}`
- **Read Path:** `GET /api/contests/{slug}/problems`, `GET /api/contests/{slug}/arena`
- **Invalidation Path:** Admin update, problem publication
- **Event Source:** Authoring portal
- **Lifetime:** Permanent versioned entity
- **Authorization Boundary:** Hidden test cases are strictly forbidden from public APIs

---

### Tier 10: Submission State
- **Owner:** PostgreSQL `contest_submissions` table
- **Source of Truth:** Authoritative row in PostgreSQL
- **Cache:** Redis in-flight job `ccc:job:{id}`, Redux `contestSlice.submitResult`
- **Mutation Path:** `POST /api/contests/{slug}/arena/submit`
- **Read Path:** `GET /api/contests/{slug}/problems/{id}/submissions`, `GET /api/jobs/{id}`
- **Invalidation Path:** Final verdict evaluation / CAS transition
- **Event Source:** Competitor code editor submit button
- **Lifetime:** Permanent competitive audit log
- **Authorization Boundary:** Authenticated registered competitor

---

### Tier 11: Scoreboard State
- **Owner:** PostgreSQL `scoreboard_entries` table (Canonical Server State)
- **Source of Truth:** PostgreSQL database with deterministic tie-breaking: `score DESC, penalty_seconds ASC, id ASC`
- **Cache:** Redis `cache:scoreboard:{slug}`, SWR cache `scoreboard:*`
- **Mutation Path:** CAS Finalization of `ContestSubmission` inside transactional advisory lock
- **Read Path:** `GET /api/contests/{slug}/scoreboard`, `GET /api/scoreboards/{slug}`
- **Invalidation Path:** `delete_cache_pattern(f"cache:scoreboard:{slug}*")`, SSE `submission_evaluated`
- **Event Source:** Execution finalizer
- **Lifetime:** Permanent contest record
- **Authorization Boundary:** Public reading; server-only writing

---

### Tier 12: Rating State
- **Owner:** PostgreSQL `member_profiles.rating`, `peak_rating`, and `rating_history` table
- **Source of Truth:** PostgreSQL database
- **Cache:** Redis `cache:leaderboard:university*`, Redux `authSlice.member.rating`
- **Mutation Path:** `DynamicContestService._apply_final_ratings` upon contest finalization
- **Read Path:** `GET /api/leaderboard`, `GET /api/members/{handle}`
- **Invalidation Path:** Contest finalization, outbox `ratings_updated`
- **Event Source:** Contest conclusion workflow
- **Lifetime:** Permanent historical ledger
- **Authorization Boundary:** Server-only execution; restricted to finalized contests

---

### Tier 13: SSE Real-Time Stream State
- **Owner:** FastAPI SSE broadcaster ([services/event_broadcaster.py](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/backend/app/services/event_broadcaster.py))
- **Source of Truth:** Ephemeral broadcast channel (`Redis Pub/Sub` + circular replay buffer ZSET)
- **Cache:** Redis circular buffer `ccc:sse:replay:{channel}` (last 100 events)
- **Mutation Path:** `broadcast_event()`, `broadcast_sync_event()`
- **Read Path:** `GET /api/events/stream`, `GET /api/events/contest/{slug}/stream`
- **Invalidation Path:** Subscriber disconnect / timeout / buffer overflow
- **Event Source:** Outbox relayer, domain events
- **Lifetime:** Transient / Streaming
- **Authorization Boundary:** Contest-scoped vs Global stream isolation

---

### Tier 14: PostgreSQL State
- **Owner:** PostgreSQL 16 ACID Database Engine
- **Source of Truth:** WAL (Write-Ahead Logging) on disk
- **Cache:** PostgreSQL shared buffers, OS buffer cache
- **Mutation Path:** SQL statements via SQLAlchemy AsyncSession (`INSERT`, `UPDATE`, `DELETE`)
- **Read Path:** SQL statements (`SELECT`)
- **Invalidation Path:** Transaction `COMMIT` / `ROLLBACK`
- **Event Source:** API routes, background workers
- **Lifetime:** Durable persistent storage
- **Authorization Boundary:** PostgreSQL role credentials + Row-level business authorization

---

### Tier 15: Redis State
- **Owner:** Redis 7 In-Memory Data Structure Store
- **Source of Truth:** Ephemeral coordination, cache-aside, job queues, distributed locks
- **Cache:** Key-value store with TTLs
- **Mutation Path:** `SET`, `HSET`, `LPUSH`, `ZADD`, Lua scripts
- **Read Path:** `GET`, `HGET`, `BRPOP`, `ZRANGEBYSCORE`
- **Invalidation Path:** Key expiration (`EX`), `DEL`, pattern deletion
- **Event Source:** Cache sync worker, queue engines, rate limiters
- **Lifetime:** Volatile / In-memory (10s to 30d TTLs)
- **Authorization Boundary:** Redis connection password / local network socket

---

### Tier 16: Background Jobs State
- **Owner:** `RedisQueueEngine` ([core/queue/redis_queue.py](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/backend/app/core/queue/redis_queue.py))
- **Source of Truth:** Redis Lists (`ccc:queue:{name}:pending`, `processing`, `dead_letter`)
- **Cache:** Redis hash `ccc:job:{id}`
- **Mutation Path:** `RedisQueueEngine.enqueue()`
- **Read Path:** Worker consumer loop (`_consume_loop`)
- **Invalidation Path:** Job acknowledgment, dead-letter migration, completion TTL
- **Event Source:** Domain controllers, outbox relayer
- **Lifetime:** Job processing lifetime (until completed or dead-lettered)
- **Authorization Boundary:** Internal backend services

---

### Tier 17: Distributed Execution State
- **Owner:** `ExecutionRouter` ([engine/execution_router.py](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/backend/app/engine/execution_router.py))
- **Source of Truth:** PostgreSQL `judge_jobs` and `judge_job_attempts` tables
- **Cache:** Redis node heartbeats `ccc:node:{id}:heartbeat`, provider leases
- **Mutation Path:** `router.execute()`, `AttemptManager.create_attempt()`, `finalize_attempt()`
- **Read Path:** `GET /api/nodes`, `GET /api/jobs/{id}`
- **Invalidation Path:** Attempt deadline expiry, lease expiry, node offline detection
- **Event Source:** Submission events, gRPC worker claims
- **Lifetime:** Ephemeral per submission execution attempt (max 15s)
- **Authorization Boundary:** Node-agent / Judge-agent mTLS & shared secrets

---

### Tier 18: Transactional Outbox State
- **Owner:** PostgreSQL `outbox_events` table
- **Source of Truth:** PostgreSQL rows with `status = 'pending'`
- **Cache:** None; polled directly with `SELECT ... FOR UPDATE SKIP LOCKED`
- **Mutation Path:** `record_outbox_event()` inside active business transactions
- **Read Path:** `relay_outbox_events()` background task
- **Invalidation Path:** Update `status = 'published'` or `'failed'` after 5 retries
- **Event Source:** Business service mutations
- **Lifetime:** Durable until published, then retained for audit trail
- **Authorization Boundary:** Internal transactional service

---

### Tier 19: Transaction Boundaries
- **Owner:** SQLAlchemy `AsyncSession` / PostgreSQL Transaction Manager
- **Source of Truth:** `BEGIN ... COMMIT / ROLLBACK` block
- **Scope:** Single ACID transaction per cohesive business operation
- **Invariant:** A business mutation and its corresponding outbox event MUST be committed in the exact same transaction.
- **Current Vulnerability:** Operations previously split across multiple commits or relying on fire-and-forget Redis calls.

---

### Tier 20: Persistence Boundaries
- **Durable Authority:** PostgreSQL (Users, Contests, Problems, Registrations, Submissions, Scores, Ratings, Outbox).
- **Volatile Authority:** Redis (Job queues, rate limit counters, lock mutexes, cache-aside records).
- **Client Convenience:** Browser `localStorage` / `sessionStorage` (strictly ephemeral; MUST be invalidated on user switch or logout).

---

## 2. STATE OWNERSHIP CANONICAL MATRIX

| Domain Fact | Authoritative Source of Truth | Permitted Caches | Forbidden Authorities |
|---|---|---|---|
| User Identity & Auth | PostgreSQL (`member_profiles`) | JWT (15m), Local storage | Redux, Browser cookies alone |
| Contest Status | PostgreSQL (`offline_contests.status`) | Redis TTL cache, Redux list | Redis lifecycle key alone, SSE event |
| Contest Registration | PostgreSQL (`contest_registrations`) | Redis registration status | Client Redux state, Local storage |
| Problem Spec & Testcases | PostgreSQL (`problems`, `problem_versions`, `problem_testcases`) | Compilation cache, Redis | Frontend memory |
| Code Submission Attempt | PostgreSQL (`judge_jobs`, `judge_job_attempts`) | Redis queue payload | Node agent local disk |
| Submission Verdict | PostgreSQL (`contest_submissions.verdict`) | Redux run/submit result | Local judge provider cache |
| Official Scoreboard Rank | PostgreSQL (`scoreboard_entries`) | Redis scoreboard cache | Frontend client sorting |
| Elo Rating | PostgreSQL (`member_profiles.rating`, `rating_history`) | Redux profile slice | Scoreboard delta inferences |
| Domain Events | PostgreSQL (`outbox_events`) | Redis Pub/Sub, SSE stream | In-memory message queues |

---

## 3. FORENSIC DEFECT AUDIT & ROOT CAUSE ANALYSIS

### Defect 1: State Leakage & Lack of Isolation on Logout (Phase 13)
- **Findings:** In [authSlice.ts](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/store/slices/authSlice.ts), the `logout` reducer only clears `authSlice` fields. `contestSlice`, `assessmentSlice`, and `socialSlice` remain in memory. If User A logs out and User B logs in without refreshing the page, User B can access User A's contest participations, active code submissions, and social follower IDs.
- **Root Cause:** No root reducer reset pattern or cross-slice logout listener in Redux. `localStorage` keys `ccc_my_social_counts` and `ccc_bookmarked_problems` are un-scoped.
- **Remediation:** Introduce root state reset on `auth/logout`, user-scoped storage keys, and in-flight request cancellation.

### Defect 2: Request Race Conditions & Lack of Response Fencing (Phase 7)
- **Findings:** In [contestSlice.ts](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/store/slices/contestSlice.ts), `fetchContestDetailThunk.fulfilled` sets `state.currentContest` without checking whether the fulfilled contest slug matches the latest requested slug. If a user quickly navigates from Contest 1 to Contest 2, and Contest 1's network response arrives second, Contest 1 overwrites Contest 2.
- **Root Cause:** Missing request sequence numbers or started-at request fencing.
- **Remediation:** Implement monotonic request ID fencing in Redux thunks.

### Defect 3: Blind SSE Event Overwrite Without Monotonic Version Checks (Phase 11 & 12)
- **Findings:** In [contestSlice.ts](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/src/store/slices/contestSlice.ts) `applyRealtimeEvent`, SSE events directly mutate `targetContest.status` and `registered_count` without checking event timestamp or entity version. An out-of-order replayed SSE message could revert a "finished" contest to "upcoming".
- **Root Cause:** Realtime events lack monotonic version comparison against state.
- **Remediation:** Add monotonic version / timestamp checks in `applyRealtimeEvent`.

### Defect 4: Duplicate SSE Broadcast from Dual Dispatch (Phase 12 & 19)
- **Findings:** In [contest_execution_service.py](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/backend/app/modules/contests/contest_execution_service.py), `submit_arena_code` writes an event to `outbox_events` and then immediately calls `await broadcast_event("submission_evaluated", ...)` after `db.commit()`. When the outbox relayer runs, it also relays the event from `outbox_events` to `broadcast_event`, producing duplicate SSE events.
- **Root Cause:** Dual emission: direct publish + outbox relay.
- **Remediation:** Make outbox the single reliable broadcaster or deduplicate at the client.

### Defect 5: Registration Concurrency Race on Capacity & Missing Lock (Phase 17)
- **Findings:** In [contest_service.py](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/backend/app/modules/contests/contest_service.py), `register_for_contest` fetches `contest` with standard `SELECT` (no `with_for_update()`). Concurrent registrations can read identical `registered_count`, resulting in lost increments and capacity overshoot.
- **Root Cause:** Missing row lock on `OfflineContest` during registration mutation.
- **Remediation:** Lock `OfflineContest` row with `with_for_update()` during registration.

### Defect 6: Conflation of Registration and Participation in Final Ratings (Phase 22)
- **Findings:** In [dynamic_contest_service.py](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/backend/app/services/dynamic_contest_service.py), `_apply_final_ratings` queries all registrations with `status.in_(["submitted", "completed", "confirmed"])` and generates `ScoreboardEntry` rows for them, even if they never submitted any code. They are then rated, distorting Elo calculations.
- **Root Cause:** Failure to separate registered candidates from active participants who submitted solutions.
- **Remediation:** Only candidates with actual submissions (`ContestSubmission`) or active solves are eligible for scoreboard ranking and rating calculations.

### Defect 7: Missing HTTP-Level Mutation Idempotency (Phase 8)
- **Findings:** While the queue system supports idempotency keys, public mutation endpoints (`POST /contests/{slug}/register`, `POST /contests/{slug}/arena/submit`) do not consume an `Idempotency-Key` HTTP header. Retries on network timeouts risk duplicate mutations or 429 errors.
- **Root Cause:** Absence of HTTP idempotency middleware/interceptor.
- **Remediation:** Add HTTP `Idempotency-Key` interceptor and storage for critical mutations.

### Defect 8: Residual Offline & QR Gate Artifacts (Product Constraint)
- **Findings:** Residual code references to `CampusPass`, `seat_assigned`, `pass_checked_in`, `top30_qualified` exist in `contestSlice`, `AppRoutes.tsx`, and `ContestOfflinePage.tsx`.
- **Root Cause:** Partial deprecation of previous offline contest logic.
- **Remediation:** Cleanly remove dead offline check-in dependencies and redirect any legacy routes to standard online contest results.

---

## 4. ACTIONABLE HARDENING ROADMAP

1. **Database Consistency:** Enforce `(contest_id, member_id)` unique constraint on `rating_history` in SQLAlchemy model; add row-level locks on registrations.
2. **Lifecycle State Machine:** Unify contest statuses into canonical database transitions: `upcoming -> live -> finished`.
3. **Rating & Scoreboard:** Decouple registration from participation; rate only active participants.
4. **Outbox Reliability:** Ensure outbox is the single authoritative asynchronous relay; eliminate duplicate direct SSE broadcasts.
5. **Client Redux Hardening:** Add global logout action listener to reset all slices; implement monotonic request fencing; user-scope localStorage keys.
6. **Testing Verification:** Run full test suite, concurrency validation, and 50-user simulated contest.
