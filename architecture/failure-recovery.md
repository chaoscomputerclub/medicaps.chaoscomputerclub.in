# Failure Recovery, Resilience & Idempotency Specification
## Chaos Computer Club Medi-Caps Chapter — Dynamic Application & Compute Fabric

---

### 1. Chaos Scenarios & Automated Recovery Matrix

| Chaos Event | Detection Mechanism | Immediate System Action | Recovery State |
|---|---|---|---|
| **Abrupt USB Disconnect** | Missing 2 consecutive heartbeats (10s) | Global Router removes node from candidate scoring. State $\to$ `SUSPECT`. | Node marked `OFFLINE`. In-flight leased jobs reclaimed by reaper. |
| **Wi-Fi / Network Flap** | Network Manager ping probe fails | Go Agent enters exponential backoff. Retains in-memory tmpfs state. | On reconnection, node reconciles state with control plane via `register`. |
| **Docker Daemon Crash** | Governor socket probe fails | Node reports `docker_status: "degraded"` in heartbeat. Judge capacity set to 0. | Node remains active for API/static traffic. Recovers when Docker restarts. |
| **Control Plane VPS Reboot**| Outbound HTTP returns connection refused | Nodes pause queue polling, buffer telemetry locally, retry with jitter. | Seamless resumption when control plane restarts. Authoritative DB is durable. |
| **10,000 Submission Burst** | Queue depth spike | Backpressure stops unbounded container spawns. Distributed fabric shares load. | Jobs processed sustainably. Zero dropped requests or DB crashes. |

---

### 2. Distributed Job Lease & Reaper Sequence

```
TIME (s)   NODE 1 (Laptop)                 REDIS QUEUE                  CLOUD REAPER
──────────────────────────────────────────────────────────────────────────────────
T=0        Claims job_101          ──────► RPOPLPUSH pending -> processing
                                           Lease set: TTL=300s
T=15       [Laptop Unplugged / USB yanked]
T=20       Heartbeat missing (1st)
T=25       Heartbeat missing (2nd) ──────► Router removes Node 1 from LB
T=60                                                                     Reaper sweeps:
                                                                         Node 1 heartbeats dead.
                                                                         Reclaims job_101 ──┐
                                   ◄────────────────────────────────────────────────────────┘
                                           Moves job_101 -> pending
T=62       NODE 2 (Cloud / Desktop) ◄───── RPOPLPUSH pending -> processing
           Executes & completes job
```

---

### 3. Strict Result Idempotency

Network retries, duplicate HTTP posts, or overlapping execution attempts must never corrupt contestant scores or generate duplicate submissions.

1. **Deterministic Submission Key**:
   $$\text{Key} = \text{SHA256}(\text{contest\_id} + \text{member\_id} + \text{problem\_id} + \text{source\_code})$$
2. **Atomic Ingestion Lock**:
   `SET ccc:submission:lock:{key} 1 NX EX 2`
   Discards identical duplicate submissions posted within 2 seconds.
3. **Atomic Result Finalization**:
   The cloud router executes an atomic Lua script upon result submission:
   - Verifies `ccc:job:{job_id}` is in state `PROCESSING`.
   - Sets state to `COMPLETED` and atomically deletes the lease key.
   - If a duplicate result for `job_id` arrives later, it is acknowledged as idempotent and safely discarded.
   - Scoreboard recalculations execute under PostgreSQL advisory transaction locks (`pg_advisory_xact_lock`), guaranteeing linearizable ranks.

---

### 4. Database Connection Pool Isolation

1. Compute nodes do **not** hold open direct PostgreSQL connections across high-latency public networks.
2. Control plane workers use bounded connection pools (`pool_size=20, max_overflow=20`).
3. Workers **never** hold a database transaction while compiling, running Docker containers, or waiting for testcase execution.
4. Database transactions are held strictly during initial submission insertion ($< 5\text{ms}$) and final verdict recording ($< 10\text{ms}$).
