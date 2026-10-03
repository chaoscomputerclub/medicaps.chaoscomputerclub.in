#!/usr/bin/env bash
# ==============================================================================
# Build & Deploy Node-Agent on Host
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔨 [Node-Agent] Compiling Linux binary..."
mkdir -p /opt/ccc-node-agent/bin /opt/ccc-node-agent/config /tmp/ccc_workspaces
CGO_ENABLED=0 go build -ldflags="-s -w" -o /opt/ccc-node-agent/bin/node-agent-linux-amd64 ./cmd/node-agent
chmod +x /opt/ccc-node-agent/bin/node-agent-linux-amd64

echo "📄 [Node-Agent] Installing systemd service..."
cp "${SCRIPT_DIR}/ccc-node-agent.service" /etc/systemd/system/ccc-node-agent.service

if [ ! -f /opt/ccc-node-agent/node.env ]; then
  cat > /opt/ccc-node-agent/node.env << 'EOF'
CONTROL_PLANE_URL=http://127.0.0.1:8002
WORKSPACE_BASE=/tmp/ccc_workspaces
USE_RAM_TMPFS=true
HEARTBEAT_INTERVAL_S=5
MAX_CPU_THRESHOLD_PCT=85.0
MIN_MEMORY_HEADROOM_MB=512
EOF
fi

systemctl daemon-reload
systemctl enable ccc-node-agent
systemctl restart ccc-node-agent
echo "✅ [Node-Agent] Successfully deployed and restarted on systemd!"
systemctl status ccc-node-agent --no-pager || true
