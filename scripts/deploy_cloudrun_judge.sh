#!/usr/bin/env bash
# ==============================================================================
# Chaos Computer Club — Medi-Caps Chapter
# scripts/deploy_cloudrun_judge.sh — Google Cloud Run Judge Service Deployer
#
# Builds and deploys ONLY the isolated Judge microservice container to Google Cloud Run.
# The Cloudflare Worker Control Plane routes code execution jobs directly to this service.
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}⚡ CCC CLOUD RUN JUDGE MICROSERVICE DEPLOYMENT ${NC}"
echo -e "${CYAN}================================================================${NC}"

PROJECT_ID="${GCP_PROJECT_ID:-chaos-computer-club}"
REGION="${GCP_REGION:-asia-south1}"
SERVICE_NAME="ccc-judge"
IMAGE_TAG="v1.0.10"

echo -e "\n${CYAN}1. Verifying GCP & Project Configuration...${NC}"
echo "• Target Project: ${PROJECT_ID}"
echo "• Target Region:  ${REGION}"
echo "• Service Name:   ${SERVICE_NAME}"
echo "• Version:        ${IMAGE_TAG}"

if ! command -v gcloud &> /dev/null; then
  echo -e "${RED}✗ gcloud CLI not found in PATH.${NC}"
  exit 1
fi

echo -e "\n${CYAN}2. Verifying Project Billing & Services...${NC}"
BILLING_ENABLED=$(gcloud billing projects describe "${PROJECT_ID}" --format='value(billingEnabled)' 2>/dev/null || echo "false")
if [ "${BILLING_ENABLED}" != "true" ]; then
  echo -e "${RED}✗ Billing is not currently enabled for project '${PROJECT_ID}'.${NC}"
  echo -e "Please link an active billing account at:"
  echo -e "  https://console.cloud.google.com/billing/linkedaccount?project=${PROJECT_ID}"
  exit 1
fi

echo -e "→ Enabling Cloud Run and Build APIs..."
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com --project "${PROJECT_ID}"

echo -e "\n${CYAN}3. Submitting Build & Deploying Judge to Cloud Run...${NC}"
gcloud run deploy "${SERVICE_NAME}" \
  --source infra/cloudrun-judge \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --timeout 30

JUDGE_URL=$(gcloud run services describe "${SERVICE_NAME}" --project "${PROJECT_ID}" --region "${REGION}" --format='value(status.url)')

if [ -n "${JUDGE_URL}" ]; then
  echo -e "\n${GREEN}✓ Judge successfully deployed to Cloud Run:${NC} ${JUDGE_URL}"
  
  echo -e "\n${CYAN}4. Linking Judge Endpoint to Cloudflare Worker Control Plane...${NC}"
  cd infra/cloudflare
  
  # Update wrangler.toml with the active JUDGE_URL
  sed -i '' "s|JUDGE_URL = \".*\"|JUDGE_URL = \"${JUDGE_URL}\"|g" wrangler.toml || sed -i "s|JUDGE_URL = \".*\"|JUDGE_URL = \"${JUDGE_URL}\"|g" wrangler.toml
  
  CLOUDFLARE_API_KEY="${CLOUDFLARE_API_KEY:-}" \
  CLOUDFLARE_EMAIL="${CLOUDFLARE_EMAIL:-}" \
  npx wrangler deploy
  
  echo -e "\n${GREEN}✓ Cloudflare Worker now actively routing execution to:${NC} ${JUDGE_URL}"
fi

echo -e "\n================================================================"
echo -e "${GREEN}🎉 Distributed Cloud Architecture Fully Operational!${NC}"
echo -e "================================================================"
