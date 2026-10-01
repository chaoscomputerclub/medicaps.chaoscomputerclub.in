#!/usr/bin/env bash
# ==============================================================================
# USB Portable Node Provisioning Script
# Prepares a USB drive with the portable ccc-node runtime bundle
# ==============================================================================
set -euo pipefail

TARGET_DIR="${1:-/tmp/ccc-usb}"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "=== Provisioning Portable Node Bundle into: ${TARGET_DIR} ==="
mkdir -p "${TARGET_DIR}/ccc-node"/{bin,config,scripts,manifests,systemd}

# 1. Cross-compile static agent for Linux amd64 and arm64
echo "--> Compiling Go Node Agent (Linux amd64)..."
cd "${SOURCE_DIR}/node-agent"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o "${TARGET_DIR}/ccc-node/bin/node-agent-linux-amd64" ./cmd/node-agent

echo "--> Compiling Go Node Agent (Linux arm64)..."
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o "${TARGET_DIR}/ccc-node/bin/node-agent-linux-arm64" ./cmd/node-agent

# 2. Copy scripts and configuration templates
echo "--> Installing runtime scripts and configs..."
cp -r "${SOURCE_DIR}/ccc-node/scripts"/* "${TARGET_DIR}/ccc-node/scripts/"
cp "${SOURCE_DIR}/ccc-node/config/node.env" "${TARGET_DIR}/ccc-node/config/"
cp "${SOURCE_DIR}/ccc-node/systemd/ccc-node.service" "${TARGET_DIR}/ccc-node/systemd/"
cp "${SOURCE_DIR}/ccc-node/bootstrap.sh" "${TARGET_DIR}/ccc-node/"
cp "${SOURCE_DIR}/ccc-node/stop.sh" "${TARGET_DIR}/ccc-node/"

chmod +x "${TARGET_DIR}/ccc-node/bootstrap.sh"
chmod +x "${TARGET_DIR}/ccc-node/stop.sh"
chmod +x "${TARGET_DIR}/ccc-node/scripts"/*.sh

echo "=== USB Bundle Successfully Created ==="
ls -lah "${TARGET_DIR}/ccc-node"
