#!/usr/bin/env bash
# ==============================================================================
# Gracefully stops the portable compute node agent and cleans up resources
# ==============================================================================
set -euo pipefail

echo "🛑 Stopping Chaos Computer Club Node Agent..."

PIDS=$(pgrep -f "node-agent" || true)

if [[ -n "${PIDS}" ]]; then
    echo "Sending SIGTERM to PIDs: ${PIDS}"
    kill -15 ${PIDS}
    echo "Waiting for graceful drain and job completion..."
    sleep 3
fi

# Clean RAM workspace
rm -rf /tmp/ccc_workspaces/sub_* 2>/dev/null || true
echo "✓ Node stopped and host workspace cleaned."
