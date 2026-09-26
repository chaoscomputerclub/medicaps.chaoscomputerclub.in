# Worker Architecture & Execution Pipeline

## Chaos Computer Club — Medi-Caps Chapter Backend

---

## 1. Core Worker Principles

1. **Independent from HTTP Controllers**: Workers operate as standalone asynchronous consumer loops. They do not depend on HTTP request contexts, headers, or Starlette request objects.
2. **Thin Worker Shell**: Workers contain **zero direct business logic**. They strictly deserialize, validate, invoke the authoritative domain application service (`DynamicContestService`, `ContestExecutionService`, `OtpService`), handle retries/exceptions, record results, and acknowledge completion.
3. **Stateless Scalability**: Workers maintain no local in-memory business state. Any worker can execute any job from its assigned domain queue.
4. **Isolated Resource Pools**: High-CPU compilation workers (`judge`) run in separate concurrency pools from I/O-bound workers (`email`, `webhooks`), preventing expensive GCC compilations from delaying urgent student OTP delivery.

---

## 2. Standardized Worker Execution Pipeline

Every worker loop executes through an 8-stage pipeline:

```
  ┌─────────────────┐
  │ 1. Dequeue/Lease│ Atomic RPOPLPUSH / BLMOVE to processing list
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ 2. Validate Job │ Schema verification, version match, payload integrity
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ 3. Execute Svc  │ Invoke domain service (e.g. ContestExecutionService)
  └────────┬────────┘
           │
     ┌─────┴───────────────┐
  [Success]             [Failure]
     │                     │
     ▼                     ▼
┌──────────────┐    ┌──────────────────────┐
│ 4. Record OK │    │ 5. Classify & Retry  │ Retryable?
└──────┬───────┘    │    or Route to DLQ   │ Exponential backoff + jitter
       │            └──────────┬───────────┘
       │                       │
       ▼                       ▼
┌──────────────┐    ┌──────────────────────┐
│ 6. ACK / Rem │    │ 7. NACK / Re-queue   │
└──────┬───────┘    └──────────┬───────────┘
       │                       │
       └───────────┬───────────┘
                   │
                   ▼
         ┌───────────────────┐
         │ 8. Emit Logs/Stats│ Structured JSON log + Prometheus/Redis metrics
         └───────────────────┘
```

### Detailed Pipeline Stages:

1. **Atomic Lease (`BLMOVE` / `BRPOPLPUSH`)**:
   - The worker requests the next job from `ccc:queue:{name}:pending`.
   - Atomically transitions the job ID to `ccc:queue:{name}:processing`.
   - Sets the job status in `ccc:job:{id}` to `processing` and marks `started_at = now()`.
2. **Payload & Identity Validation**:
   - Parses the JSON job contract. Verifies version compatibility.
   - Ensures required entity IDs (`member_id`, `problem_id`) are present.
3. **Domain Service Invocation**:
   - Instantiates a clean scoped async database session (`AsyncSessionLocal()`).
   - Delegates directly to domain logic:
     - `JudgeWorker` $\rightarrow$ `ContestExecutionService.evaluate_submission_job(db, payload)`
     - `EmailWorker` $\rightarrow$ `OtpService.send_otp_email_job(payload)`
     - `ContestLifecycleWorker` $\rightarrow$ `DynamicContestService.finalize_ratings_job(db, payload)`
4. **Error Classification**:
   - Catches exceptions and classifies into:
     - **`RetryableError`**: Network timeouts, database lock deadlocks, transient 5xx responses from external APIs.
     - **`NonRetryableError`**: Invalid user code, malformed inputs, business constraint violations (e.g. student already submitted).
5. **Intelligent Retry & Backoff**:
   - If retryable and `attempt < max_retries`: calculates delay with exponential backoff and randomized jitter:
     $$T_{\text{delay}} = (\text{backoff\_base} \times 2^{\text{attempt}}) + \text{uniform}(0, 1.0)$$
   - Re-inserts into `ccc:queue:{name}:delayed` (Redis Sorted Set keyed by execution timestamp).
6. **Dead-Letter Routing**:
   - If `attempt >= max_retries` or error is non-retryable, pushes job to `ccc:queue:{name}:dlq`.
   - Records comprehensive error trace and metadata in the job hash.
7. **Acknowledgment (`ACK`)**:
   - Removes job from `ccc:queue:{name}:processing`.
   - Updates `ccc:job:{id}` status to `completed` or `failed` with execution duration.
8. **Structured Telemetry & Log Emission**:
   - Emits a structured JSON log containing `queue_name`, `job_type`, `job_id`, `correlation_id`, `duration_ms`, and `status`.

---

## 3. Worker Implementations

```
workers/
├── base_worker.py        # Generic abstract async worker with lifecycle hooks
├── email_worker.py       # Processes 'email' queue (SMTP dispatch)
├── judge_worker.py       # Processes 'judge' queue (CodeBox sandbox execution)
├── contest_worker.py     # Processes 'contest_lifecycle' queue (Elo & qualification)
└── webhook_worker.py     # Processes 'webhooks' queue (Outbound HTTP events)
```

### Example: `JudgeWorker` Architecture
```python
class JudgeWorker(BaseQueueWorker):
    queue_name = "judge"
    default_concurrency = 4

    async def process_job(self, job: JobContract, db: AsyncSession) -> Dict[str, Any]:
        if job.job_type == "EVALUATE_ARENA_SUBMISSION":
            return await ContestExecutionService.evaluate_submission_async(
                submission_id=job.payload["submission_id"],
                db=db,
            )
        elif job.job_type == "EVALUATE_ASSESSMENT_SUBMISSION":
            return await AssessmentExecutionService.evaluate_submission_async(
                submission_id=job.payload["submission_id"],
                db=db,
            )
        raise NonRetryableError(f"Unknown job_type '{job.job_type}' for judge queue.")
```

---

## 4. Graceful Shutdown & Signal Handling

Workers must never abort mid-execution during deployments or container restarts:

1. **Signal Interception**:
   - Intercepts `SIGINT` (Ctrl+C) and `SIGTERM` (Docker / Kubernetes shutdown).
2. **Drain Period**:
   - Flips `is_running = False` immediately; stops accepting new jobs from `pending`.
   - Active in-flight jobs are granted a **15-second grace window** to finish and commit their transactions.
3. **Lease Evacuation**:
   - Any job unable to complete within the grace window has its processing lease safely evacuated back to the pending queue for re-delivery.
4. **Connection Teardown**:
   - Closes PostgreSQL asyncpg pools, Redis client connections, and HTTP client sessions cleanly.
