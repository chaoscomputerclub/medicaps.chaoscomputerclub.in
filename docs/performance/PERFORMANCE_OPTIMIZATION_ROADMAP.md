# Chaos Computer Club India — Medi-Caps Chapter
# Performance Optimization Roadmap (Phase 2 Execution & Verification)

**Status:** PHASE 2 COMPLETE & VERIFIED (v1.2.4 Release)  
**Objective:** Deliver sub-second perceived load and instantaneous navigation on slow, congested campus Wi-Fi networks (1 Mbps / 300ms RTT) without breaking authentication, security, or data consistency.

---

## 1. Prioritized Implementation Sequence

The remediation tasks are prioritized by:
1. **Perceived User Impact:** Immediate reduction in blank screen and skeleton waiting times.
2. **Impact on Weak Networks:** Dramatic reduction in sequential WAN round trips.
3. **Implementation Risk & Blast Radius:** Non-invasive fixes prioritized over architectural rewrites.

```
┌────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: Immediate Non-Architectural Fixes (Zero Core Logic Changes)  │
│ 1. Self-host Google Fonts as static WOFF2 (PERF-001)                   │
│ 2. Fix Cache-Control headers on /contests to enable Edge caching (PERF-003) │
│ 3. Enable FastAPI GZipMiddleware for JSON payloads (PERF-009)          │
│ 4. Offload synchronous Docker calls in /api/health (PERF-004)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ STAGE 2: Client-Side Flow & State Consolidation                        │
│ 5. Coalesce SSE cache invalidation & eliminate thundering herd (PERF-002)   │
│ 6. Collapse dashboard initial API waterfall (PERF-005)                 │
│ 7. Unify Redux and SWR initial profile bootstrap (PERF-011)            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ STAGE 3: Backend & Database Query Modernization                       │
│ 8. Implement Redis Cache-Aside on /api/practice/problems (PERF-006)    │
│ 9. Unify contest list cache key across all users (PERF-007)            │
│ 10. Align PostgreSQL composite index for leaderboard ordering (PERF-010)│
│ 11. Implement raw JSON passthrough in Redis cache layer (PERF-012)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ STAGE 4: Heavy Asset & Code Editor Deferral                            │
│ 12. Defer Monaco editor chunk with lightweight editor stub (PERF-008)  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Work Packages

### Stage 1: Immediate Non-Architectural Wins

#### Package 1.1: Self-Host Fonts & Eliminate Render-Blocking Network Calls (PERF-001)
- **Target Files:** `index.html`, `src/styles.css`
- **Actions:**
  1. Download optimized WOFF2 subsets for `Bebas Neue`, `Montserrat`, `Nunito Sans`, and `Space Mono`.
  2. Place in `public/fonts/` directory.
  3. Declare `@font-face` blocks inside `src/styles.css` with `font-display: swap`.
  4. Remove external `<link rel="preconnect">` and `<link rel="stylesheet">` tags targeting `fonts.googleapis.com` from `index.html`.
- **Expected Impact:** Eliminates 1.8s–3.2s of render-blocking delay on slow/congested networks; FCP drops from ~2,420ms to <600ms.
- **Risk:** Low. Verify typography rendering and layout alignment across headers.
- **Rollback Strategy:** Revert git commit to restore Google Fonts link tags.

#### Package 1.2: Enable HTTP Edge Caching & ETags on Public API Endpoints (PERF-003)
- **Target Files:** `backend/app/modules/contests/contest_service.py`
- **Actions:**
  1. Remove `response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"`.
  2. Set `response.headers["Cache-Control"] = "public, max-age=15, stale-while-revalidate=30"`.
  3. Include `ETag` header generated from the response body.
- **Expected Impact:** Warm navigation requests to `/api/contests` hit Cloudflare edge / browser disk cache in 0ms–20ms instead of 300ms–400ms.
- **Risk:** Low. 15-second TTL prevents significant data staleness.
- **Rollback Strategy:** Re-apply `no-store` header if stale contest status is reported.

#### Package 1.3: Enable FastAPI Response Compression (PERF-009)
- **Target Files:** `backend/main.py`
- **Actions:**
  1. Import `from fastapi.middleware.gzip import GZipMiddleware`.
  2. Add `app.add_middleware(GZipMiddleware, minimum_size=1000)` right after CORS middleware.
- **Expected Impact:** 60%–80% reduction in transferred JSON bytes across all API responses exceeding 1 KB.
- **Risk:** Very low. GZipMiddleware is standard and battle-tested in Starlette/FastAPI.
- **Rollback Strategy:** Comment out the middleware line in `main.py`.

#### Package 1.4: Asynchronous Docker Daemon Telemetry (PERF-004)
- **Target Files:** `backend/app/engine/providers/docker_provider.py`
- **Actions:**
  1. Wrap `self.client.ping()` and `client.containers.list()` in `asyncio.to_thread()`.
  2. Alternatively, cache Docker daemon status in Redis via a background task running every 10 seconds.
- **Expected Impact:** `/api/health` P95 latency drops from 982ms to <20ms; eliminates main event loop stalls.
- **Risk:** Low.
- **Rollback Strategy:** Revert to direct synchronous calls if thread pool issues arise.

---

### Stage 2: Client Flow & State Consolidation

#### Package 2.1: Invalidation Coalescing & Thundering Herd Protection (PERF-002)
- **Target Files:** `src/lib/realtime.ts`, `src/lib/cache/swrCache.ts`
- **Actions:**
  1. Replace `window.dispatchEvent(new CustomEvent("contest:cache_invalidated"))` with targeted store invalidations (`globalSwrStore.invalidate("contests:*")`).
  2. Remove the global event listener `window.addEventListener("contest:cache_invalidated", () => executeFetch(true))` from `useSwrData`.
  3. Let `useSwrData` naturally react to store subscriber updates without bypassing in-flight deduplication.
- **Expected Impact:** Cuts peak client requests during contest events by 70%–80%; prevents UI freezes caused by multiple concurrent refetches.
- **Risk:** Medium. Requires verifying that active components receive real-time updates when an event arrives.
- **Validation:** Run Playwright stress tests with simulated SSE events and monitor network request counts.

#### Package 2.2: Collapse Initial Dashboard API Waterfall (PERF-005)
- **Target Files:** `src/organization/data/portal.functions.ts`
- **Actions:**
  1. Eliminate the sequential dependency where `/scoreboards/${slug}` waits for `/contests`.
  2. If active scoreboard data is required on the dashboard, fetch it in parallel using a well-known active slug or combine into a composite endpoint.
- **Expected Impact:** Saves 1 full WAN round trip (300ms–800ms) during initial dashboard hydration.
- **Risk:** Low.
- **Rollback Strategy:** Revert to sequential promise chain.

---

### Stage 3: Backend & Database Query Optimization

#### Package 3.1: Redis Cache-Aside for Practice Problems (PERF-006)
- **Target Files:** `backend/app/services/practice_service.py`
- **Actions:**
  1. Cache the base catalog query and aggregate submission counts in Redis with a 120s TTL (`key="practice:catalog:{page}:{limit}:{filters}"`).
  2. Query user-specific status (`MemberProblemStats`) separately or overlay it in-memory.
  3. Add `Cache-Control: public, max-age=60, stale-while-revalidate=30` header.
- **Expected Impact:** Reduces `/api/practice/problems` latency from 340ms to <15ms on cache hit; reduces database connection pool utilization by 80%.
- **Risk:** Medium. Requires cache invalidation when problems are created or updated in admin panel.

#### Package 3.2: Unified Contest List Cache Key (PERF-007)
- **Target Files:** `backend/app/modules/contests/contest_service.py`
- **Actions:**
  1. Stop partitioning the cache key by `current_member.id`.
  2. Cache public contest data globally (`contests:list:{status}:{division}`).
  3. Provide user registration flags via a dedicated lightweight endpoint (e.g., `/api/contests/my/registrations-map`) or client-side reconciliation.
- **Expected Impact:** 1 shared Redis cache entry serves all users; eliminates cache misses for logged-in cadets.

#### Package 3.3: Composite Index Alignment for Leaderboard (PERF-010)
- **Target Files:** `backend/app/core/db.py`
- **Actions:**
  1. Update index statement:
     ```sql
     CREATE INDEX IF NOT EXISTS ix_member_profiles_leaderboard_full 
     ON member_profiles (is_onboarded, rating DESC, peak_rating DESC, attendance_count DESC, id ASC);
     ```
- **Expected Impact:** PostgreSQL switches from a sequential scan with in-memory quicksort to a pure index scan; query execution drops to <1ms.
- **Risk:** None. Fully backward-compatible additive index.

---

### Stage 4: Asset & Editor Deferral

#### Package 4.1: Asynchronous Monaco Editor Stubbing (PERF-008)
- **Target Files:** `src/organization/components/MonacoEditor.tsx`, `src/pages/ContestArenaPage.tsx`
- **Actions:**
  1. Render a lightweight syntax-highlighted code container immediately upon navigating to a problem.
  2. Stream the 4.17 MB `vendor-monaco` chunk in the background or initialize on cursor focus.
- **Expected Impact:** Problem statements and test cases render in <200ms on 1 Mbps networks without waiting 9–33 seconds for Monaco editor download.
- **Risk:** Medium. User must perceive the editor as responsive if they begin typing immediately.

---

## 3. Validation & Rollback Protocol

For every stage deployed in Phase 2:
1. **Automated Verification:**
   - Execute `node scripts/audit_platform_performance.mjs` against the staging/preview cluster to ensure 100% pass rate.
   - Run `npx playwright test tests/e2e/zero_lag_navigation.spec.ts` and `tests/e2e/runtime_telemetry.spec.ts`.
2. **Version Bump Protocol:**
   - Follow `AGENTS.md` Section 1.1: Increment `VERSION` in `config.py`, `.env`, and `package.json`.
3. **Live Health Probe Verification:**
   - Run `curl -s https://medicaps.chaoscomputerclub.in/api/health | jq .` to verify active version and sub-second health probe response.
