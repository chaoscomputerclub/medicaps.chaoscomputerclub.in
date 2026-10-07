# CCC Medi-Caps — Production Runbook & Operations Guide

> **Target Audience**: SREs, DevOps Engineers, and Platform Administrators  
> **Platform**: Chaos Computer Club Medi-Caps Chapter Competitive Programming Arena

---

## 1. Routine Deployment Procedures

### 1.1 Frontend Deployment to Vercel
```bash
# 1. Typecheck and build locally
npm run build

# 2. Deploy to Vercel production
npx vercel --prod --token "$VERCEL_TOKEN"
```
Verification:
- Inspect `https://medicaps.chaoscomputerclub.in/`
- Verify HTTP 200, clean console, and proper asset caching.

### 1.2 Backend Deployment to Google Cloud Run
```bash
# 1. Build and push multi-target container image
docker build -t gcr.io/$GCP_PROJECT/ccc-backend:v1.0.10 -f infra/cloudrun/Dockerfile .
docker push gcr.io/$GCP_PROJECT/ccc-backend:v1.0.10

# 2. Deploy ccc-api (REST endpoints)
gcloud run deploy ccc-api \
  --image gcr.io/$GCP_PROJECT/ccc-backend:v1.0.10 \
  --region asia-south1 \
  --set-env-vars SERVICE_MODE=api,VERSION=1.0.10 \
  --max-instances 3 \
  --memory 512Mi \
  --allow-unauthenticated

# 3. Deploy ccc-worker (Background outbox processor)
gcloud run deploy ccc-worker \
  --image gcr.io/$GCP_PROJECT/ccc-backend:v1.0.10 \
  --region asia-south1 \
  --set-env-vars SERVICE_MODE=worker,VERSION=1.0.10 \
  --max-instances 2 \
  --memory 512Mi \
  --no-allow-unauthenticated

# 4. Deploy ccc-realtime (SSE stream gateway)
gcloud run deploy ccc-realtime \
  --image gcr.io/$GCP_PROJECT/ccc-backend:v1.0.10 \
  --region asia-south1 \
  --set-env-vars SERVICE_MODE=realtime,VERSION=1.0.10 \
  --max-instances 3 \
  --memory 512Mi \
  --allow-unauthenticated
```

### 1.3 Launching Distributed Go Judge Nodes
On any student or organizer workstation:
```bash
cd node-agent
# Build standalone binary
go build -o ccc-node-agent ./cmd/node-agent

# Run with connection to cloud control plane
./ccc-node-agent \
  --server https://medicaps-api.chaoscomputerclub.in \
  --secret "$JUDGE_AGENT_SECRET" \
  --concurrency 4
```

---

## 2. Health & Telemetry Verification Commands

```bash
# 1. API Health & Version Verification
curl -s -i https://medicaps-api.chaoscomputerclub.in/api/health

# 2. Active Judge Nodes & Fabric Capacity
curl -s -H "Authorization: Bearer $JUDGE_AGENT_SECRET" \
  https://medicaps-api.chaoscomputerclub.in/api/nodes/stats | jq .

# 3. Queue Depth & Latency
curl -s https://medicaps-api.chaoscomputerclub.in/api/jobs/metrics | jq .

# 4. Verify SSE Event Stream Connectivity
curl -N -H "Accept: text/event-stream" \
  https://medicaps-api.chaoscomputerclub.in/api/events/stream
```
