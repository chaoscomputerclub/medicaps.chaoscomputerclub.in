#!/usr/bin/env bash
# ==============================================================================
# Chaos Computer Club — Portable USB Compute Node Bootstrap Script
# Boots any authorized computer into the Global Distributed Application Fabric
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/config/node.env"

echo "================================================================="
echo "🛸 CHAOS COMPUTER CLUB — PORTABLE COMPUTE NODE BOOTSTRAP"
echo "================================================================="

# 1. Load configuration
if [[ -f "${CONFIG_FILE}" ]]; then
    set -a
    source "${CONFIG_FILE}"
    set +a
    echo "✓ Loaded configuration from config/node.env"
else
    echo "⚠️ config/node.env not found; using defaults."
fi

# 2. Check Docker availability
if ! command -v docker >/dev/null 2>&1; then
    echo "❌ Error: Docker is not installed on this host."
    echo "   Please install Docker or start the daemon to join compute fabric."
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    echo "❌ Error: Docker daemon is not running or current user lacks docker group permission."
    echo "   Try running with: sudo $0"
    exit 1
fi
echo "✓ Docker runtime is active and accessible."

# 3. Setup in-memory RAM tmpfs workspace
"${SCRIPT_DIR}/scripts/prepare-tmpfs.sh" "${WORKSPACE_BASE:-/tmp/ccc_workspaces}"

# 4. Select binary for architecture
OS_TYPE="$(uname -s)"
ARCH_TYPE="$(uname -m)"

BINARY_NAME=""
if [[ "${OS_TYPE}" == "Linux" && "${ARCH_TYPE}" == "x86_64" ]]; then
    BINARY_NAME="${SCRIPT_DIR}/bin/node-agent-linux-amd64"
elif [[ "${OS_TYPE}" == "Darwin" && "${ARCH_TYPE}" == "arm64" ]]; then
    BINARY_NAME="${SCRIPT_DIR}/bin/node-agent-darwin-arm64"
elif [[ -f "${SCRIPT_DIR}/bin/node-agent-linux-amd64" ]]; then
    BINARY_NAME="${SCRIPT_DIR}/bin/node-agent-linux-amd64"
else
    echo "❌ Unsupported OS/Arch combination: ${OS_TYPE} / ${ARCH_TYPE}"
    exit 1
fi

chmod +x "${BINARY_NAME}"
echo "✓ Launching agent binary: ${BINARY_NAME}"

# 5. Launch Node Agent
exec "${BINARY_NAME}"
