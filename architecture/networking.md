# Network Topology & Outbound NAT Traversal Specification
## Chaos Computer Club Medi-Caps Chapter — Dynamic Application & Compute Fabric

---

### 1. Ingress & Edge Network Topology

```
                  INTERNET CLIENTS
                         │
                         ▼
             ┌────────────────────────┐
             │       Cloudflare       │
             │   Global Edge Ingress  │
             │ (TLS, DDoS, Real-IP)   │
             └───────────┬────────────┘
                         │
                         ▼
             ┌────────────────────────┐
             │  GLOBAL FABRIC ROUTER  │
             │ (Control Plane VPS)    │
             └───────────┬────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        │ Outbound TLS   │ Outbound TLS   │ Outbound TLS
        │ Reverse Stream │ Reverse Stream │ Reverse Stream
        ▼                ▼                ▼
   ┌─────────┐      ┌─────────┐      ┌─────────┐
   │ NODE 1  │      │ NODE 2  │      │ NODE 3  │
   │ Laptop  │      │ Desktop │      │ Lab PC  │
   │ behind  │      │ behind  │      │ behind  │
   │ NAT /   │      │ CGNAT / │      │ Uni Wi-Fi│
   │ Wi-Fi   │      │ Home IP │      │ Firewall│
   └─────────┘      └─────────┘      └─────────┘
```

---

### 2. Zero-Inbound-Port Model

Compute nodes (e.g. laptops booted from USB) run in hostile, unroutable network environments:
- University Wi-Fi client isolation (peer-to-peer traffic blocked).
- Carrier-Grade NAT (CGNAT) with dynamic IP allocation.
- Inbound firewall rules blocking all incoming TCP/UDP ports.

**Protocol Guarantee**:
- Nodes **never** listen on public internet ports.
- All connections are initiated **outbound** from the node to the cloud control plane over TLS (port 443).
- The Go agent maintains a persistent outbound multiplexed reverse tunnel (`/api/v1/fabric/tunnel/{node_id}`).
- Standard HTTP/1.1 and HTTP/2 request frames flow through the tunnel to the node's local load balancer without opening port forwardings or UPnP.

---

### 3. Reconnection Engine & Backoff Algorithm

The Go Network Manager continuously evaluates transport health:
1. **Liveness Probe**: Emits TCP keep-alive frames every 10 seconds; drops tunnel if ACK missing after 3 attempts.
2. **Exponential Backoff with Full Jitter**:
   $$T_{\text{wait}} = \text{random}(0, \min(T_{\text{max}}, T_{\text{base}} \times 2^{\text{attempt}}))$$
   - $T_{\text{base}} = 1.0\text{ s}$
   - $T_{\text{max}} = 30.0\text{ s}$
3. **State Reconciliation**:
   Upon reconnection, the node agent does not blindly resume polling. It invokes `POST /api/v1/nodes/register` to reconcile its capabilities and active job leases with the control plane.

---

### 4. Workload Separation & Communication Transport Matrix

To avoid building a bloated monolithic multiplexing protocol over a single transport, the fabric strictly separates communication channels by workload:

| Workload / Channel | Transport | Path / Mechanism | Purpose |
| :--- | :--- | :--- | :--- |
| **Public Browser Ingress** | HTTPS / TLS | `Cloudflare` $\rightarrow$ `Nginx` $\rightarrow$ `FastAPI` | Student portal, auth, problem view, leaderboard. |
| **Realtime Updates** | SSE over HTTPS | `/api/v1/events/stream` | Server-Sent Events pushed to connected student browsers. |
| **Internal Control & Execution** | **gRPC over HTTP/2 + TLS** | `proto/fabric.proto` on `:50051` | Node registration, 5s heartbeats, atomic job leasing, result submission, bidirectional streaming. |
| **Application Reverse Proxy** | WSS (WebSocket) | `/api/v1/fabric/tunnel/{id}` | Optional reverse routing for public HTTP requests down to remote nodes. |
| **Coordination & Outbox** | Redis Protocol | Private network (`6379`) | Job queues, 300s leases, SSE pub/sub, single-flight locks. |
| **Authoritative Durable State**| Postgres Wire | Private network (`5432`) | Authoritative persistence for users, contests, submissions, scoreboards. |
| **Untrusted Code Execution** | Docker Engine API | Local unix socket (`/var/run/docker.sock`) | Isolated container runtimes (`--network none`, RAM tmpfs workspaces). |

#### Why gRPC over HTTP/2 for Node ↔ Cloud:
1. **Built-in Multiplexing**: HTTP/2 multiplexes concurrent RPCs over a single persistent TCP/TLS connection without head-of-line blocking.
2. **Strong Typed Contracts**: Protocol Buffers (`fabric.proto`) eliminate manual JSON parsing errors and wire ambiguity.
3. **Low Latency & Low Overhead**: Binary protobuf serialization reduces bandwidth by up to 70% compared to JSON over REST, preserving university Wi-Fi bandwidth.
4. **Deadlines & Cancellation**: Native context deadlines automatically cancel hanging testcase compilations when timeouts occur.

