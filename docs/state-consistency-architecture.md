# CCC Medi-Caps Online Platform — State Consistency & System Architecture

## 1. Discovered End-to-End System Topology

The Chaos Computer Club (CCC) Medi-Caps platform is an online-only competitive programming platform (LeetCode/Codeforces model). 

```
                                  USER BROWSER
    ┌────────────────────────────────────────────────────────────────────────┐
    │                                                                        │
    │  React 18 Component Tree (Vite)                                        │
    │      │                                                                 │
    │      ├──> React Router (URL / Path params: /contest/:slug, /problems)  │
    │      │                                                                 │
    │      ├──> Redux Toolkit (Session, auth state, UI drawer, active tab)   │
    │      │                                                                 │
    │      ├──> SWR Memory Cache (swrFetch, globalSwrStore, background dedup)│
    │      │                                                                 │
    │      ├──> Unified SSE Multiplexer (GlobalSseMultiplexer: /events/stream)│
    │      │                                                                 │
    │      └──> API Client (apiFetch, interceptors, Idempotency-Key headers) │
    └───────────────────────────────────┬────────────────────────────────────┘
                                        │ HTTPS / WSS / SSE
                                        ▼
    ┌────────────────────────────────────────────────────────────────────────┐
    │                    FastAPI Backend (Port 8000 / Nginx)                 │
    │                                                                        │
    │  API Middleware & Security Layer:                                      │
    │      ├── CORS, Rate Limiter, Turnstile, JWT Authentication             │
    │      └── Request Context & Idempotency Filter                          │
    │                                                                        │
    │  Routers & Domain Controllers:                                         │
    │      ├── AuthRouter (/auth/send-otp, /verify-otp, /me, /logout)        │
    │      ├── ContestRouter (/contests/list, /:slug, /register, /arena)     │
    │      ├── SubmissionRouter (/submissions, /judge/verdict-callback)     │
    │      ├── ProblemRouter (/problems, /tags)                              │
    │      ├── ScoreboardRouter (/contests/:slug/scoreboard)                 │
    │      └── RealtimeRouter (/events/stream, /events/contest/:slug/stream) │
    │                                                                        │
    │  Domain Services:                                                      │
    │      ├── DynamicContestService (Lifecycle transitions, finalization)   │
    │      ├── ContestExecutionService (Submission intake, attempt creation) │
    │      ├── ScoreboardService (Deterministic ranking, score calculation)  │
    │      └── OutboxRelayService (Reliable event extraction and delivery)   │
    └──────────────────┬─────────────────────────────┬───────────────────────┘
                       │                             │
                       ▼                             ▼
    ┌────────────────────────────────────┐ ┌─────────────────────────────────┐
    │       PostgreSQL 16 (Primary)      │ │         Redis 7.2 (Cache)       │
    │  SINGLE AUTHORITATIVE BUSINESS TRUTH│ │      COORDINATION ONLY (NO SSOT)│
    │                                    │ │                                 │
    │  - members, roles, profiles        │ │  - Rate limit counters          │
    │  - contests, contest_problems      │ │  - Celery / task broker queues  │
    │  - contest_registrations (UNIQUE)  │ │  - PubSub event fanout channel  │
    │  - submissions, execution_attempts │ │  - Distributed execution leases │
    │  - scoreboard_entries (ACID sync)  │ │  - SWR transient HTTP cache     │
    │  - rating_history (UNIQUE)         │ │  - Active judge node heartbeats │
    │  - idempotency_records             │ └─────────────────────────────────┘
    │  - outbox_events (Transactional)   │
    └──────────────────┬─────────────────┘
                       │ Transactional Polling / LISTEN
                       ▼
    ┌────────────────────────────────────────────────────────────────────────┐
    │                 Distributed Execution & Judge Subsystem                │
    │                                                                        │
    │  Outbox Worker (Background Daemon):                                    │
    │      Reads outbox_events -> Publishes to Redis pubsub -> Dispatched SSE│
    │                                                                        │
    │  Execution Router (Celery / Redis / HTTP):                             │
    │      1. Checks active judge nodes via heartbeats (lease_id, provider)  │
    │      2. Dispatches submission payload to Go Node-Agent / Judge-Agent   │
    │      3. Isolated Docker container execution with rlimit + seccomp      │
    │      4. Node returns execution telemetry (runtime, memory, stdout)     │
    │      5. FastAPI CAS Finalization (verifies active lease_id)            │
    │      6. Authoritative verdict committed to PostgreSQL + Outbox         │
    └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Invariant Ownership Matrix

| Domain Fact | Authoritative Owner | Cache / Coordination | Consumer Projection | Invariant Guarantees |
|---|---|---|---|---|
| User Identity & Auth | PostgreSQL (`members`) | Redis JWT blacklist / SWR | Redux `authSlice` | Zero cross-user state leakage on logout |
| Contest Lifecycle | PostgreSQL (`contests.status`) | SWR (`contests:*`) | Redux `contestSlice` | Strict monotonic state transitions: DRAFT -> UPCOMING -> LIVE -> ENDED -> FINALIZING -> FINALIZED |
| Contest Registration | PostgreSQL (`contest_registrations`) | Redis registration count | Redux `contestSlice.registration` | `UNIQUE(contest_id, member_id)`; row lock on contest capacity |
| Contest Participation | PostgreSQL (`submissions`) | Scoreboard snapshot | UI Contest Arena | Registration alone does NOT constitute participation. Participation requires >=1 submitted solution |
| Problem & Test Cases | PostgreSQL (`problems`, `test_cases`) | SWR / Redis | UI Editor / Monaco | Hidden test cases never exposed to client; starter code sanitized |
| Submission & Verdict | PostgreSQL (`submissions`, `attempts`) | Redis queue lease | UI Arena Drawer / SSE | Single authoritative attempt; CAS fencing prevents stale results from overwriting newer runs |
| Scoreboard & Rank | PostgreSQL (`scoreboard_entries`) | Redis scoreboard cache | UI Live Scoreboard | Deterministic tie-breaking: Higher score -> Lower penalty -> Earlier accepted time -> Stable ID |
| Rating Updates | PostgreSQL (`rating_history`) | Redis leaderboards | User Profile / Hub | Idempotent finalization: `UNIQUE(contest_id, member_id)` prevents double rating |
| Idempotency Records | PostgreSQL (`idempotency_keys`) | Redis fast-path | API Client | Identical mutation retries return stored result without re-executing |
| Realtime Notifications | PostgreSQL (`outbox_events`) | Redis PubSub | Browser `GlobalSseMultiplexer` | Monotonic timestamps/versions; client drops out-of-order SSE |
