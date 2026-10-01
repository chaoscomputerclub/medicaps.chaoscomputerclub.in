# Local Worker Model & Worker Lifecycle Specification
## Chaos Computer Club Medi-Caps Chapter — Dynamic Application & Compute Fabric

---

### 1. Worker Hierarchy on Compute Nodes

Every registered node is managed by the Go Node Agent daemon, which orchestrates four distinct worker subsystems:

```
                       NODE AGENT DAEMON (Go)
                                  │
      ┌───────────────────────────┼───────────────────────────┐
      │                           │                           │
      ▼                           ▼                           ▼
[LOCAL LOAD BALANCER]     [RESOURCE GOVERNOR]     [LOCAL WORKER MANAGER]
      │                                                       │
      ├───────────────────────────┬───────────────────────────┤
      ▼                           ▼                           ▼
┌───────────────┐         ┌───────────────┐           ┌───────────────┐
│ STATIC & API  │         │  SSE RELAY    │           │ JUDGE WORKER  │
│ WORKER POOL   │         │    WORKER     │           │     POOL      │
│ (FastAPI/SPA) │         │ (Redis Stream)│           │(Docker Sandbx)│
└───────────────┘         └───────────────┘           └───────────────┘
```

---

### 2. Worker Subsystems & Responsibilities

#### 2.1 Static Frontend & API Worker Pool
- **Static Assets**: Serves versioned Vite production assets (`/dist`, `/assets/*`, `/fonts/*`) directly from memory/disk using immutable cache headers (`max-age=31536000`).
- **API Endpoints**: Executes read-only queries and authorized API calls routed by the Fabric Router.
- **Failover**: If a local API worker process crashes, the Go Worker Manager detects the exit, isolates the port, triggers an immediate restart, and re-attaches it to the local load balancer after a successful `/health` probe.

#### 2.2 SSE Real-Time Event Worker
- Maintains long-lived HTTP streaming connections for client browsers (`/api/events/stream/*`).
- Subscribes to Cloud Redis event channels (`ccc:contest:*`, `ccc:events:*`) over the outbound secure tunnel.
- Translates pub/sub messages into standard W3C SSE chunk format with replay buffer tracking (`Last-Event-ID`).
- Emits proxy-safe periodic `: heartbeat\n\n` comments every 15s.

#### 2.3 Judge Worker Pool
- Bounded semaphore initialized to the node's derived `max_concurrency` slots.
- Pulls claimed execution jobs from the local queue or outbound claim channel.
- Spawns ephemeral Docker execution containers inside RAM tmpfs workspaces.
- Enforces strict execution timeouts and formats standardized verdicts.

---

### 3. Worker Auto-Scaling & Thrash Prevention

1. **Scale-Up**: Triggered when in-flight queue depth > 2 for over 5 seconds AND Governor reports CPU $< 70\%$ and available RAM $> 2000\text{ MB}$.
2. **Scale-Down**: Triggered when worker slots sit idle for $> 30$ seconds.
3. **Cooldown Window**: Minimum 30 seconds between auto-scaling decisions to avoid thrashing and memory fragmentation.
