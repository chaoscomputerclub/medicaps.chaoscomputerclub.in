"""
Chaos Computer Club — Medi-Caps Chapter
tests/regression/conftest.py — Global Regression Test Suite Configuration
"""

import sys
import os
import pytest

# Ensure repository root and backend are in python path for imports
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")

if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Re-export fixtures
from tests.regression.fixtures.regression_fixtures import mock_contest_data, mock_member_data

def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "regression(bug_id): Mark test as a historical regression test enforcing invariant"
    )
