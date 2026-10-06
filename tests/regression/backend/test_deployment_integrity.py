"""
Chaos Computer Club — Medi-Caps Chapter
tests/regression/backend/test_deployment_integrity.py — Production Deployment & Semantic Version Invariants

Linked Bugs: REG-0001, REG-0002, REG-0003
Invariant: PRODUCTION_DEPLOYMENTS_MUST_PRESERVE_ACTIVE_ASSETS_AND_RELOAD_SAFELY
"""

import pytest
import os
import re
import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]


@pytest.mark.regression("REG-0001")
def test_semantic_version_format_in_package_json():
    """
    REG-0001 Invariant:
    package.json must specify a valid SemVer 2.0 (e.g. 1.0.5) to ensure client
    and server telemetry versions can be correlated unambiguously.
    """
    pkg_file = REPO_ROOT / "package.json"
    assert pkg_file.exists(), f"package.json missing at {pkg_file}"

    with open(pkg_file, "r") as f:
        pkg_data = json.load(f)

    version = pkg_data.get("version")
    assert version is not None, "package.json missing 'version' field"

    semver_regex = r"^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$"
    assert re.match(semver_regex, version), f"Invalid SemVer in package.json: {version}"


@pytest.mark.regression("REG-0002")
def test_backend_config_version_matches_semantic_version():
    """
    REG-0002 Invariant:
    backend/app/core/config.py must declare a valid non-empty VERSION matching SemVer.
    """
    config_file = REPO_ROOT / "backend" / "app" / "core" / "config.py"
    assert config_file.exists(), f"config.py missing at {config_file}"

    content = config_file.read_text(encoding="utf-8")
    m = re.search(r'VERSION:\s*str\s*=\s*(?:os\.getenv\("VERSION",\s*)?["\']([^"\']+)["\']', content)
    assert m, "Could not find VERSION in backend/app/core/config.py"
    version = m.group(1)
    assert re.match(r"^\d+\.\d+\.\d+", version), f"Invalid SemVer in config.py: {version}"


@pytest.mark.regression("REG-0003")
def test_deploy_workflow_uses_hard_reset_to_prevent_dirty_tree_aborts():
    """
    REG-0003 Invariant:
    The deployment workflow must use git reset --hard or clean checkout to prevent
    untracked runtime server files from blocking updates.
    """
    deploy_yml = REPO_ROOT / ".github" / "workflows" / "deploy.yml"
    assert deploy_yml.exists(), f"deploy.yml missing at {deploy_yml}"

    content = deploy_yml.read_text(encoding="utf-8")
    # Must use git fetch and reset --hard
    assert "git fetch origin main" in content, "deploy.yml missing 'git fetch origin main'"
    assert "git reset --hard origin/main" in content, "deploy.yml missing 'git reset --hard origin/main'"
