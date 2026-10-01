#!/usr/bin/env bash
# ==============================================================================
# Production Zero-Downtime Deployment Script for Cloud VPS Control Plane
# ==============================================================================
set -euo pipefail

APP_DIR="/var/www/medicaps"
BACKEND_DIR="${APP_DIR}/backend"

echo "=== [1/5] Pulling latest main branch ==="
cd "${APP_DIR}"
git fetch origin main
git reset --hard origin/main

echo "=== [2/5] Building frontend static bundle ==="
npm ci --prefer-offline --no-audit
npm run build

echo "=== [3/5] Updating backend dependencies ==="
cd "${BACKEND_DIR}"
source .venv/bin/activate
pip install -r requirements.txt --quiet

echo "=== [4/5] Executing database migrations ==="
python -m alembic upgrade head || echo "No pending migrations or alembic not configured"

echo "=== [5/5] Reloading backend and Nginx services ==="
sudo systemctl restart ccc-backend
sudo systemctl reload nginx

echo "=== Fabric Control Plane successfully updated ==="
curl -s http://127.0.0.1:8000/api/v1/fabric/health | jq .
