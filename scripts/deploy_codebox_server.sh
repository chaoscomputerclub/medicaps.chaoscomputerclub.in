#!/usr/bin/env bash
# ==============================================================================
# Chaos Computer Club — Shopgroundera Server CodeBox Migration Script
# Replaces old Interleet / Docker Judge containers with Hitesh Choudhary's CodeBox engine
# ==============================================================================

set -euo pipefail

echo "============================================================"
echo "⚡ [CCC] CodeBox Engine Migration & Deployment on Server"
echo "============================================================"

# Step 1: Stop and remove legacy Docker judge instances
echo "🛑 Step 1: Stopping legacy judge containers..."
docker ps -a --filter "name=interleet" -q | xargs -r docker stop || true
docker ps -a --filter "name=interleet" -q | xargs -r docker rm || true
docker ps -a --filter "name=judge" -q | xargs -r docker stop || true
docker ps -a --filter "name=judge" -q | xargs -r docker rm || true

echo "✅ Legacy judge containers terminated."

# Step 2: Deploy CodeBox using the official single-file hub compose
CODEBOX_DIR="/opt/codebox"
echo "📁 Step 2: Preparing CodeBox directory at ${CODEBOX_DIR}..."
sudo mkdir -p "${CODEBOX_DIR}"
cd "${CODEBOX_DIR}"

if [ ! -f "docker-compose.yml" ]; then
    echo "⬇️ Downloading official CodeBox Docker Hub compose configuration..."
    sudo curl -fsSLO https://raw.githubusercontent.com/hiteshchoudhary/Codebox/main/docker-compose.hub.yml
    sudo mv docker-compose.hub.yml docker-compose.yml
fi

# Step 3: Configure CodeBox Environment
echo "🔐 Step 3: Generating secrets & writing .env..."
if [ ! -f ".env" ]; then
    AUTH_SECRET=$(openssl rand -hex 32)
    METRICS_SECRET=$(openssl rand -hex 16)
    GRAFANA_SECRET=$(openssl rand -hex 16)

    sudo bash -c "cat > .env" <<EOF
# CodeBox Secret Tokens
AUTH_TOKEN=${AUTH_SECRET}
METRICS_TOKEN=${METRICS_SECRET}
GRAFANA_PASSWORD=${GRAFANA_SECRET}

# Set domain if you have a DNS A record for automatic SSL, or leave blank for plain HTTP
DOMAIN=

# Worker Resource Sizing
WORKER_CPUS=1.5
WORKER_MEMORY=4G
WORKER_CONCURRENCY=2
EOF
    echo "Generated new .env for CodeBox."
else
    echo ".env already exists, keeping current keys."
fi

# Step 4: Pull and Start CodeBox Stack
echo "🚀 Step 4: Launching CodeBox (API + Redis + Workers)..."
sudo docker compose pull
sudo docker compose up -d

echo "⏳ Waiting for CodeBox to initialize..."
sleep 5

# Step 5: Verify Health
echo "🔍 Step 5: Running health check..."
if curl -fsSL http://localhost/health > /dev/null 2>&1; then
    echo "🎉 CodeBox is healthy on port 80!"
    curl -s http://localhost/health
    echo ""
elif curl -fsSL http://localhost:3000/health > /dev/null 2>&1; then
    echo "🎉 CodeBox is healthy on port 3000!"
    curl -s http://localhost:3000/health
    echo ""
else
    echo "⚠️ CodeBox container is starting up. Check status with: docker compose ps"
fi

echo "============================================================"
echo "🔑 Active CodeBox AUTH_TOKEN for your backend/.env:"
sudo grep AUTH_TOKEN .env || true
echo "============================================================"
