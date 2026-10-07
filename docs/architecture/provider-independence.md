# Provider Independence Architecture
## Strict Provider Decoupling & Elimination of Vendor Lock-in

---

### 1. The Anti-Pattern: Provider-Coupled Logic

The following code pattern is **STRICTLY FORBIDDEN** anywhere in the CCC codebase:

```python
# ❌ FORBIDDEN: Anti-pattern violating provider independence
if provider == "render":
    handle_render_request()
elif provider == "cloud-run":
    call_cloud_run_service()
elif provider == "railway":
    use_railway_db()
```

### 2. The Solution: Capability-Driven Routing

Business code interacts exclusively with abstract **Peer Roles** and **Capabilities**:

```python
# ✅ CORRECT: Capability-driven federated dispatch
candidate_peers = await peer_router.select_peers(
    required_roles=[PeerType.API_PEER],
    min_capacity=1,
    exclude_quota_states=[QuotaState.EXHAUSTED]
)
```

The underlying infrastructure provider (whether Cloud Run, Render, Railway, Koyeb, Northflank, Fly.io, or an on-premise workstation) is purely an **execution container**, completely transparent to:
- Contest state machines
- Problem evaluation logic
- User authentication and session verification
- Scoreboard calculation and rating deltas

---

### 3. Dynamic Addition of a Provider

To introduce a new cloud provider (e.g. Koyeb or Fly.io):
1. **Deploy Standard Container**: Deploy the unified container image `ccc-peer:v1.0.10` with standard environment variables (`DATABASE_URL`, `REDIS_URL`, `PEER_ROLES`).
2. **Auto-Enrollment**: On startup, the container broadcasts `POST /internal/v1/peers/register`.
3. **Health Validation**: Neighbor peers probe its `/internal/v1/health` endpoint.
4. **Traffic Onboarding**: Nginx routers detect the new healthy peer in the Redis registry and begin routing traffic within 5 seconds.
5. **Zero Deployments**: No database migration, no frontend build, and no code alterations are required.

---

### 4. Safe Provider Eviction & Draining

To safely retire or scale down a provider:
1. Signal the peer: `POST /internal/v1/peers/drain`.
2. The peer transitions to `DRAINING` state:
   - Ingress immediately stops routing new user requests to it.
   - Active in-flight requests and background jobs run to completion.
3. The peer unregisters itself and halts: state remains 100% consistent across PostgreSQL and Redis.
