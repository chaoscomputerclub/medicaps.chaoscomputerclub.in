# Queue Strategy & Job Contract Specification

## Chaos Computer Club — Medi-Caps Chapter Backend

---

## 1. Domain Queue Topology

Queues are partitioned strictly by **domain responsibility and resource profile**, rather than creating dozens of unmanageable micro-queues.

```
queues/
├── email/              # Transactional authentication OTPs & student notices
├── judge/              # Sandboxed code execution (Arena & Screening assessments)
├── contest_lifecycle/  # Final ratings, Top-30 qualification, dynamic contest clones
├── webhooks/           # Outbound third-party webhook HTTP notifications
└── maintenance/        # QA test simulations, database cleanups, cache warming
```

### Queue Characteristics & Service Level Objectives (SLOs)

| Queue Name | Primary Workload | Target Latency | Concurrency Limit | Failure Policy |
| :--- | :--- | :--- | :--- | :--- |
| `email` | SMTP verification emails | P95 $< 1500\text{ ms}$ | 5 concurrent | 3 retries, exponential backoff (2s, 8s, 30s) $\rightarrow$ DLQ |
| `judge` | Code compilation & test runs | P95 $< 2500\text{ ms}$ | 4 concurrent | Non-retryable on user code errors; retry only on sandbox crash |
| `contest_lifecycle` | Standings re-ranking & Elo math | P95 $< 5000\text{ ms}$ | 2 concurrent | Distributed lock per contest; 2 retries on DB serialization failure |
| `webhooks` | Outbound HTTP event delivery | P95 $< 2000\text{ ms}$ | 5 concurrent | 5 retries with jitter; drop permanently on HTTP 4xx |
| `maintenance` | Deep-dive QA audits, simulations | P95 $< 30000\text{ ms}$ | 1 concurrent | Single retry; isolated low-priority pool |

---

## 2. Job Contract Specification

Every queue message adheres to a standardized, serializable, version-controlled JSON contract.

### Contract Schema (`JobContract`)

```json
{
  "id": "e4b2d5a1-7c98-4b21-8273-0f7e4a7d3c29",
  "queue_name": "judge",
  "job_type": "EVALUATE_ARENA_SUBMISSION",
  "version": 1,
  "payload": {
    "submission_id": "c1f6b158-6ef8-470f-90e6-7b2de135d10a",
    "contest_slug": "weekly-challenge-42",
    "problem_id": "8f3b6121-6679-4d6d-8bc4-9d414e040aa2",
    "member_id": "5a27f677-2f16-4a44-a032-4753063f64c1",
    "language": "cpp",
    "code": "#include <iostream>...",
    "time_limit": 2.0,
    "memory_limit": 256
  },
  "created_at": "2026-09-27T02:30:00.000000Z",
  "updated_at": "2026-09-27T02:30:00.000000Z",
  "attempt": 1,
  "max_retries": 2,
  "backoff_base_seconds": 2.0,
  "priority": "HIGH",
  "correlation_id": "req-98f21a8d-cf42",
  "idempotency_key": "sub:weekly-challenge-42:prob-A:cadet_123:v1",
  "status": "queued",
  "error": null,
  "result": null
}
```

### Design Principles for Job Payloads:
1. **Pass IDs & References, Not Huge Graphs**: Store entity IDs (`submission_id`, `contest_id`, `member_id`). Workers fetch fresh entity state from the database at execution time to avoid stale data anomalies.
2. **Deterministic Versioning**: Every job contract specifies `"version": 1`. When schema evolutions occur, workers support schema migration pathways.
3. **Correlation ID Tracking**: Every job preserves the originating client's `X-Request-ID` or generates a unique correlation ID (`req-<uuid>`), propagating it across worker logs and downstream database queries.
4. **Idempotency Keys**: A deterministic key (`idempotency_key`) is computed prior to enqueueing to eliminate duplicate jobs caused by rapid client double-clicks or network retries.

---

## 3. Supported Job Types by Domain

### 1. `email` Queue
- **`SEND_OTP_EMAIL`**:
  - `to_email`: string (strictly `@medicaps.ac.in`)
  - `otp_code`: 6-digit numeric token
  - `app_name`: string

### 2. `judge` Queue
- **`EVALUATE_ARENA_SUBMISSION`**:
  - `submission_id`: UUID
  - `contest_slug`: string
  - `problem_id`: UUID
  - `member_id`: UUID
  - `language`: string (`cpp`, `python`, `java`, `javascript`)
  - `code`: string (sanitized)
- **`EVALUATE_ASSESSMENT_SUBMISSION`**:
  - `session_id`: UUID
  - `problem_id`: UUID
  - `member_id`: UUID
  - `language`: string
  - `code`: string

### 3. `contest_lifecycle` Queue
- **`FINALIZE_CONTEST_RATINGS`**:
  - `contest_slug`: string
  - `trigger_reason`: string (`"admin_action"` or `"auto_finish_sweeper"`)
- **`QUALIFY_TOP_30_SWEEP`**:
  - `contest_slug`: string
- **`CLONE_CONTEST_BLUEPRINT`**:
  - `source_slug`: string
  - `new_slug`: string
  - `new_title`: string

### 4. `webhooks` Queue
- **`DISPATCH_OUTBOUND_WEBHOOK`**:
  - `target_url`: string
  - `event_type`: string
  - `payload`: dictionary
  - `signature_secret`: optional HMAC secret

---

## 4. Backpressure & Queue Depth Governance

To prevent memory bloat or cascading database saturation during peak contest submission rushes:

```
                            BACKPRESSURE MECHANISM
                     Incoming Job
                          │
                          ▼
            Is Queue Depth > MAX_QUEUE_DEPTH?
             (e.g., judge queue > 500 jobs)
                    │                │
             [Yes]  │                │ [No]
                    ▼                ▼
            Return HTTP 429     Push to Redis
          "Judge Overloaded,      ccc:queue:judge:pending
           Retry in 5s"
```

1. **Queue Depth Thresholds**:
   - `judge`: 500 maximum queued submissions.
   - `email`: 1,000 maximum queued emails.
   - `webhooks`: 2,000 maximum queued webhooks.
2. **Backpressure Response**:
   When the queue depth exceeds capacity, the producer immediately rejects with `HTTP 429 Too Many Requests` and a `Retry-After: 5` header, protecting downstream compute and database connection pools.
3. **Queue TTL & Cleanup**:
   Completed job hashes expire after **24 hours** (`86400` seconds). Dead-letter entries are retained for **7 days** (`604800` seconds) for administrative auditing and replay.
