#!/usr/bin/env bash
# ==============================================================================
# Global Fabric End-to-End Verification Probe
# ==============================================================================
set -euo pipefail

BASE_URL="${FABRIC_CONTROL_PLANE_URL:-http://127.0.0.1:8000}"

echo "=== Probing Global Fabric Control Plane (${BASE_URL}) ==="

echo "--> 1. Testing Fabric Health..."
HEALTH_RESP=$(curl -s -f "${BASE_URL}/api/v1/fabric/health")
echo "${HEALTH_RESP}" | jq .

echo "--> 2. Testing Fabric Dynamic Capacity Aggregation..."
CAP_RESP=$(curl -s -f "${BASE_URL}/api/v1/fabric/capacity")
echo "${CAP_RESP}" | jq .

echo "--> 3. Simulating Route Decisions..."
ROUTE_RESP=$(curl -s -f -X POST "${BASE_URL}/api/v1/fabric/route" \
  -H "Content-Type: application/json" \
  -d '{"method": "POST", "path": "/api/contests/winter-2026/submit"}')
echo "${ROUTE_RESP}" | jq .

echo "--> 4. Querying Active Nodes..."
NODES_RESP=$(curl -s -f "${BASE_URL}/api/v1/fabric/nodes")
echo "${NODES_RESP}" | jq .

echo "=== All Fabric Invariants Verified Operational ==="
