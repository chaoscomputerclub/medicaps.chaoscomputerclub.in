#!/usr/bin/env bash
# ==============================================================================
# Chaos Computer Club — Medi-Caps Chapter
# scripts/deploy_railway_judge.sh — Connect Railway Judge Container to Backend Fabric
#
# Usage:
#   ./scripts/deploy_railway_judge.sh https://<your-judge-service>.up.railway.app
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
  echo -e "${RED}Usage: $0 <RAILWAY_JUDGE_URL>${NC}"
  echo "Example: $0 https://ccc-judge.up.railway.app"
  exit 1
fi

JUDGE_URL="$1"
JUDGE_URL="${JUDGE_URL%/}"

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}⚡ REGISTERING RAILWAY JUDGE SANDBOX WITH CCC BACKEND FABRIC     ${NC}"
echo -e "${BLUE}================================================================${NC}"

echo -e "→ Target Railway Judge Endpoint: ${GREEN}${JUDGE_URL}${NC}"

# Update Cloudflare Worker JUDGE_PEERS
WRANGLER_FILE="${ROOT_DIR}/infra/cloudflare/wrangler.toml"
CURRENT_JUDGES=$(grep "JUDGE_PEERS" "${WRANGLER_FILE}" | sed -E 's/.*JUDGE_PEERS = "([^"]*)".*/\1/' || true)

if [ -z "${CURRENT_JUDGES}" ]; then
  NEW_JUDGES="${JUDGE_URL}"
elif [[ "${CURRENT_JUDGES}" != *"${JUDGE_URL}"* ]]; then
  NEW_JUDGES="${CURRENT_JUDGES},${JUDGE_URL}"
else
  NEW_JUDGES="${CURRENT_JUDGES}"
fi

if grep -q "JUDGE_PEERS" "${WRANGLER_FILE}"; then
  sed -i '' "s|JUDGE_PEERS = .*|JUDGE_PEERS = \"${NEW_JUDGES}\"|g" "${WRANGLER_FILE}" 2>/dev/null || \
  sed -i "s|JUDGE_PEERS = .*|JUDGE_PEERS = \"${NEW_JUDGES}\"|g" "${WRANGLER_FILE}"
else
  echo "JUDGE_PEERS = \"${NEW_JUDGES}\"" >> "${WRANGLER_FILE}"
fi

# Deploy Cloudflare Worker
cd "${ROOT_DIR}/infra/cloudflare"
export CLOUDFLARE_API_KEY="${CLOUDFLARE_API_KEY:-}"
export CLOUDFLARE_EMAIL="${CLOUDFLARE_EMAIL:-}"
npx wrangler deploy

echo -e "\n${GREEN}✓ Railway Judge Sandbox successfully connected to CCC Fabric!${NC}"
