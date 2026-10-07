#!/usr/bin/env bash
# ==============================================================================
# Chaos Computer Club — Medi-Caps Chapter
# scripts/deploy_koyeb_peer.sh — Connect Koyeb Peer to Cloudflare Edge Router
#
# Usage:
#   ./scripts/deploy_koyeb_peer.sh https://<your-service-name>.koyeb.app
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
  echo -e "${RED}Usage: $0 <KOYEB_URL>${NC}"
  echo "Example: $0 https://ccc-medicaps-peer.koyeb.app"
  exit 1
fi

KOYEB_URL="$1"
KOYEB_URL="${KOYEB_URL%/}"

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}⚡ CONNECTING KOYEB COMPUTE PEER TO CCC SERVICE FABRIC           ${NC}"
echo -e "${BLUE}================================================================${NC}"

echo -e "→ Target Koyeb Peer: ${GREEN}${KOYEB_URL}${NC}"

# 1. Update wrangler.toml
WRANGLER_FILE="${ROOT_DIR}/infra/cloudflare/wrangler.toml"
echo -e "→ Updating ${WRANGLER_FILE}..."

if grep -q "ROUTER_PEERS" "${WRANGLER_FILE}"; then
  sed -i '' "s|ROUTER_PEERS = .*|ROUTER_PEERS = \"${KOYEB_URL}\"|g" "${WRANGLER_FILE}" || sed -i "s|ROUTER_PEERS = .*|ROUTER_PEERS = \"${KOYEB_URL}\"|g" "${WRANGLER_FILE}"
else
  echo "ROUTER_PEERS = \"${KOYEB_URL}\"" >> "${WRANGLER_FILE}"
fi

# 2. Deploy Cloudflare Worker
echo -e "→ Deploying Cloudflare Worker edge router..."
cd "${ROOT_DIR}/infra/cloudflare"
npx wrangler deploy

# 3. Verify probe
echo -e "→ Validating live edge routing to Koyeb peer..."
sleep 2
PROBE_RES=$(curl -s -i "https://medicaps.chaoscomputerclub.in/api/health" || true)

echo -e "\n${GREEN}✓ Koyeb peer successfully configured in edge router!${NC}"
echo "Probe result:"
echo "${PROBE_RES}" | head -n 15
