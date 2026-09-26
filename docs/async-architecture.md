# Asynchronous Processing & Concurrency Architecture

## Chaos Computer Club — Medi-Caps Chapter Backend

---

## 1. Executive Summary & Problem Context

The Chaos Computer Club (CCC) Medi-Caps Chapter backend is a high-performance **Modular Monolith** built on Python 3.12, FastAPI, SQLAlchemy 2.0 (asyncpg), PostgreSQL 16+, and Redis 8. It manages physical and online competitive programming contests, code execution sandboxes, Elo rating ladder updates, cryptographic Trust-of-Proof verification, and campus gate access control.

Prior to this architectural evolution, several critical operations executed **synchronously within HTTP request handlers** or via **unmanaged in-process fire-and-forget coroutines**:
1. **Sandboxed Code Execution**: Contest and assessment code submissions synchronously invoked sandbox execution engines (Docker, CodeBox, local compilers) inside HTTP POST requests, blocking ASGI worker event loops for 2–10 seconds per request under peak contest submissions.
2. **Heavy Elo Rating Finalization**: Contest conclusion performed whole-contest standings re-ranking, Elo rating delta calculations, multiple table mutations (`ScoreboardEntry`, `RatingHistory`, `MemberProfile`), and attendance recalculations synchronously.
3. **Unmanaged Background Coroutines**: Email OTP dispatches and outbound webhooks ran via `asyncio.create_task()` with zero persistence, no retries, no backpressure, no dead-letter tracking, and vulnerability to silent process crash data loss.
4. **Vulnerable Periodic Sweepers**: Contest lifecycle sweeps (auto-start, auto-finish, session expiration) relied on `asyncio.sleep()` loops with in-memory Python `set()` states, creating race conditions and duplicate execution when running multiple ASGI workers or replicas.

This document establishes the production-grade **Asynchronous Processing and Concurrency Architecture** for the platform, eliminating HTTP request blocking while preserving modular monolithic simplicity.

---

## 2. Workload Analysis & Operation Classification

Every significant backend operation has been audited and classified into one of ten operational profiles:

| Operation | Current Execution | Classification | Bottleneck Type | Proposed Async Model |
| :--- | :--- | :--- | :--- | :--- |
| **Health Check (`GET /api/health`)** | Sync HTTP | 1. Synchronous Request/Response | Low latency I/O | Immediate sync response |
| **Leaderboard / Scoreboard Read** | Sync HTTP + Redis Cache | 1. Synchronous Request/Response | Memory read | Immediate sync response with cache-aside |
| **Interactive Code Run (`/arena/run`)** | Sync HTTP (2-3 testcases) | 1. Synchronous Request/Response | CPU / Subprocess | Synchronous interactive run (timeout $\le 3.0s$) |
| **OTP Verification (`/auth/otp/verify`)** | Sync HTTP | 10. Critical Transactional | DB Transaction | Immediate sync response with ACID commit |
| **Gate QR Scan (`/webhooks/gate-scan`)** | Sync HTTP + SSE Relay | 10. Critical Transactional | DB Transaction | Immediate sync response + async event push |
| **OTP Email Dispatch** | `asyncio.create_task` | 2. Async Background Task | Network / SMTP I/O | Domain Queue: `email` |
| **Arena Code Submission** | Sync HTTP (All Testcases) | 5. CPU-Intensive / 6. I/O | Compiler / Sandbox | Domain Queue: `judge` (202 Accepted + Job Polling / SSE) |
| **Assessment Code Submission** | Sync HTTP (All Testcases) | 5. CPU-Intensive / 6. I/O | Compiler / Sandbox | Domain Queue: `judge` (202 Accepted + Job Polling / SSE) |
| **Contest Rating Finalization** | Sync HTTP / Background Loop | 8. Batch / 5. CPU-Intensive | DB Batch + Math | Domain Queue: `contest_lifecycle` |
| **Top 30 Finalist Qualification** | Sync HTTP / Background Loop | 8. Batch Processing | DB Sort / Seat Alloc | Domain Queue: `contest_lifecycle` |
| **Outbound Webhook Delivery** | `asyncio.create_task` | 7. External API Task | Network I/O | Domain Queue: `webhooks` |
| **Session Expiry Sweeper** | In-process `asyncio.sleep` | 3. Scheduled Task | DB Query / Update | Distributed Lock + Queue Scheduler |
| **Contest Auto-Start/Finish** | In-process `asyncio.sleep` | 3. Scheduled Task | DB Query / Update | Distributed Lock + Queue Scheduler |
| **Tournament Simulation** | Sync HTTP (Admin QA) | 8. Batch Processing | Heavy DB Writes | Domain Queue: `maintenance` |

---

## 3. Technology Evaluation & Selection

We rigorously compared message brokers and queue architectures against the project's actual traffic profile (hundreds to low thousands of students during live contests, sub-second execution requirements, and modular deployment constraints).

```
                                  EVALUATION MATRIX
┌──────────────────┬──────────────┬──────────────┬──────────────┬────────────────────────┬─────────────┐
│ Dimension        │ Apache Kafka │ RabbitMQ     │ BullMQ (Node)│ Redis Async Engine     │ Celery      │
├──────────────────┼──────────────┼──────────────┼──────────────┼────────────────────────┼─────────────┤
│ Runtime Stack    │ JVM / KRaft  │ Erlang/OTP   │ Node.js      │ Python 3.12 (Native)   │ Python sync │
│ Operational Cost │ Very High    │ Moderate     │ Moderate     │ ZERO (Already in place)│ Moderate    │
│ Memory Overhead  │ 2-4 GB min   │ 200-500 MB   │ 50-100 MB    │ 15-30 MB               │ 150-300 MB  │
│ Latency (Enqueue)│ 2-5 ms       │ 1-3 ms       │ < 1 ms       │ < 0.5 ms               │ 2-5 ms      │
│ Asyncio Native   │ Complex      │ Via aio-pika │ Split-stack  │ Native (redis.asyncio) │ Fractured   │
│ Job State / API  │ Custom topics│ Manual state │ Native       │ Native Hashes          │ Result Bknd │
│ DLQ & Retries    │ Heavy custom │ DLX plugin   │ Native       │ Native ZSET + DLQ list │ Redis/RPC   │
│ Dist. Locking    │ No           │ No           │ No           │ Redlock / Atomic Token │ Separate pkg│
└──────────────────┴──────────────┴──────────────┴──────────────┴────────────────────────┴─────────────┘
```

### Why Alternatives Were Rejected:
- **Apache Kafka**: Designed for multi-gigabyte log streaming and partition-based event consumption. It does not provide point-to-point job state transitions (`QUEUED` $\rightarrow$ `PROCESSING` $\rightarrow$ `COMPLETED`), fine-grained individual retry backoffs with jitter, or job status polling APIs without custom state layers. Requires massive operational overhead (JVM, KRaft, zoo management).
- **RabbitMQ**: Requires installing, monitoring, and maintaining an Erlang runtime and RabbitMQ broker daemon. Redundant when Redis 8 is already provisioned and healthy.
- **BullMQ**: Written natively for Node.js / TypeScript. Introducing BullMQ would require either maintaining an auxiliary Node.js worker service or using brittle, unidiomatic Python wrapper ports.
- **Celery**: Historically architected for prefork synchronous worker pools. Running asyncpg and FastAPI's native async coroutines inside Celery workers leads to nested event loops, thread pool exhaustion, and fragile database connection management.

### Selected Architecture: Native Redis Async Queue Engine (`ChaosQueue`)
- **Direct Stack Alignment**: Built natively in Python 3.12 on top of `redis.asyncio` (already a production dependency in `backend/requirements.txt`).
- **Zero New Infrastructure**: Leverages the running, healthy Redis 8 instance.
- **Sub-Millisecond Overhead**: Atomic enqueueing and dequeuing via Redis primitives (`LPUSH`, `BLMOVE` / `RPOPLPUSH`, Sorted Sets for delayed retries).
- **First-Class Job State Machine**: Each job maintains an atomic Redis Hash (`ccc:job:{job_id}`) tracking state, attempts, duration, error details, and execution results.
- **At-Least-Once Delivery**: Work items are leased atomically into a processing list and only acknowledged (`ACK`) upon successful execution.

---

## 4. Target Architecture

```
                    ┌────────────────────────────┐
                    │    HTTP / Web Clients      │
                    └─────────────┬──────────────┘
                                  │
                                  ▼
                    ┌────────────────────────────┐
                    │    FastAPI Controllers     │
                    └─────────────┬──────────────┘
                                  │
                                  ▼
                    ┌────────────────────────────┐
                    │  Application Domain Service │
                    └──────┬──────────────┬──────┘
                           │              │
        [Synchronous Path] │              │ [Asynchronous Path]
                           ▼              ▼
                    ┌────────────┐  ┌────────────────────────────┐
                    │ Direct DB  │  │ Transactional Outbox /     │
                    │ / Cache    │  │ Queue Producer             │
                    └────────────┘  └─────────────┬──────────────┘
                                                  │
                                                  ▼
                        ═════════════════════════════════════════
                                   CHAOS REDIS QUEUE
                        ═════════════════════════════════════════
                           ├── ccc:queue:email:pending
                           ├── ccc:queue:judge:pending
                           ├── ccc:queue:contest_lifecycle:pending
                           ├── ccc:queue:webhooks:pending
                           └── ccc:queue:maintenance:pending
                        ═════════════════════════════════════════
                                                  │
                     ┌────────────────────────────┼────────────────────────────┐
                     ▼                            ▼                            ▼
          ┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
          │   Email Worker      │      │   Judge Worker      │      │ Lifecycle Worker    │
          │  Concurrency: 5     │      │  Concurrency: 4     │      │  Concurrency: 2     │
          │  Rate-Limit: 10/sec │      │  Process Isolated   │      │  Distributed Locks  │
          └──────────┬──────────┘      └──────────┬──────────┘      └──────────┬──────────┘
                     │                            │                            │
                     └────────────────────────────┼────────────────────────────┘
                                                  │
                                                  ▼
                                ┌──────────────────────────────────┐
                                │   Infrastructure Services        │
                                │   PostgreSQL / MinIO / External  │
                                └──────────────────────────────────┘
```

---

## 5. End-to-End Async Job Lifecycle

For asynchronous operations (such as code evaluation or batch rating recalculation), the API adheres to the HTTP 202 Accepted protocol:

1. **Submission**:
   `POST /api/contests/{slug}/arena/submit`
   $\rightarrow$ Validates authentication, contest state, problem existence, and eligibility.
   $\rightarrow$ Generates unique `job_id` and persists idempotency key in Redis.
   $\rightarrow$ Enqueues `EVALUATE_SUBMISSION` job into `ccc:queue:judge:pending`.
   $\rightarrow$ Returns **`202 Accepted`**:
   ```json
   {
     "success": true,
     "job_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
     "status": "queued",
     "message": "Submission received and queued for evaluation.",
     "check_status_url": "/api/jobs/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
   }
   ```
2. **Polling / Real-time Notification**:
   - Browser client polls `GET /api/jobs/{job_id}` $\rightarrow$ receives current state (`queued`, `processing`, `completed`, `failed`), execution metrics, and verdict.
   - Concurrently, the worker broadcasts the `submission_evaluated` event over Server-Sent Events (SSE) via the existing `app.services.event_broadcaster` relay.
3. **Backwards Compatibility**:
   - For legacy test runners and automated QA scripts requiring synchronous completion, an optional query flag `?sync=true` or `async=false` allows inline waiting with an asynchronous timeout barrier.

---

## 6. Concurrency & Resource Isolation Model

Concurrency is managed per domain queue, preventing resource starvation:

```
Queue: judge
├── Concurrency: 4 workers
├── Rationale: Subprocesses compile C++/Java/Python. Bound by CPU core count.
└── DB Impact: 4 concurrent connections max.

Queue: email
├── Concurrency: 5 workers
├── Rationale: Network I/O bound to SMTP server (port 465/587).
└── Rate Limit: Max 10 dispatches/sec to avoid SMTP provider rate limits.

Queue: contest_lifecycle
├── Concurrency: 2 workers
├── Rationale: Database batch updates (Elo recalculation, scoreboard re-ranking).
└── Lock Governance: Serialized per contest slug via Redlock (`lock:contest:{slug}`).

Queue: webhooks
├── Concurrency: 5 workers
├── Rationale: Network I/O to external endpoints with 5s timeout.
└── Failure Mode: Circuit breaker on repeatedly failing hostnames.
```

---

## 7. Scaling & Operational Procedures

- **Vertical Scaling**: Tuning `QUEUE_CONCURRENCY_{QUEUE_NAME}` environment variables based on host CPU cores and memory.
- **Horizontal Scaling**: Multiple ASGI processes or standalone worker instances can safely connect to the same Redis instance. Distributed locks prevent duplicate executions of scheduled jobs.
- **Graceful Shutdown**: On `SIGTERM` / `SIGINT`, workers stop picking up new jobs from pending queues, allow active jobs up to 15 seconds to finalize, and release Redis leases cleanly.
