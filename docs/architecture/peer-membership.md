# Peer Membership & Discovery Protocol
## CCC Distributed Service Fabric — Dynamic Node Federation

---

### 1. Peer State Machine

Every peer node participating in the CCC compute fabric transitions through well-defined lifecycle states:

```
  ┌──────────┐
  │ OFFLINE  │◄───────────────────────────────────┐
  └────┬─────┘                                    │
       │ Heartbeat & Enrollment                   │ Heartbeat Expiry
       ▼                                          │ (TTL 15s)
  ┌──────────┐   Health Check Passed    ┌─────────┴┐
  │ JOINING  ├─────────────────────────►│ HEALTHY  │
  └──────────┘                          └──┬────┬──┘
                                           │    │ High Load /
           Manual Drain Trigger            │    │ Latency Spikes
       ┌───────────────────────────────────┘    ▼
       ▼                                    ┌──────────┐
  ┌──────────┐   Active Tasks Flushed       │ DEGRADED │
  │ DRAINING ├─────────────────────────────►└────┬─────┘
  └──────────┘                                   │ Missing Heartbeats
                                                 ▼
                                            ┌──────────┐
                                            │ SUSPECT  │
                                            └────┬─────┘
                                                 │ Timeout (30s)
                                                 ▼
                                            ┌──────────┐
                                            │ OFFLINE  │
                                            └────┬─────┘
                                                 │ Admin Prune
                                                 ▼
                                            ┌──────────┐
                                            │ REMOVED  │
                                            └──────────┘
```

---

### 2. State Definitions & Transitions

| State | Ingress Acceptance | Background Tasks | Health Action | Transition Trigger |
|---|---|---|---|---|
| **`JOINING`** | Blocked | Blocked | Verifying capabilities & network reachability | Initial enrollment handshake |
| **`HEALTHY`** | Accepted | Accepted | Active heartbeats sent every 5s | Health check probes pass ($<500\text{ms}$) |
| **`DEGRADED`** | Deprioritized | Capped | Capacity throttled | Memory $>85\%$, CPU $>90\%$, or error rate $>5\%$ |
| **`DRAINING`** | Blocked | Finish active | In-flight requests drained gracefully | Pre-shutdown signal or operator command |
| **`SUSPECT`** | Blocked | Halted | Awaiting recovery probe | Heartbeat missed for $>10\text{s}$ |
| **`OFFLINE`** | Evicted | Evicted | Requeued to healthy peers | No heartbeat for $>25\text{s}$ |
| **`REMOVED`** | Purged | Purged | Deleted from registry | Ephemeral TTL expiry or admin unregister |

---

### 3. Capability Advertisement Schema

When a peer enrolls via `POST /internal/v1/peers/register`, it broadcasts its capabilities:

```json
{
  "peer_id": "peer-cloudrun-asia01",
  "provider": "google-cloud-run",
  "region": "asia-south1",
  "endpoint": "https://ccc-api-56166160875.asia-south1.run.app",
  "version": "1.0.10",
  "git_sha": "8b0dff8",
  "service_types": ["API_PEER", "WORKER_PEER"],
  "capacity": {
    "max_concurrent_requests": 80,
    "max_concurrent_jobs": 4,
    "cpu_cores": 1.0,
    "memory_mb": 512,
    "quota_state": "NORMAL"
  },
  "capabilities": {
    "http_api": true,
    "sse_streaming": false,
    "judge_languages": [],
    "docker_sandboxing": false
  },
  "protocol_version": "1.0.0"
}
```

---

### 4. Heartbeat Protocol

Each active peer runs a non-blocking background daemon publishing a heartbeat every **5 seconds**:

```
KEY: ccc:peer:heartbeat:<peer_id>
TTL: 15 seconds
VALUE: {
  "peer_id": "...",
  "timestamp": "2026-10-07T15:00:00Z",
  "status": "HEALTHY",
  "cpu_utilization": 0.35,
  "ram_utilization_mb": 210,
  "active_requests": 6,
  "active_jobs": 1,
  "latency_p95_ms": 28.4
}
```

If Redis does not receive a heartbeat before the 15-second TTL expires, the key is removed from the active membership set `ccc:peers:active`, triggering immediate data-plane failover.
