#!/usr/bin/env bash
# ==============================================================================
# Cross-compile Go Node Agent for all supported platforms
# ==============================================================================
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

mkdir -p bin

echo "Compiling Linux AMD64 (standard PC/Laptop)..."
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bin/node-agent-linux-amd64 ./cmd/node-agent

echo "Compiling Linux ARM64 (Raspberry Pi / Graviton)..."
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o bin/node-agent-linux-arm64 ./cmd/node-agent

echo "Compiling macOS ARM64 (Apple Silicon M1/M2/M3/M4)..."
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o bin/node-agent-darwin-arm64 ./cmd/node-agent

echo "Compiling macOS AMD64 (Intel Mac)..."
CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o bin/node-agent-darwin-amd64 ./cmd/node-agent

echo "Compiling Windows AMD64..."
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o bin/node-agent-windows-amd64.exe ./cmd/node-agent

echo "=================================================================="
echo "✓ All binaries built successfully in judge-agent/bin/:"
ls -lh bin/
