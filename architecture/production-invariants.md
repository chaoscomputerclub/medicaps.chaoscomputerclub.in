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
