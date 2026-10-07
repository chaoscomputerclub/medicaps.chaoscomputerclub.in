# Failure Domains & Blast Radius Mitigation
## Fault Tolerance Matrix Across Federated Peers

---

### 1. Component Failure Matrix

| Component | Failure Mode | System Behavior | Data Impact | Recovery Action |
|---|---|---|---|---|
| **Cloudflare Edge** | Cloudflare network outage | Route via direct fallback DNS (Hostinger/Route53) | None | DNS anycast failover |
| **Cloudflare Worker** | Worker runtime exception | Failover to alternate route / raw origin IP | None | Cloudflare automatic error bypass |
| **Nginx Router Peer** | Router instance crashes | Worker selects Router Peer 2 within $<50\text{ms}$ | Zero loss | Ingress continues transparently |
| **API Service Peer** | Cloud instance terminated | Router evicts peer; retries request on sibling peer | Zero loss | Stateless idempotency protects DB |
| **Worker Peer** | Background daemon killed | Leases expire in Redis; sibling worker claims job | Zero loss | Idempotent outbox reprocessing |
| **Realtime SSE Peer** | Stream gateway closes | Browser client reconnects sending `Last-Event-ID` | Zero loss | Redis replay buffer catches up |
| **Judge Compute Peer** | Machine crashes during compile | Job lease TTL expires in Redis ($30\text{s}$) | Zero loss | Requeued to another healthy judge |
| **PostgreSQL 16** | Unreachable | Read-only cache-aside mode; mutations queue | Preserved | Transaction rollback / connection pool recovery |
| **Redis 7** | Failover / transient drop | Fall back to direct in-process queues & local cache | Zero loss | Redis cluster auto-reconnect |

---

### 2. Strict CAS Fencing Guarantee

Under no circumstances can an untrusted or stale judge execution corrupt competition results. The state machine enforces:

```sql
UPDATE judge_jobs 
SET status = 'COMPLETED', 
    verdict = :verdict, 
    score = :score, 
    finalized_at = NOW() 
WHERE id = :job_id 
  AND active_attempt_id = :attempt_id;
```

If a judge peer experiences a network partition and reports results after its lease has been revoked and reassigned, the database update matches zero rows. The stale result is silently discarded, and the new attempt retains sole authority.
