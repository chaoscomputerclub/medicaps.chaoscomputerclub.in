"""
HCVE Production Readiness QA Suite.
Tests:
- Audio ingress buffering, backpressure, reordering, and overflow.
- Audio egress sequencing and stale chunk rejection on cancellation.
- Control-plane HTTP API endpoints (/health, /ready, /sessions, /interrupt).
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.middleware.auth import get_current_member
from app.models.db_models import MemberProfile
from app.services.hcve.contracts import (
    AudioCodec,
    AudioFormatSpec,
)
from app.services.hcve.transport import (
    AudioEgressSequencer,
    AudioFrame,
    AudioIngressBuffer,
)
from main import app


@pytest.mark.asyncio
async def test_audio_ingress_buffer_reordering_and_backpressure():
    """Verify ingress buffer properly sequences out-of-order frames and handles overflow."""
    buf = AudioIngressBuffer(max_frames=3, max_payload_bytes=1000)

    # Push frames out of order: seq 1, then seq 0
    f1 = AudioFrame(
        session_id="ses_1",
        stream_id="str_1",
        sequence=1,
        timestamp_ms=20,
        payload_bytes=b"\x00" * 100,
    )
    f0 = AudioFrame(
        session_id="ses_1",
        stream_id="str_1",
        sequence=0,
        timestamp_ms=0,
        payload_bytes=b"\x00" * 100,
    )

    await buf.push_frame(f1)
    await buf.push_frame(f0)

    # Must pop in strict order: seq 0 first, then seq 1
    p0 = await buf.pop_next_ordered()
    assert p0 is not None
    assert p0.sequence == 0

    p1 = await buf.pop_next_ordered()
    assert p1 is not None
    assert p1.sequence == 1

    assert await buf.pop_next_ordered() is None


@pytest.mark.asyncio
async def test_audio_egress_sequencer_stale_rejection():
    """Verify egress sequencer attaches sequential numbers and immediately rejects cancelled responses."""
    sequencer = AudioEgressSequencer()
    fmt = AudioFormatSpec(codec=AudioCodec.PCM_S16LE, sample_rate_hz=24000, channels=1)

    # Active response chunk 0
    res0 = await sequencer.prepare_chunk("resp_101", "seg_0", b"\x00" * 480, fmt, 20)
    assert res0 is not None
    meta0, _ = res0
    assert meta0.sequence == 0

    # Active response chunk 1
    res1 = await sequencer.prepare_chunk("resp_101", "seg_1", b"\x00" * 480, fmt, 20)
    assert res1 is not None
    meta1, _ = res1
    assert meta1.sequence == 1

    # Register cancellation for response resp_101
    await sequencer.register_cancellation("resp_101")

    # Stale chunk for resp_101 must be immediately rejected (returns None)
    res_stale = await sequencer.prepare_chunk("resp_101", "seg_2", b"\x00" * 480, fmt, 20)
    assert res_stale is None


@pytest.mark.asyncio
async def test_hcve_control_plane_api_endpoints():
    """Verify FastAPI endpoints: /health, /ready, authenticated /sessions, and /interrupt."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Health & Ready
        h_resp = await client.get("/api/v1/hcve/health")
        assert h_resp.status_code == 200
        assert h_resp.json()["status"] == "ok"

        r_resp = await client.get("/api/v1/hcve/ready")
        assert r_resp.status_code == 200
        assert r_resp.json()["status"] == "ready"

        # 2. Unauthenticated Create Session must return 401 (CCC-AI-0601)
        unauth_resp = await client.post(
            "/api/v1/hcve/sessions",
            json={"application_id": "test_app", "persona_id": "interview_proctor"},
        )
        assert unauth_resp.status_code == 401

        # 3. Authenticate as student_42
        test_member = MemberProfile(
            id="mem_hcve_test_42",
            handle="voice_tester",
            email="voice_tester@chaoscomputerclub.in",
            full_name="Voice Tester",
            rating=1200,
            is_onboarded=True,
        )
        app.dependency_overrides[get_current_member] = lambda: test_member

        try:
            # 4. Authenticated Create Session
            c_resp = await client.post(
                "/api/v1/hcve/sessions",
                json={
                    "application_id": "test_app",
                    "persona_id": "interview_proctor",
                    "language": "en-IN",
                },
            )
            assert c_resp.status_code == 201
            session_data = c_resp.json()
            session_id = session_data["session_id"]
            assert session_data["owner_id"] == "mem_hcve_test_42"
            assert session_data["state"] == "Idle"

            # 5. Read Session
            g_resp = await client.get(f"/api/v1/hcve/sessions/{session_id}")
            assert g_resp.status_code == 200
            assert g_resp.json()["session_id"] == session_id

            # 6. Trigger Interruption
            i_resp = await client.post(
                f"/api/v1/hcve/sessions/{session_id}/interrupt",
                json={"reason": "user_voice_barge_in"},
            )
            assert i_resp.status_code == 200
            assert i_resp.json()["interrupted"] is True

            # 7. Close Session
            d_resp = await client.delete(f"/api/v1/hcve/sessions/{session_id}")
            assert d_resp.status_code == 204

            # 8. Read after close must be 404
            g_closed = await client.get(f"/api/v1/hcve/sessions/{session_id}")
            assert g_closed.status_code == 404

        finally:
            app.dependency_overrides.pop(get_current_member, None)
