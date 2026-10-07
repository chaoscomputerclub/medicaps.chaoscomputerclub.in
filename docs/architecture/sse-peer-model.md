# Realtime SSE Peer Model
## Distributed Event Streaming & Seamless Disconnection Recovery

---

### 1. Peer-Independent Event Delivery

Server-Sent Events (SSE) must never depend on a specific persistent server. In our peer fabric:
- Any `REALTIME_PEER` instance can subscribe to Redis channel `ccc:events:arena`.
- Any browser client can connect to any `REALTIME_PEER` through the Nginx router fabric.
- If a `REALTIME_PEER` is restarted or terminated, the browser reconnects to an alternate peer without losing events.

```mermaid
graph TD
    Cadet["Student Browser"] -->|EventSource| Worker["Cloudflare Worker"]
    Worker -->|Pass-Through| Router["Nginx Router Fabric"]
    Router -->|Load Balance| RealtimePeerA["Realtime Peer A (Render)"]
    Router -.->|Failover| RealtimePeerB["Realtime Peer B (Railway)"]

    RealtimePeerA <-->|SUBSCRIBE ccc:events:arena| Redis["Redis Pub/Sub"]
    RealtimePeerB <-->|SUBSCRIBE ccc:events:arena| Redis

    Redis <-->|LPUSH / LRANGE (Replay Buffer)| RingBuffer[("Redis Ring Buffer (1000 events)")]
```

---

### 2. Resumable Replay Protocol (`Last-Event-ID`)

1. Every authoritative event carries an incremental, monotonic `event_id` (e.g. `evt_10482`).
2. When a connection drops, the browser automatically sends:
   ```http
   GET /api/events/arena HTTP/1.1
   Last-Event-ID: evt_10482
   ```
3. The newly contacted `REALTIME_PEER` queries the Redis Ring Buffer:
   `ZRANGEBYSCORE ccc:events:ring (10482 +inf`
4. The peer replays all missed events in chronological order, then seamlessly resumes live pub/sub streaming.
