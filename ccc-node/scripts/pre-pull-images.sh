#!/usr/bin/env bash
# ==============================================================================
# Pre-pulls sandbox Docker images to local host daemon for instant execution
# ==============================================================================
set -euo pipefail

IMAGES=(
    "python:3.11-slim"
    "node:20-alpine"
    "gcc:13"
    "openjdk:17-slim"
    "golang:1.22-alpine"
)

echo "🐳 [Docker] Verifying and pre-pulling sandbox runtime images..."

for img in "${IMAGES[@]}"; do
    if docker image inspect "$img" >/dev/null 2>&1; then
        echo "✓ Image already cached: $img"
    else
        echo "⬇️ Pulling $img..."
        docker pull "$img" || echo "⚠️ Could not pull $img (offline mode or network slow)"
    fi
done

echo "✓ Docker image pre-caching complete."
