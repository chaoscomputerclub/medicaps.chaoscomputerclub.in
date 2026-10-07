#!/usr/bin/env bash
# ==============================================================================
# Chaos Computer Club — Medi-Caps Chapter
# scripts/deploy_railway_peer.sh — Connect Railway Backend Peer to Global Edge Load Balancer
#
# Usage:
#   ./scripts/deploy_railway_peer.sh https://<your-service-name>.up.railway.app
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
  echo -e "${RED}Usage: $0 <RAILWAY_URL>${NC}"
  echo "Example: $0 https://ccc-medicaps-backend.up.railway.app"
  exit 1
fi

RAILWAY_URL="$1"
RAILWAY_URL="${RAILWAY_URL%/}"

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}⚡ CONNECTING RAILWAY PEER TO CCC GLOBAL LOAD BALANCER         ${NC}"
echo -e "${BLUE}================================================================${NC}"

echo -e "→ Target Railway Peer: ${GREEN}${RAILWAY_URL}${NC}"

WRANGLER_FILE="${ROOT_DIR}/infra/cloudflare/wrangler.toml"
echo -e "→ Updating ${WRANGLER_FILE}..."

# Retrieve current peers and append Railway peer if not already present
CURRENT_PEERS=$(grep "ROUTER_PEERS" "${WRANGLER_FILE}" | sed -E 's/.*ROUTER_PEERS = "([^"]*)".*/\1/' || true)

if [ -z "${CURRENT_PEERS}" ]; then
  NEW_PEERS="${RAILWAY_URL}"
elif [[ "${CURRENT_PEERS}" != *"${RAILWAY_URL}"* ]]; then
  NEW_PEERS="${CURRENT_PEERS},${RAILWAY_URL}"
else
  NEW_PEERS="${CURRENT_PEERS}"
fi

sed -i '' "s|ROUTER_PEERS = .*|ROUTER_PEERS = \"${NEW_PEERS}\"|g" "${WRANGLER_FILE}" 2>/dev/null || \
sed -i "s|ROUTER_PEERS = .*|ROUTER_PEERS = \"${NEW_PEERS}\"|g" "${WRANGLER_FILE}"

# Deploy Cloudflare Worker
echo -e "→ Deploying Cloudflare Worker edge load balancer..."
cd "${ROOT_DIR}/infra/cloudflare"

export CLOUDFLARE_API_KEY="${CLOUDFLARE_API_KEY:-}"
export CLOUDFLARE_EMAIL="${CLOUDFLARE_EMAIL:-}"
npx wrangler deploy

# Verify probe
echo -e "→ Validating live global edge routing..."
sleep 2
PROBE_RES=$(curl -s -i "https://medicaps.chaoscomputerclub.in/api/health/edge" || true)

echo -e "\n${GREEN}✓ Railway peer successfully registered in global load balancer pool!${NC}"
echo "Probe result:"
echo "${PROBE_RES}" | head -n 15
