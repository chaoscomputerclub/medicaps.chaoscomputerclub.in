# CCC Peer-to-Peer Distributed Service Fabric
## Architectural Specification & Master Contract

---

### 1. The Core Architectural Thesis

> **Every compute instance is a peer. Providers are merely locations where peers happen to run.**  
> There is **NO single control plane**, **NO single application server**, **NO provider required for normal operation**, and **NO centralized service discovery server required for basic operation.**  
> There is **one authoritative business data model** (PostgreSQL 16) and **shared ephemeral coordination** (Redis 7), but compute is fully federated.

Providers (Google Cloud Run, Render, Railway, Fly.io, Koyeb, Northflank, VPS, student laptops, gaming rigs) can be **added or removed dynamically without changing the application's logical architecture, database schemas, or frontend interfaces.**

---

### 2. Level 1 Architecture: Ingress, Data Plane & Federated Peers

```mermaid
graph TD
    User["Cadet / Proctor Browser"] -->|HTTPS| Cloudflare["Cloudflare Edge (DNS / WAF / DDoS)"]
    Cloudflare -->|Fast Route| CFWorker["Cloudflare Worker (Ultra-Lightweight Ingress Proxy)"]
    
    subgraph DataPlane ["Stateless Data-Plane Router Fabric"]
        CFWorker -->|Failover Pool| RouterA["Nginx Router Peer 01"]
        CFWorker -.->|Backup Pool| RouterB["Nginx Router Peer 02"]
    end
    
    subgraph ComputePeers ["Federated Compute Peer Fabric"]
        RouterA -->|HTTP / API| PeerA["Peer A (Cloud Run: API + Worker)"]
        RouterA -->|HTTP / API| PeerB["Peer B (Render: API)"]
        RouterA -->|HTTP / API| PeerC["Peer C (Railway: API + Realtime)"]
        RouterA -->|HTTP / API| PeerD["Peer D (Koyeb / VPS: API)"]
    end
    
    subgraph SharedState ["Authoritative State & Ephemeral Coordination"]
        PeerA <-->|ACID Transactions / CAS| Postgres[("PostgreSQL 16 (Authoritative State)")]
        PeerB <-->|ACID Transactions / CAS| Postgres
        PeerC <-->|ACID Transactions / CAS| Postgres
        PeerD <-->|ACID Transactions / CAS| Postgres
        
        PeerA <-->|Queues / Leases / PubSub| Redis[("Redis 7 (Coordination Plane)")]
        PeerB <-->|Queues / Leases / PubSub| Redis
        PeerC <-->|Queues / Leases / PubSub| Redis
        PeerD <-->|Queues / Leases / PubSub| Redis
    end
    
    subgraph ExecutionFabric ["Judge & Compute Execution Peers"]
        Redis <-->|Outbound Lease Claim| JudgeA["Judge Peer A (Gaming PC)"]
        Redis <-->|Outbound Lease Claim| JudgeB["Judge Peer B (Student Laptop)"]
        Redis <-->|Outbound Lease Claim| JudgeC["Judge Peer C (Containerized Cloud Runner)"]
    end
```

---

### 3. Level 2 Architecture: Subsystem Responsibilities

```mermaid
graph LR
    subgraph Edge ["Edge Tier"]
        CW[Cloudflare Worker]
    end

    subgraph Routers ["Router Tier"]
        NR1[Router Peer 1]
        NR2[Router Peer 2]
    end

    subgraph ServicePeers ["Service Peers"]
        AP1[API Peer 1]
        AP2[API Peer 2]
        WP1[Worker Peer 1]
        WP2[Worker Peer 2]
        RP1[Realtime SSE Peer 1]
    end

    subgraph Coordination ["State Tier"]
        PG[(PostgreSQL 16)]
        RD[(Redis 7)]
    end

    subgraph Execution ["Judge Compute Tier"]
        JP1[Judge Peer 1 - Go Daemon]
        JP2[Judge Peer 2 - Cloud Sandbox]
    end

    CW --> NR1
    CW -.-> NR2
    NR1 --> AP1
    NR1 --> AP2
    NR1 --> RP1

    AP1 --> PG
    AP2 --> PG
    AP1 --> RD
    AP2 --> RD

    WP1 --> PG
    WP1 --> RD
    WP2 --> PG
    WP2 --> RD

    RP1 --> RD
    RD --> JP1
    RD --> JP2
    JP1 --> PG
    JP2 --> PG
```

---

### 4. Level 3 Architecture: Submission Lifecycle & CAS Fencing

```mermaid
sequenceDiagram
    autonumber
    participant B as Cadet Browser
    participant W as Cloudflare Worker
    participant R as Nginx Router Peer
    participant AP as API Peer
    participant PG as PostgreSQL 16
    participant RD as Redis 7
    participant JP as Judge Peer
    participant RP as Realtime SSE Peer

    B->>W: POST /api/contests/brawl/arena/submit
    W->>R: Proxy request to active router peer
    R->>AP: Forward to least-loaded API peer
    AP->>PG: Begin TX: Insert JudgeJob (status=QUEUED, active_attempt=1)
    AP->>RD: LPUSH ccc:queue:fabric:pending
    AP->>B: 202 Accepted (submission_id, attempt=1)
    
    Note over JP,RD: Distributed Claim via Monotonic Leases
    JP->>RD: BRPOPLPUSH pending -> processing
    JP->>RD: SETEX ccc:job:{id}:lease 30s {peer_id, attempt: 1}
    
    Note over JP: Compile Once -> Multi-Testcase Isolation
    JP->>JP: Compile source code to binary artifact
    JP->>JP: Execute Testcases inside cgroup / rlimit sandbox
    
    Note over JP,PG: Strict CAS Fencing on Completion
    JP->>PG: UPDATE judge_jobs SET status='COMPLETED' WHERE id=job_id AND active_attempt_id=1
    alt Success: Active Attempt Finalized
        PG-->>JP: 1 Row Updated (Authoritative)
        JP->>RD: PUBLISH ccc:events:arena {verdict: 'Accepted', score: 100}
        RD->>RP: PubSub notification received
        RP->>B: SSE Event: submission_evaluated
    else Conflict: Stale Attempt (Lease expired, claimed by another peer)
        PG-->>JP: 0 Rows Updated (CAS Rejection)
        JP->>JP: Discard result (Stale lease protection)
    end
```

---

### 5. Level 3 Architecture: Provider & Judge Failure Resiliency

```mermaid
sequenceDiagram
    autonumber
    participant B as Cadet Browser
    participant W as Cloudflare Worker
    participant RA as Router Peer A (Cloud Run)
    participant RB as Router Peer B (VPS)
    participant JA as Judge Peer A (Fails)
    participant JB as Judge Peer B (Recovers)
    participant RD as Redis 7
    participant PG as PostgreSQL 16

    Note over RA,W: Scenario 1: Router Peer Failure
    B->>W: GET /api/contests
    W->>RA: Attempt connection to Router A
    RA--xW: 502 / Connection Refused (Router A crashed)
    Note over W: Worker Health Sentinel detects failure (<50ms)
    W->>RB: Instant failover to Router Peer B
    RB-->>W: 200 OK (Response served transparently)
    W-->>B: 200 OK (Zero user impact)

    Note over JA,JB: Scenario 2: Judge Peer Hardware Failure
    JA->>RD: Leased job_id=456, attempt_id=1 (30s lease)
    Note over JA: Judge Peer A loses power / network
    Note over RD: 30s TTL expires -> Lease Reaper triggers
    RD->>RD: Move job_id=456 back to ccc:queue:fabric:pending
    JB->>RD: Claims job_id=456, creates attempt_id=2
    JB->>JB: Executes testcases
    JB->>PG: UPDATE judge_jobs SET status='COMPLETED' WHERE id=456 AND active_attempt_id=2
    PG-->>JB: Updated successfully!
```

---

### 6. Summary of Architectural Invariants

| Dimension | Immutable Contract |
|---|---|
| **Control Plane** | **None.** Compute is peer-to-peer. Every service is a self-governing peer. |
| **Ingress Edge** | Cloudflare Edge + ultra-lightweight Worker (<10ms CPU) routing to stateless Nginx router fabric. |
| **Data Plane** | Horizontally replicated, disposable Nginx router peers with dynamic upstream reload. |
| **Authoritative State** | Managed PostgreSQL 16 with ACID transactions, idempotency keys, and CAS fences. |
| **Shared Coordination** | Redis 7 for ephemeral queues, distributed leases, heartbeats, and SSE pub/sub. |
| **Compute Scalability** | Compile-once, isolated testcase execution across heterogeneous compute peers. |
