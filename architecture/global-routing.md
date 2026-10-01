# Global Fabric Routing & Load Balancing Architecture
## Chaos Computer Club Medi-Caps Chapter — Dynamic Application & Compute Fabric

---

### 1. Mission & Architectural Overview

The Global Fabric Router operates as the centralized ingress orchestrator behind Cloudflare Global Edge. It transforms the infrastructure from a single Cloud VPS hosting all responsibilities into a dynamic, distributed heterogeneous fabric where any authorized compute device (Cloud VPS, cadet laptops, lab desktops) participates in serving production traffic.

```
                    INTERNET
                       │
                       ▼
                ┌──────────────┐
                │  Cloudflare  │
                │ Global Edge  │
                └──────┬───────┘
                       │
                       ▼
             ┌─────────────────────┐
             │ GLOBAL LOAD BALANCER│
             │ / FABRIC ROUTER     │
             └──────────┬──────────┘
                        │
          ┌─────────────┼────────────────┐
          │             │                │
          ▼             ▼                ▼
       ☁️ CLOUD      💻 NODE 1        💻 NODE 2
          │             │                │
          ▼             ▼                ▼
      Local LB       Local LB        Local LB
          │             │                │
      ┌───┼───┐     ┌───┼───┐        ┌───┼───┐
      │   │   │     │   │   │        │   │   │
     API SSE Judge API SSE Judge     API SSE Judge
              │             │                │
              ▼             ▼                ▼
           Docker        Docker           Docker
           Codebox       Codebox          Codebox
```

---

### 2. Request Types & Classification

Incoming requests are inspected and classified into distinct resource profiles before scheduling:

| Request Class | Matching URI / Method | Resource Profile | Preferred Node Type |
|---|---|---|---|
| `STATIC` | `GET /assets/*`, `GET /*.js`, `GET /*.css`, `GET /*.woff2` | Low CPU, High I/O, Cacheable | Any node with `frontend=True` |
| `API_READ` | `GET /api/contests`, `GET /api/scoreboards/*`, `GET /api/problems/*` | Low-Med CPU, Read-Only DB Cache | Least-loaded node with API capacity |
| `API_WRITE` | `POST /api/contests/*`, `POST /api/auth/*`, `PUT /api/*` | Med CPU, DB Transactional | Cloud control plane or Node with DB connectivity |
| `SSE` | `GET /api/events/stream/*` | High Connection Concurrency, Negligible CPU | Node with active Redis PubSub relay |
| `AUTH` | `POST /api/auth/otp/*`, `POST /api/auth/verify` | Low CPU, Security Sensitive | Control plane (central identity) |
| `JUDGE_RUN` | `POST /api/contests/{slug}/run` | High CPU, Ephemeral Sandbox, Low Latency | Node with highest available compute score |
| `JUDGE_SUBMIT` | `POST /api/contests/{slug}/submit` | High CPU, Strict Deduplication, Queue-backed | Queue -> Distributed Node Worker |
| `ADMIN` | `ALL /admin/*`, `ALL /api/admin/*` | Strict RBAC, Low Volume | Control plane |
| `HEALTH` | `GET /api/health`, `GET /api/v1/fabric/health` | Instant Response | Local node immediate response |

---

### 3. Live Node Registry Schema

The Global Router maintains an in-memory and Redis-backed state machine for all registered nodes:

```json
{
  "node_id": "node_32dc9245c062",
  "hostname": "santusht-legion-5",
  "status": "READY",
  "cpu_total": 12,
  "cpu_available": 8.4,
  "cpu_usage_pct": 28.5,
  "memory_total_mb": 8192,
  "memory_available_mb": 6200,
  "memory_usage_pct": 24.3,
  "api_capacity": 6,
  "api_active": 1,
  "sse_capacity": 1000,
  "sse_active": 45,
  "judge_capacity": 6,
  "judge_active": 2,
  "queue_depth": 0,
  "latency_ms": 7.4,
  "docker_healthy": true,
  "capabilities": {
    "frontend": true,
    "api": true,
    "sse": true,
    "judge": true
  },
  "supported_languages": [
    "python",
    "javascript",
    "cpp",
    "java"
  ],
  "tunnel_connected": true,
  "last_heartbeat": 1759281000.12
}
```

---

### 4. Global Weighted Scoring Engine

When a request arrives, candidate nodes are filtered by capability and health, then evaluated by a deterministic scoring function:

$$\text{Score}(N) = w_{\text{cpu}} \cdot S_{\text{cpu}} + w_{\text{mem}} \cdot S_{\text{mem}} + w_{\text{api}} \cdot S_{\text{api}} + w_{\text{judge}} \cdot S_{\text{judge}} + w_{\text{lat}} \cdot S_{\text{lat}} + w_{\text{health}} \cdot S_{\text{health}}$$

Where:
- $S_{\text{cpu}} = \frac{\text{CPU Available}}{\text{CPU Total}} \times 100$
- $S_{\text{mem}} = \frac{\text{RAM Available MB}}{\text{RAM Total MB}} \times 100$
- $S_{\text{api}} = \left(1 - \frac{\text{API Active}}{\text{API Capacity}}\right) \times 100$
- $S_{\text{judge}} = \left(1 - \frac{\text{Judge Active}}{\text{Judge Capacity}}\right) \times 100$
- $S_{\text{lat}} = \max\left(0, 100 - \text{Latency (ms)}\right)$
- $S_{\text{health}} = 100 \text{ if Docker and Heartbeat OK, else } 0$

**Default Configurable Weights:**
- `WEIGHT_CPU`: 0.25
- `WEIGHT_MEMORY`: 0.20
- `WEIGHT_API_CAPACITY`: 0.20
- `WEIGHT_JUDGE_CAPACITY`: 0.15
- `WEIGHT_LATENCY`: 0.10
- `WEIGHT_HEALTH`: 0.10

Nodes in `DRAINING`, `OFFLINE`, or `UNHEALTHY` states receive a hard score of $-1$ and are pruned from candidate pools.

---

### 5. Outbound NAT Traversal & Reverse Multiplexed Tunnels

1. Compute nodes behind NAT/CGNAT/Wi-Fi do **not** open inbound ports.
2. Upon registration, the Go Node Agent initiates an authenticated persistent outbound connection to the Cloud Fabric Router (`/api/v1/fabric/tunnel/{node_id}`).
3. When the Fabric Router dispatches an HTTP request to Node 1, it frames the HTTP payload over the established multiplexed tunnel stream.
4. The Node's Local Load Balancer receives the frame, routes it to a local worker (or internal static server), collects the response, and streams it back across the tunnel to the client.
5. If the tunnel drops, the Fabric Router immediately marks the node degraded, recovers in-flight requests, and re-routes to surviving nodes.
