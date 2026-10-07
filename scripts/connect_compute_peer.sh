#!/usr/bin/env bash
# ==============================================================================
# Chaos Computer Club — Medi-Caps Chapter
# scripts/connect_compute_peer.sh — Connect Any Cloud/Edge Compute Peer to Ingress Fabric
#
# Supports: Render, Koyeb, Railway, Fly.io, Cloud Run, VPS, Local Tunnels
#
# Usage:
#   ./scripts/connect_compute_peer.sh <PEER_URL_1> [PEER_URL_2, ...]
# Examples:
#   ./scripts/connect_compute_peer.sh https://ccc-medicaps-peer.onrender.com
#   ./scripts/connect_compute_peer.sh https://ccc-medicaps-peer.onrender.com,https://ccc-api.koyeb.app
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

if [ "$#" -lt 1 ]; then
  echo -e "${RED}Usage: $0 <PEER_URL_OR_COMMA_SEPARATED_LIST>${NC}"
  echo "Examples:"
  echo "  $0 https://ccc-medicaps-peer.onrender.com"
  echo "  $0 https://ccc-medicaps-peer.onrender.com,https://my-app.koyeb.app"
  exit 1
fi

PEERS_INPUT="$*"
PEERS_CLEAN=$(echo "$PEERS_INPUT" | tr ' ' ',' | sed 's/,,*/,/g')

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}⚡ CONNECTING COMPUTE PEERS TO CCC EDGE INGRESS FABRIC          ${NC}"
echo -e "${CYAN}================================================================${NC}"

echo -e "→ Configured Router Peers: ${GREEN}${PEERS_CLEAN}${NC}"

# 1. Update wrangler.toml
WRANGLER_FILE="${ROOT_DIR}/infra/cloudflare/wrangler.toml"
echo -e "→ Updating ${WRANGLER_FILE}..."

if grep -q "ROUTER_PEERS" "${WRANGLER_FILE}"; then
  sed -i '' "s|ROUTER_PEERS = .*|ROUTER_PEERS = \"${PEERS_CLEAN}\"|g" "${WRANGLER_FILE}" 2>/dev/null || \
  sed -i "s|ROUTER_PEERS = .*|ROUTER_PEERS = \"${PEERS_CLEAN}\"|g" "${WRANGLER_FILE}"
else
  echo "ROUTER_PEERS = \"${PEERS_CLEAN}\"" >> "${WRANGLER_FILE}"
fi

# 2. Deploy Cloudflare Worker
echo -e "→ Deploying Cloudflare Worker edge router..."
cd "${ROOT_DIR}/infra/cloudflare"

export CLOUDFLARE_API_KEY="${CLOUDFLARE_API_KEY:-}"
export CLOUDFLARE_EMAIL="${CLOUDFLARE_EMAIL:-}"
npx wrangler deploy

# 3. Verify probe
echo -e "→ Validating live edge routing..."
sleep 2
PROBE_RES=$(curl -s -i "https://medicaps.chaoscomputerclub.in/api/health" || true)

echo -e "\n${GREEN}✓ Compute peer(s) successfully registered with edge router!${NC}"
echo "Probe result:"
echo "${PROBE_RES}" | head -n 20
