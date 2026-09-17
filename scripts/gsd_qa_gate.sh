#!/usr/bin/env bash
# ==============================================================================
# Chaos Computer Club — Medi-Caps Chapter
# scripts/gsd_qa_gate.sh — GET SHIT DONE (GSD) Automated QA Gatekeeper
#
# Pre-Deployment Quality Gate:
#   1. Local Frontend Compilation & TypeScript Static Analysis (Vite build)
#   2. Full Backend In-Process API Contract & Schema Verification (51 tests)
#   3. Full Application Frontend-to-Backend Automated Action Simulation
# ==============================================================================

set -e

# ANSI Color Codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}   🛡️  CCC MEDI-CAPS — AUTOMATED QA PRE-DEPLOYMENT GATE         ${NC}"
echo -e "${CYAN}================================================================${NC}"

# ------------------------------------------------------------------------------
# STEP 1: Local Compilation & Static Analysis
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[1/3] Running Frontend Compilation & TypeScript Check...${NC}"
npm run build
echo -e "${GREEN}✓ Frontend bundle compiled with zero errors.${NC}"

# ------------------------------------------------------------------------------
# STEP 2: Backend Production API Contract Audit
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[2/3] Running Backend In-Process API Contract QA Suite (51 Tests)...${NC}"
if [ -f "backend/.venv/bin/python" ]; then
  backend/.venv/bin/python backend/scripts/run_production_api_qa.py
else
  python3 backend/scripts/run_production_api_qa.py
fi
echo -e "${GREEN}✓ Backend API QA suite passed with 100% compliance.${NC}"

# ------------------------------------------------------------------------------
# STEP 3: Full Application Frontend-to-Backend User Action Simulation
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[3/3] Running Full Application Frontend-to-Backend QA Simulation...${NC}"
node scripts/qa_full_application.mjs
echo -e "${GREEN}✓ Full application user action simulation passed.${NC}"

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}   ✨ ALL GSD QA GATES PASSED — CODE QUALIFIED FOR PRODUCTION    ${NC}"
echo -e "${GREEN}================================================================${NC}"
