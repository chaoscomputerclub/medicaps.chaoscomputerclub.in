"""
Chaos Computer Club — Medi-Caps Chapter
Unit & Topology Verification: Railway & Render Global Load Balancing & Multi-Judge Engine
"""

import asyncio
import os
import pytest
from unittest.mock import AsyncMock, patch

from app.engine.providers.codebox_provider import CodeboxProvider
from app.engine.schemas import TestCaseSchema


@pytest.mark.asyncio
async def test_codebox_provider_multi_endpoint_pool():
    """Verify CodeboxProvider correctly parses and balances across multiple endpoints."""
    with patch.dict(os.environ, {"JUDGE_URLS": "https://ccc-judge-render.onrender.com,https://ccc-judge-railway.up.railway.app"}):
        provider = CodeboxProvider()
        assert len(provider.endpoints) == 2
        assert "https://ccc-judge-render.onrender.com" in provider.endpoints
        assert "https://ccc-judge-railway.up.railway.app" in provider.endpoints
        
        # Test endpoint rotation
        first = provider.base_url
        second = provider.get_next_endpoint()
        assert first != second
        third = provider.get_next_endpoint()
        assert third == first


@pytest.mark.asyncio
async def test_render_and_railway_blueprint_configs_exist():
    """Verify Railway and Render blueprints and judge Dockerfiles are present and valid."""
    from pathlib import Path
    root = Path(__file__).resolve().parent.parent.parent
    
    assert (root / "render.yaml").exists()
    assert (root / "railway.json").exists()
    assert (root / "railway.judge.json").exists()
    assert (root / "Dockerfile").exists()
    assert (root / "Dockerfile.judge").exists()
    
    render_text = (root / "render.yaml").read_text()
    assert "ccc-medicaps-peer" in render_text
    assert "ccc-judge-peer" in render_text
    assert "Dockerfile.judge" in render_text
    
    railway_text = (root / "railway.json").read_text()
    assert "Dockerfile" in railway_text
    
    railway_judge_text = (root / "railway.judge.json").read_text()
    assert "Dockerfile.judge" in railway_judge_text


@pytest.mark.asyncio
async def test_cloudflare_worker_load_balancer_script_contract():
    """Verify the Cloudflare Worker contains load balancing and failover logic."""
    from pathlib import Path
    root = Path(__file__).resolve().parent.parent.parent
    worker_file = root / "infra" / "cloudflare" / "worker.js"
    assert worker_file.exists()
    
    content = worker_file.read_text()
    assert "global_edge_load_balancer" in content
    assert "dynamic_health_round_robin" in content
    assert "JUDGE_PEERS" in content
    assert "ROUTER_PEERS" in content
    assert "isProviderDead" in content
