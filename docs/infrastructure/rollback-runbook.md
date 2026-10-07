# CCC Medi-Caps — Rollback Runbook & Emergency Recovery Procedures

> **Standard Operating Procedure**: The platform operates on a distributed, cloud-native architecture. All rollbacks are executed through cloud revision management and version promotion, with zero reliance on legacy VPS servers or private SSH keys.

---

## 1. Cloud-Native Rollback Matrix

| Layer | Rollback Trigger | Execution Command | Target Rollback Time |
|---|---|---|---|
| **Frontend (Vercel)** | Broken client bundle / runtime error | `vercel rollback <deployment-id>` or promote prior deployment in Vercel Dashboard | < 30 seconds |
| **API Backend (Cloud Run)** | 5xx errors or routing regressions | `gcloud run services update-traffic ccc-api --to-revisions=PREV_REVISION=100` | < 15 seconds |
| **Worker Backend (Cloud Run)** | Queue worker latency / crash loop | `gcloud run services update-traffic ccc-worker --to-revisions=PREV_REVISION=100` | < 15 seconds |
| **Realtime Backend (Cloud Run)** | SSE streaming connection drops | `gcloud run services update-traffic ccc-realtime --to-revisions=PREV_REVISION=100` | < 15 seconds |
| **Edge Router (Cloudflare)** | Edge routing worker regression | `wrangler rollback <deployment-id>` | < 10 seconds |
| **Database (Supabase)** | Bad migration / schema error | Execute Alembic downgrade or restore point-in-time backup in Supabase Dashboard | < 5 minutes |

---

## 2. Step-by-Step Cloud Revision Rollbacks

### 2.1 Reverting API Backend (`ccc-api`)
To instantaneously shift 100% of production traffic to the preceding healthy container revision:
```bash
gcloud run services update-traffic ccc-api \
  --region us-central1 \
  --to-revisions=PREV_REVISION=100
```
Verify the health endpoint immediately:
```bash
curl -s https://medicaps-api.chaoscomputerclub.in/api/health | jq .
```

### 2.2 Reverting Frontend SPA (Vercel Edge)
To roll back the static client bundle without rebuilding:
```bash
# Rollback to the previous production deployment
vercel rollback --token="$VERCEL_TOKEN"
```
Or instantaneously via the Vercel Dashboard $\rightarrow$ Deployments $\rightarrow$ Promote to Production on the previous verified build.

### 2.3 Reverting Cloudflare Worker Routing
```bash
cd infra/cloudflare
npx wrangler rollback
```

---

## 3. Database State Rollback & Point-in-Time Recovery
- Supabase provides automated continuous Write-Ahead Log (WAL) archiving and Point-in-Time Recovery (PITR).
- If accidental data corruption or a catastrophic schema regression occurs:
  1. Open the **Supabase Dashboard** $\rightarrow$ **Database** $\rightarrow$ **Backups**.
  2. Select **Point-in-Time Recovery**.
  3. Choose the exact timestamp (down to the second) prior to the faulty event.
  4. Confirm recovery to restore authoritative database state.

---
*Decommission Notice: The legacy single-server VPS droplet (`143.198.38.205`) and private SSH keys have been fully decommissioned. All production operations and rollbacks are managed via authenticated cloud providers.*
