#!/usr/bin/env bash
# ==============================================================================
# Chaos Computer Club — Medi-Caps Chapter
# scripts/deploy_render_judge.sh — Connect Render Judge Container to Backend Fabric
#
# Usage:
#   ./scripts/deploy_render_judge.sh https://<your-judge-service>.onrender.com
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ "$#" -lt 1 ]; then
  echo -e "${RED}Usage: $0 <RENDER_JUDGE_URL>${NC}"
  echo "Example: $0 https://ccc-judge-peer.onrender.com"
  exit 1
fi

JUDGE_URL="$1"
JUDGE_URL="${JUDGE_URL%/}"

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}⚡ REGISTERING RENDER JUDGE SANDBOX WITH CCC BACKEND FABRIC      ${NC}"
echo -e "${BLUE}================================================================${NC}"

echo -e "→ Target Render Judge Endpoint: ${GREEN}${JUDGE_URL}${NC}"

# Update Cloudflare Worker JUDGE_PEERS
WRANGLER_FILE="${ROOT_DIR}/infra/cloudflare/wrangler.toml"
if grep -q "JUDGE_PEERS" "${WRANGLER_FILE}"; then
  sed -i '' "s|JUDGE_PEERS = .*|JUDGE_PEERS = \"${JUDGE_URL}\"|g" "${WRANGLER_FILE}" 2>/dev/null || \
  sed -i "s|JUDGE_PEERS = .*|JUDGE_PEERS = \"${JUDGE_URL}\"|g" "${WRANGLER_FILE}"
else
  echo "JUDGE_PEERS = \"${JUDGE_URL}\"" >> "${WRANGLER_FILE}"
fi

# Deploy Cloudflare Worker
cd "${ROOT_DIR}/infra/cloudflare"
export CLOUDFLARE_API_KEY="${CLOUDFLARE_API_KEY:-}"
export CLOUDFLARE_EMAIL="${CLOUDFLARE_EMAIL:-}"
npx wrangler deploy

echo -e "\n${GREEN}✓ Render Judge Sandbox successfully connected to CCC Fabric!${NC}"
