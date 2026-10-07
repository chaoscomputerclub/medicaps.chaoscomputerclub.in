# CCC Medi-Caps — Disaster Recovery & Business Continuity Plan

> **Recovery Point Objective (RPO)**: $\le 1$ minute for contest submissions; 0 seconds for committed scoreboard state.  
> **Recovery Time Objective (RTO)**: $\le 5$ minutes for stateless compute; $\le 15$ minutes for total database restore.

---

## 1. Disposability & Independence Principle

Every compute layer is replaceable.  
Every cache is disposable.  
Every judge node is disposable.  
If the old 4 GB VPS hardware disappears entirely, the platform continues to run normally on Cloudflare, Vercel, Cloud Run, Supabase, Cloudinary, and distributed Go judge nodes.

---

## 2. Disaster Recovery Scenarios & Procedures

### Scenario 1: Complete PostgreSQL Failure / Corruption on Supabase
1. **Diagnosis**: Database connection pool throws consecutive timeout errors; Supabase status reports regional disruption.
2. **Mitigation**:
   - Locate the most recent automated daily logical dump or point-in-time recovery WAL checkpoint.
   - Run the automated restore script against the secondary fallback database (e.g. Neon, Aiven, or local standby):
     ```bash
     pg_restore -h $STANDBY_DB_HOST -p 5432 -U postgres -d ccc_medicaps -c ccc_medicaps_backup.dump
     ```
   - Update `DATABASE_URL` secret on Google Cloud Run:
     ```bash
     gcloud run services update ccc-api --set-env-vars DATABASE_URL="$STANDBY_DATABASE_URL"
     gcloud run services update ccc-worker --set-env-vars DATABASE_URL="$STANDBY_DATABASE_URL"
     ```
   - Cloud Run containers roll out new revision in 30 seconds.

### Scenario 2: Complete Redis Failure / Instance Flush
1. **Diagnosis**: Redis commands return connection refused; pub/sub messages cease.
2. **Mitigation**:
   - Restart Redis or provision a new Upstash/Cloud instance.
   - Point Cloud Run to the new `REDIS_HOST` and `REDIS_PASSWORD`.
   - Run the database reconciliation command:
     ```bash
     python3 -m app.scripts.reconcile_unfinalized_jobs
     ```
   - Outbox events marked `PENDING` are picked up by `ccc-worker` and broadcast into the fresh Redis instance.
   - Active judge nodes automatically reconnect and re-register their capabilities.

### Scenario 3: Cloud Run Regional Outage
1. **Diagnosis**: Google Cloud region reports outage; HTTP 503 on Cloud Run ingress.
2. **Mitigation**:
   - Deploy container image to secondary region (`us-central1` or `asia-east1`):
     ```bash
     gcloud run deploy ccc-api --region us-central1 --image gcr.io/$PROJECT_ID/ccc-api:latest
     ```
   - Or start `ccc-medicaps-api.service` on the standby VPS host.
   - Repoint Cloudflare DNS `medicaps-api.chaoscomputerclub.in` to the secondary endpoint.

### Scenario 4: All Distributed Judge Nodes Disconnect
1. **Diagnosis**: `ccc:nodes:registered` set is empty or all heartbeats expired.
2. **Mitigation**:
   - Submissions accumulate safely in PostgreSQL (`QUEUED`) and Redis queue (`ccc:queue:fabric:pending`).
   - Organizer or student launches Go `node-agent` on any available laptop or workstation:
     ```bash
     ./ccc-node-agent --server https://medicaps-api.chaoscomputerclub.in --secret $JUDGE_AGENT_SECRET
     ```
   - Node agent registers, claims accumulated jobs, and drains the backlog within seconds.
   - No submissions are lost; students see pending spinner until judging catches up.
