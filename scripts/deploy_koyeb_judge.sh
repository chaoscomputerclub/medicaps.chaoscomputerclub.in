#!/usr/bin/env bash
# ==============================================================================
# Chaos Computer Club — Medi-Caps Chapter
# scripts/deploy_koyeb_judge.sh — Koyeb Judge Container Deployer
#
# Deploys the isolated Judge microservice container to Koyeb (Free Tier).
# Automatically updates Cloudflare Worker Control Plane with the live Koyeb endpoint.
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

KOYEB_BIN="${HOME}/.koyeb/bin/koyeb"
APP_NAME="ccc-judge-app"
SERVICE_NAME="ccc-judge"

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}⚡ CCC KOYEB JUDGE MICROSERVICE DEPLOYMENT ${NC}"
echo -e "${CYAN}================================================================${NC}"

if [ ! -f "${KOYEB_BIN}" ]; then
  echo "Installing Koyeb CLI..."
  curl -fsSL https://raw.githubusercontent.com/koyeb/koyeb-cli/master/install.sh | bash
fi

export PATH="${HOME}/.koyeb/bin:${PATH}"

# Check Koyeb Token
KOYEB_TOKEN="${KOYEB_TOKEN:-}"
if [ -z "${KOYEB_TOKEN}" ] && [ ! -f "${HOME}/.koyeb.yaml" ]; then
  echo -e "${YELLOW}ℹ Please provide your Koyeb API token or run '${KOYEB_BIN} login'.${NC}"
  echo -e "You can create a free token at: https://app.koyeb.com/user/settings/api"
  read -rsp "Enter Koyeb API Token: " KOYEB_TOKEN
  echo ""
  export KOYEB_TOKEN
fi

TOKEN_ARG=""
if [ -n "${KOYEB_TOKEN}" ]; then
  TOKEN_ARG="--token ${KOYEB_TOKEN}"
fi

echo -e "\n${CYAN}1. Ensuring Koyeb App '${APP_NAME}' exists...${NC}"
${KOYEB_BIN} apps get "${APP_NAME}" ${TOKEN_ARG} &>/dev/null || \
  ${KOYEB_BIN} apps create "${APP_NAME}" ${TOKEN_ARG}

echo -e "\n${CYAN}2. Deploying Judge Container to Koyeb...${NC}"
if ${KOYEB_BIN} services get "${APP_NAME}/${SERVICE_NAME}" ${TOKEN_ARG} &>/dev/null; then
  echo "Updating existing service..."
  ${KOYEB_BIN} service update "${APP_NAME}/${SERVICE_NAME}" ${TOKEN_ARG} \
    --git github.com/chaoscomputerclub/medicaps.chaoscomputerclub.in \
    --git-branch main \
    --git-builder docker \
    --git-docker-dockerfile infra/cloudrun-judge/Dockerfile \
    --ports 8080:http \
    --routes /:8080
else
  echo "Creating new service on free nano instance..."
  ${KOYEB_BIN} service create "${SERVICE_NAME}" ${TOKEN_ARG} \
    --app "${APP_NAME}" \
    --git github.com/chaoscomputerclub/medicaps.chaoscomputerclub.in \
    --git-branch main \
    --git-builder docker \
    --git-docker-dockerfile infra/cloudrun-judge/Dockerfile \
    --ports 8080:http \
    --routes /:8080 \
    --instance-type nano
fi

echo -e "\n${CYAN}3. Retrieving Live Service Public URL...${NC}"
SERVICE_URL=""
for i in {1..30}; do
  SERVICE_URL=$(${KOYEB_BIN} apps get "${APP_NAME}" ${TOKEN_ARG} -o json | python3 -c '
import sys, json
try:
  data = json.load(sys.stdin)
  domains = data.get("app", {}).get("domains", [])
  if domains:
    print("https://" + domains[0]["name"])
except Exception:
  pass
' 2>/dev/null || true)
  if [ -n "${SERVICE_URL}" ]; then
    break
  fi
  echo "Waiting for domain assignment... ($i/30)"
  sleep 3
done

if [ -n "${SERVICE_URL}" ]; then
  echo -e "${GREEN}✓ Live Koyeb Judge URL:${NC} ${SERVICE_URL}"
  
  echo -e "\n${CYAN}4. Synchronizing Cloudflare Worker with Koyeb Endpoint...${NC}"
  cd infra/cloudflare
  sed -i '' "s|JUDGE_URL = \".*\"|JUDGE_URL = \"${SERVICE_URL}\"|g" wrangler.toml || sed -i "s|JUDGE_URL = \".*\"|JUDGE_URL = \"${SERVICE_URL}\"|g" wrangler.toml
  
  CLOUDFLARE_API_KEY="${CLOUDFLARE_API_KEY:-}" \
  CLOUDFLARE_EMAIL="${CLOUDFLARE_EMAIL:-}" \
  npx wrangler deploy
  
  echo -e "\n${GREEN}✓ Cloudflare Worker is now delegating code evaluation to Koyeb!${NC}"
else
  echo -e "${YELLOW}ℹ Service created. Once the app URL is active in Koyeb console, set JUDGE_URL in wrangler.toml and redeploy.${NC}"
fi

echo -e "\n================================================================"
echo -e "${GREEN}🎉 Koyeb Container Deployment Complete!${NC}"
echo -e "================================================================"
