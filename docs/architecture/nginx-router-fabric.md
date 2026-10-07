# Nginx Stateless Router Fabric
## Data-Plane Layer Specification & Zero Single-Point-of-Failure Guarantee

---

### 1. Conceptual Separation: Router vs Control Plane

```
[WRONG MENTAL MODEL]
VPS (Nginx + Control Plane) ──► Monolith orchestrating all providers (Single Point of Failure)

[CORRECT PEER FABRIC MODEL]
Cloudflare Edge
       │
       ▼
Cloudflare Worker (Ingress Selector)
       ├──► Router Peer 01 (Stateless Nginx on VPS) ──────┐
       └──► Router Peer 02 (Stateless Nginx on Cloud Run) ─┼──► Any Healthy Service Peer
       └──► Router Peer 03 (Stateless Nginx on Render) ────┘
```

**Core Principle**:  
Nginx is **NEVER a control plane**. Nginx is a **disposable, horizontally replicable data-plane router**. If a router peer crashes or is terminated:
1. The Cloudflare Worker detects the failure in $<50\text{ms}$.
2. Traffic is instantly routed to an alternative router peer.
3. The cluster continues serving without dropped requests or state loss.

---

### 2. High-Performance Stateless Nginx Architecture

The Nginx Router peer configuration is strictly declarative, isolating upstream groups for each peer capability:

```nginx
# /etc/nginx/conf.d/peer-upstreams.conf (Generated Dynamically)

# 1. Stateless API Peers
upstream api_peers {
    least_conn;
    server 10.0.0.1:8000 max_fails=2 fail_timeout=5s; # Peer Cloud Run
    server 10.0.0.2:8000 max_fails=2 fail_timeout=5s; # Peer Render
    server 10.0.0.3:8000 max_fails=2 fail_timeout=5s; # Peer Railway
    keepalive 64;
}

# 2. Realtime SSE Event Stream Peers
upstream realtime_peers {
    ip_hash; # Preserves stream locality while healthy
    server 10.0.0.4:8000 max_fails=2 fail_timeout=5s;
    server 10.0.0.5:8000 max_fails=2 fail_timeout=5s;
    keepalive 32;
}

# 3. Judge Compute Execution Endpoints
upstream judge_peers {
    least_conn;
    server 10.0.0.6:8080 max_fails=1 fail_timeout=3s; # Cloud Sandbox
    server 10.0.0.7:8080 max_fails=1 fail_timeout=3s; # Dedicated Laptop
    keepalive 16;
}
```

---

### 3. Dynamic Configuration & Atomic Zero-Downtime Reload

Peers join and leave dynamically. Rather than manual config edits, each router peer runs a lightweight Python synchronizer (`scripts/peer_sync_router.py`):

1. **Watch Registry**: Polls `ccc:peers:active` in Redis every 5 seconds.
2. **Filter Qualified Peers**: Discards `DEGRADED`, `DRAINING`, and `OFFLINE` peers.
3. **Generate Atomic Config**: Writes new upstream definitions to a temporary staging file (`/etc/nginx/conf.d/peer-upstreams.conf.tmp`).
4. **Validation Barrier**: Runs `nginx -t -c /etc/nginx/nginx.conf`.
   - If syntax or network resolution fails, the staging file is discarded, and current running configuration remains untouched.
5. **Atomic Promotion**: Moves temporary file over production config (`mv -f`).
6. **Graceful Reload**: Triggers `nginx -s reload` (zero dropped packets, existing connections drain gracefully).
