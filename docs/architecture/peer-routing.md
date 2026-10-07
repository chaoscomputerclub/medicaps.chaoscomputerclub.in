# Peer Routing Algorithm
## Dynamic, Capacity-Aware, Multi-Factor Peer Selection

---

### 1. Six-Stage Filtering Pipeline

When a request or background job requires dispatch to a peer, the `PeerRouter` executes a strict six-stage pipeline:

```
[ All Registered Peers ]
         │
         ▼ (Stage 1: Health Filter)
[ Exclude: OFFLINE, SUSPECT, REMOVED ]
         │
         ▼ (Stage 2: Capability Match)
[ Exclude: Missing required roles or language runtimes ]
         │
         ▼ (Stage 3: Capacity Filter)
[ Exclude: active_jobs >= max_concurrency or CPU > 95% ]
         │
         ▼ (Stage 4: Quota & State Filter)
[ Exclude: DRAINING or quota_state == EXHAUSTED ]
         │
         ▼ (Stage 5: Multi-Factor Scoring)
[ Compute composite score S for each eligible peer ]
         │
         ▼ (Stage 6: Weighted Deterministic Selection)
[ Selected Peer Instance ]
```

---

### 2. Multi-Factor Scoring Formula

For each candidate peer $p$, the routing score $S(p)$ is computed as:

$$S(p) = w_h \cdot H(p) + w_c \cdot C(p) - w_l \cdot L(p) + w_q \cdot Q(p) + w_r \cdot R(p)$$

Where:
- $H(p) \in [0, 1]$: Health index ($1.0$ if `HEALTHY`, $0.4$ if `DEGRADED`).
- $C(p) = 1.0 - \frac{\text{active\_jobs}}{\text{max\_concurrency}}$: Normalized headroom.
- $L(p) = \frac{\text{latency\_ms}}{1000}$: Measured round-trip network latency.
- $Q(p) \in [0, 1]$: Quota headroom ($1.0$ for `NORMAL`, $0.3$ for `WARNING`).
- $R(p) \in [0, 1]$: Historical uptime & job finalization success rate over the last 100 attempts.

Default weights:
- $w_h = 3.0$ (Health is paramount)
- $w_c = 2.5$ (Balance load across free-tier compute)
- $w_l = 1.5$ (Prefer regional peers close to Medi-Caps campus)
- $w_q = 2.0$ (Avoid burning exhausted free-tier accounts)
- $w_r = 1.0$ (Penalize unstable or flaky nodes)
