#!/usr/bin/env bash
# ==============================================================================
# 🛡️ GSD PROTOCOL: Full Application UI Elements & Button Backend Connectivity Audit
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ROOT_DIR}"

echo "================================================================"
echo " 🛡️  GSD PROTOCOL: UI ELEMENTS & BUTTON CONNECTIVITY AUDIT       "
echo "================================================================"

node "${SCRIPT_DIR}/audit_ui_elements_backend_connectivity.mjs"
