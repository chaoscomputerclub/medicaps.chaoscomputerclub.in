# STATE OWNERSHIP & ARCHITECTURAL INVARIANTS
**Platform:** Chaos Computer Club (CCC) — Medi-Caps Chapter  
**Scope:** Online Competitive Programming Arena  
**Branch:** `audit/state-consistency-hardening`  

---

## 1. CANONICAL STATE OWNERSHIP MATRIX

No domain fact in the CCC platform may possess more than one authoritative source of truth. Caches, real-time event channels, and client-side state managers act strictly as read-accelerators, notifications, or presentation layer buffers.

| Domain Fact | Authoritative Authority | Storage Subsystem | Permitted Read Accelerators | Prohibited Authorities |
|---|---|---|---|---|
| **Cadet & User Profile** | PostgreSQL | `member_profiles` table | In-memory SWR cache (`member:profile:*`), JWT | Redux store, Browser LocalStorage |
| **Contest Identity & Rules** | PostgreSQL | `offline_contests` table | Redis cache (`cache:contest:detail:{slug}`), SWR | Redis standalone key, Client memory |
| **Contest Lifecycle State** | PostgreSQL | `offline_contests.status` (`upcoming`, `live`, `finished`) | Redis TTL sync key (`ccc:contest:{slug}:lifecycle_state`) | Redis alone, SSE message alone |
| **Contest Registration** | PostgreSQL | `contest_registrations` table | Redis cache (`cache:reg_status:{slug}:{member_id}`) | Redux store, LocalStorage |
| **Contest Participation** | PostgreSQL | `contest_submissions` (distinct `member_id` with $\ge 1$ submit) | Derived query / Scoreboard cache | Merely having a registration row |
| **Problem Specification** | PostgreSQL | `problems`, `problem_versions`, `contest_problems` | Redis (`cache:contest:problems:{slug}`), compilation cache | Client memory |
| **Testcase Vault (Hidden)** | PostgreSQL | `problem_testcases` (`is_hidden = TRUE`) | Sandbox memory during execution | Public APIs, HTTP responses, Client bundles |
| **Execution Job State** | PostgreSQL | `judge_jobs` (`state`, `active_attempt_id`) | Redis queue payload | Node agent local filesystem |
| **Execution Attempt & Lease** | PostgreSQL | `judge_job_attempts` (`lease_id`, `state`) | Redis lease keys | Worker in-memory flag |
| **Submission Verdict** | PostgreSQL | `contest_submissions.verdict` | Redux run/submit result | Local judge sandbox cache |
| **Scoreboard Rank & Score** | PostgreSQL (Canonical Derived) | `scoreboard_entries` (`score DESC, penalty_seconds ASC`) | Redis (`cache:scoreboard:{slug}`), SWR cache | Client-side sorting or independent decisions |
| **Elo Rating & Trajectory** | PostgreSQL | `member_profiles.rating`, `rating_history` | SWR cache (`leaderboard:*`) | Scoreboard calculations outside finalization |
| **Domain Events** | PostgreSQL | `outbox_events` (`status = 'pending'`) | Redis Pub/Sub, SSE streams | Fire-and-forget background tasks |
| **Realtime Push Notifications** | Server-Sent Events (SSE) | Network stream | Redis circular replay buffer (100 events) | Authoritative business state |
| **UI Presentation State** | Browser Client | React component state / Redux | None (transient) | Database, Server session |

---

## 2. THE THREE CARDINAL INVARIANTS

### Invariant 1: Single Authority Invariant
A domain fact cannot be updated by bypassing its authoritative owner. 
- Example: Redis cannot mark a contest "live" or "finished" without an atomic, committed transaction in PostgreSQL.
- Example: Redux cannot decide a user is "registered" or "rated" without successful confirmation from PostgreSQL.

### Invariant 2: Atomicity Across Persistence & Outbox
Every state-changing mutation that requires downstream notification must commit the business mutation and the corresponding `outbox_events` record in the **exact same PostgreSQL transaction**.
- Never commit to PostgreSQL and then try-catch publish to Redis as the sole delivery mechanism.
- Redis failures must NOT cause lost domain events. The transactional outbox poller guarantees at-least-once delivery.

### Invariant 3: Clean Client Isolation on Session Boundaries
Upon user logout or authentication token invalidation:
1. In-flight HTTP requests must be aborted.
2. SSE multiplexer connection must be cleanly closed and event subscriptions cleared.
3. User-scoped cache entries in `globalSwrStore` and `sessionStorage` must be purged.
4. User-specific Redux state (`contest.myParticipations`, `contest.registration`, `social.followingIds`, etc.) must be reset to initial state.
5. No cached state from User A may ever be visible to User B on subsequent login.
