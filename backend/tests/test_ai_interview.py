"""
Chaos Computer Club — Medi-Caps Chapter
AI Interview Practice Backend Test Suite (CCC-AI-601)

Verifies:
1. Category registry metadata, capabilities, and defaults.
2. Interview session creation and initial state invariants.
3. Session start, agenda planning via LLM, and first question formulation.
4. Ownership & security boundary: 403 Forbidden on cross-member access.
5. Idempotent answer submissions: duplicate idempotency_key returns cached answer.
6. Turn evaluation, score calculation, and question advancement.
7. Lifecycle controls: Pause, Resume, and manual Complete.
8. Comprehensive final dossier coaching report synthesis and fallback safety.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, delete

from main import app
from app.core.db import AsyncSessionLocal, init_db
from app.middleware.auth import get_current_member
from app.models.db_models import MemberProfile
from app.models.interview import (
    InterviewSession,
    InterviewQuestion,
    InterviewAnswer,
    InterviewEvaluation,
    InterviewReport,
)
from app.services.interview.category_registry import get_all_categories, get_category_config
from app.services.llm.mock_provider import DeterministicMockLLMProvider
from app.services.llm import factory as llm_factory


def make_member(member_id: str, handle: str) -> MemberProfile:
    return MemberProfile(
        id=member_id,
        handle=handle,
        email=f"{handle}@chaoscomputerclub.in",
        full_name=f"Tester {handle}",
        prn=f"EN22CS{abs(hash(member_id)) % 899999 + 100000}",
        department="CSE",
        batch="2022-26",
        rating=1350,
        peak_rating=1350,
        is_onboarded=True,
    )


@pytest_asyncio.fixture(autouse=True)
async def setup_interview_test_env():
    """Ensure database is initialized and mock LLM provider is active for hermetic testing."""
    await init_db()
    # Force DeterministicMockLLMProvider for all tests
    mock_provider = DeterministicMockLLMProvider()
    llm_factory.set_llm_provider(mock_provider)

    yield

    llm_factory.set_llm_provider(None)


@pytest.mark.asyncio
async def test_category_registry_metadata():
    """Verify all 10 curated categories exist with required attributes."""
    categories = get_all_categories()
    assert len(categories) == 10

    category_ids = {c["id"] for c in categories}
    expected_ids = {
        "TECHNICAL", "CODING", "DSA", "SYSTEM_DESIGN",
        "BACKEND", "FRONTEND", "DEVOPS", "DATABASE_SQL",
        "BEHAVIORAL", "MIXED"
    }
    assert category_ids == expected_ids

    coding_cat = get_category_config("CODING")
    assert coding_cat["supports_code"] is True
    assert len(coding_cat["default_topics"]) > 0

    design_cat = get_category_config("SYSTEM_DESIGN")
    assert design_cat["supports_diagrams"] is True


@pytest.mark.asyncio
async def test_session_creation_and_ownership_gate():
    """Verify session creation and 403 access control across members."""
    member_a = make_member("test-mem-a", "alice_sec")
    member_b = make_member("test-mem-b", "bob_hacker")

    async with AsyncSessionLocal() as db:
        await db.execute(delete(InterviewSession).where(InterviewSession.member_id.in_(["test-mem-a", "test-mem-b"])))
        await db.merge(member_a)
        await db.merge(member_b)
        await db.commit()

    # Authenticate as Member A
    app.dependency_overrides[get_current_member] = lambda: member_a
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Create Session
        create_res = await client.post(
            "/api/interview/sessions",
            json={
                "target_role": "Distributed Systems Engineer",
                "experience_level": "MID_LEVEL",
                "category": "BACKEND",
                "difficulty": "HARD",
                "duration_minutes": 30,
                "preferred_language": "python",
                "focus_topics": ["PostgreSQL ACID", "Redis Pub/Sub"],
                "resume_notes": "Built distributed ledger and async queues.",
            },
        )
        assert create_res.status_code == 201
        data = create_res.json()
        session_id = data["id"]
        assert data["state"] == "CREATED"
        assert data["category"] == "BACKEND"
        assert data["target_role"] == "Distributed Systems Engineer"

        # 2. Member A can read their session
        detail_res = await client.get(f"/api/interview/sessions/{session_id}")
        assert detail_res.status_code == 200

        # 3. Member B attempts to read Member A's session -> 403 Forbidden
        app.dependency_overrides[get_current_member] = lambda: member_b
        forbidden_res = await client.get(f"/api/interview/sessions/{session_id}")
        assert forbidden_res.status_code == 403

        # 4. Member B attempts to answer Member A's session -> 403 Forbidden
        forbidden_answer = await client.post(
            f"/api/interview/sessions/{session_id}/answer",
            json={
                "idempotency_key": "bob-exploit-attempt-key-12345",
                "answer_text": "Unauthorized answer",
            },
        )
        assert forbidden_answer.status_code == 403

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_interview_full_lifecycle_and_idempotency():
    """Verify complete start -> ask -> idempotent answer -> follow-up -> complete pipeline."""
    member = make_member("test-mem-lifecycle", "charlie_dev")

    async with AsyncSessionLocal() as db:
        await db.execute(delete(InterviewSession).where(InterviewSession.member_id == member.id))
        await db.merge(member)
        await db.commit()

    app.dependency_overrides[get_current_member] = lambda: member
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Create Session
        create_res = await client.post(
            "/api/interview/sessions",
            json={
                "target_role": "Backend Engineer",
                "experience_level": "ENTRY_LEVEL",
                "category": "CODING",
                "difficulty": "MEDIUM",
                "duration_minutes": 30,
                "preferred_language": "python",
                "focus_topics": ["Two Pointers", "Sliding Window"],
            },
        )
        assert create_res.status_code == 201
        session_id = create_res.json()["id"]

        # 2. Start Session
        start_res = await client.post(f"/api/interview/sessions/{session_id}/start")
        assert start_res.status_code == 200
        start_data = start_res.json()
        assert start_data["state"] == "ASKING"
        assert start_data["current_question"] is not None
        assert len(start_data["questions"]) >= 1

        active_q = start_data["current_question"]

        # 3. Submit Answer with Idempotency Key
        idempotency_key = "idemp-key-test-abc-123456"
        answer_payload = {
            "idempotency_key": idempotency_key,
            "answer_text": "We maintain two pointers left and right, expanding the window and shrinking when constraint violated.",
            "submitted_code": "def solve(nums):\n    return len(nums)",
        }

        ans_res1 = await client.post(f"/api/interview/sessions/{session_id}/answer", json=answer_payload)
        assert ans_res1.status_code == 200
        ans_data1 = ans_res1.json()
        assert len(ans_data1["answers"]) == 1
        assert len(ans_data1["evaluations"]) == 1
        eval_item = ans_data1["evaluations"][0]
        assert eval_item["score"] >= 0
        assert len(eval_item["strengths"]) > 0

        # 4. Idempotent Retry: Send EXACT same answer payload with same idempotency_key
        ans_res2 = await client.post(f"/api/interview/sessions/{session_id}/answer", json=answer_payload)
        assert ans_res2.status_code == 200
        ans_data2 = ans_res2.json()
        # Must NOT duplicate answer or evaluation rows
        assert len(ans_data2["answers"]) == 1
        assert len(ans_data2["evaluations"]) == 1

        # 5. Pause and Resume Session
        pause_res = await client.post(f"/api/interview/sessions/{session_id}/pause")
        assert pause_res.status_code == 200
        assert pause_res.json()["state"] == "PAUSED"

        resume_res = await client.post(f"/api/interview/sessions/{session_id}/resume")
        assert resume_res.status_code == 200
        assert resume_res.json()["state"] == "ASKING"

        # 6. Complete Session & Finalize Report
        complete_res = await client.post(f"/api/interview/sessions/{session_id}/complete")
        assert complete_res.status_code == 200
        comp_data = complete_res.json()
        assert comp_data["state"] == "COMPLETED"
        assert comp_data["report"] is not None
        report = comp_data["report"]
        assert report["overall_score"] >= 0
        assert report["verdict"] in ("STRONG_HIRE", "HIRE", "LEANING_HIRE", "NEUTRAL", "LEANING_NO_HIRE", "NO_HIRE")
        assert len(report["top_strengths"]) > 0
        assert len(report["areas_to_improve"]) > 0
        assert len(report["recommended_practice"]) > 0

        # 7. List Sessions
        list_res = await client.get("/api/interview/sessions")
        assert list_res.status_code == 200
        items = list_res.json()
        matched = [s for s in items if s["id"] == session_id]
        assert len(matched) == 1
        assert matched[0]["state"] == "COMPLETED"
        assert matched[0]["overall_score"] is not None

        # 8. Delete Session
        del_res = await client.delete(f"/api/interview/sessions/{session_id}")
        assert del_res.status_code == 200

        # Verify 404 after delete
        not_found_res = await client.get(f"/api/interview/sessions/{session_id}")
        assert not_found_res.status_code == 404

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_langgraph_checkpoint_thread_isolation():
    """Verify that multiple concurrent interview sessions have isolated thread checkpoints."""
    from app.services.interview.langgraph_orchestrator import _LANGGRAPH_CHECKPOINTER, _COMPILED_INTERVIEW_GRAPH

    member1 = make_member("test-mem-thread-1", "user_alpha")
    member2 = make_member("test-mem-thread-2", "user_beta")

    async with AsyncSessionLocal() as db:
        await db.execute(delete(InterviewSession).where(InterviewSession.member_id.in_([member1.id, member2.id])))
        await db.merge(member1)
        await db.merge(member2)
        await db.commit()

    transport = ASGITransport(app=app)

    # Session 1 for Member 1
    app.dependency_overrides[get_current_member] = lambda: member1
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        res1 = await client.post(
            "/api/interview/sessions",
            json={
                "target_role": "Security Researcher",
                "experience_level": "MID_LEVEL",
                "category": "TECHNICAL",
                "difficulty": "HARD",
                "duration_minutes": 45,
                "preferred_language": "python",
                "focus_topics": ["Binary Exploitation", "Kernel Security"],
            },
        )
        s1_id = res1.json()["id"]
        await client.post(f"/api/interview/sessions/{s1_id}/start")

    # Session 2 for Member 2
    app.dependency_overrides[get_current_member] = lambda: member2
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        res2 = await client.post(
            "/api/interview/sessions",
            json={
                "target_role": "Frontend Architect",
                "experience_level": "SENIOR",
                "category": "FRONTEND",
                "difficulty": "MEDIUM",
                "duration_minutes": 30,
                "preferred_language": "typescript",
                "focus_topics": ["Rendering Performance", "Hydration Boundaries"],
            },
        )
        s2_id = res2.json()["id"]
        await client.post(f"/api/interview/sessions/{s2_id}/start")

    # Verify LangGraph checkpoint threads are isolated
    cfg1 = {"configurable": {"thread_id": s1_id}}
    cfg2 = {"configurable": {"thread_id": s2_id}}

    state1 = await _COMPILED_INTERVIEW_GRAPH.aget_state(cfg1)
    state2 = await _COMPILED_INTERVIEW_GRAPH.aget_state(cfg2)

    assert state1.values["target_role"] == "Security Researcher"
    assert state2.values["target_role"] == "Frontend Architect"
    assert state1.values["session_id"] != state2.values["session_id"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_candidate_context_integration():
    """Verify candidate context builder extracts candidate profile and resume notes without leakage."""
    from app.services.interview.candidate_context_service import CandidateContextService

    member = make_member("test-mem-context", "context_hacker")
    async with AsyncSessionLocal() as db:
        await db.merge(member)
        await db.commit()

        context_str = await CandidateContextService.build_bounded_context(
            member=member,
            target_role="Site Reliability Engineer",
            category="DEVOPS",
            resume_notes="Maintained 99.99% uptime for multi-region Kubernetes clusters.",
            job_description="Seeking engineer with deep Linux kernel and Prometheus experience.",
            db=db,
        )

    assert "Site Reliability Engineer" in context_str
    assert "Candidate-" in context_str
    assert member.prn not in context_str
    assert "99.99% uptime" in context_str
    assert "Prometheus" in context_str


@pytest.mark.asyncio
async def test_idempotency_conflict_detection():
    """Verify that using the same idempotency key with a DIFFERENT payload returns 409 conflict."""
    member = make_member("test-mem-idemp-conflict", "idemp_user")

    async with AsyncSessionLocal() as db:
        await db.execute(delete(InterviewSession).where(InterviewSession.member_id == member.id))
        await db.merge(member)
        await db.commit()

    app.dependency_overrides[get_current_member] = lambda: member
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        res = await client.post(
            "/api/interview/sessions",
            json={
                "target_role": "Backend Engineer",
                "experience_level": "ENTRY_LEVEL",
                "category": "TECHNICAL",
                "difficulty": "MEDIUM",
                "duration_minutes": 30,
                "preferred_language": "python",
                "focus_topics": ["APIs"],
            },
        )
        s_id = res.json()["id"]
        await client.post(f"/api/interview/sessions/{s_id}/start")

        key = "conflict-test-key-999888"
        p1 = {
            "idempotency_key": key,
            "answer_text": "Original answer payload.",
        }
        ans1 = await client.post(f"/api/interview/sessions/{s_id}/answer", json=p1)
        assert ans1.status_code == 200

        # Submit different text with same key -> 409 Conflict
        p2 = {
            "idempotency_key": key,
            "answer_text": "Altered answer payload with same key.",
        }
        ans2 = await client.post(f"/api/interview/sessions/{s_id}/answer", json=p2)
        assert ans2.status_code == 409
        assert "IDEMPOTENCY_KEY_REUSED" in ans2.json()["detail"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_candidate_profile_and_resume_lifecycle():
    """Verify profile CRUD, resume upload, fact review, and consent lifecycle."""
    member = make_member("test-mem-resume-life", "resume_pro")

    async with AsyncSessionLocal() as db:
        await db.merge(member)
        await db.commit()

    app.dependency_overrides[get_current_member] = lambda: member
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Get profile (initializes default)
        prof_res = await client.get("/api/interview/profile")
        assert prof_res.status_code == 200
        assert prof_res.json()["context_consent"] is True

        # 2. Patch profile
        patch_res = await client.patch(
            "/api/interview/profile",
            json={
                "declared_skills": ["Python", "FastAPI", "Docker"],
                "learning_goals": ["Master distributed transactions"],
            },
        )
        assert patch_res.status_code == 200
        assert "FastAPI" in patch_res.json()["declared_skills"]

        # 3. Upload resume (plain text file)
        resume_content = (
            "Alex Mercer\n"
            "Software Engineer with 3 years experience building APIs in Python and FastAPI.\n"
            "Skills: Python, FastAPI, Docker, PostgreSQL, Redis, Kubernetes.\n"
            "Projects: Built distributed event bus with Kafka."
        )
        files = {"file": ("alex_resume.txt", resume_content.encode("utf-8"), "text/plain")}
        up_res = await client.post("/api/interview/resumes", files=files)
        assert up_res.status_code == 201
        asset_data = up_res.json()
        asset_id = asset_data["asset_id"]
        assert asset_data["detected_mime_type"] == "text/plain"
        assert asset_data["scan_status"] == "CLEAN"

        # 4. Get resume detail and review facts
        det_res = await client.get(f"/api/interview/resumes/{asset_id}")
        assert det_res.status_code == 200
        det_data = det_res.json()
        facts = det_data["facts"]
        assert len(facts) > 0
        fact_id = facts[0]["id"]

        # 5. Patch fact (confirm with candidate correction)
        fact_patch_res = await client.patch(
            f"/api/interview/resumes/{asset_id}/facts",
            json=[
                {
                    "fact_id": fact_id,
                    "candidate_status": "CONFIRMED",
                    "candidate_corrected_value": "Python 3.12 Senior Specialist",
                }
            ],
        )
        assert fact_patch_res.status_code == 200
        updated_facts = fact_patch_res.json()
        assert any(f["candidate_status"] == "CONFIRMED" for f in updated_facts)

        # 6. Grant explicit consent
        consent_res = await client.post(
            f"/api/interview/resumes/{asset_id}/consent",
            json={"consent": True, "purpose": "USE_RESUME_IN_INTERVIEW"},
        )
        assert consent_res.status_code == 200
        assert consent_res.json()["consent_status"] == "CONFIRMED"

        # 7. Delete resume asset
        del_res = await client.delete(f"/api/interview/resumes/{asset_id}")
        assert del_res.status_code == 200

        # Verify 404 after delete
        not_found = await client.get(f"/api/interview/resumes/{asset_id}")
        assert not_found.status_code == 404

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_interview_report_and_regeneration():
    """Verify versioned report creation, retrieval, and explicit regeneration."""
    member = make_member("test-mem-report-regen", "regen_dev")

    async with AsyncSessionLocal() as db:
        await db.execute(delete(InterviewSession).where(InterviewSession.member_id == member.id))
        await db.merge(member)
        await db.commit()

    app.dependency_overrides[get_current_member] = lambda: member
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Create, start, complete session
        c_res = await client.post(
            "/api/interview/sessions",
            json={
                "target_role": "Platform Engineer",
                "experience_level": "SENIOR",
                "category": "DEVOPS",
                "difficulty": "HARD",
                "duration_minutes": 30,
                "preferred_language": "python",
                "focus_topics": ["Kubernetes Operators"],
            },
        )
        s_id = c_res.json()["id"]
        await client.post(f"/api/interview/sessions/{s_id}/start")
        await client.post(f"/api/interview/sessions/{s_id}/complete")

        # 1. Get initial report (version 1.0)
        rep1_res = await client.get(f"/api/interview/sessions/{s_id}/report")
        assert rep1_res.status_code == 200
        rep1 = rep1_res.json()
        assert rep1["report_version"] == "1.0"
        assert rep1["overall_score"] >= 0

        # 2. Regenerate report -> creates new version 1.1
        rep2_res = await client.post(f"/api/interview/sessions/{s_id}/report/regenerate")
        assert rep2_res.status_code == 200
        rep2 = rep2_res.json()
        assert rep2["report_version"] == "1.1"

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_voice_session_authenticated_binding():
    """Verify voice session link creation, client barge-in, and close."""
    member = make_member("test-mem-voice-bind", "voice_pilot")

    async with AsyncSessionLocal() as db:
        await db.execute(delete(InterviewSession).where(InterviewSession.member_id == member.id))
        await db.merge(member)
        await db.commit()

    app.dependency_overrides[get_current_member] = lambda: member
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Create session
        c_res = await client.post(
            "/api/interview/sessions",
            json={
                "target_role": "Fullstack Engineer",
                "experience_level": "ENTRY_LEVEL",
                "category": "MIXED",
                "difficulty": "MEDIUM",
                "duration_minutes": 15,
                "preferred_language": "typescript",
                "mode": "VOICE",
            },
        )
        s_id = c_res.json()["id"]

        # 1. Bind voice session
        bind_res = await client.post(f"/api/interview/sessions/{s_id}/voice-session")
        assert bind_res.status_code == 200
        voice_data = bind_res.json()
        voice_id = voice_data["voice_session_id"]
        assert voice_data["owner_id"] == member.id
        assert voice_data["transport"]["type"] == "WEBSOCKET"

        # 2. Interrupt voice session
        intr_res = await client.post(f"/api/interview/sessions/{s_id}/voice-session/{voice_id}/interrupt")
        assert intr_res.status_code == 200
        assert intr_res.json()["interrupted"] is True

        # 3. Close voice session
        close_res = await client.delete(f"/api/interview/sessions/{s_id}/voice-session/{voice_id}")
        assert close_res.status_code == 200

        # 4. Abandon session
        ab_res = await client.post(f"/api/interview/sessions/{s_id}/abandon")
        assert ab_res.status_code == 200
        assert ab_res.json()["state"] == "ABANDONED"

    app.dependency_overrides.clear()

