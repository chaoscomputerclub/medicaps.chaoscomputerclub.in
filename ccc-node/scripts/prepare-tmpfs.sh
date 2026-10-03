#!/usr/bin/env bash
# ==============================================================================
# Prepares in-memory RAM tmpfs filesystem for Docker executions
# Eliminates 4KB write wear and throttling on USB flash drives
# ==============================================================================
set -euo pipefail

WS_PATH="${1:-/tmp/ccc_workspaces}"

echo "⚡ [Storage] Initializing RAM tmpfs workspace at: ${WS_PATH}"
mkdir -p "${WS_PATH}"

if [[ "$(uname -s)" == "Linux" ]]; then
    if ! mountpoint -q "${WS_PATH}"; then
        if [[ $EUID -eq 0 ]]; then
            mount -t tmpfs -o size=2048M,exec,nosuid tmpfs "${WS_PATH}"
            echo "✓ Mounted 2048 MB tmpfs in RAM"
        else
            echo "ℹ️ Running unprivileged; relying on host /tmp RAM backing"
        fi
    else
        echo "✓ tmpfs mount already active"
    fi
fi

chmod 0777 "${WS_PATH}"
echo "✓ RAM workspace ready."
