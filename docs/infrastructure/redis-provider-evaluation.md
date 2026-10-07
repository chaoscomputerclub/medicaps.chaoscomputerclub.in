# CCC Medi-Caps — Redis Provider Evaluation & Namespace Architecture

> **Document Type**: Technical Evaluation & Architectural Decision Record (ADR)  
> **Role of Redis**: Ephemeral Coordination, State Acceleration, Pub/Sub Event Relay, and Queue Buffering.  
> **Authority Invariant**: Redis is NEVER authoritative for business state. Losing Redis keys must never corrupt submissions, scores, or accounts.

---

## 1. Required Redis Capabilities

The Medi-Caps backend depends on specific Redis primitives:
1. **Atomic Queues**: `RPUSH`, `LPOP`, `RPOPLPUSH`, `BLPOP` for distributed job dispatching.
2. **Atomic Leases & Locks**: `SET NX EX` and Lua scripts (`SingleFlight`, TOCTOU-safe claim locking).
3. **Pub/Sub Messaging**: `PUBLISH`, `SUBSCRIBE` for real-time event distribution between API and SSE workers.
4. **Circular Replay Buffers**: Sorted Sets (`ZADD`, `ZRANGEBYSCORE`, `ZREMRANGEBYRANK`) for monotonic `Last-Event-ID` SSE reconnect recovery.
5. **Worker Heartbeats**: Key expiration (`SET EX 30`) and Set membership (`SADD`, `SMEMBERS`) for distributed node tracking.

---

## 2. Free Redis Provider Comparison

| Evaluation Criterion | Upstash Redis (Serverless) | Redis Cloud (Redis Ltd) | Aiven for Redis | Self-Hosted VPS Redis (Fallback) |
|---|---|---|---|---|
| **Free Allowance** | 10,000 commands / day | 30 MB free database | 30-day trial only (No permanent free tier) | Unmetered (Limited only by 4GB VPS RAM) |
| **Max Concurrent Connections** | 100 connections | 30 connections | N/A | 10,000 connections (`maxclients`) |
| **Redis Pub/Sub Support** | ⚠️ Supported via TCP; NOT supported via REST API | ✅ Full native Pub/Sub supported | ✅ Full native Pub/Sub | ✅ Full native Pub/Sub supported |
| **Persistence (AOF / RDB)** | Replicated serverless storage | Periodic RDB snapshot | Managed persistent disk | Local AOF (`appendonly yes`) |
| **Eviction Policy** | `noeviction` | `volatile-lru` / `allkeys-lru` | Configurable | `volatile-lru` |
| **Latency from Cloud Run** | 15–25ms (Mumbai `ap-south-1`) | 12–20ms (Mumbai `ap-south-1`) | N/A | 10–18ms (Bangalore `blr1`) |
| **Sleeping / Cold Start** | None (always active) | None (always active) | N/A | None (continuous systemd daemon) |
| **Verdict** | Suitable for low-frequency cache; 10k cmd/day exceeded during 50-user live contest | Suitable for small contest, but 30 MB & 30 connections limit is tight | Excluded (no permanent free tier) | **RECOMMENDED PRIMARY/FALLBACK**: Extremely reliable, zero command limits, low latency within India region |

### Provider Decision:
1. **Primary Coordination**: Redis Cloud / Upstash for lightweight edge caching and rate limiting where suitable.
2. **Contest Orchestration & Pub/Sub Queue**: The existing Redis 7 instance on the VPS (`143.198.38.205:6379`) configured with strict authentication (`REDIS_PASSWORD`) and TLS/tunneling serves as the unmetered, high-throughput coordination bus during contest bursts, avoiding the risk of hitting 10,000 daily command caps.
3. **Correctness Guarantee**: If cloud Redis commands exceed free limits, the system seamlessly falls back to the VPS Redis daemon without dropping a single submission.

---

## 3. Redis Key Namespace Directory

Every Redis key adheres to a strictly structured namespace:

| Key Pattern | Owner Module | TTL / Eviction | Authority | Purpose & Failure Behavior |
|---|---|---|---|---|
| `ccc:queue:fabric:pending` | `DistributedFabricProvider` | None (Reaped on empty) | Ephemeral Queue | FIFO queue of unassigned judge jobs. If lost, `ReconciliationWorker` re-enqueues from DB. |
| `ccc:queue:fabric:pending:<lang>` | `DistributedFabricProvider` | None | Ephemeral Queue | Language-partitioned queue for capability-matched node claiming. |
| `ccc:job:<job_id>` | `DistributedFabricProvider` | 86,400s (24 hours) | Ephemeral Cache | Temporary job execution payload and completed result cache. Authoritative result stored in PostgreSQL. |
| `ccc:job:<job_id>:done` | `nodes.py` | Transient (Pub/Sub channel) | Notification | Wake-up trigger for waiting execution coroutine. |
| `ccc:lease:<job_id>` | `AttemptManager` | 120s–300s | Coordination Lock | Active worker execution lease. Expired leases trigger automatic requeue. |
| `ccc:node:<node_id>:heartbeat` | `nodes.py` | 30s (`WORKER_HEARTBEAT_TTL_S`)| Ephemeral Liveness | Worker liveness marker. Key expiration marks node as SUSPECT/OFFLINE. |
| `ccc:node:<node_id>:info` | `nodes.py` | None (Deleted on unregister) | Ephemeral Metadata | Node hardware capability profile (CPU, RAM, container version, max concurrency). |
| `ccc:nodes:registered` | `nodes.py` | None | Ephemeral Set | Set of all active/enrolled node IDs. |
| `ccc:realtime:events` | `event_broadcaster.py` | Transient (Pub/Sub channel) | Notification | Central pub/sub channel fanning out domain events across ASGI worker instances. |
| `ccc:sse:replay:<channel>` | `event_broadcaster.py` | 86,400s (Trimmed to 100 items) | Recovery Buffer | Circular ZSET of historical events for `Last-Event-ID` reconnection replay. |
| `ccc:dedup:<sha256>` | `ContestExecutionService` | 2s | Anti-Spam Lock | Short-lived mutex preventing rapid-fire duplicate submissions. |
| `ccc:cache:contests:*` | `ContestService` | 30s–300s | Read Cache | Materialized JSON list of contests to avoid DB query storms. |
| `ratelimit:<ip_or_user>:<action>` | `RateLimitMiddleware` | 60s | Edge Protection | Sliding-window counter enforcing API rate limits. |
