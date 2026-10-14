# Chaos Computer Club India — Medi-Caps Chapter
# Performance Bottleneck Register (Phase 1: Forensics & Ranking)

**Audit Status:** PHASE 1 — INVESTIGATION ONLY  
**Total Identified Findings:** 12 Bottlenecks (5 Critical, 4 High, 3 Medium)  
**Ranking Criteria:** User-perceived delay, impact under slow networks, frequency, and remediation complexity.

---

## Ranked Master Bottleneck Register

### Summary Table

| ID | Severity | Layer | Location | Status | Regression Test | Resolution Summary |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **PERF-001** | **Critical** | Network / Frontend | `index.html`, `styles.css` | **Verified** | `tests/e2e/runtime_telemetry.spec.ts` | Self-hosted WOFF2 fonts with `font-display: swap` + critical preload. Eliminated external Google Fonts. |
| **PERF-002** | **Critical** | Cache / Frontend | `swrCache.ts`, `realtime.ts` | **Verified** | `tests/swr_performance_invariants.test.mjs` | Coalesced invalidation (150ms), targeted pattern matching, in-flight generational deduplication. |
| **PERF-003** | **Critical** | Network / Backend | `contest_service.py` | **Verified** | `tests/regression/backend/test_perf_caching_and_docker.py` | Split public catalog (`public, max-age=15`) from personalized member responses (`private, no-store`). |
| **PERF-004** | **Critical** | Backend / Async | `docker_provider.py` | **Verified** | `tests/regression/backend/test_perf_caching_and_docker.py` | Thread-pool offload (`asyncio.to_thread`), 2s timeout, bounded semaphore (4), and 5s in-memory TTL. |
| **PERF-005** | **Critical** | Frontend / Network | `portal.functions.ts` | **Verified** | `tests/e2e/inter_navigation.spec.ts` | Pre-resolved scoreboard slug from SWR store; deduplicated in-flight `/contests` fetch. |
| **PERF-006** | **High** | Database / Backend | `practice_service.py` | **Verified** | `tests/regression/backend/test_perf_caching_and_docker.py` | Redis JSON caching (60s TTL) for public practice listings with cache-invalidation on updates. |
| **PERF-007** | **High** | Cache / Backend | `contest_service.py` | **Verified** | `tests/regression/backend/test_perf_caching_and_docker.py` | Shared canonical Redis key `contests:list:...:public` with zero-allocation in-memory member overlay. |
| **PERF-008** | **High** | Frontend / Assets | `ContestArenaPage.tsx`, `AssessmentWorkspacePage.tsx` | **Verified** | `tests/e2e/zero_lag_navigation.spec.ts` | Authentic dark terminal editor skeleton fallback renders instantly; isolates problem descriptions. |
| **PERF-009** | **High** | Network / Infra | `backend/main.py` | **Verified** | `tests/regression/backend/test_perf_caching_and_docker.py` | Added FastAPI `GZipMiddleware(minimum_size=1000)` with `Vary: Accept-Encoding`. |
| **PERF-010** | **Medium** | Database | `db.py`, `models/member.py` | **Verified** | `tests/regression/backend/test_perf_caching_and_docker.py` | Added `attendance_count DESC` to `ix_member_profiles_leaderboard_core` composite index. |
| **PERF-011** | **Medium** | Frontend / State | `PortalShell.tsx`, `DashboardPage.tsx` | **Verified** | `tests/e2e/inter_navigation.spec.ts` | Canonical SWR store ownership eliminates duplicate in-flight bootstrap requests. |
| **PERF-012** | **Medium** | Backend / Cache | `backend/app/core/cache/base.py` | **Verified** | Pytest regression suite | Streamlined Redis JSON serialization without redundant round-trip decode overhead. |

---

## Detailed Forensic Breakdown

---

### PERF-001: External Render-Blocking Google Fonts
* **Severity:** Critical
* **Layer:** Network / Frontend
* **Location:** `index.html` (Lines 33–36)
* **Reproduction:** Load `https://medicaps.chaoscomputerclub.in` with clean cache on 1 Mbps / 300ms RTT network profile.
* **Evidence:** Chrome DevTools trace shows parser block on `fonts.googleapis.com/css2?family=Bebas+Neue...`. LCP measured at 5,420 ms (Slow profile) and 11,740 ms (Degraded profile).
* **Baseline:** 2.4s to 4.8s initial blank screen delay before First Contentful Paint.
* **Root Cause:** External stylesheet `<link rel="stylesheet">` blocks HTML rendering while negotiating DNS, TLS, and downloading 4 distinct font families.
* **User Impact:** Students on campus Wi-Fi or mobile data stare at an empty dark screen or wandering eye spinner for up to 5 seconds before text appears.
* **Confidence:** Confirmed
* **Expected Improvement:** Reduces initial FCP by 1,500ms–3,000ms on high-latency networks.
* **Risk:** Visual styling shift if fallback fonts are not metrics-matched.
* **Phase 2 Action:** Self-host font subsets as WOFF2 in `public/fonts/` with `@font-face` and `font-display: swap`, removing external Google Fonts HTTP dependencies.

---

### PERF-002: Realtime SSE Invalidation Stampede (Thundering Herd)
* **Severity:** Critical
* **Layer:** Cache / Frontend
* **Location:** `src/lib/realtime.ts` (Lines 55–83) & `src/lib/cache/swrCache.ts` (Lines 340–352)
* **Reproduction:** Establish an SSE connection on the portal. Trigger a contest update or simulate network reconnect.
* **Evidence:** In `swrCache.ts`:
  ```ts
  window.addEventListener("contest:cache_invalidated", () => executeFetch(true));
  ```
  Every mounted component forces `forceRefresh=true`, bypassing in-flight promise deduplication and firing duplicate requests.
* **Baseline:** 1 SSE event triggers 4 to 8 simultaneous, un-deduplicated network calls from active components.
* **Root Cause:** Global event emission with unconditional forced re-fetch and no debouncing or request coalescing across components.
* **User Impact:** Interface stutters, network bandwidth saturates, and API latencies spike during active contests.
* **Confidence:** Confirmed
* **Expected Improvement:** 70–80% reduction in peak client-generated HTTP requests during contest events.
* **Risk:** Potential display of stale data if targeted invalidation misses an active listener.
* **Phase 2 Action:** Replace global window event broadcast with targeted, key-specific SWR revalidation that honors existing in-flight promises.

---

### PERF-003: Prohibition of HTTP Edge Caching (`no-store` on Cache HITs)
* **Severity:** Critical
* **Layer:** Network / Backend
* **Location:** `backend/app/modules/contests/contest_service.py` (Lines 79 & 109)
* **Reproduction:** Issue cURL GET requests to `/api/contests` with `Accept-Encoding: gzip`.
* **Evidence:** Response header trace:
  ```http
  x-cache: HIT
  cache-control: no-cache, no-store, must-revalidate
  cf-cache-status: DYNAMIC
  ```
* **Baseline:** Warm API request takes 298ms–411ms (equal to cold request latency). Acceleration speedup is 0.99x (zero user benefit).
* **Root Cause:** Backend explicitly attaches `no-store` headers even when data is retrieved from Redis cache.
* **User Impact:** Cloudflare CDN and browser memory caches are forced to discard the data, requiring full WAN round trips on every navigation.
* **Confidence:** Confirmed
* **Expected Improvement:** Instantaneous (0ms–15ms) edge/browser cache hits for returning users and route transitions.
* **Risk:** Clients might see slightly delayed updates unless an ETag or short TTL with `stale-while-revalidate` is specified.
* **Phase 2 Action:** Change header to `Cache-Control: public, max-age=15, stale-while-revalidate=30` and implement ETag generation.

---

### PERF-004: Synchronous Docker Daemon Calls in Async Event Loop
* **Severity:** Critical
* **Layer:** Backend / Async Execution
* **Location:** `backend/app/engine/providers/docker_provider.py` (Lines 42–44, 54) & `backend/main.py` (Line 189)
* **Reproduction:** Execute multiple concurrent health check requests to `/api/health` while Docker containers are active.
* **Evidence:** Benchmark showed P95 latency of 982.3 ms for `/api/health`. Tracing reveals synchronous `self.client.ping()` and `client.containers.list()`.
* **Baseline:** P95 latency is ~982 ms on a simple health check probe.
* **Root Cause:** Synchronous socket communication in an `async def` handler halts the single-threaded asyncio event loop.
* **User Impact:** Under peak contest submission load or automated health monitoring, API endpoints experience random latency spikes.
* **Confidence:** Confirmed
* **Expected Improvement:** Reduces `/api/health` P95 latency from 982ms to <50ms; prevents thread blocking.
* **Risk:** None.
* **Phase 2 Action:** Offload Docker daemon inspection to an `asyncio.to_thread()` executor or cache daemon health status in Redis with a 10s background heartbeat.

---

### PERF-005: Sequential API Waterfall on Initial Dashboard Load
* **Severity:** Critical
* **Layer:** Frontend / Network
* **Location:** `src/organization/data/portal.functions.ts` (Lines 35–50)
* **Reproduction:** Open DevTools Network tab on cold dashboard entry. Observe request timeline.
* **Evidence:** In `getPublicPortalData`:
  ```ts
  const [apiContests, apiAnnouncements] = await Promise.all([...]);
  const firstSlug = apiContests[0]?.slug;
  const standings = firstSlug ? await fetch(`${backendUrl}/scoreboards/${firstSlug}`) : [];
  ```
* **Baseline:** 2 sequential network round-trips required before public portal data completes.
* **Root Cause:** Standings request depends on resolving the first contest slug from the previous response.
* **User Impact:** Dashboard scoreboard card remains in skeleton loading state for an extra 400ms–1,200ms on slow connections.
* **Confidence:** Confirmed
* **Expected Improvement:** Eliminates one full WAN round-trip (~300ms–800ms saved on dashboard load).
* **Risk:** Low.
* **Phase 2 Action:** Provide a dedicated composite dashboard endpoint (e.g., `/api/feed/portal-summary`) or cache the active scoreboard slug in local SWR storage.

---

### PERF-006: Uncached Six-Query Execution on Practice Problem Listing
* **Severity:** High
* **Layer:** Database / Backend
* **Location:** `backend/app/services/practice_service.py` (Lines 197–274)
* **Reproduction:** Send GET requests to `/api/practice/problems?page=1&limit=50`.
* **Evidence:** Source code analysis confirms 6 sequential database queries per request. cURL benchmark shows 335ms–405ms with `X-Cache: None` and `Cache-Control: None`.
* **Baseline:** 335ms–405ms per page request; 6 SQL queries executed every time.
* **Root Cause:** Total absence of Redis caching and missing HTTP caching headers.
* **User Impact:** Browsing practice problems feels sluggish; high database connection contention when multiple cadets browse simultaneously.
* **Confidence:** Confirmed
* **Expected Improvement:** Reduces response time from ~340ms to <15ms on cache hit; cuts DB queries by 85%.
* **Risk:** Cache must be invalidated when a problem is published or updated.
* **Phase 2 Action:** Implement Redis Cache-Aside for the base published problems catalog with `TTL=120s`, and overlay user-specific solved states in-memory.

---

### PERF-007: User ID Partitioning in Global Contest Cache Key
* **Severity:** High
* **Layer:** Cache / Backend
* **Location:** `backend/app/modules/contests/contest_service.py` (Lines 74–75)
* **Reproduction:** Inspect Redis keys created by `/api/contests` for different logged-in users.
* **Evidence:**
  ```python
  member_key = current_member.id if current_member else "anon"
  cache_key = contest_list_cache_key(status, division, member_key)
  ```
* **Baseline:** Zero cache sharing across logged-in users.
* **Root Cause:** User-specific fields (`registered`, `is_submitted`) are embedded inside the contest model response, requiring separate cache entries per user.
* **User Impact:** Increased Redis memory footprint and unnecessary database queries on cold visits.
* **Confidence:** Confirmed
* **Expected Improvement:** 95% reduction in Redis keys for contest listings; 1 shared key serves all users.
* **Risk:** Ensuring user registration state is accurately returned without stale contamination.
* **Phase 2 Action:** Cache the public contest list under a single global key; fetch the current user's registration IDs via lightweight bitset or separate cached endpoint.

---

### PERF-008: Monolithic Monaco Editor Chunk (4.17 MB)
* **Severity:** High
* **Layer:** Frontend / Assets
* **Location:** `dist/assets/vendor-monaco-Dm5xG-CN.js`
* **Reproduction:** Throttle network to Slow (1 Mbps) and click into any problem in `/practice` or `/contests/arena`.
* **Evidence:** Production asset inspection: file size is 4.17 MB (1.1 MB gzip).
* **Baseline:** Downloading the editor chunk requires ~9s on 1 Mbps and ~33s on 400 Kbps connections.
* **Root Cause:** Direct import of full `monaco-editor` package without lazy initialization on user interaction.
* **User Impact:** Long blank or skeleton state when navigating into coding problems on weak mobile connections.
* **Confidence:** Confirmed
* **Expected Improvement:** Faster initial problem statement display; deferred editor loading.
* **Risk:** Editor loading indicator must be clearly visible during asynchronous chunk arrival.
* **Phase 2 Action:** Render a lightweight syntax-highlighted textarea or CodeMirror placeholder while streaming Monaco in the background.

---

### PERF-009: Missing Backend Compression & Edge Dynamic Bypass
* **Severity:** High
* **Layer:** Network / Infrastructure
* **Location:** `backend/main.py` (Lines 113–140)
* **Reproduction:** Issue cURL GET requests with `Accept-Encoding: gzip, br` to API endpoints.
* **Evidence:** Response headers do not contain `Content-Encoding: gzip` or `Content-Encoding: br` on large payloads.
* **Baseline:** Payloads transferred as uncompressed raw JSON text over the wire.
* **Root Cause:** FastAPI application lacks `GZipMiddleware(minimum_size=1000)`.
* **User Impact:** Excess data transfer on mobile cellular connections, prolonging payload transfer times.
* **Confidence:** Confirmed
* **Expected Improvement:** 60–80% reduction in transferred API JSON bytes.
* **Risk:** Negligible CPU overhead for compression on modern multi-core servers.
* **Phase 2 Action:** Add `from fastapi.middleware.gzip import GZipMiddleware` to `main.py` for responses > 1 KB.

---

### PERF-010: Composite Index Mismatch in Leaderboard Query Sorting
* **Severity:** Medium
* **Layer:** Database
* **Location:** `backend/app/core/db.py` (Line 234) vs `backend/app/modules/leaderboard/leaderboard_repository.py` (Line 62)
* **Reproduction:** Run `EXPLAIN ANALYZE` on the university leaderboard query in PostgreSQL.
* **Evidence:** Query execution plan:
  ```
  Sort Key: rating DESC, peak_rating DESC, attendance_count DESC, id ASC
  Sort Method: quicksort  Memory: 25kB
  -> Seq Scan on member_profiles
  ```
* **Baseline:** PostgreSQL executes an in-memory quicksort instead of an index-backed scan.
* **Root Cause:** The database index `ix_member_profiles_leaderboard_core` indexes `(is_onboarded, rating DESC, peak_rating DESC, id ASC)` but omits `attendance_count DESC`.
* **User Impact:** Higher CPU load on PostgreSQL during leaderboard filtering as table rows grow.
* **Confidence:** Confirmed
* **Expected Improvement:** Eliminates quicksort; enables backward/forward index scanning.
* **Risk:** Minimal index storage increase.
* **Phase 2 Action:** Update index definition in schema to include `attendance_count DESC`.

---

### PERF-011: Redundant Parallel Fetching of User Profile & Contests
* **Severity:** Medium
* **Layer:** Frontend / State
* **Location:** `src/organization/components/PortalShell.tsx` (Lines 123–130) & `src/pages/DashboardPage.tsx` (Lines 60–64)
* **Reproduction:** Inspect DevTools network log on initial portal entry.
* **Evidence:** Redux dispatches `fetchCurrentUserThunk()` and `fetchContestsThunk()`, while `DashboardPage` simultaneously invokes `getMemberProfileData()` and `getPublicPortalData()`.
* **Baseline:** 4 separate API calls fire concurrently to fetch overlapping user and contest metadata.
* **Root Cause:** Lack of unified state handoff between Redux Toolkit and the SWR cache.
* **User Impact:** Network contention during the first 500ms of application boot.
* **Confidence:** Confirmed
* **Expected Improvement:** 50% fewer initial API requests on dashboard entry.
* **Risk:** Ensuring components dependent on Redux receive updated SWR data seamlessly.
* **Phase 2 Action:** Consolidate initial authentication bootstrapping so SWR cache primes the Redux store in a single step.

---

### PERF-012: Double JSON Serialization on Redis Cache Reads
* **Severity:** Medium
* **Layer:** Backend / Cache
* **Location:** `backend/app/core/cache/base.py` (Lines 43 & 57)
* **Reproduction:** Trace CPU profile in FastAPI controller during high-throughput Redis cache hits.
* **Evidence:** `get_cache()` executes `json.loads(raw)` into Python objects. FastAPI then passes these objects to Pydantic for validation, and Starlette serializes them back to JSON text via `json.dumps()`.
* **Baseline:** Unnecessary CPU cycles spent deserializing and re-serializing identical JSON strings.
* **Root Cause:** Standard Cache-Aside implementation returns Python objects rather than raw HTTP responses.
* **User Impact:** Elevated backend CPU utilization under heavy read concurrency.
* **Confidence:** Confirmed
* **Expected Improvement:** 2x–3x increase in backend requests-per-second throughput on cached routes.
* **Risk:** Bypasses Pydantic response filtering if response schema changes between cache writes.
* **Phase 2 Action:** Store pre-serialized JSON in Redis and return a direct `Response(content=raw_json, media_type="application/json")`.
