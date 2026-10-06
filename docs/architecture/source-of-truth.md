# SOURCE-OF-TRUTH (SSOT) & BUSINESS LOGIC AUDIT
**Platform:** Chaos Computer Club (CCC) — Medi-Caps Chapter  
**Scope:** Canonical Invariant Boundaries, Duplicate Calculation Audit, and Authority Isolation  
**Status:** FORENSIC AUDIT COMPLETE  

---

## 1. Single Source of Truth (SSOT) Master Matrix

Every domain fact in the CCC platform is owned by exactly one authoritative subsystem. Any presentation layer or caching tier attempting to act as an authoritative decider violates architectural invariants.

| Domain Fact | Authoritative Source (SSOT) | Permitted Derived Caches | Prohibited Authorities |
|---|---|---|---|
| **Contest Lifecycle Status** | PostgreSQL `offline_contests.status` (`upcoming`, `live`, `finished`) | Redis sync key `ccc:contest:{slug}:lifecycle_state`, SWR `contest:detail:{slug}` | Redux store, SSE payload alone, Local browser timer |
| **Submission Verdict** | PostgreSQL `contest_submissions.verdict` | Redux `submitResult`, local test history in `localStorage` | Client-side test evaluator, Worker memory |
| **Scoreboard Rank & Points** | PostgreSQL `scoreboard_entries` (`score DESC, penalty_seconds ASC`) | Redis cache `cache:scoreboard:{slug}`, SWR `scoreboard:{slug}` | Client-side array sorting, Redux standalone scores |
| **Cadet Elo Rating & Ladder** | PostgreSQL `member_profiles.rating` & `rating_history` table | Redis cache `cache:leaderboard:*`, SWR `leaderboard:*` | Scoreboard calculations outside finalization |
| **Contest Registration** | PostgreSQL `contest_registrations` table | Redis cache `cache:reg_status:{slug}:{uid}` | Redux state alone, LocalStorage |
| **Contest Participation** | PostgreSQL `contest_submissions` (distinct member submit $\ge 1$) | Derived count query, Scoreboard entry existence | Merely possessing a registration record |
| **Testcase Ground Truth** | PostgreSQL `problem_testcases` (`is_hidden = true/false`) | Worker sandbox memory during compile/run | Client bundles, HTTP response schemas |
| **Judge Job State** | PostgreSQL `judge_jobs` (`state`, `active_attempt_id`) | Redis queue payload `ccc:job:{id}` | Distributed node agent filesystem |
| **Execution Attempt & Lease** | PostgreSQL `judge_job_attempts` (`lease_id`, `state`) | Redis lease key `ccc:lease:{job_id}` | Worker process in-memory flags |
| **Node Health & Heartbeat** | Redis `ccc:node:{node_id}:heartbeat` (TTL 30s) | In-memory admin telemetry table | Database polling |

---

## 2. Duplicate Calculations & Business Rule Analysis

### 1. Scoreboard Penalty Calculation
- **Canonical Implementation**:
  [`backend/app/modules/contests/contest_execution_service.py:881-885`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/backend/app/modules/contests/contest_execution_service.py#L881-L885):
  ```python
  sb_entry.penalty_seconds = sum(
      item.get("penalty_seconds", 0)
      for item in telemetry_list
      if item.get("status") == "solved"
  )
  ```
  Penalty is computed strictly on the backend as submission time elapsed since contest start plus 20 minutes (1200s) per rejected attempt on problems that are eventually solved.
- **Client Duplicate Rule**: None. Client components (`ContestSummaryPage`, `LeaderboardPage`) render `entry.penalty_seconds` directly from the server API without recalculating or altering penalty mathematics.

### 2. Elo Rating Calculation
- **Canonical Implementation**:
  [`backend/app/services/dynamic_contest_service.py:_apply_final_ratings`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/backend/app/services/dynamic_contest_service.py#L1600):
  Uses Elo formula based on participant rank and expected outcome with dynamic $K$-factor scaling.
- **Guard against Duplicate Execution**:
  Checked via `contest.ratings_finalized_at IS NOT NULL`. If non-null, returns idempotent `{ already_finalized: True, rated_count: 0 }`.
  Distributed lock `contest:finalize:{slug}` in [`contest_worker.py`](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/backend/app/workers/contest_worker.py#L48) guarantees single-worker execution across clustered ASGI processes.

### 3. Contest Arena Clock & End Time
- **Server Rule**:
  `contest.ends_at` in PostgreSQL. Submissions rejected if `now > ends_at + grace_period` via `assert_submissions_open(slug)`.
- **Client Rule**:
  `useCountdown()` in `ContestArenaPage.tsx` counts down to 0 and initiates redirect to `/summary`.
- **Consistency Verification**:
  If client clock drifts, server remains the authoritative validator: `assert_submissions_open()` raises HTTP 400 if contest is closed.

### 4. Registration Capacity Guard
- **Server Rule**:
  `ContestService.register_for_contest()` checks `contest.registered_count >= contest.seat_capacity` inside database transaction.
- **Client UI Rule**:
  Buttons show "Registration Full" if `contest.registered_count >= contest.seat_capacity`. Client only provides UX guidance; server strictly gates enrollment.
