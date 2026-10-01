# Two-Tier Scheduler & Global Queue Architecture
## Chaos Computer Club Medi-Caps Chapter — Dynamic Application & Compute Fabric

---

### 1. Two-Tier Scheduling Hierarchy

```
           INCOMING REQUEST / JUDGE JOB
                        │
                        ▼
         ┌──────────────────────────────┐
         │     TIER 1: GLOBAL SCHEDULER │
         │   (Selects Target Physical   │
         │           Machine)           │
         └──────────────┬───────────────┘
                        │
       ┌────────────────┼────────────────┐
       ▼                ▼                ▼
    [CLOUD]          [NODE 1]         [NODE 2]
       │                │                │
       ▼                ▼                ▼
 ┌───────────┐    ┌───────────┐    ┌───────────┐
 │  TIER 2:  │    │  TIER 2:  │    │  TIER 2:  │
 │ LOCAL LB  │    │ LOCAL LB  │    │ LOCAL LB  │
 │ (Selects  │    │ (Selects  │    │ (Selects  │
 │  Worker)  │    │  Worker)  │    │  Worker)  │
 └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
       │                │                │
 ┌─────┼─────┐    ┌─────┼─────┐    ┌─────┼─────┐
 │     │     │    │     │     │    │     │     │
API   SSE  Judge API   SSE  Judge API   SSE  Judge
```

1. **Tier 1 (Global Scheduler)**: Evaluates the entire fabric topology. Evaluates global queue depth, node hardware capabilities, network latency, and current utilization to select the optimal physical host.
2. **Tier 2 (Local Scheduler / Load Balancer)**: Runs inside each node's Go agent daemon. Evaluates worker process health, local queue depth, memory headroom, and active thread counts to select an individual worker slot.

---

### 2. Global Redis Coordination Queues

The coordination plane leverages Redis data structures with atomic Lua scripts for strict FIFO/Priority execution and zero TOCTOU race conditions:

| Queue Key | Type | Purpose | Max Retention |
|---|---|---|---|
| `ccc:queue:fabric:pending` | List / Sorted Set | High-priority distributed jobs awaiting claim | In-memory |
| `ccc:queue:fabric:processing` | List | Currently claimed jobs in active execution | Visibility timeout |
| `ccc:queue:fabric:retry` | Sorted Set | Failed transient jobs scored by retry timestamp | 24 hours |
| `ccc:queue:fabric:dead_letter`| List | Non-retryable or exhausted jobs | 7 days |

---

### 3. Distributed Job Leases & Reaper Protocol

1. **Claim & Lease**:
   When a node executes `RPOPLPUSH ccc:queue:fabric:pending ccc:queue:fabric:processing`, a 300-second distributed lease is created:
   - `ccc:job:{job_id}:leased_at` $\to$ Epoch timestamp
   - `ccc:job:{job_id}:node_id` $\to$ Claiming Node ID
2. **Heartbeat Renewal**:
   While the node executes Docker testcases, the agent's runner renews the lease every 30 seconds if the job exceeds 30 seconds.
3. **Automated Reaper**:
   The cloud's `MaintenanceWorker` sweeps every 60 seconds:
   - If `ccc:job:{job_id}` is in `processing` but its lease expired (or the node disappeared and missed 3 consecutive heartbeats), the reaper atomically moves the job back to `ccc:queue:fabric:pending` for another node to claim.
   - Max retries: 3 attempts before relegation to `dead_letter`.

---

### 4. Concurrency & Fairness Governance

To prevent single-user denial-of-service or starvation:
1. **Per-User Concurrency**: Max 3 active judge jobs per member (`ccc:user:{member_id}:active_jobs`). Submissions exceeding this threshold are queued with lower priority.
2. **Per-Contest Concurrency**: Contest active mode reserves 70% of total fabric compute capacity for contest submissions, bounding general arena runs to 30%.
3. **Starvation Protection**: An aging coefficient boosts the priority of queued jobs waiting longer than 10 seconds:
   $$\text{Effective Priority} = \text{Base Priority} + 0.1 \times \text{Wait Time (seconds)}$$
