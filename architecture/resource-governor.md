# Local Resource Governor & Capacity Derivation Specification
## Chaos Computer Club Medi-Caps Chapter — Dynamic Application & Compute Fabric

---

### 1. Continuous Resource Sampling Engine

Every physical node runs a high-resolution Go resource governor goroutine that samples host metrics every 1.5 seconds:

- **Host CPU Usage %**: Delta calculation across `/proc/stat` or OS sysctl counters.
- **Host Memory Headroom**: Evaluates `/proc/meminfo` (Linux) or `vm_stat` (Darwin), measuring actual available unallocated RAM.
- **Host Load Average**: 1m, 5m, 15m load averages.
- **Docker Daemon Health**: Checks socket responsiveness (`/var/run/docker.sock`) with a 500ms timeout probe.
- **RAM tmpfs Storage**: Verifies space and inode availability on `/tmp/ccc_workspaces`.

---

### 2. Dynamic Hardware Capacity Derivation

Capacity is **never** hardcoded. When the node starts, the governor applies hardware derivation rules:

| Host Profile | Physical / Threads | RAM | Derived API Workers | Derived SSE Capacity | Derived Judge Slots | Reserved System RAM |
|---|---|---|---|---|---|---|
| **High-End Laptop** | 6 cores / 12 threads | 8 GB | 4 workers | 1,000 conns | 6 slots | 1.5 GB |
| **Mid-Tier Desktop** | 4 cores / 8 threads | 16 GB | 4 workers | 1,500 conns | 6 slots | 2.0 GB |
| **Budget / Lab PC** | 4 cores / 4 threads | 4 GB | 2 workers | 300 conns | 2 slots | 1.0 GB |
| **Cloud VPS (Control)**| 2 vCPU | 4 GB | 2 workers | 500 conns | 2 slots | 1.0 GB |

**Derivation Formulas:**
- $\text{Judge Slots} = \min\left(\lfloor \text{Logical Threads} \times 0.6 \rfloor, \left\lfloor \frac{\text{Available RAM MB} - 1024}{512} \right\rfloor, 16\right)$ (minimum 1)
- $\text{API Workers} = \max\left(1, \min\left(\lfloor \text{Physical Cores} \times 0.5 \rfloor, 4\right)\right)$
- $\text{SSE Capacity} = \min(1500, \text{Total RAM MB} \times 0.15)$

---

### 3. API vs. Judge Competition & Resource Budgets

API request serving and untrusted Docker code execution must coexist peacefully without starving each other.

```
       TOTAL PHYSICAL RESOURCES (e.g. 12 Cores, 8 GB RAM)
 ┌────────────────────────────────────────────────────────────┐
 │  SYSTEM RESERVED: 1.5 GB RAM, 10% CPU                      │
 ├────────────────────────────┬───────────────────────────────┤
 │  API & STATIC BUDGET       │  DOCKER JUDGE BUDGET          │
 │  40% CPU Headroom          │  50% CPU Max Limit            │
 │  2.0 GB RAM Ceiling        │  4.5 GB RAM Ceiling           │
 │  High Priority / Low PIDs  │  Ephemeral Containers         │
 └────────────────────────────┴───────────────────────────────┘
```

#### Strict Safety Circuit Breakers:
1. **CPU Saturated ($\ge 85\%$)**:
   The governor immediately closes the judge claim semaphore (`TryAcquireSlot() == false`). The node refuses all new judge jobs. API workers remain protected.
2. **RAM Pressure ($< 1024\text{ MB}$ free)**:
   The governor transitions node state from `READY` to `BUSY` / `DEGRADED`. Active executions continue, but zero new Docker containers can be spawned.
3. **Recovery Hysteresis**:
   Once CPU drops below $70\%$ and available RAM rises above $1500\text{ MB}$ for at least 3 consecutive sampling cycles (4.5s), the governor re-opens execution slots to prevent thrashing.
