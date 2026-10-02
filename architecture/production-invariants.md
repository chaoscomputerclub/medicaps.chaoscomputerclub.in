# Production System Architecture & Core Invariants
## Chaos Computer Club Medi-Caps Chapter — Dynamic Application & Compute Fabric

---

### 1. The Core Architectural Thesis

> **The Cloud VPS is the authoritative control plane and immutable source of truth.**  
> **Portable machines (laptops, lab desktops) are outbound-only, disposable compute workers.**

Portable nodes are **never** treated as public web servers, edge proxies, or incoming gateway endpoints. They do not run ingress tunnels, expose public ports, or handle browser user sessions. If a laptop loses Wi-Fi, runs out of battery, or is disconnected, **the platform remains fully operational**—only transient worker capacity fluctuates.

---

### 2. The Four Pillars of Authority

```
┌────────────────────────────────────────────────────────────────────────┐
│                        1. POSTGRESQL 16                                │
│                     [AUTHORITATIVE STATE]                              │
│  Users, Contests, Submissions, Problems, Scoreboard, Registered Nodes  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────┴─────────────────────────────────────┐
│                          2. REDIS 7                                    │
│                     [COORDINATION PLANE]                               │
│  Job Queues, Distributed Leases, Advisory Locks, Real-Time SSE Streams │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────┴─────────────────────────────────────┐
│                         3. FASTAPI CONTROL                             │
│                     [ORCHESTRATION PLANE]                              │
│  Auth, Submission Lifecycle, Turnstile QR Verification, State Machine  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │  (Outbound HTTPS/TLS Claim Channel)
┌──────────────────────────────────┴─────────────────────────────────────┐
│                      4. GO NODE AGENT (DAEMON)                         │
│                     [DISPOSABLE COMPUTE PLANE]                         │
│  Hardware Discovery, Resource Governor, Ephemeral Docker Sandboxes     │
└────────────────────────────────────────────────────────────────────────┘
```

| Subsystem | Technology | Authority & Primary Responsibilities |
|---|---|---|
| **Authoritative State** | **PostgreSQL 16** | Immutable truth: Cadet profiles, contest timetables, problem definitions, final verdicts, verified audit trail, permanent scoreboards. |
| **Coordination Plane** | **Redis 7** | Ephemeral coordination: Distributed FIFO queues (`ccc:queue:fabric:*`), job lease TTLs, distributed mutexes, SSE pub/sub relays, live node hardware telemetry. |
| **Control Plane** | **FastAPI (Python 3.12)** | Ingress brain: User auth/OTP, CSRF/Cookie security, contest state transitions, submission queuing, node registration, SSE streaming, admin API. |
| **Compute Plane** | **Go Node Agent** | Disposable execution: Outbound job pulling, local thread/memory governance, RAM-backed Docker containers (`tmpfs`), strict cgroup isolation, result reporting. |

---

### 3. Three Separate Scheduling & Routing Domains

To avoid architectural entanglement, the system strictly isolates three separate scheduling layers:

```
[1. HTTP / Web Load Balancing]
Cadet Browser ──► Cloudflare Edge (WAF/DDoS) ──► Cloudflare Tunnel ──► Nginx ──► FastAPI Cluster

[2. Global Judge Queue Scheduling]
FastAPI Ingress ──► Redis Queue (ccc:queue:fabric:pending) ──► Outbound Claim ──► Compute Nodes

[3. Local Node Worker Scheduling]
Go Node Agent ──► Resource Governor (CPU/RAM/Slots) ──► Worker Semaphore ──► Ephemeral Docker
```

1. **HTTP / Web Load Balancing**:
   - Manages student browser traffic, assets, and API requests.
   - Handled exclusively at the edge by **Cloudflare + Cloudflare Tunnel + Nginx**.
   - Student browsers **never** communicate directly with compute laptops.

2. **Global Judge Queue Scheduling**:
   - Manages asynchronous code execution submissions.
   - Enqueued by FastAPI into Redis `ccc:queue:fabric:pending`.
   - Compute nodes atomically claim jobs via outbound HTTPS without knowing or caring about user sessions.

3. **Local Node Worker Scheduling**:
   - Runs locally inside each node's Go daemon.
   - The **Resource Governor** monitors real-time CPU thermal headroom and available RAM.
   - Dispatches jobs into pre-allocated Docker containers with strict memory limits (`tmpfs`, `--cpus`, `--memory`).

---

### 4. Distributed Job Reliability: Lease & Reaper Protocol

Jobs cannot be lost or permanently stalled due to laptop hardware failures, network disconnections, or OS crashes.

```
                          ccc:queue:fabric:pending
                                     │
                                     │ POST /api/v1/nodes/claim
                                     ▼
                     ccc:queue:fabric:processing
                                     │
                     ┌───────────────┴───────────────┐
                     │ Distributed Lease Initialized │
                     │ ccc:job:{id}:leased_at (300s) │
                     │ ccc:job:{id}:node_id          │
                     └───────────────┬───────────────┘
                                     │
                     ┌───────────────┴───────────────┐
                     ▼                               ▼
            [NORMAL EXECUTION]               [NODE DISCONNECT / CRASH]
                     │                               │
        POST /api/v1/nodes/result            Lease expires (> 300s)
                     │                               │
       ┌─────────────┴─────────────┐                 ▼
       │ 1. lrem processing        │          REAPER PROTOCOL
       │ 2. delete leased_at       │          (Maintenance Worker)
       │ 3. mark job COMPLETED     │                 │
       │ 4. publish SSE completion │          ┌──────┴──────────────┐
       └───────────────────────────┘          │ 1. lrem processing  │
                                              │ 2. delete leased_at │
                                              │ 3. reset to QUEUED  │
                                              │ 4. rpush to pending │
                                              └──────┬──────────────┘
                                                     ▼
                                            Claimed by Node B or
                                            Cloud Worker
```

1. **Atomic Claim**:
   Node issues `POST /api/v1/nodes/claim`. Redis pops the job ID from `pending` to `processing` (`RPOPLPUSH`).
2. **Lease Attachment**:
   A distributed lease is attached with an epoch timestamp (`ccc:job:{id}:leased_at`) and an expiration TTL of 300 seconds.
3. **Heartbeat Extension**:
   For long multi-testcase jobs, the Go agent extends the lease every 30 seconds via `POST /api/v1/nodes/heartbeat`.
4. **Reaper Sentinel**:
   The Cloud Maintenance Worker periodically runs `RedisQueueEngine.reap_orphaned_jobs()`. If a node disconnects, its lease expires, and the Reaper automatically resets the job state to `QUEUED` and returns it to `pending`.

---

### 5. Automatic Node Lifecycle (Plug-and-Play)

Compute nodes are designed for zero-configuration, plug-and-play operation:

```
[PLUG IN USB / BOOTSTRAP]
        │
        ▼
   Prober probes hardware (CPU logical cores, physical RAM, NVMe)
        │
        ▼
   Docker Daemon health check verified
        │
        ▼
   POST /api/v1/nodes/register (Sends hardware fingerprint & capabilities)
        │
        ▼
   Node state becomes READY in Redis (ccc:node:{id}:info)
        │
        ▼
   Begins continuous pull loop (POST /api/v1/nodes/claim)
        │
        ├──► If disconnected (Wi-Fi drop / USB removed):
        │    1. Heartbeat key ccc:node:{id}:heartbeat expires (TTL 30s)
        │    2. Global scheduler flags node as SUSPECT -> OFFLINE
        │    3. Active job leases expire -> Reaper requeues jobs to healthy nodes
        │
        └──► If reconnected:
             1. Node registers or resumes heartbeats
             2. Transition back to READY without manual admin intervention
```

---

### 6. Origin Hardening & Perimeter Security Invariants

1. **Zero Direct Origin Access**:
   The Cloud VPS firewall (`ufw`) strictly blocks incoming connections on ports 80, 443, 5432, and 6379 from the public internet. All traffic enters solely through **Cloudflare Tunnel (`cloudflared`)**.
2. **Same-Origin Student Web Flow**:
   Browsers visit `https://medicaps.chaoscomputerclub.in`. Static assets are served directly; API calls route via `/api/*` to FastAPI. This preserves first-party cookie isolation and completely eliminates CORS overhead.
3. **Dedicated Infrastructure Channel**:
   Machine-to-machine traffic (Go agents, judge workers, CI/CD, admin tools) addresses `https://medicaps-api.chaoscomputerclub.in` with bearer token or HMAC cryptographic authentication.
4. **Strict Isolation of Data Engines**:
   PostgreSQL 16 and Redis 7 listen only on `127.0.0.1` and are never reachable outside the VPS localhost boundary.

---

### 7. Execution Safety & Fencing Invariant

> **EXECUTION SAFETY INVARIANT**
> 
> "No execution provider or node may finalize a submission unless its `attempt_id` matches the currently authoritative `active_attempt_id` for that job.
> 
> Node crash or network delay must never cause:
> - duplicate authoritative results
> - stale result overwrites
> - unbounded fallback fan-out
> - uncontrolled Codebox saturation
> - loss of PostgreSQL submission state
> - scoreboard corruption."

Key Mechanisms:
1. **Durable Attempt Models**: Every execution is recorded in PostgreSQL (`judge_jobs` and `judge_job_attempts`) with a strictly managed `active_attempt_id`.
2. **Atomic Result Fencing**: Results are committed conditionally:
   ```sql
   UPDATE judge_jobs
   SET state = 'COMPLETED', active_attempt_id = NULL
   WHERE id = :job_id AND active_attempt_id = :attempt_id;
   ```
   If 0 rows update, the result is rejected as `STALE_ATTEMPT` or `DUPLICATE_RESULT`.
3. **Event-Driven Bounded Admission**: Codebox fallback avoids polling spin-loops, using non-blocking Lua permit checks and deterministic grant key signaling (`BLPOP`) with bounded capacity.
4. **Sliding-Window Circuit Breakers**: Codebox circuit breaker tracks infrastructure failures within a sliding 60-second time window (ignoring user code errors like WA/TLE/MLE) and transitions `CLOSED -> OPEN -> HALF-OPEN -> CLOSED`.
5. **Reconciliation Engine**: Background worker detects orphaned jobs, verifies lease timestamps, records `EXECUTION_REQUEUE` in the Transactional Outbox within PostgreSQL, and expires dead attempts without dual-write races.

---

### 8. Transactional Outbox Architecture

To prevent Redis/PostgreSQL dual-write divergence:
1. Every domain mutation (verdict finalization, contest lifecycle transition, rating update, execution requeue) commits business state and inserts an `outbox_events` record within the **SAME PostgreSQL transaction**.
2. PostgreSQL transaction commits.
3. The background **Outbox Relay** polls pending outbox events with row-level advisory locking (`FOR UPDATE SKIP LOCKED`), dispatches them idempotently to Redis (pub/sub, SSE, or fabric queue), and marks them `DELIVERED`.
4. If Redis is temporarily down, PostgreSQL state remains fully intact, and events are delivered immediately upon Redis recovery with zero event loss.

---

### 9. Capability-Aware Node Scheduling & Slot Governance

Nodes advertise hardware capabilities on registration (`POST /api/v1/nodes/register`):
- `languages`: e.g. `["python", "cpp", "java", "javascript"]`
- `architecture`: e.g. `x86_64` / `arm64`
- `available_slots`: centralized integer bound based on CPU logical cores and RAM
- `draining`: boolean drain flag

Scheduler Guarantees:
- Jobs requiring specific language runtimes are partitioned into language-specific queues (`ccc:queue:fabric:pending:{lang}`).
- In `POST /api/v1/nodes/claim`, nodes atomically pop only from queues matching their advertised language set.
- Nodes with `available_slots <= 0` or status `draining` are rejected from claiming new work.
- Atomic slot decrement occurs upon claim, and slot restoration occurs upon result finalization.

---

### 10. Canonical Contest State Machine & Scoreboard Atomicity

Contests transition through five deterministic states:
```
UPCOMING  ──►  LIVE  ──►  DRAINING  ──►  FINALIZING  ──►  COMPLETED
```
- **LIVE**: Submissions accepted and judged.
- **DRAINING**: Contest duration has expired; `assert_submissions_open()` strictly blocks new submissions with HTTP 422, while existing in-flight jobs are permitted to complete.
- **FINALIZING**: Scoreboard recalculation and anti-cheat audit.
- **COMPLETED**: Final ratings computed and committed atomically alongside outbox events (`ratings_updated`, `leaderboard_updated`). Rating finalization is strictly idempotent and prevented from running twice.

---

### 11. Production Observability & Metrics

Prometheus exposition via `/metrics`:
- `ccc_judge_attempts_total{provider, status}`: Execution attempts by provider and outcome.
- `ccc_judge_stale_results_total`: Count of rejected stale attempts.
- `ccc_circuit_breaker_state{provider}`: Current state (0 = CLOSED, 1 = HALF_OPEN, 2 = OPEN).
- `ccc_outbox_events_total{event_type, status}`: Outbox delivery and relay telemetry.
- `ccc_node_active_count`, `ccc_node_available_slots`: Distributed fabric cluster capacity.

