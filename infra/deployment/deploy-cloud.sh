#!/usr/bin/env bash
# ==============================================================================
# Production Cloud Deployment Script
# Chaos Computer Club — Medi-Caps Chapter
#
# Deploys to the distributed free-tier infrastructure:
# 1. Frontend -> Vercel Global Edge Network
# 2. Control Plane Containers -> Google Cloud Run (ccc-api, ccc-worker, ccc-realtime)
# 3. Edge Routing -> Cloudflare Workers
# ==============================================================================
set -euo pipefail

echo "============================================================"
echo "⚡ [CCC] Production Cloud Infrastructure Deployment"
echo "============================================================"

# Step 1: Build & Deploy Frontend to Vercel
echo "--> 1. Deploying Frontend to Vercel Edge..."
if command -v vercel &> /dev/null; then
  npm run build
  vercel --prod --yes
  echo "✓ Frontend deployed to Vercel."
else
  echo "ℹ vercel CLI not installed locally. Deploying via GitHub Actions."
fi

# Step 2: Deploy Cloud Run Services
echo "--> 2. Deploying Control Plane to Google Cloud Run..."
if command -v gcloud &> /dev/null; then
  PROJECT_ID="${GCP_PROJECT_ID:-ccc-medicaps}"
  IMAGE="gcr.io/${PROJECT_ID}/ccc-arena-backend:latest"
  docker build -t "$IMAGE" -f infra/cloudrun/Dockerfile backend/
  docker push "$IMAGE"

  echo "→ Deploying ccc-api..."
  gcloud run deploy ccc-api --image "$IMAGE" --region us-central1 --max-instances 3 --min-instances 0 --memory 512Mi --set-env-vars SERVICE_MODE=api,ALLOW_UNSANDBOXED_EXECUTION=false
  
  echo "→ Deploying ccc-worker..."
  gcloud run deploy ccc-worker --image "$IMAGE" --region us-central1 --max-instances 2 --min-instances 0 --memory 512Mi --set-env-vars SERVICE_MODE=worker,ALLOW_UNSANDBOXED_EXECUTION=false

  echo "→ Deploying ccc-realtime..."
  gcloud run deploy ccc-realtime --image "$IMAGE" --region us-central1 --max-instances 2 --min-instances 0 --memory 512Mi --set-env-vars SERVICE_MODE=realtime,ALLOW_UNSANDBOXED_EXECUTION=false
  echo "✓ Cloud Run services updated."
else
  echo "ℹ gcloud CLI not installed locally. Deploying via GitHub Actions."
fi

# Step 3: Verify Live Production Ingress
echo "--> 3. Verifying Live Edge Health..."
curl -s -k --max-time 10 https://medicaps.chaoscomputerclub.in/api/health | jq . || true
echo "=== Production Cloud Deployment Verification Completed ==="
