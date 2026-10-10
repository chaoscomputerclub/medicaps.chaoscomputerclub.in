#!/usr/bin/env bash
# Generates a valid 30-day Core Team Admin RS256 JWT using the production server key
set -euo pipefail

EMAIL="${1:-santushtkotai@gmail.com}"

TOKEN=$(ssh -i ~/.ssh/shopground_era_key root@143.198.38.205 "/root/projects/ccc-medicaps-api/venv/bin/python -c \"
import sys; sys.path.insert(0, '/root/projects/ccc-medicaps-api')
from app.core.security import create_access_token
print(create_access_token({'sub': 'admin', 'email': '${EMAIL}'}))
\"")

echo "${TOKEN}"
