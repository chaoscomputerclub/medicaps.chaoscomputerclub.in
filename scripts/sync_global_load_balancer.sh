#!/usr/bin/env bash
# ==============================================================================
# Chaos Computer Club — Medi-Caps Chapter
# scripts/sync_global_load_balancer.sh — Master Multi-Provider Load Balancer Orchestrator
#
# Connects and balances traffic across Render & Railway compute peers and judge engines.
#
# Examples:
#   ./scripts/sync_global_load_balancer.sh \
#     --render https://ccc-medicaps-peer.onrender.com \
#     --railway https://ccc-backend-production.up.railway.app \
#     --render-judge https://ccc-judge-peer.onrender.com \
#     --railway-judge https://ccc-judge-production.up.railway.app
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}⚡ CCC GLOBAL LOAD BALANCER & MULTI-CLOUD ORCHESTRATOR           ${NC}"
echo -e "${CYAN}================================================================${NC}"

RENDER_URL=""
RAILWAY_URL=""
KOYEB_URL=""
RENDER_JUDGE_URL=""
RAILWAY_JUDGE_URL=""
CUSTOM_PEERS=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --render)
      RENDER_URL="$2"
      shift 2
      ;;
    --railway)
      RAILWAY_URL="$2"
      shift 2
      ;;
    --koyeb)
      KOYEB_URL="$2"
      shift 2
      ;;
    --render-judge)
      RENDER_JUDGE_URL="$2"
      shift 2
      ;;
    --railway-judge)
      RAILWAY_JUDGE_URL="$2"
      shift 2
      ;;
    --peers)
      CUSTOM_PEERS="$2"
      shift 2
      ;;
    --status)
      echo -e "Fetching live edge load balancer telemetry..."
      curl -s "https://medicaps.chaoscomputerclub.in/api/health/edge" | python3 -m json.tool
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown argument: $1${NC}"
      exit 1
      ;;
  esac
done

# Build active API peers list
API_PEERS_ARRAY=()
[ -n "${RENDER_URL}" ] && API_PEERS_ARRAY+=("${RENDER_URL%/}")
[ -n "${RAILWAY_URL}" ] && API_PEERS_ARRAY+=("${RAILWAY_URL%/}")
[ -n "${KOYEB_URL}" ] && API_PEERS_ARRAY+=("${KOYEB_URL%/}")
if [ -n "${CUSTOM_PEERS}" ]; then
  IFS=',' read -ra ADDR <<< "${CUSTOM_PEERS}"
  for i in "${ADDR[@]}"; do
    API_PEERS_ARRAY+=("${i%/}")
  done
fi

# Build active Judge peers list
JUDGE_PEERS_ARRAY=()
[ -n "${RENDER_JUDGE_URL}" ] && JUDGE_PEERS_ARRAY+=("${RENDER_JUDGE_URL%/}")
[ -n "${RAILWAY_JUDGE_URL}" ] && JUDGE_PEERS_ARRAY+=("${RAILWAY_JUDGE_URL%/}")

WRANGLER_FILE="${ROOT_DIR}/infra/cloudflare/wrangler.toml"

if [ ${#API_PEERS_ARRAY[@]} -gt 0 ]; then
  JOINED_API_PEERS=$(IFS=','; echo "${API_PEERS_ARRAY[*]}")
  echo -e "→ Updating API Peers: ${GREEN}${JOINED_API_PEERS}${NC}"
  if grep -q "ROUTER_PEERS" "${WRANGLER_FILE}"; then
    sed -i '' "s|ROUTER_PEERS = .*|ROUTER_PEERS = \"${JOINED_API_PEERS}\"|g" "${WRANGLER_FILE}" 2>/dev/null || \
    sed -i "s|ROUTER_PEERS = .*|ROUTER_PEERS = \"${JOINED_API_PEERS}\"|g" "${WRANGLER_FILE}"
  else
    echo "ROUTER_PEERS = \"${JOINED_API_PEERS}\"" >> "${WRANGLER_FILE}"
  fi
fi

if [ ${#JUDGE_PEERS_ARRAY[@]} -gt 0 ]; then
  JOINED_JUDGE_PEERS=$(IFS=','; echo "${JUDGE_PEERS_ARRAY[*]}")
  echo -e "→ Updating Judge Peers: ${GREEN}${JOINED_JUDGE_PEERS}${NC}"
  if grep -q "JUDGE_PEERS" "${WRANGLER_FILE}"; then
    sed -i '' "s|JUDGE_PEERS = .*|JUDGE_PEERS = \"${JOINED_JUDGE_PEERS}\"|g" "${WRANGLER_FILE}" 2>/dev/null || \
    sed -i "s|JUDGE_PEERS = .*|JUDGE_PEERS = \"${JOINED_JUDGE_PEERS}\"|g" "${WRANGLER_FILE}"
  else
    echo "JUDGE_PEERS = \"${JOINED_JUDGE_PEERS}\"" >> "${WRANGLER_FILE}"
  fi
fi

echo -e "\n→ Deploying updated configuration to Cloudflare Edge Network..."
cd "${ROOT_DIR}/infra/cloudflare"
export CLOUDFLARE_API_KEY="${CLOUDFLARE_API_KEY:-}"
export CLOUDFLARE_EMAIL="${CLOUDFLARE_EMAIL:-}"
npx wrangler deploy

echo -e "\n→ Verifying live Edge Load Balancer..."
sleep 2
LIVE_TELEMETRY=$(curl -s "https://medicaps.chaoscomputerclub.in/api/health/edge" || true)

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}🎉 GLOBAL LOAD BALANCER SYNCHRONIZATION COMPLETE!               ${NC}"
echo -e "${GREEN}================================================================${NC}"
echo "${LIVE_TELEMETRY}" | python3 -m json.tool 2>/dev/null || echo "${LIVE_TELEMETRY}"
