# Concurrency Model, Database Connection Budget & Distributed Locking

## Chaos Computer Club — Medi-Caps Chapter Backend

---

## 1. Concurrency Tuning & Capacity Limits

Concurrency in an asynchronous system must be governed by the **narrowest downstream bottleneck**, never by arbitrary CPU thread counts.

```
                      DOWNSTREAM CAPACITY BUDGET
┌─────────────────────────────────┬───────────────────┬─────────────────────────────────┐
│ Infrastructure Resource         │ Max Capacity      │ Budget Allocation               │
├─────────────────────────────────┼───────────────────┼─────────────────────────────────┤
│ PostgreSQL Pool (AsyncPG)       │ 25 conn (10+15)   │ Web: 10, Judge: 4, Admin/Life: 6│
│ Redis Connections               │ 10,000 conn       │ Max 50 client connections       │
│ Sandboxed Docker / Subprocesses │ 4 concurrent runs │ 4 judge workers                 │
│ External SMTP (Port 465)        │ 10 conn / sec     │ 5 email workers                 │
│ Outbound Webhook Sockets        │ 50 concurrent     │ 5 webhook workers               │
└─────────────────────────────────┴───────────────────┴─────────────────────────────────┘
```

### Queue Concurrency Matrix

| Queue Name | Worker Concurrency | Environment Variable | Downstream Constraint |
| :--- | :--- | :--- | :--- |
| **`judge`** | **4** | `QUEUE_CONCURRENCY_JUDGE` | CPU cores (compilation & isolated testcase execution) |
| **`email`** | **5** | `QUEUE_CONCURRENCY_EMAIL` | SMTP server rate limits & TLS handshake latency |
| **`contest_lifecycle`**| **2** | `QUEUE_CONCURRENCY_LIFECYCLE` | Database write contention during whole-contest Elo updates |
| **`webhooks`** | **5** | `QUEUE_CONCURRENCY_WEBHOOKS` | Outbound socket connections & target server responsiveness |
| **`maintenance`** | **1** | `QUEUE_CONCURRENCY_MAINTENANCE`| Heavy batch write operations (simulations, test audits) |

---

## 2. Database Connection Pool Management

In `app/core/db.py`, the engine connection pool is configured as:
- `pool_size = 10` (persistent connections maintained in the pool)
- `max_overflow = 15` (temporary burst connections allowed)
- `pool_timeout = 15.0s` (maximum wait time before `TimeoutError`)

### Critical Rule for Workers:
Workers must **never hold open database connections during long external I/O or sandboxed execution**.
- **Bad Pattern**:
  ```python
  # DANGEROUS: Holds DB connection for 5 seconds while compiling code
  async with AsyncSessionLocal() as db:
      result = await provider.execute_batch(...) # 5s sandbox run!
      await db.commit()
  ```
- **Engineered Pattern**:
  ```python
  # SAFE: Connection is checked out only during fast database reads and writes
  # 1. Fast read (check out & return to pool)
  async with AsyncSessionLocal() as db:
      problem, submission = await fetch_entities(db)
  
  # 2. Execution phase (ZERO database connections held)
  result = await provider.execute_batch(...)
  
  # 3. Fast write (check out & commit)
  async with AsyncSessionLocal() as db:
      await record_verdict(db, result)
  ```

---

## 3. Distributed Locking Architecture

When running multiple uvicorn workers or distributed server replicas, scheduled tasks and contest lifecycle operations must not execute concurrently.

### The Algorithm: Safe Atomic Token Lock
1. **Acquire**:
   Uses Redis atomic `SET key token NX PX ttl_ms`:
   - `NX`: Set only if key does not already exist.
   - `PX`: Automatic lease expiration in milliseconds (prevents indefinite deadlocks if a worker crashes).
   - `token`: Cryptographically random UUID4.
2. **Release**:
   Releases the lock strictly via an **atomic Lua script**:
   ```lua
   if redis.call("get", KEYS[1]) == ARGV[1] then
       return redis.call("del", KEYS[1])
   else
       return 0
   end
   ```
   This guarantees that a slow worker whose lease has expired will never accidentally delete a lock acquired by a subsequent worker.

### Operations Requiring Distributed Locks:

```
lock:contest:finalize:{slug}
├── TTL: 60 seconds
├── Scope: Serializes Elo rating calculation and scoreboard finalization per contest.
└── Failure Behavior: Enqueued retry with 5s backoff if lock is busy.

lock:contest:qualify_top30:{slug}
├── TTL: 30 seconds
├── Scope: Guarantees Top 30 seats LAB-04-PC01..PC30 are allocated exactly once.
└── Failure Behavior: Drop duplicate attempt; qualification is already running.

lock:scheduler:session_sweeper
├── TTL: 45 seconds
├── Scope: Prevents multiple ASGI replicas from sweeping expired sessions simultaneously.
└── Failure Behavior: Skip sweep cycle.

lock:scheduler:contest_sweeper
├── TTL: 25 seconds
├── Scope: Prevents duplicate auto-start / auto-finish sweeps.
└── Failure Behavior: Skip sweep cycle.
```

---

## 4. Idempotency Strategy

Every asynchronous operation is designed under an **at-least-once processing** guarantee:

1. **Idempotency Keys (`ccc:idempotency:{key}`)**:
   - For code submissions: `key = sub:{contest_slug}:{problem_id}:{member_id}:{hash(code)}`
   - Stored in Redis with a 60-second TTL. If a student double-clicks the "Submit" button, the second request detects the existing key and returns the initial `job_id`.
2. **Database Unique Constraints**:
   - `contest_registrations`: `UniqueConstraint("contest_id", "member_id")`
   - `rating_history`: `UniqueConstraint("contest_id", "member_id")`
   - `campus_passes`: `UniqueConstraint("contest_id", "member_id")` and `UniqueConstraint("contest_id", "seat_number")`
3. **State Transition Guards**:
   - Contest state transitions follow strict monotonically increasing order:
     $$\text{upcoming} \longrightarrow \text{live} \longrightarrow \text{finished}$$
   - Any worker attempting to transition a contest that is already `finished` immediately exits with a safe no-op.
