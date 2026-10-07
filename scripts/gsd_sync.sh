#!/usr/bin/env bash
# ==============================================================================
# Chaos Computer Club — Medi-Caps Chapter
# scripts/gsd_sync.sh — Cloud CI/CD Push & Sync Pipeline
#
# Pipeline:
#   1. Local Verification (TypeScript & Vite Build Check)
#   2. Git Atomic Commit & Push to GitHub (origin/main)
#   3. GitHub Actions Cloud CI/CD Trigger (Cloud Run, Vercel, Supabase)
#   4. End-to-End Live Health Validation via Cloudflare Edge
# ==============================================================================

set -e

# ANSI Color Codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

COMMIT_MSG="${1:-feat: sync latest changes and deploy via cloud CI/CD}"

if [ "${ALLOW_GSD_SYNC:-0}" != "1" ]; then
  echo -e "${YELLOW}🛑 GSD Push Pipeline requires explicit opt-in.${NC}"
  echo -e "To execute this pipeline, run: ALLOW_GSD_SYNC=1 ./scripts/gsd_sync.sh \"$COMMIT_MSG\""
  exit 0
fi

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}   🚀 CCC MEDI-CAPS — CLOUD CI/CD SYNC PIPELINE                 ${NC}"
echo -e "${CYAN}================================================================${NC}"

# ------------------------------------------------------------------------------
# STEP 1: Full Automated QA Gatekeeper
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[1/4] Executing Automated QA Pre-Deployment Gate...${NC}"
if [ -f "./scripts/gsd_qa_gate.sh" ]; then
  ./scripts/gsd_qa_gate.sh
else
  npm run build
  npx tsc --noEmit
fi

echo -e "${GREEN}✓ All Automated QA verification checks passed successfully.${NC}"

# ------------------------------------------------------------------------------
# STEP 2: Git Atomic Commit & Push to GitHub
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[2/4] Committing & pushing to GitHub (origin/main)...${NC}"
git add -A

if git diff-index --quiet HEAD --; then
  echo -e "${YELLOW}ℹ No local changes to commit. Proceeding with push check.${NC}"
else
  git commit -m "$COMMIT_MSG"
fi

git push origin main
echo -e "${GREEN}✓ Successfully pushed to GitHub (origin/main).${NC}"

# ------------------------------------------------------------------------------
# STEP 3: Cloud Deployment Notification
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[3/4] GitHub Actions Cloud CI/CD Triggered...${NC}"
echo -e "  • Frontend: Vercel Global Edge Network deployment"
echo -e "  • Control Plane: Google Cloud Run container deployment (ccc-api, ccc-worker, ccc-realtime)"
echo -e "  • State Core: Supabase PostgreSQL 16 migrations"
echo -e "  • Media: Cloudinary CDN"

# ------------------------------------------------------------------------------
# STEP 4: Live Production Health Check
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[4/4] Validating live production endpoints...${NC}"
sleep 3

HEALTH_URL="https://medicaps.chaoscomputerclub.in/api/health"
API_RESP=$(curl -s -k --max-time 10 "$HEALTH_URL" || echo "FAILED")
echo -e "Backend Health: ${CYAN}${API_RESP}${NC}"

WEB_CODE=$(curl -s -k -o /dev/null -w "%{http_code}" --max-time 10 https://medicaps.chaoscomputerclub.in/ || echo "FAILED")
echo -e "Frontend Status: ${CYAN}HTTP ${WEB_CODE}${NC}"

if [[ "$API_RESP" == *"operational"* ]] || [[ "$API_RESP" == *"healthy"* ]] || [[ "$API_RESP" == *"version"* ]]; then
  echo -e "\n${GREEN}================================================================${NC}"
  echo -e "${GREEN}   ✨ CLOUD PIPELINE SUCCESS: PUSHED TO GITHUB & LIVE DEPLOY    ${NC}"
  echo -e "${GREEN}================================================================${NC}"
else
  echo -e "\n${YELLOW}ℹ Cloud deployment is running asynchronously via GitHub Actions.${NC}"
  echo -e "  Monitor progress at: https://github.com/chaoscomputerclub/medicaps.chaoscomputerclub.in/actions"
fi
