# CCC Medi-Caps — Distributed Execution Platform Architecture
## Production-Grade Infrastructure Design

> **Audit Date**: 2026-09-30  
> **Based on**: Live graphify knowledge-graph traversal of the codebase (15,203 nodes)  
> **Codebase commit**: 7094408 (deployed on 143.198.38.205)

---

## PHASE 1 AUDIT: What Already Exists

Before designing anything new, here is what the codebase already has:

### ✅ Already Implemented
| Component | Status | Location |
|-----------|--------|----------|
| `RedisQueueEngine` | ✅ Production-grade | `core/queue/redis_queue.py` |
| `BaseQueueWorker` | ✅ Semaphore-bounded, drain, reaper | `core/queue/base_worker.py` |
| `JobContract` / `JobState` | ✅ Full state machine | `core/queue/contracts.py` |
| `JudgeWorker` (concurrency=4) | ✅ | `workers/judge_worker.py` |
| `ContestLifecycleWorker` | ✅ | `workers/contest_worker.py` |
| `EmailWorker`, `WebhookWorker` | ✅ | `workers/` |
| `MaintenanceWorker` (reaper) | ✅ | `workers/maintenance_worker.py` |
| `CacheSyncWorker` | ✅ | `workers/cache_sync_worker.py` |
| `DockerSandboxProvider` | ✅ Persistent container pool | `engine/providers/docker_provider.py` |
| `CodeboxProvider` | ✅ External fallback | `engine/providers/codebox_provider.py` |
| `Judge0Provider` | ✅ Remote fallback | `engine/providers/judge0_provider.py` |
| `LocalSandboxProvider` | ✅ Dev fallback | `engine/providers/local_provider.py` |
| Provider factory (`JUDGE_PROVIDER` env) | ✅ | `engine/providers/factory.py` |
| Job status API (`GET /jobs/{id}`) | ✅ BOLA-protected | `controllers/job_controller.py` |
| Queue metrics + DLQ replay | ✅ | `routers/jobs.py` |
| Transactional outbox | ✅ | `core/queue/outbox.py` |
| Outbox `FOR UPDATE SKIP LOCKED` | ✅ | `core/queue/outbox.py:99` |
| Atomic Lua idempotency (TOCTOU-safe) | ✅ | `redis_queue.py` |
| Backpressure (`QueueBackpressureError`) | ✅ | `redis_queue.py` |
| Visibility timeout reaper | ✅ 5min TTL | `redis_queue.py:49` |
| DLQ with 7-day retention | ✅ | `redis_queue.py:47` |
| SingleFlight (distributed, Redis locks) | ✅ 10 call-sites | `core/cache/singleflight.py` |
| `pg_advisory_xact_lock` on scoreboard | ✅ | `contest_execution_service.py:561` |
| `db.rollback()` before sandbox exec | ✅ | `contest_execution_service.py:255,478` |
| DB pool (20/20/30s/1800s) | ✅ | `core/db.py`, `core/config.py` |
| SSE heartbeat + `finally: unsubscribe` | ✅ | `modules/events/events_service.py` |
| `Last-Event-ID` replay buffer | ✅ | `events_service.py:63–86` |
| 30 composite PostgreSQL indexes | ✅ | `core/db.py:148–198` |
| SHA-256 submission dedup (NX, 2s TTL) | ✅ | `contest_execution_service.py:395–400` |
| `RetryableError` / `NonRetryableError` | ✅ | `core/queue/contracts.py` |
| Exponential backoff + jitter | ✅ | `base_worker.py` |
| Pre-warmed persistent container pool | ✅ | `engine/docker/pool.py` |
| Rate limiting (Redis sliding-window) | ✅ | `middleware/rate_limit.py` |
| OTP IP rate limit | ✅ | `routers/auth.py` |
| Assessment rate limit (10/min submit, 30/min run) | ✅ | `routers/assessment.py` |

### ❌ Missing / Gaps
| Component | Priority | Notes |
|-----------|----------|-------|
| **Worker Registry** (laptop agent) | 🔴 HIGH | No remote worker registration protocol |
| **Heartbeat system** (worker health) | 🔴 HIGH | No `last_seen` tracking for external workers |
| **Resource-aware scheduler** | 🔴 HIGH | Jobs go to any available local worker; no capacity check |
| **Laptop Judge Agent** | 🔴 HIGH | No outbound agent that registers with cloud |
| **Contest lifecycle modes** | 🟡 MED | `PRE_CONTEST/CONTEST_ACTIVE/DRAINING` states |
| **Per-user / per-contest concurrency** | 🟡 MED | Global semaphore only; no per-user fairness |
| **Arena /submit rate limit** | 🟡 MED | Only SHA-256 2s dedup; no sliding-window |
| **Docker resource limits** (CPU/mem/pid) | 🟡 MED | Container pool exists, limits not enforced |
| **NGINX SSE config** | 🟡 MED | `proxy_buffering off` + SSE timeouts needed |
| **Structured trace IDs** | 🟡 MED | No `request_id` → `job_id` → `worker_id` chain |
| **Load testing suite** | 🟢 LOW | No k6/locust scripts |
| **Worker scaling policy** | 🟢 LOW | No autoscaler; workers are static |
| **Monitoring dashboard** | 🟢 LOW | Metrics exist but no Grafana/Prometheus wiring |

---

## DELIVERABLE 1: Current Architecture Diagram

```
                         INTERNET
                            │
                            ▼
                   ┌──────────────────┐
                   │      NGINX       │
                   │   (Reverse Proxy)│
                   │   TLS / Port 443 │
                   └────────┬─────────┘
                            │
                   ┌────────▼─────────┐
                   │   FastAPI        │
                   │   (Uvicorn ×2)   │
                   │   Port 8002      │
                   └────────┬─────────┘
                            │
              ┌─────────────┼──────────────┐
              │             │              │
              ▼             ▼              ▼
         PostgreSQL        Redis        Workers
         (Auth/Truth)    (Cache/Q)    (in-process)
                                           │
                            ┌──────────────┴──────────────────┐
                            │              │                   │
                       JudgeWorker   ContestWorker     MaintenanceWorker
                       (concur=4)    (concur=2)        (concur=1)
                            │
                       ┌────▼─────┐
                       │ Provider │
                       │ Factory  │
                       └────┬─────┘
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
        Docker(local)   Codebox(cloud)  Judge0(remote)
        Sandbox         Provider        Provider
```

**Current state**: All judge execution happens _inside the cloud VM_ as in-process workers.
The gaming laptop is NOT connected. No worker registry or agent exists.

---

## DELIVERABLE 2: Proposed Architecture Diagram

```
                         INTERNET
                            │
                            ▼
                   ┌──────────────────────┐
                   │        NGINX         │
                   │  TLS · Proxy · LB    │
                   │  /api/*  /events/*   │
                   │  /health/* /metrics/*│
                   └────────┬─────────────┘
                            │
               ┌────────────┴─────────────┐
               │                          │
               ▼                          ▼
      ┌─────────────────┐        ┌────────────────────┐
      │   FastAPI API   │        │  FastAPI API        │
      │   Worker 1      │        │  Worker 2           │
      │  (Uvicorn)      │        │  (Uvicorn)          │
      └────────┬────────┘        └──────────┬──────────┘
               │                            │
               └──────────────┬─────────────┘
                              │
               ┌──────────────▼──────────────┐
               │          Redis              │
               │  ┌────────────────────────┐ │
               │  │  Queues (5 domains)    │ │
               │  │  Worker Registry       │ │
               │  │  Heartbeat Tracker     │ │
               │  │  Distributed Locks     │ │
               │  │  Cache + SingleFlight  │ │
               │  │  Rate Limiter          │ │
               │  │  Event Bus (SSE)       │ │
               │  └────────────────────────┘ │
               └──────────────┬──────────────┘
                              │
               ┌──────────────▼──────────────┐
               │    Resource Governor        │
               │    (Scheduler + Registry)   │
               └──────┬──────────────┬───────┘
                      │              │
          ┌───────────▼──┐    ┌──────▼────────────┐
          │  Cloud Judge │    │   Laptop Agent    │
          │  Worker      │    │   (Judge Agent)   │
          │  concur=2    │    │   concur=4-6      │
          └──────┬───────┘    └──────┬────────────┘
                 │                   │
                 ▼                   ▼
          Docker Sandbox      Docker Sandbox
          (cloud, limited)    (local, full power)
                 │                   │
                 └─────────┬─────────┘
                           │
                           ▼
                      PostgreSQL
                      (authoritative)
                           │
                      Outbox Worker
                           │
                      Redis Event Bus
                           │
                        SSE Stream
                           │
                         USERS
```

---

## DELIVERABLE 3: Request Lifecycle

```
Browser
  │  GET /api/contests
  ▼
NGINX (TLS terminate, rate-check headers)
  │  proxy_pass to FastAPI
  ▼
FastAPI Route Handler
  │  1. Auth middleware (JWT decode, MemberProfile)
  │  2. Rate limit check (Redis sliding window)
  │  3. Cache check: GET cache:contest:list → hit? return 200
  │  4. Cache miss: SingleFlight.execute(cache_key, _fetch)
  │       _fetch → db.execute(SELECT ...) → serialize
  │       → set_cache(TTL=60s)
  ▼
Response: 200 OK (X-Cache: HIT|MISS)
```

**SSE lifecycle**:
```
Browser: GET /api/events/stream
  │
NGINX: proxy_buffering off; read_timeout 1h; send_timeout 1h
  │
FastAPI SSE generator:
  │  subscribe(channel="contest:{slug}", queue)
  │  Last-Event-ID replay → send missed events
  │  loop:
  │    if request.is_disconnected(): break
  │    yield heartbeat every 15s
  │    yield event from queue when available
  │  finally: unsubscribe(channel, queue)
```

---

## DELIVERABLE 4: Submission Lifecycle

```
Browser
  │  POST /api/contests/{slug}/arena/submit
  │  { problem_id, language, code }
  ▼
NGINX → FastAPI
  │
  ├── 1. Authenticate (JWT)
  ├── 2. Rate limit: arena:submit 15/60s (TO ADD)
  ├── 3. Validate contest state (status == "live")
  ├── 4. Validate problem exists in contest
  ├── 5. Validate source code (language, size)
  ├── 6. SHA-256 dedup check (Redis NX, 2s TTL)
  │         → 429 if duplicate
  │
  ├── 7. BEGIN TRANSACTION
  │       INSERT contest_submissions (status=QUEUED)
  │       INSERT outbox_events (queue="judge", type="EVALUATE_ARENA_SUBMISSION")
  │   COMMIT
  │
  ├── 8. Outbox worker picks up event → RedisQueueEngine.enqueue(
  │         queue="judge", priority=HIGH,
  │         idempotency_key=f"arena:{submission_id}")
  │
  └── 9. Return 202: { submission_id, job_id, status: "queued" }

Meanwhile (async):
  RedisQueueEngine pending list
    │  JudgeWorker.semaphore.acquire() [max=4]
    │  dequeue() → JobContract
    ▼
  JudgeWorker.process_job()
    │  1. Load MemberProfile
    │  2. ContestExecutionService.submit_arena_code()
    │       a. Resolve problem execution contract
    │       b. Build test cases
    │       c. db.rollback()  ← connection released to pool
    │       d. provider.execute_batch() [Docker sandbox]
    │       e. Post-process verdicts
    │  3. BEGIN TRANSACTION
    │       pg_advisory_xact_lock(scoreboard:{contest_id})
    │       UPDATE/INSERT scoreboard_entries WITH FOR UPDATE
    │       INSERT contest_submissions (verdict, score, ...)
    │       re_rank_scoreboard()
    │   COMMIT
    │  4. delete_cache_pattern(slug-scoped)
    │  5. broadcast_event("submission_evaluated", {...})
    ▼
  Redis event bus → SSE → Browser
  Browser updates submission status + leaderboard delta
```

---

## DELIVERABLE 5: Worker Lifecycle

### Current (in-process workers)
```
main.py:startup
  │  start_all_workers()
  │    JudgeWorker.start()    → asyncio task
  │    ContestWorker.start()  → asyncio task
  │    MaintenanceWorker.start() → asyncio task
  │    ... etc
  ▼
main.py:shutdown
  │  stop_all_workers()
  │    each worker.stop(drain_timeout=15s)
  │      cancel poll loop
  │      wait for in-flight tasks
  ▼
Systemd restarts service
```

### Target (Laptop Agent + Cloud Workers)
```
Laptop boots
  │
systemd/launchd: ccc-judge-agent.service
  │
JudgeAgent.startup():
  │  1. Collect system resources (psutil)
  │       cpu_cores=8, memory_mb=16384, available_mb=14000
  │  2. POST /workers/register
  │       { worker_id, hostname, api_key, cpu_cores, memory_mb,
  │         max_concurrency, languages, version }
  │  → Response: { worker_token, assigned_id }
  │
  │  3. Start heartbeat task (every 5s)
  │  4. Start resource reporter (every 30s)
  │  5. Start job consumer (poll judge queue)
  │
Loop:
  │  heartbeat → POST /workers/{id}/heartbeat
  │               { cpu_pct, ram_free_mb, active_jobs, status }
  │
  │  job consumer:
  │    RedisQueueEngine.dequeue("judge", timeout=2)
  │    semaphore.acquire() → max_concurrency
  │    DockerSandboxProvider.execute_batch(...)
  │    POST /workers/{id}/jobs/{job_id}/complete
  │       { result, execution_ms }
  │
Graceful drain:
  │  SIGTERM / Contest end
  │  is_running = False
  │  stop accepting new jobs
  │  wait for active tasks (drain_timeout=30s)
  │  POST /workers/{id}/unregister
  │  exit 0
```

---

## DELIVERABLE 6: Contest Lifecycle

```
Admin: POST /admin/contests/{slug}/status  (status → "upcoming")
  │  ContestLifecycleWorker enqueued

PRE_CONTEST (T-30min):
  │  warm contest cache
  │  warm leaderboard cache
  │  verify worker health (Scheduler.check_worker_pool())
  │  verify Docker daemon (DockerSandboxProvider.healthy())
  │  verify compiler versions (prewarm_containers())
  │  verify PostgreSQL / Redis connectivity
  │  calculate available capacity
  │  → broadcast event: contest_prepping

CONTEST_ACTIVE (T-0):
  │  Admin: status → "live"
  │  Scheduler: enable all registered workers
  │  job priority elevated: P1 for arena submissions
  │  SSE broadcast: contest_started
  │  Leaderboard cache TTL reduced to 15s

CONTEST_DRAINING (T+duration):
  │  Admin: status → "ended"
  │  FastAPI: reject new submissions (422)
  │  JudgeWorker: finish in-flight jobs
  │  Redis queue: drain remaining judge jobs
  │  Wait: queue depth = 0

CONTEST_FINALIZING:
  │  ContestLifecycleWorker.finalize()
  │    final re_rank_scoreboard()
  │    compute rating changes
  │    generate trust proofs
  │    persist rating_history
  │    emit qualification events
  │    verify consistency: count(submissions) == count(scored)
  │  SSE broadcast: contest_ended, leaderboard_finalized

CONTEST_COMPLETE:
  │  Release laptop workers (POST /workers/{id}/release)
  │  Cloud workers return to normal concurrency
  │  Cache TTL restored to 60s
  │  SSE broadcast: results_published
```

---

## DELIVERABLE 7: Failure Recovery Lifecycle

### Laptop Power-Off
```
T+0:  Laptop powers off
T+5:  Heartbeat missed — worker status → SUSPECT
T+15: Heartbeat expired — worker status → OFFLINE
T+15: Scheduler stops routing to laptop worker
T+300: VISIBILITY_TIMEOUT_SECONDS — reaper fires
        ccc:queue:judge:processing → scan for stuck jobs
        for each job: leased_at + 300 < now → re-queue
        → rpush to ccc:queue:judge:pending (HIGH priority)
T+305: Cloud JudgeWorker picks up re-queued jobs
        re-executes with retry metadata (attempt=2)
T+306: Result persisted, SSE broadcast
        User sees: QUEUED → RUNNING → COMPLETED
```

### Redis Restart
```
T+0:  Redis restarts
T+0:  PostgreSQL outbox_events still has status=pending
T+0:  In-flight job results buffered in worker memory
T+5:  Workers reconnect to Redis (asyncio retry with backoff)
T+5:  Outbox relay_outbox_events() resumes from PostgreSQL
      → re-publishes pending events
T+5:  Worker completes job → write result to Redis + PostgreSQL
      (PostgreSQL is authoritative; Redis is warm state)
Note: No job lost because PostgreSQL outbox is source of truth
```

### API Restart (Uvicorn)
```
T+0:  Process exits (SIGTERM)
T+0:  Workers.stop(drain_timeout=15s) — drain in-flight
T+15: Process starts
T+15: Workers re-registered with Redis
T+15: Outbox relay resumes
Note: Clients see SSE disconnect → reconnect with Last-Event-ID
      Replay buffer serves missed events
```

---

## DELIVERABLE 8: Database Ownership Model

```
                    SINGLE AUTHORITATIVE SOURCE OF TRUTH
                    =====================================
                           PostgreSQL (Cloud VM)

Tables Owned:
  ┌─────────────────────────────────────────────────────────────┐
  │  member_profiles          - users, auth, ratings            │
  │  offline_contests         - contest state, lifecycle        │
  │  contest_registrations    - participation, check-in         │
  │  contest_submissions      - submission records, verdicts     │
  │  scoreboard_entries       - live scores, ranks, telemetry   │
  │  rating_history           - post-contest Elo changes        │
  │  trust_proofs             - SHA-256 signed qualification     │
  │  contest_problems         - problem assignments             │
  │  assessments              - Phase 1 assessments             │
  │  assessment_sessions      - candidate session state         │
  │  assessment_submissions   - assessment responses            │
  │  outbox_events            - transactional event relay       │
  └─────────────────────────────────────────────────────────────┘

Laptop Compute Node:
  - Reads: JobContract payload (from Redis, sent by cloud)
  - Writes: ONLY through POST /workers/{id}/jobs/{job_id}/complete
            which triggers cloud PostgreSQL write
  - Never writes directly to PostgreSQL
  - Local state: execution workspace (/tmp/interleet_workspaces)
                 Docker container filesystem (ephemeral)
                 Both destroyed after job completion

Conflict prevention:
  - pg_advisory_xact_lock on all scoreboard writes
  - Unique constraint: (contest_id, member_id) on scoreboard_entries
  - Unique constraint: (assessment_id, member_id) on assessment_sessions
  - Idempotency keys prevent duplicate scoring on job retry
```

---

## DELIVERABLE 9: Redis Architecture

```
Redis Namespace Map:

QUEUES
  ccc:queue:{name}:pending          LIST  (LIFO priority: HIGH→right, NORMAL→left)
  ccc:queue:{name}:processing       LIST  (in-flight job IDs)
  ccc:queue:{name}:delayed          ZSET  (score=execute_at Unix timestamp)
  ccc:queue:{name}:dlq              LIST  (dead jobs, 7-day retention)

JOB DATA
  ccc:job:{job_id}                  STRING (JSON: JobContract, TTL=24h)
  ccc:job:{job_id}:leased_at        STRING (Unix ts, TTL=VISIBILITY_TIMEOUT)
  ccc:idempotency:{key}             STRING (job_id, TTL=1h)

WORKER REGISTRY (NEW)
  ccc:worker:{id}                   HASH   (hostname, cpu, ram, concurrency, status)
  ccc:worker:{id}:heartbeat         STRING (last_seen Unix ts, TTL=30s)
  ccc:workers:active                SET    (worker IDs currently healthy)

CACHE
  cache:contest:list                STRING (JSON, TTL=30s)
  cache:contest:detail:{slug}       STRING (JSON, TTL=60s)
  cache:contest:problems:{slug}     STRING (JSON, TTL=60s)
  cache:scoreboard:{slug}:*         STRING (JSON, TTL=15s live / 60s normal)
  cache:leaderboard:*               STRING (JSON, TTL=60s)
  cache:reg_status:{contest_id}:*   STRING (JSON, TTL=30s)

LOCKS
  ccc:lock:{key}                    STRING (NX, TTL=lock_duration)
  ccc:singleflight:{cache_key}      STRING (distributed SingleFlight lock)

RATE LIMITING
  rl:{scope}:{identifier}           STRING (sliding window counter, TTL=window)

SSE / EVENTS
  ccc:events:{channel}              PubSub (Pub/Sub for real-time fan-out)
  ccc:replay:{channel}              ZSET   (score=event_id, TTL=5min buffer)

RESOURCE GOVERNOR (NEW)
  ccc:scheduler:queue_pressure      HASH   (queue depths by name)
  ccc:scheduler:capacity            HASH   (available slots per worker)
```

---

## DELIVERABLE 10: Scheduler Design

### Resource Governor (to implement)

```python
class ResourceGovernor:
    """
    Central scheduler that answers: "Which worker should run this job?"
    Replaces blind queue consumption with capacity-aware routing.
    """

    async def can_schedule(self, job: JobContract) -> Optional[WorkerInfo]:
        """
        Returns the best available worker for this job, or None to queue.

        Algorithm:
        1. Get all healthy workers from Redis registry
        2. Filter by: language support, health=HEALTHY
        3. Score each by: (available_slots / max_concurrency) * memory_score
        4. Pick highest-scoring worker with:
             running_jobs < max_concurrency
             available_memory_mb >= job.memory_mb
             cpu_pct < CPU_SAFETY_THRESHOLD (80%)
        5. If no worker available: queue (backpressure)
        """
        workers = await self.get_healthy_workers()
        candidates = [w for w in workers
                      if job.language in w.languages
                      and w.running_jobs < w.max_concurrency
                      and w.available_memory_mb >= job.memory_mb
                      and w.cpu_pct < settings.CPU_SAFETY_THRESHOLD]

        if not candidates:
            return None  # job stays queued

        # Score: prefer workers with most available capacity
        return max(candidates, key=lambda w:
            (w.max_concurrency - w.running_jobs) / w.max_concurrency
            * (w.available_memory_mb / w.total_memory_mb))

    async def autoscale(self):
        """
        Scale worker concurrency up/down based on multi-signal policy.
        Runs every 10s.
        """
        queue_depth = await RedisQueueEngine.queue_depth("judge")
        queue_wait  = await self.estimate_queue_wait_seconds()
        cpu_pct     = await self.get_system_cpu()
        ram_free_mb = await self.get_system_ram_free()

        if (queue_wait > settings.SCALE_UP_WAIT_THRESHOLD_S
                and cpu_pct < settings.CPU_SAFETY_THRESHOLD
                and ram_free_mb > settings.RAM_SAFETY_FLOOR_MB):
            await self.increase_worker_concurrency()

        elif (queue_depth == 0
              and all workers idle):
            await self.decrease_worker_concurrency()
```

### Scheduling Policy Matrix
```
Priority | Queue          | Workers       | Max depth
---------|----------------|---------------|----------
P0       | system         | all           | 50
P1       | judge          | all (contest) | 500
P2       | contest_lc     | cloud only    | 200
P3       | email          | cloud only    | 1000
P4       | maintenance    | cloud only    | 100
         | cache_sync     | cloud only    | 1000
```

---

## DELIVERABLE 11: Worker Registration Protocol

```
STEP 1: Agent Authentication
  Laptop → POST /workers/auth
  { api_key: "JUDGE_AGENT_SECRET_KEY" }
  ← { session_token: "eyJ...", expires_in: 3600 }

STEP 2: Worker Registration
  Laptop → POST /workers/register
  Authorization: Bearer {session_token}
  {
    "hostname": "ccc-laptop-01",
    "cpu_cores": 8,
    "cpu_threads": 12,
    "memory_mb": 16384,
    "available_memory_mb": 14000,
    "max_concurrency": 4,
    "languages": ["python", "javascript", "cpp", "java", "go"],
    "docker_version": "24.0.5",
    "agent_version": "1.2.0",
    "judge_image": "ccc-judge:v3"
  }
  ← {
    "worker_id": "worker-laptop-ccc-01-uuid",
    "queue_name": "judge",
    "queue_url": "redis://cloud:6379",
    "poll_timeout": 2,
    "max_concurrency": 4,
    "status": "active"
  }

STEP 3: Redis Registration (server-side on POST /register)
  HMSET ccc:worker:{id} hostname cpu_cores memory_mb max_concurrency ...
  SET ccc:worker:{id}:heartbeat {now()} EX 30
  SADD ccc:workers:active {worker_id}

STEP 4: Start poll loop
  RedisQueueEngine.dequeue("judge", timeout=2)  [blocking BRPOP equivalent]
```

---

## DELIVERABLE 12: Heartbeat Protocol

```
Every 5 seconds:
  Laptop → POST /workers/{id}/heartbeat
  Authorization: Bearer {session_token}
  {
    "timestamp": "2026-09-30T18:00:00Z",
    "cpu_pct": 42.3,
    "ram_free_mb": 11200,
    "active_jobs": 2,
    "available_slots": 2,
    "docker_containers": 2,
    "version": "1.2.0",
    "status": "healthy"
  }
  ← 200 OK { "status": "ack" }

Server-side on heartbeat receive:
  SET ccc:worker:{id}:heartbeat {now()} EX 30   ← 30s TTL
  HSET ccc:worker:{id} cpu_pct ram_free_mb active_jobs ...

Health state machine:
  HEALTHY  → heartbeat received within 10s
  SUSPECT  → heartbeat missing 10-30s  (still routes jobs, with lower score)
  OFFLINE  → heartbeat TTL expired (30s)
               SREM ccc:workers:active {worker_id}
               Scheduler stops routing new jobs
               Reaper fires after 300s → requeue orphaned jobs
  RECONNECTED → new heartbeat arrives → SADD ccc:workers:active {worker_id}
                Scheduler resumes routing
```

---

## DELIVERABLE 13: Job Lease Protocol

```
Job enqueue:
  ccc:queue:judge:pending  → [job_id_3, job_id_2, job_id_1]  (LIFO)

Atomic dequeue + lease (Lua script — currently in redis_queue.py):
  1. RPOPLPUSH ccc:queue:judge:pending → ccc:queue:judge:processing
  2. SET ccc:job:{job_id}:leased_at {now()} EX 300     ← 5-min lease
  3. HSET ccc:job:{job_id} status "processing"

Lease renewal (worker sends every 60s while running):
  SET ccc:job:{job_id}:leased_at {now()} EX 300        ← refresh

Job completion (worker calls /complete):
  LREM ccc:queue:judge:processing 1 {job_id}
  HSET ccc:job:{job_id} status "completed" result {...}
  DEL ccc:job:{job_id}:leased_at

Lease expiry (worker crashed):
  After 300s: ccc:job:{job_id}:leased_at expires
  Reaper (every 60s) scans ccc:queue:judge:processing:
    for each job_id:
      leased_at = GET ccc:job:{job_id}:leased_at
      if leased_at is None:
        attempt = HGET ccc:job:{job_id} attempt
        if attempt < max_retries:
          → RPUSH ccc:queue:judge:pending {job_id}  (retry)
          → HSET status=retrying, attempt+=1
        else:
          → RPUSH ccc:queue:judge:dlq {job_id}
          → HSET status=dead_letter
      LREM ccc:queue:judge:processing 1 {job_id}
```

---

## DELIVERABLE 14: Resource Allocation Algorithm

```
function allocate_job(job: JobContract) -> WorkerAllocation:
    workers = redis.smembers("ccc:workers:active")
    
    candidates = []
    for worker_id in workers:
        w = redis.hgetall(f"ccc:worker:{worker_id}")
        heartbeat = redis.get(f"ccc:worker:{worker_id}:heartbeat")
        
        if heartbeat is None:
            continue  # OFFLINE: skip
        
        if job.language not in w.languages:
            continue  # language not supported
        
        running = int(w.running_jobs)
        max_c   = int(w.max_concurrency)
        avail_m = int(w.available_memory_mb)
        cpu_pct = float(w.cpu_pct)
        
        if running >= max_c:
            continue  # at capacity
        if avail_m < job.memory_mb:
            continue  # insufficient memory
        if cpu_pct > CPU_SAFETY_THRESHOLD:
            continue  # overloaded
        
        # Composite score: more free slots and memory = better
        slot_score = (max_c - running) / max_c
        mem_score  = min(1.0, avail_m / max(job.memory_mb * 2, 1))
        priority_bonus = 0.1 if w.hostname.contains("laptop") else 0.0
        score = slot_score * 0.6 + mem_score * 0.3 + priority_bonus * 0.1
        
        candidates.append((score, worker_id))
    
    if not candidates:
        return WorkerAllocation(worker_id=None, action=QUEUE)
    
    best_score, best_worker = max(candidates, key=lambda x: x[0])
    return WorkerAllocation(worker_id=best_worker, action=DISPATCH)
```

---

## DELIVERABLE 15: Queue Strategy

```
Current mechanism: Redis LIST (LPUSH/RPUSH + BRPOPLPUSH pattern)
Why not Redis Streams? Current LIST+visibility approach is simpler,
already handles all durability requirements via PostgreSQL outbox.
Streams would add consumer group complexity for no additional benefit
at current scale. Revisit if jobs > 10,000/day.

Queue structure per domain:

  ccc:queue:{name}:pending     ← active work
  ccc:queue:{name}:processing  ← claimed by worker
  ccc:queue:{name}:delayed     ← scheduled (ZSET, score=execute_at)
  ccc:queue:{name}:dlq         ← permanently failed (7-day retention)

Priority mechanism:
  HIGH   → RPUSH to :pending (dequeued first by BRPOP from right)
  NORMAL → LPUSH to :pending (dequeued last)
  → Effective priority: HIGH jobs always run before NORMAL

Starvation protection:
  NORMAL jobs are dequeued by LPUSH/BRPOP ordering.
  The reaper reschedules expired NORMAL jobs with elevated priority
  after STARVATION_THRESHOLD_SECONDS=300.

Backpressure limits:
  judge:             500 jobs
  email:            1000 jobs
  contest_lifecycle: 200 jobs
  webhooks:         2000 jobs
  maintenance:       100 jobs
  cache_sync:       1000 jobs

On backpressure: FastAPI returns 503 Service Unavailable with
  Retry-After: 30 header.
```

---

## DELIVERABLE 16: SSE Strategy

```
Architecture: Notification-only, never a query trigger

Channel namespacing:
  "global"                   ← system-wide announcements
  "contest:{slug}"           ← all participants of a contest
  "user:{member_id}"         ← personal events (submit result, pass)
  "admin"                    ← admin-only events

Client connection:
  GET /api/events/stream?channel=contest:{slug}
  Authorization: Bearer {token}
  Accept: text/event-stream

Server behavior:
  1. Validate auth
  2. Rate limit SSE connections (max 3 per user IP)
  3. Subscribe to Redis Pub/Sub channel
  4. Replay missed events via Last-Event-ID (5-min buffer)
  5. Stream events as they arrive
  6. Heartbeat every 15s: ": heartbeat\n\n"
  7. finally: unsubscribe, release queue, cleanup

Event schema:
  id: {monotonic_event_id}
  event: submission_evaluated
  data: {"contest_slug":"...", "member":"...", "verdict":"ACCEPTED",
         "problem_index":"A", "version":42}
  \n\n

Client rules:
  - On submission_evaluated: update only this submission's row
  - On leaderboard_updated: fetch only /api/scoreboards/{slug} delta
  - On contest_started/ended: re-fetch contest status (1 GET)
  - NEVER refetch full page on any SSE event
  - Client-side deduplication: ignore event.version <= last_seen_version
  - Reconnect with Last-Event-ID header on disconnect

SSE NGINX config:
  location /api/events/ {
    proxy_pass http://fastapi_upstream;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_set_header Connection "";
    proxy_http_version 1.1;
    chunked_transfer_encoding on;
  }
```

---

## DELIVERABLE 17: Cache Strategy

```
Cache Tiers:

TIER 1 — Static-ish (TTL=5min)
  Problem metadata (immutable once contest starts)
  cache:problem:{id}

TIER 2 — Semi-dynamic (TTL=60s, invalidated on mutation)
  Contest list:           cache:contest:list
  Contest detail:         cache:contest:detail:{slug}
  Contest problems:       cache:contest:problems:{slug}
  University leaderboard: cache:leaderboard:university:*
  Member profile:         cache:profile:{handle}

TIER 3 — Fast-changing (TTL=15s during live, 60s otherwise)
  Scoreboard:   cache:scoreboard:{slug}:*
  Registration: cache:reg_status:{contest_id}:{member_id}

TIER 4 — User-private (TTL=30s, keyed by member_id)
  Pass status: cache:pass:{contest_id}:{member_id}

Stampede protection: SingleFlight (10 call-sites, Redis-distributed lock)
  Pattern:
    cache_key = "cache:contest:detail:{slug}"
    result = get_cache(cache_key)
    if result: return result  # HIT
    payload = await single_flight.execute(cache_key, _fetch_from_db)
    # Only ONE DB query fires even if 500 users miss simultaneously

Invalidation strategy:
  On submission accepted:
    delete_cache_pattern("cache:scoreboard:{slug}*")
    delete_cache_pattern("cache:contest:detail:{slug}*")
    delete_cache_pattern("cache:contest:problems:{slug}*")
  On contest status change:
    delete_cache_pattern("cache:contest:*")
  On profile update:
    delete_cache_pattern("cache:profile:{handle}*")
  Never: global flush of all cache keys
```

---

## DELIVERABLE 18: PostgreSQL Pooling Strategy

```
Hardware: 2 vCPU, 4 GB RAM
PostgreSQL max_connections: 100 (default)

Connection budget:
  FastAPI workers (2 Uvicorn × pool_size=20): 40 connections
  FastAPI overflow (2 × max_overflow=20):     40 connections
  Background workers in-process:              10 connections
  Maintenance/outbox:                          5 connections
  Admin/psql:                                  5 connections
  TOTAL:                                     100 connections ✓

Pool configuration (current, correct):
  pool_size=20, max_overflow=20,
  pool_timeout=30s, pool_recycle=1800s,
  pool_pre_ping=True

Connection lifetime rules:
  - Connection released BEFORE Docker execution (db.rollback())
  - No transaction held during: compile, execute, SSE, Redis wait
  - Maximum transaction duration: < 500ms (index queries + advisory lock)

When laptop worker is added:
  Laptop does NOT get a direct DB connection.
  All DB writes flow through FastAPI API endpoints.
  Laptop → POST /workers/{id}/complete → FastAPI → PostgreSQL
  No additional pool adjustment needed.

Monitoring targets:
  idle connections < 10 during off-peak
  active connections < 40 during peak
  wait time for connection < 100ms
  no connection exhaustion (pool_timeout=30s returns 503)
```

---

## DELIVERABLE 19: Docker Isolation Strategy

```
Current: DockerSandboxProvider + pre-warmed persistent container pool
Target: Add explicit resource limits to all containers

Container lifecycle:
  1. prewarm_containers() at startup → pool of warm containers
  2. get_container(image) → returns running container from pool
  3. CoreDockerSandbox.execute() → exec_run inside container
     (no new container created per submission)
  4. Workspace: ephemeral /tmp mount, deleted after execution

Resource limits to enforce per container:
  CPU:     --cpus="1.0"          # 1 full core max
  Memory:  --memory="512m"       # 512 MB hard limit
           --memory-swap="512m"  # No swap
  PIDs:    --pids-limit=64       # Prevent fork bombs
  Network: --network=none        # No internet access
  User:    --user=1000:1000      # Non-root execution
  Read-only rootfs: yes, with /tmp writable tmpfs

Output limits:
  Truncate stdout/stderr at 64KB
  Kill container if timeout exceeded

Security hardening:
  --cap-drop=ALL                    # Drop all capabilities
  --security-opt=no-new-privileges  # No privilege escalation
  --security-opt=seccomp=profile.json  # Syscall filter
  Read-only mounts: /etc, /usr, /lib (only /workspace writable)
  No Docker socket access inside container

Per-language time limits (from problem config):
  Python:     2–5s
  JavaScript: 2–5s
  Java:       5–10s (JVM startup)
  C++:        1–3s
  Go:         2–4s
```

---

## DELIVERABLE 20: Monitoring Architecture

```
Metrics to collect (Prometheus format):

API:
  ccc_http_requests_total{method,endpoint,status}
  ccc_http_request_duration_seconds{method,endpoint} (histogram)
  ccc_active_sse_connections{channel}
  ccc_sse_events_total{channel,event_type}

Queue:
  ccc_queue_depth{queue_name}
  ccc_queue_processing{queue_name}
  ccc_queue_dlq_depth{queue_name}
  ccc_job_duration_seconds{queue_name,job_type} (histogram)
  ccc_job_retries_total{queue_name}
  ccc_job_failures_total{queue_name,error_class}

Judge:
  ccc_judge_compile_time_seconds (histogram)
  ccc_judge_execution_time_seconds (histogram)
  ccc_judge_queue_wait_seconds (histogram)
  ccc_docker_containers_active
  ccc_judge_verdicts_total{verdict}

Workers:
  ccc_worker_active_jobs{worker_id}
  ccc_worker_cpu_pct{worker_id}
  ccc_worker_ram_free_mb{worker_id}
  ccc_worker_heartbeat_age_seconds{worker_id}
  ccc_worker_status{worker_id, status}

Database:
  ccc_db_pool_active_connections
  ccc_db_pool_idle_connections
  ccc_db_query_duration_seconds (histogram)

Redis:
  ccc_redis_memory_used_bytes
  ccc_redis_ops_per_sec
  ccc_redis_latency_ms

Alerting thresholds:
  judge queue depth > 100: WARNING
  judge queue depth > 400: CRITICAL (near backpressure)
  worker heartbeat age > 15s: WARNING
  worker heartbeat age > 30s: CRITICAL (OFFLINE)
  DB pool active > 80%: WARNING
  p95 API latency > 300ms: WARNING
  5xx rate > 1%: CRITICAL
  DLQ depth > 10: WARNING (failed jobs need inspection)

Existing endpoint: GET /api/jobs/metrics (queue depth by name)
Add: GET /api/health/detailed (worker registry, Docker health)
Add: GET /metrics (Prometheus exposition format)
```

---

## DELIVERABLE 21: CI/CD Architecture

```
.github/workflows/pr_check.yml (existing — 3 parallel gates):
  Gate 1: Frontend (TypeScript, Vite build, a11y)
  Gate 2: Playwright E2E (17 tests, WCAG 2.2 AA)
  Gate 3: Backend QA (51 API contract tests, PostgreSQL+Redis containers)

.github/workflows/deploy.yml (existing — SSH deploy):
  Build → SSH → pull → restart → health check

Proposed additions:

pre-deploy:
  - docker build ccc-judge:v{version}
  - docker scan ccc-judge:v{version} (Trivy)
  - pin compiler versions in Dockerfile
  - verify judge image: compile + run test case

migration safety:
  - Run: alembic upgrade head --sql > migration.sql
  - Review migration.sql in PR (blocking check)
  - Run: alembic check (no pending migrations after deploy)
  - Pattern: EXPAND → DEPLOY → MIGRATE → VERIFY → CONTRACT

smoke tests (post-deploy):
  - GET /api/health → 200
  - GET /api/health/detailed → workers healthy
  - GET /api/contests → 200
  - POST /api/auth/send-otp (dry run) → 200
  - Queue depth check: ccc:queue:judge:pending depth = 0

rollback plan:
  - git revert + redeploy (< 2 min)
  - Database: alembic downgrade -1 (only backward-compatible changes)
```

---

## DELIVERABLE 22: Security Boundaries

```
Network zones:

PUBLIC ZONE:
  ┌─────────────────────────────────┐
  │  Internet → NGINX (443/80)      │
  │  Rate limited, TLS only         │
  └─────────────────────────────────┘

APPLICATION ZONE (localhost only):
  ┌─────────────────────────────────┐
  │  NGINX → FastAPI (127.0.0.1:8002)│
  │  Worker → Redis (127.0.0.1:6379) │
  │  API → PostgreSQL (socket/local) │
  └─────────────────────────────────┘

WORKER ZONE (authenticated outbound):
  ┌─────────────────────────────────────────────┐
  │  Laptop → cloud:443/api/workers/*           │
  │  Authenticated: JUDGE_AGENT_SECRET_KEY       │
  │  Short-lived tokens (1h), rotated per contest│
  │  TLS only                                    │
  └─────────────────────────────────────────────┘

SANDBOX ZONE (maximum isolation):
  ┌─────────────────────────────────────────────┐
  │  Docker containers                           │
  │  --network=none                              │
  │  --cap-drop=ALL                              │
  │  --user=1000:1000 (non-root)                │
  │  --read-only rootfs                          │
  │  No access to: DB, Redis, filesystem, env   │
  └─────────────────────────────────────────────┘

What is NEVER exposed publicly:
  - Redis port 6379 (localhost only)
  - PostgreSQL port 5432 (localhost only)
  - Docker socket /var/run/docker.sock (no external access)
  - Worker control API (no direct external worker control)
  - Internal job IDs (BOLA-protected by JobController)
  - Database credentials (env-only, never in code)
  - Judge container environment (no secrets injected)
```

---

## DELIVERABLE 23: Load-Testing Strategy

```
Tool: k6 (or locust for Python-native)
Location: backend/load_tests/

Scenario 1: Normal API load (baseline)
  VUs: 100 → 500 → 1000 (ramp 5min each)
  Endpoints: GET /contests, GET /leaderboard, GET /auth/me
  Target: p95 < 150ms, error rate < 0.1%

Scenario 2: SSE connection flood
  VUs: 1000 simultaneous SSE connections
  Hold for: 10 minutes
  Monitor: Redis Pub/Sub connections, memory, GC

Scenario 3: Submission burst (contest start)
  VUs: 200 users, each submitting every 30s
  Duration: 60 minutes
  Monitor: queue depth, judge throughput, p99 submit latency

Scenario 4: Leaderboard stampede
  VUs: 500 simultaneous GET /scoreboards/{slug}
  Target: SingleFlight reduces DB queries to ≤1, p99 < 200ms

Scenario 5: Worker failure during contest
  1. Run scenario 3 at full load
  2. Kill laptop worker mid-contest (kill agent process)
  3. Verify: jobs requeued within 300s, no submission lost
  4. Restart laptop agent
  5. Verify: worker re-registers, jobs resume

Scenario 6: Redis restart
  1. Run scenario 3
  2. sudo systemctl restart redis
  3. Verify: workers reconnect, outbox replays, no data loss

Key metrics to capture:
  RPS, p50, p95, p99 (HTTP latency)
  Judge queue depth (max and recovery time)
  Docker container count (should stay ≤ max_concurrency)
  PostgreSQL connection pool utilization (should stay < 80%)
  SSE reconnect rate after Redis restart
  Submission loss rate (must be 0.00%)

Performance targets:
  GET /api/contests p95:           < 50ms (cached)
  GET /api/contests p95 (miss):    < 150ms
  POST /arena/submit p95:          < 300ms (enqueue only)
  Judge queue throughput:          ≥ 4 submissions/min (concurrency=4)
  SSE event propagation:           < 500ms from DB commit
  Worker registration:             < 1s
  Job requeue after worker failure: < 305s (visibility timeout)
```

---

## IMPLEMENTATION ROADMAP

### Phase 1 (Immediate — this week)
- [ ] Add `rate_limit("arena:submit", max_calls=15, window_seconds=60)` to `contests.py:247`
- [ ] Add Docker resource limits to container creation (CPU, memory, PIDs, network)
- [ ] Add NGINX SSE config (`proxy_buffering off`, extended timeouts)

### Phase 2 (Contest prep — before next contest)
- [ ] Implement Worker Registry API (`POST /workers/register`, heartbeat, unregister)
- [ ] Implement `ResourceGovernor` with health-aware routing
- [ ] Implement `JudgeAgent` for laptop (Python service + systemd unit)
- [ ] Implement per-user concurrency limit (Redis counter: `ccc:user:{id}:active_jobs`)

### Phase 3 (Hardening — ongoing)
- [ ] Implement contest lifecycle modes (`PRE_CONTEST/CONTEST_ACTIVE/DRAINING/FINALIZING`)
- [ ] Implement Prometheus metrics endpoint
- [ ] Add structured trace IDs (`request_id → job_id → worker_id`)
- [ ] Write k6 load test suite

### Phase 4 (Scale-out)
- [ ] Implement autoscaler (queue pressure → concurrency scaling)
- [ ] Add priority starvation protection (promote aged NORMAL jobs)
- [ ] Grafana dashboard for all metrics

---

## Definition of Done Status

| Requirement | Status |
|-------------|--------|
| API/judge workload separation | ✅ Workers are async, not in request path |
| NGINX reverse proxy | ✅ (SSE config missing) |
| API concurrency bounded | ✅ Uvicorn ×2 workers |
| DB connections bounded | ✅ 20/20/30s |
| GET endpoints no mutations | ✅ Verified |
| Submission execution async | ✅ Outbox → Redis → JudgeWorker |
| Redis queue operational | ✅ Full implementation |
| Job state machine | ✅ QUEUED/PROCESSING/COMPLETED/FAILED/DLQ |
| Worker registration | ❌ No laptop agent |
| Worker heartbeat | ❌ No heartbeat system |
| Worker leases | ✅ Visibility timeout 5min |
| Worker failure recovery | ✅ Reaper requeues |
| Resource-aware scheduling | ❌ Round-robin only |
| Dynamic worker allocation | ❌ Static concurrency |
| CPU limits in Docker | ❌ Not enforced |
| RAM limits in Docker | ❌ Not enforced |
| Docker isolation | ✅ Persistent container pool |
| Network isolation | ❌ Not configured |
| Judge concurrency bounded | ✅ Semaphore=4 |
| Per-user concurrency limits | ❌ Missing |
| Per-contest limits | ❌ Missing |
| Global concurrency limits | ✅ Semaphore=4 |
| Queue backpressure | ✅ QueueBackpressureError |
| Retry policy | ✅ RetryableError + exponential backoff |
| Idempotency | ✅ SHA-256 + NX + outbox keys |
| Scoreboard concurrency-safe | ✅ pg_advisory_xact_lock |
| SSE event-driven | ✅ |
| SSE no request storms | ✅ |
| SSE scoped channels | ✅ |
| SSE event versioning | ✅ Last-Event-ID replay |
| Cache stampede prevention | ✅ SingleFlight |
| Short transactions | ✅ |
| No DB during execution | ✅ rollback before execute_batch |
| Laptop auto-registers | ❌ No agent yet |
| Laptop reports resources | ❌ No agent yet |
| Laptop graceful drain | ❌ No agent yet |
| Laptop failure safe | ✅ Reaper handles |
| Network failure safe | ✅ Reaper handles |
| Jobs requeue-able | ✅ DLQ + reaper |
| Cloud works without laptop | ✅ LocalProvider fallback |
| Contest lifecycle explicit | ❌ Partial |
| Monitoring | ⚠️ Partial (queue metrics only) |
| Structured logs | ⚠️ Partial (no trace IDs) |
| Metrics endpoint | ❌ Not Prometheus-formatted |
| Load testing | ❌ Missing |
| Failure testing | ❌ Missing |
| CI/CD validates deploy | ✅ |
| Safe migrations | ⚠️ Pattern defined, not enforced |
| Future workers extensible | ✅ Factory pattern |
| No unnecessary complexity | ✅ |

**Score: 32/52 complete. 12 gaps. Next priority: laptop worker agent + Docker resource limits.**
