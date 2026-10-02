#!/usr/bin/env bash
# ==============================================================================
# Medi-Caps Competitive Programming Platform — 50 Virtual Users Load Runner
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOAD_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ROOT_DIR="$(cd "${LOAD_DIR}/../.." && pwd)"

export PATH="${ROOT_DIR}/backend/.venv/bin:${PATH}"
export PYTHONPATH="${ROOT_DIR}:${ROOT_DIR}/backend:${LOAD_DIR}"

# 1. Load environment file if present
if [ -f "${LOAD_DIR}/.env" ]; then
    echo "Loading environment from ${LOAD_DIR}/.env..."
    # shellcheck disable=SC2046
    export $(grep -v '^#' "${LOAD_DIR}/.env" | xargs)
fi

SCENARIO="${1:-normal_50}"
BASE_URL="${LOAD_TEST_BASE_URL:-http://localhost:8000}"
ENV="${LOAD_TEST_ENVIRONMENT:-local}"

echo "======================================================================="
echo "  CHAOS COMPUTER CLUB — MEDI-CAPS COMPETITIVE PROGRAMMING PLATFORM"
echo "  VIRTUAL STUDENT LOAD TESTING RUNNER"
echo "======================================================================="
echo "  Target Base URL   : ${BASE_URL}"
echo "  Target Environment: ${ENV}"
echo "  Scenario Selected : ${SCENARIO}"
echo "======================================================================="

# 2. Strict Production Guard
if [[ "${ENV}" =~ ^(prod|production)$ ]] || [[ "${BASE_URL}" =~ medicaps\.chaoscomputerclub\.in ]]; then
    if [ "${ALLOW_PRODUCTION_LOAD_TEST:-false}" != "true" ]; then
        echo "🛑 SAFETY ABORT: Production load testing blocked without ALLOW_PRODUCTION_LOAD_TEST=true."
        exit 1
    fi
fi

# 3. Provisioning (Optional Seed)
if [ "${AUTO_SEED:-false}" = "true" ]; then
    echo "Ensuring test users and contest data are provisioned..."
    python3 "${SCRIPT_DIR}/create_test_users.py" || true
    python3 "${SCRIPT_DIR}/seed_test_data.py" || true
fi

# 4. Map Scenario to Locust Parameters
case "${SCENARIO}" in
    smoke|smoke_5)
        USERS=5
        SPAWN=2
        TIME="${LOAD_TEST_TIME:-30s}"
        ;;
    smoke_10)
        USERS=10
        SPAWN=3
        TIME="${LOAD_TEST_TIME:-45s}"
        ;;
    smoke_25)
        USERS=25
        SPAWN=5
        TIME="${LOAD_TEST_TIME:-60s}"
        ;;
    normal_50)
        USERS=50
        SPAWN=5
        TIME="${LOAD_TEST_TIME:-2m}"
        ;;
    submission_burst)
        USERS=50
        SPAWN=10
        TIME="${LOAD_TEST_TIME:-2m}"
        ;;
    run_code_load)
        USERS=50
        SPAWN=5
        TIME="${LOAD_TEST_TIME:-2m}"
        ;;
    soak)
        USERS=20
        SPAWN=2
        TIME="${LOAD_TEST_TIME:-10m}"
        ;;
    *)
        echo "Unknown scenario: ${SCENARIO}. Using defaults (50 users, 2m)."
        USERS=50
        SPAWN=5
        TIME="${LOAD_TEST_TIME:-2m}"
        ;;
esac


TIMESTAMP=$(date +%s)
REPORT_DIR="${LOAD_DIR}/reports/run-${TIMESTAMP}"
mkdir -p "${REPORT_DIR}"

echo "Launching Locust in headless mode (${USERS} users, spawn rate ${SPAWN}/s, duration ${TIME})..."

locust -f "${LOAD_DIR}/locustfile.py" \
    --headless \
    --host="${BASE_URL}" \
    -u "${USERS}" \
    -r "${SPAWN}" \
    -t "${TIME}" \
    --html="${REPORT_DIR}/report.html" \
    --csv="${REPORT_DIR}/locust_stats"

echo "======================================================================="
echo "  ✓ Load test run finished! Reports saved to:"
echo "    ${REPORT_DIR}/report.html"
echo "    ${REPORT_DIR}/locust_stats_stats.csv"
echo "    ${REPORT_DIR}/summary.json"
echo "======================================================================="
