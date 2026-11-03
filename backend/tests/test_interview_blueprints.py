"""
Chaos Computer Club — Medi-Caps Chapter
backend/tests/test_interview_blueprints.py — Tests for Published Blueprints, Graph Validation & Track Catalog
"""

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import delete
from main import app
from app.core.db import AsyncSessionLocal, init_db
from app.middleware.auth import get_current_member
from app.models.db_models import MemberProfile
from app.models.interview import (
    InterviewSession,
    InterviewDomain,
    InterviewBlueprintModel,
)
from app.services.llm.mock_provider import DeterministicMockLLMProvider
from app.services.llm import factory as llm_factory
from app.services.interview.blueprint_registry import (
    BlueprintRegistryService,
    BlueprintGraphValidator,
    InterviewBlueprint,
    BlueprintNode,
    BlueprintEdge,
    QuestionPolicy,
    EvaluationRubric,
    PublicMetadata,
    CompletionPolicy,
    RuntimePolicy,
)


@pytest.fixture
def mock_member():
    member = MemberProfile(
        id="mem_blueprint_test_001",
        handle="blueprint_candidate",
        email="blueprint_candidate@chaoscomputerclub.in",
        full_name="Tester Blueprint",
        prn="EN22CS999999",
        department="CSE",
        batch="2022-26",
        rating=1350,
        peak_rating=1350,
        is_onboarded=True,
    )
    return member


@pytest.fixture(autouse=True)
async def setup_test_env(mock_member):
    await init_db()
    BlueprintRegistryService.clear_dynamic_blueprints()
    mock_provider = DeterministicMockLLMProvider()
    llm_factory.set_llm_provider(mock_provider)

    test_slugs = ["quantum-computing-specialist", "cloud-native-devops", "unauthorized-domain"]
    async with AsyncSessionLocal() as db:
        await db.execute(delete(InterviewSession).where(InterviewSession.member_id == mock_member.id))
        for s in test_slugs:
            await db.execute(delete(InterviewDomain).where(InterviewDomain.slug == s))
            await db.execute(delete(InterviewBlueprintModel).where(InterviewBlueprintModel.slug == s))
        await db.merge(mock_member)
        await db.commit()

    app.dependency_overrides[get_current_member] = lambda: mock_member
    yield
    app.dependency_overrides.pop(get_current_member, None)
    llm_factory.set_llm_provider(None)
    BlueprintRegistryService.clear_dynamic_blueprints()


@pytest.mark.asyncio
async def test_all_preseeded_blueprints_valid():
    """Verifies that all 13 pre-seeded blueprints pass deterministic graph integrity checks."""
    tracks = BlueprintRegistryService.list_published_tracks()
    assert len(tracks) == 13, f"Expected 13 published tracks, got {len(tracks)}"

    for track in tracks:
        bp = BlueprintRegistryService.get_blueprint(track["slug"])
        assert bp is not None
        errors = BlueprintGraphValidator.validate(bp)
        assert len(errors) == 0, f"Blueprint '{track['slug']}' failed validation: {errors}"


@pytest.mark.asyncio
async def test_graph_validator_detects_broken_graphs():
    """Verifies that BlueprintGraphValidator catches unreachable nodes and broken entry points."""
    broken_bp = InterviewBlueprint(
        blueprint_id="broken-track",
        version="1.0.0",
        slug="broken-track",
        title="Broken Track",
        description="A broken track for testing",
        category="TECHNICAL",
        domain="Testing",
        status="published",
        entry_node_ids=["nonexistent_entry"],
        nodes={
            "isolated_node": BlueprintNode(
                node_id="isolated_node",
                title="Orphan Node",
                learning_objective="Testing",
                question_policy=QuestionPolicy(instructions="None"),
                evaluation_rubric=EvaluationRubric(),
                fallback_question="Fallback",
            )
        },
        edges=[],
        completion_policy=CompletionPolicy(terminal_node_required=True),
        runtime_policy=RuntimePolicy(),
        public_metadata=PublicMetadata(badge="Test", icon="Code"),
    )

    errors = BlueprintGraphValidator.validate(broken_bp)
    assert len(errors) > 0
    assert any("nonexistent_entry" in e for e in errors)
    assert any("terminal" in e for e in errors)


@pytest.mark.asyncio
async def test_list_published_tracks_api():
    """Verifies GET /api/v1/interview/tracks returns all tracks with public metadata only."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/interview/tracks")
        assert response.status_code == 200
        tracks = response.json()
        assert len(tracks) == 13

        # Check first track structure
        first = tracks[0]
        assert "slug" in first
        assert "title" in first
        assert "difficulty" in first
        assert "duration_minutes" in first
        assert "topics" in first
        assert "badge" in first
        assert "icon" in first
        # Crucial security assertion: Internal rubrics and prompt instructions must NEVER leak
        assert "evaluation_rubric" not in first
        assert "question_policy" not in first
        assert "nodes" not in first
        assert "edges" not in first


@pytest.mark.asyncio
async def test_filter_published_tracks_by_category():
    """Verifies category filtering works for TECHNICAL vs OTHER tracks."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        tech_res = await ac.get("/api/v1/interview/tracks?category=TECHNICAL")
        assert tech_res.status_code == 200
        tech_tracks = tech_res.json()
        assert len(tech_tracks) == 11
        assert all(t["category"] == "TECHNICAL" for t in tech_tracks)

        other_res = await ac.get("/api/v1/interview/tracks?category=OTHER")
        assert other_res.status_code == 200
        other_tracks = other_res.json()
        assert len(other_tracks) == 2
        assert all(t["category"] == "OTHER" for t in other_tracks)


@pytest.mark.asyncio
async def test_get_published_track_detail():
    """Verifies GET /api/v1/interview/tracks/{slug} returns track details or 404."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/interview/tracks/backend-engineering")
        assert res.status_code == 200
        data = res.json()
        assert data["slug"] == "backend-engineering"
        assert data["domain"] == "Backend"
        assert data["total_questions"] >= 3
        assert "PostgreSQL ACID" in data["topics"]

        # Unknown slug
        not_found = await ac.get("/api/v1/interview/tracks/nonexistent-track-xyz")
        assert not_found.status_code == 404


@pytest.mark.asyncio
async def test_create_session_from_track_slug_and_start():
    """Verifies candidate can launch an interview directly using an interview_slug."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create session directly from slug
        create_res = await ac.post(
            "/api/v1/interview/sessions",
            json={
                "interview_slug": "backend-engineering",
                "mode": "TEXT",
            },
        )
        assert create_res.status_code == 201
        session = create_res.json()
        session_id = session["id"]
        assert session["target_role"] == "Backend Engineering & Distributed APIs"
        assert session["category"] == "TECHNICAL"
        assert session["plan_version"] == "1.0.0"

        # Start session and verify initial question from pinned blueprint
        start_res = await ac.post(f"/api/v1/interview/sessions/{session_id}/start")
        assert start_res.status_code == 200
        started = start_res.json()
        assert started["state"] == "ASKING"
        assert len(started["questions"]) == 1
        q1 = started["questions"][0]
        assert "Idempotent API Design" in q1["title"] or "Backend" in q1["topic"]
