# Distributed Node Fabric Wire Protocol & Lifecycle Specification
## Chaos Computer Club Medi-Caps Chapter — Portable Compute Fabric Protocol v2

---

### 1. Node Lifecycle State Machine

Every physical machine connected to the distributed compute fabric transitions through explicit states:

```
      ┌────────────────┐
      │  PROVISIONING  │
      └───────┬────────┘
              │ Hardware probed, tmpfs verified
              ▼
      ┌────────────────┐
      │    STARTING    │
      └───────┬────────┘
              │ Auth verified, workers spawned
              ▼
      ┌────────────────┐◄─────────────┐
      │     READY      │              │ Load drops
      └───────┬────────┘              │
              │ High load (slots > 80%)│
              ▼                       │
      ┌────────────────┐              │
      │      BUSY      ├──────────────┘
      └───────┬────────┘
              │ Signal trap (SIGINT/SIGTERM/USB unmount)
              ▼
      ┌────────────────┐
      │    DRAINING    │
      └───────┬────────┘
              │ In-flight jobs finish, unregister
              ▼
      ┌────────────────┐
      │    OFFLINE     │
      └────────────────┘
```

**Exceptional States:**
- `UNHEALTHY`: Docker daemon crash, out-of-memory condition, or network jitter threshold exceeded.
- `REVOKED`: Enrollment token invalidated by security admin; node rejected from pool.

---

### 2. Node Identity & Cryptographic Authentication

1. **Hardware Fingerprint**: Generated from system UUID, CPU model, MAC address, and disk serial.
2. **Node ID**: Format `node_<12-hex-chars>`, e.g., `node_32dc9245c062`.
3. **Enrollment Token**: Short-lived, revocable secret provided during USB creation (`JUDGE_AGENT_SECRET` or temporary enrollment token).
4. **Session Token**: Returned upon successful registration; used for all subsequent heartbeats and claims.
5. **No Plaintext Long-Lived Secrets**: USB keys never store permanent database or Redis passwords. All communication terminates at the Control Plane REST/WebSocket gateway.

---

### 3. REST API Contract

#### 3.1 Registration: `POST /api/v1/nodes/register`
**Request Payload:**
```json
{
  "node_id": "node_32dc9245c062",
  "hostname": "santusht-legion-5",
  "os_name": "linux",
  "architecture": "x86_64",
  "cpu": {
    "physical_cores": 6,
    "logical_cores": 12,
    "model": "AMD Ryzen 5 5600H",
    "frequency_mhz": 3300.0
  },
  "memory": {
    "total_mb": 8192,
    "available_mb": 6200
  },
  "storage": {
    "available_gb": 45.0,
    "usb_mode": true
  },
  "container": {
    "runtime": "docker",
    "version": "29.1.3",
    "healthy": true
  },
  "network": {
    "interface": "wlan0",
    "latency_ms": 7.4
  },
  "capabilities": {
    "frontend": true,
    "api": true,
    "sse": true,
    "judge": true
  },
  "max_concurrency": 6,
  "languages": ["python", "javascript", "cpp", "java", "c", "go"],
  "agent_version": "2.1.0",
  "protocol_version": "2.0"
}
```

**Response Payload:**
```json
{
  "node_id": "node_32dc9245c062",
  "status": "READY",
  "heartbeat_interval_s": 5,
  "heartbeat_ttl_s": 15,
  "assigned_concurrency": 6,
  "api_worker_target": 4,
  "sse_capacity_target": 1000,
  "queue_name": "fabric"
}
```

---

#### 3.2 Heartbeat: `POST /api/v1/nodes/{node_id}/heartbeat`
Emitted every 5 seconds.
```json
{
  "cpu_usage_pct": 24.5,
  "memory_usage_pct": 32.1,
  "available_memory_mb": 5800,
  "running_jobs": 2,
  "available_slots": 4,
  "active_api_requests": 1,
  "active_sse_connections": 12,
  "docker_status": "healthy",
  "network_status": "healthy",
  "status": "READY"
}
```

---

#### 3.3 Outbound Job Claim: `POST /api/v1/nodes/{node_id}/claim`
```json
{
  "timeout_seconds": 2.0
}
```
**Response (when job available):**
```json
{
  "job": {
    "id": "job_94fb21a3-...",
    "job_type": "CONTEST_SUBMISSION",
    "payload": {
      "language": "cpp",
      "code": "#include <iostream>...",
      "time_limit_ms": 2000.0,
      "memory_limit_mb": 256,
      "testcases": [
        {"id": "tc_1", "stdin": "5\n", "expected_output": "10\n"}
      ]
    },
    "lease_ttl_s": 300
  }
}
```

---

#### 3.4 Result Submission: `POST /api/v1/nodes/{node_id}/result`
```json
{
  "job_id": "job_94fb21a3-...",
  "verdict": "ACCEPTED",
  "runtime_ms": 14.2,
  "memory_mb": 18.5,
  "compile_output": null,
  "error": null,
  "testcase_results": [
    {
      "testcase_id": "tc_1",
      "passed": true,
      "verdict": "ACCEPTED",
      "stdout": "10",
      "stderr": "",
      "wall_time_ms": 14.2
    }
  ]
}
```

---

#### 3.5 Graceful Drain: `POST /api/v1/nodes/{node_id}/drain`
Stops receiving new jobs while completing active executions.

#### 3.6 Unregister: `POST /api/v1/nodes/{node_id}/unregister`
Removes node from active registry and clears ephemeral keys.
