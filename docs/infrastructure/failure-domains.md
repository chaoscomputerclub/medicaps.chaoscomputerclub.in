# CCC Medi-Caps — Failure Domains & Resilience Analysis

> **Operational Standard**: Systems will fail. The architecture must guarantee that any failure leaves authoritative business state intact, uncorrupted, and automatically recoverable.

---

## 1. Comprehensive Failure Mode Matrix

| Failure Mode | Direct System Impact | Automated Detection Mechanism | Automatic Mitigation & Self-Healing | Authoritative Invariant Preserved |
|---|---|---|---|---|
| **Vercel Edge Unavailable** | New page loads fail; active tabs retain loaded SPA | Cloudflare synthetic health probe | Cloudflare DNS failover can repoint to fallback origin | No backend data impact |
| **Cloudflare Worker Error** | Edge proxying fails | Cloudflare analytics & 5xx alerts | Requests bypass to Cloud Run custom domain directly | Zero state mutation |
| **Cloud Run Instance Crash** | In-flight HTTP request drops | Cloud Run health check failure | Cloud Run autoscaler immediately spawns replacement container; client retries with jitter | Transactional boundaries ensure no half-committed SQL |
| **Cloud Run Autoscaling Storm** | Connection surge towards database | PostgreSQL active connection count | Bounded connection pools (`pool_size=3`, `max_overflow=2`) prevent pooler exhaustion | Supabase pooler stays within 200 connection limit |
| **Redis Restart / Memory Purge** | Ephemeral queues, locks, and replay buffers dropped | `redis.exceptions.ConnectionError` | Re-established on reconnect; `ReconciliationWorker` scans PostgreSQL for unfinalized `QUEUED`/`PROCESSING` jobs and re-enqueues them; Outbox re-broadcasts un-relayed events | **PostgreSQL contains complete authoritative state**; zero lost points, submissions, or accounts |
| **Redis Complete Outage** | Queueing, rate limiting, and SSE relay disabled | Circuit breaker opens | System switches to synchronous local processing or safe backpressure (HTTP 503); DB writes remain protected | Database integrity never bypassed |
| **SSE Disconnect / Network Drop** | Realtime stream severed on client | Browser `EventSource.onerror` event | Client initiates exponential reconnect (1s–30s); presents `Last-Event-ID` header; server replays missed events from circular Redis buffer or signals `resync_required` for snapshot refetch | No missing scoreboard or submission status updates |
| **Supabase Transient Network Drop** | Database queries fail | asyncpg `ConnectionDoesNotExistError` | Short retry with backpressure; uncommitted transactions roll back automatically | ACID transactions prevent partial writes |
| **Judge Node Offline / Disconnect** | Worker stops polling `claim` | Node heartbeat key `ccc:node:<id>:heartbeat` expires (30s) | Node removed from active registry set; scheduler skips node | No new jobs assigned to dead node |
| **Judge Node Crash Mid-Job** | In-flight job attempt uncompleted | Active lease `ccc:lease:<job_id>` expires | `ReconciliationWorker` detects expired lease on `STARTED` job; increments `attempt_number`; requeues job to fabric | Job re-executed by another healthy node |
| **Compiler Crash (OOM / Segfault)** | Compiler emits non-zero returncode | Process exit status != 0 | Marked as `COMPILATION_ERROR`; compiler stderr captured; execution halts before running testcases | Telemetry accurately records `compile_time_ms` and error details |
| **Testcase Container Crash / Escape Attempt** | Container terminated by Docker cgroups | Exit code 137 (OOM) or seccomp violation | Mapped to `MEMORY_LIMIT_EXCEEDED` or `RUNTIME_ERROR`; sandboxed process cleaned up | Host filesystem and kernel untouched |
| **Submission Timeout (TLE)** | Process runs indefinitely | `ExecutionDeadlineTracker` watchdog timeout | `SIGKILL` sent to container; verdict recorded as `TIME_LIMIT_EXCEEDED` | Worker thread unblocked; slots freed |
| **Stale Lease / Late Result Submission** | Node reports result after lease expired and new attempt already launched | AttemptManager checks active attempt ID vs reported lease ID | CAS check rejects stale lease; returns `STALE_ATTEMPT_IGNORED` | Stale results never overwrite newer attempts |
| **Duplicate Job Enqueued** | Job placed twice into Redis queue | Redis `SET NX` or DB unique constraint on `submission_id` | Second execution finds existing job/attempt; deduplicated harmlessly | Zero duplicate submissions or points |
| **Browser Refresh During Submission** | User refreshes tab while submission is judging | Browser page reloads | SWR queries `GET /api/contests/{slug}/arena/submissions` or SSE reconnects with `Last-Event-ID`; latest verdict retrieved | State seamlessly restored |
| **User Opens Multiple Tabs** | Multiple concurrent SSE streams for same user | Global SSE multiplexer across tabs / unique subscriber queues | Backpressure queues handle fanout; SWR cache coordinates updates | Zero cross-tab state divergence |
