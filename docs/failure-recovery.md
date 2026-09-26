# Failure Recovery, Dead-Letter Queue & Outbox Pattern

## Chaos Computer Club — Medi-Caps Chapter Backend

---

## 1. Failure Modes & Recovery Matrix

| Failure Mode | Direct Symptom | Automatic Recovery Strategy | Data Loss Risk |
| :--- | :--- | :--- | :--- |
| **Worker Process Crash (SIGKILL / OOM)** | Job is left in `ccc:queue:{name}:processing` | Recovery sweeper detects abandoned lease ($> 5\text{ min}$) $\rightarrow$ re-enqueues to `pending` | **ZERO** (Lease lease-recovery pattern) |
| **Redis Broker Crash / Restart** | Queue and active jobs temporarily unreachable | Worker reconnection loop with exponential backoff (1s $\rightarrow$ 30s). Redis AOF persistence restores queues | **ZERO** (AOF `appendfsync everysec`) |
| **PostgreSQL Connection Spike / Outage** | Worker receives `asyncpg.exceptions.ConnectionDoesNotExistError` | Error classified as `RetryableError`. Job backoff with randomized jitter $\rightarrow$ re-attempts | **ZERO** (Transaction rolls back, job re-queued) |
| **External SMTP Outage / Rate Limit** | Worker receives `SMTPConnectError` or 421 response | Backoff delay escalates (2s $\rightarrow$ 8s $\rightarrow$ 30s). After 3 attempts $\rightarrow$ routes to `ccc:queue:email:dlq` | **ZERO** (Preserved in DLQ for replay) |
| **Malicious or Syntax-Corrupt Student Code** | Compiler returns non-zero error or syntax crash | Classified as **`NonRetryableError`**. Recorded as `COMPILE_ERROR` verdict. Acknowledged immediately | **ZERO** (Intended domain result) |
| **Rolling Deployment During Active Job** | In-flight worker receives `SIGTERM` | Graceful shutdown gives 15s window to finish. If unfinished, lease evacuated back to `pending` queue | **ZERO** (Picked up by new worker container) |

---

## 2. Dead-Letter Queue (DLQ) Architecture

Jobs that fail repeatedly or encounter unrecoverable system faults are never discarded into void logs. They are preserved in the domain's **Dead-Letter Queue (`ccc:queue:{name}:dlq`)**.

```
              ┌──────────────────────────────────────────────┐
              │               Main Domain Queue              │
              └──────────────────────┬───────────────────────┘
                                     │
                                     ▼
                              [Job Execution]
                                     │
                             Failure Occurs?
                             (Attempt < Max)
                                     │
                       ┌─────────────┴─────────────┐
                    [Yes]                         [No]
                       │                           │
                       ▼                           ▼
            Calculate Backoff + Jitter       Push to DLQ:
            Re-insert into Delayed ZSET   ccc:queue:{name}:dlq
                                                   │
                                                   ▼
                                       ┌───────────────────────┐
                                       │ Admin DLQ Inspection  │
                                       │   & Manual Replay     │
                                       └───────────────────────┘
```

### DLQ Job Record Metadata
Every dead-lettered job stores:
1. `job_id`: Unique tracking UUID
2. `queue_name`: Originating domain queue
3. `job_type`: Specific task command
4. `payload`: Original sanitized parameters
5. `failed_at`: ISO timestamp of terminal failure
6. `total_attempts`: Count of executed attempts
7. `error_summary`: Exception class and primary reason
8. `error_stack`: Sanitized traceback (credentials and tokens stripped)
9. `correlation_id`: Original HTTP request tracing ID

### DLQ Replay Mechanism
The platform provides administrative APIs to inspect and replay failed DLQ jobs once the underlying external cause (e.g. SMTP server recovery or network patch) is resolved:

```http
POST /api/admin/jobs/{queue_name}/dlq/{job_id}/replay
Authorization: Bearer <ADMIN_JWT_TOKEN>
```
1. Verifies caller has Admin or Core role.
2. Atomically removes `job_id` from `ccc:queue:{name}:dlq`.
3. Resets `attempt = 0`, clears `error`, and pushes back into `ccc:queue:{name}:pending`.
4. Emits audit log to track the administrator who authorized the replay.

---

## 3. Transaction + Queue Consistency: The Outbox Pattern

A classic distributed systems flaw occurs when an operation modifies the database and then publishes to a queue:
- If the database commit succeeds but Redis publishing fails, the job is lost forever.
- If the queue publish succeeds but the database transaction fails, the worker executes a ghost job.

### Dual Strategy for Consistency:

```
               TRANSACTIONAL OUTBOX PATTERN (For Critical Events)
  Application
       │
       ▼
  Database Transaction 
       ├── Business Record (e.g. OfflineContest state -> 'finished')
       └── Outbox Record (`outbox_events` table)
               │ (ACID Commit)
               ▼
       Outbox Publisher (Background Async Task)
               │ (Reads pending outbox records)
               ▼
       Chaos Redis Queue (`ccc:queue:contest_lifecycle:pending`)
               │ (ACK received)
               ▼
       Mark Outbox Record as `PUBLISHED`
```

1. **For High-Volume, Non-ACID Tasks (Submissions & Webhooks)**:
   - The queue publish occurs immediately after commit.
   - Idempotency keys protect against duplicate processing.
2. **For Critical System Events (Contest Lifecycle & Certificate Trust Proofs)**:
   - An `OutboxEvent` row is written inside the **same database transaction** as the business mutation.
   - An asynchronous outbox relay polls the `outbox_events` table and guarantees at-least-once delivery into Redis.
