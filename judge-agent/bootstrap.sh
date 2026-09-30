#!/usr/bin/env bash
# ==============================================================================
# Chaos Computer Club — Portable Node Fabric Bootstrap
# ==============================================================================
# Usage: ./bootstrap.sh
# Plug USB -> Run ./bootstrap.sh -> Machine instantly joins the compute fabric!
#
# Powered by Go Native Agent:
# - Zero Python / venv / pip dependencies on host
# - Statically linked native binary execution
# - In-memory RAM tmpfs execution workspace (Zero USB flash wear)
# - Outbound HTTPS connection to Central Control Plane
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "===================================================================="
echo "🛸 Chaos Computer Club — Portable Distributed Compute Fabric"
echo "===================================================================="

# 1. Detect Operating System and Architecture
OS_RAW="$(uname -s)"
ARCH_RAW="$(uname -m)"

case "$OS_RAW" in
    Linux*)   GO_OS="linux" ;;
    Darwin*)  GO_OS="darwin" ;;
    MINGW*|MSYS*|CYGWIN*) GO_OS="windows" ;;
    *)        GO_OS="linux" ;;
esac

case "$ARCH_RAW" in
    x86_64|amd64)   GO_ARCH="amd64" ;;
    aarch64|arm64)  GO_ARCH="arm64" ;;
    *)              GO_ARCH="amd64" ;;
esac

BINARY_NAME="node-agent-${GO_OS}-${GO_ARCH}"
if [ "$GO_OS" = "windows" ]; then
    BINARY_NAME="${BINARY_NAME}.exe"
fi

BINARY_PATH="$SCRIPT_DIR/bin/$BINARY_NAME"

echo "[1/4] Platform detected: $GO_OS / $GO_ARCH"
echo "[1/4] Target Agent Binary: bin/$BINARY_NAME"

if [ ! -f "$BINARY_PATH" ]; then
    echo "❌ Binary $BINARY_PATH not found! Attempting local build..."
    if command -v go >/dev/null 2>&1; then
        mkdir -p "$SCRIPT_DIR/bin"
        go build -ldflags="-s -w" -o "$BINARY_PATH" ./cmd/node-agent
    else
        echo "❌ Cannot find precompiled binary and 'go' compiler is not installed."
        exit 1
    fi
fi

# 2. Host Optimization & RAM tmpfs Setup (Zero USB Wear)
echo "[2/4] Initializing In-Memory tmpfs workspace..."
WORKSPACE_DIR="/tmp/ccc_workspaces"
sudo mkdir -p "$WORKSPACE_DIR" 2>/dev/null || mkdir -p "$WORKSPACE_DIR"
sudo chmod 0777 "$WORKSPACE_DIR" 2>/dev/null || chmod 0777 "$WORKSPACE_DIR"

if [ "$GO_OS" = "linux" ]; then
    # Mount tmpfs in RAM if not already mounted
    if ! grep -qs "$WORKSPACE_DIR" /proc/mounts; then
        echo "Mounting 2GB RAM tmpfs at $WORKSPACE_DIR..."
        sudo mount -t tmpfs -o size=2G,noexec=off,nosuid,nodev tmpfs "$WORKSPACE_DIR" 2>/dev/null || true
    fi

    # Boost CPU clock governor to performance
    echo "[3/4] Tuning CPU performance governor..."
    echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor > /dev/null 2>&1 || true

    # Prevent USB flash throttling by tuning dirty writeback
    sudo sysctl -w vm.dirty_writeback_centisecs=3000 > /dev/null 2>&1 || true
    sudo sysctl -w vm.dirty_expire_centisecs=6000 > /dev/null 2>&1 || true
else
    echo "[3/4] Running on $GO_OS. Host kernel tuning managed by OS."
fi

# 3. Verify Docker Engine
echo "[4/4] Verifying Docker container engine..."
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker is not installed on this host."
    if [ "$GO_OS" = "linux" ] && command -v apt-get &> /dev/null; then
        echo "Attempting automated Docker installation via apt..."
        sudo apt-get update -y && sudo apt-get install -y docker.io
        sudo usermod -aG docker "$USER" || true
    else
        echo "❌ Please install or start Docker to enable sandbox execution."
        exit 1
    fi
fi

if ! docker ps > /dev/null 2>&1; then
    echo "Starting Docker service..."
    sudo systemctl start docker 2>/dev/null || sudo service docker start 2>/dev/null || true
fi

# 4. Load Environment Configuration
if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs -0 2>/dev/null || true)
fi

export WORKSPACE_BASE="$WORKSPACE_DIR"
export CONTROL_PLANE_URL="${CONTROL_PLANE_URL:-https://medicaps.chaoscomputerclub.in/api/v1}"

echo "===================================================================="
echo "🚀 Launching Go Native Node Agent: $BINARY_PATH"
echo "===================================================================="

exec "$BINARY_PATH"
