#!/usr/bin/env bash
set -euo pipefail

# Chaos Computer Club — Load Testing Execution Runner
# Usage: ./backend/load_tests/run_load_tests.sh [scenario_number]

TARGET_URL="${TARGET_URL:-https://medicaps.chaoscomputerclub.in}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "============================================================"
echo " CCC MEDI-CAPS — PRODUCTION LOAD TEST HARNESS (k6)"
echo " Target: ${TARGET_URL}"
echo "============================================================"

if ! command -v k6 &> /dev/null; then
    echo "⚠ k6 is not installed on this system."
    echo "Install via: brew install k6  (or apt-get install k6)"
    exit 1
fi

SCENARIO="${1:-all}"

run_scenario() {
    local script="$1"
    local name="$2"
    echo ""
    echo ">>> Running Scenario: ${name} (${script}) <<<"
    k6 run -e TARGET_URL="${TARGET_URL}" "${SCRIPT_DIR}/${script}"
}

case "${SCENARIO}" in
    1)
        run_scenario "01_api_baseline.js" "API Baseline & Metrics (1000 VUs)"
        ;;
    2)
        run_scenario "02_sse_concurrency.js" "SSE Connection Flood (1000 Concurrency)"
        ;;
    3)
        run_scenario "03_submission_burst.js" "Submission Burst (200 Cadets)"
        ;;
    4)
        run_scenario "04_leaderboard_stampede.js" "Leaderboard Stampede (500 VUs SingleFlight)"
        ;;
    all)
        run_scenario "01_api_baseline.js" "API Baseline & Metrics (1000 VUs)"
        run_scenario "04_leaderboard_stampede.js" "Leaderboard Stampede (500 VUs SingleFlight)"
        echo ""
        echo "✓ All automated load tests completed successfully."
        ;;
    *)
        echo "Usage: $0 [1|2|3|4|all]"
        exit 1
        ;;
esac
