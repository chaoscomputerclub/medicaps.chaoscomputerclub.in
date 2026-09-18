#!/usr/bin/env bash
# ==============================================================================
# Chaos Computer Club — Medi-Caps Chapter
# scripts/gsd_sync.sh — GET SHIT DONE (GSD) GitHub Push & Server Sync Protocol
#
# Pipeline:
#   1. Local Verification (TypeScript & Vite Build Check)
#   2. Git Atomic Commit & Push to GitHub (origin/main)
#   3. Server Auto-Pull (root@143.198.38.205)
#   4. Production Backend & Frontend Sync & Service Reload
#   5. End-to-End Live Health Validation
# ==============================================================================

set -e

# ANSI Color Codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SERVER_HOST="143.198.38.205"
SERVER_USER="root"
SSH_KEY="$HOME/.ssh/shopground_era_key"
REMOTE_REPO="/root/projects/medicaps.chaoscomputerclub.in"
REMOTE_API_DIR="/root/projects/ccc-medicaps-api"
REMOTE_WEB_DIR="/var/www/ccc-medicaps"
REMOTE_ADMIN_DIR="/var/www/ccc-medicaps-admin"

COMMIT_MSG="${1:-feat: sync latest changes and deploy via GSD framework}"

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}   🚀 CCC MEDI-CAPS — GET SHIT DONE (GSD) SYNC PIPELINE        ${NC}"
echo -e "${CYAN}================================================================${NC}"

# ------------------------------------------------------------------------------
# STEP 1: Full Automated QA Gatekeeper (Local Build, In-Process API, and Action Simulation)
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[1/5] Executing GSD Automated QA Pre-Deployment Gate...${NC}"
./scripts/gsd_qa_gate.sh

echo -e "${GREEN}✓ All Automated QA verification checks passed successfully.${NC}"

# ------------------------------------------------------------------------------
# STEP 2: Git Atomic Commit & Push to GitHub
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[2/5] Committing & pushing to GitHub (origin/main)...${NC}"
git add -A

if git diff-index --quiet HEAD --; then
  echo -e "${YELLOW}ℹ No local changes to commit. Proceeding with push/sync check.${NC}"
else
  git commit -m "$COMMIT_MSG"
  echo -e "${GREEN}✓ Committed: $COMMIT_MSG${NC}"
fi

git push origin main
echo -e "${GREEN}✓ Successfully pushed to GitHub (origin/main).${NC}"

# ------------------------------------------------------------------------------
# STEP 3: Server Remote Pull
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[3/5] Pulling latest commits on remote server (${SERVER_HOST})...${NC}"

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_HOST}" "
  set -e
  echo '→ Pulling repository in ${REMOTE_REPO}...'
  cd ${REMOTE_REPO}
  git pull origin main
"

echo -e "${GREEN}✓ Remote repository updated to latest main commit.${NC}"

# ------------------------------------------------------------------------------
# STEP 4: Sync & Reload Production Services
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[4/5] Deploying backend updates & restarting server services...${NC}"

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_HOST}" "
  set -e
  # 1. Sync backend application files
  echo '→ Updating backend services...'
  rsync -av --delete \
    --exclude '.env' \
    --exclude 'keys' \
    --exclude 'venv' \
    --exclude '__pycache__' \
    --exclude '.pytest_cache' \
    ${REMOTE_REPO}/backend/ ${REMOTE_API_DIR}/

  # 2. Ensure official contest state is initialized with canonical schedule
  echo '→ Updating official contest schedule in production DB...'
  cd ${REMOTE_API_DIR}
  venv/bin/python scripts/launch_official_contests.py --force || true

  # 3. Restart FastAPI backend systemd service
  systemctl restart ccc-medicaps-api.service
  echo '→ Backend service restarted.'
"

  # 3. Sync local pre-built verified student portal to remote web directory
  echo '→ Syncing verified student portal frontend bundle...'
  rsync -avz -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" dist/ "${SERVER_USER}@${SERVER_HOST}:${REMOTE_WEB_DIR}/.output/public/"

  # 4. Sync local pre-built verified admin console to remote admin web directory
  echo '→ Syncing verified admin console frontend bundle...'
  ssh -n -i "$SSH_KEY" -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_HOST}" "mkdir -p ${REMOTE_ADMIN_DIR}"
  rsync -avz -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" dist-admin/ "${SERVER_USER}@${SERVER_HOST}:${REMOTE_ADMIN_DIR}/"

  ssh -n -i "$SSH_KEY" -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_HOST}" "
    systemctl reload nginx
  "

echo -e "${GREEN}✓ Services deployed and restarted successfully.${NC}"

# ------------------------------------------------------------------------------
# STEP 5: Live Production Health Check
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[5/5] Validating live production endpoints...${NC}"
sleep 2

API_RESP=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_HOST}" "curl -s http://127.0.0.1:8002/api/health" || echo "FAILED")
echo -e "Backend Health: ${CYAN}${API_RESP}${NC}"

WEB_CODE=$(curl -s -k -o /dev/null -w "%{http_code}" --max-time 10 https://medicaps.chaoscomputerclub.in/ || echo "FAILED")
echo -e "Frontend Status: ${CYAN}HTTP ${WEB_CODE}${NC}"

if [[ "$API_RESP" == *"operational"* ]]; then
  echo -e "\n${GREEN}================================================================${NC}"
  echo -e "${GREEN}   ✨ GSD PIPELINE SUCCESS: CODE LIVE ON GITHUB & PRODUCTION    ${NC}"
  echo -e "${GREEN}================================================================${NC}"
else
  echo -e "\n${YELLOW}⚠ Warning: Health check returned unexpected output. Please check logs.${NC}"
fi
