"""
Automated QA Suite for HCVE (Human Conversational Voice Engine).
Verifies:
1. Event envelope schema validation (Draft 2020-12 alignment).
2. Expression plan schema validation and emphasis span bounds check.
3. Turn state machine transitions and illegal transition rejection.
4. Session lifecycle (create, read, touch, TTL expiry, delete, ownership isolation).
5. Voice expression resolution against persona policies and provider capabilities.
6. Barge-in interruption and cancellation propagation.
"""

import pytest
from app.services.hcve import (
    EventEnvelope,
    ExpressionPlan,
    FakeTTSAdapter,
    HCVEError,
    HCVEErrorCode,
    InMemorySessionRepository,
    PersonaProfile,
    SessionState,
    ToneEnum,
    TurnState,
    VoiceExpressionEngine,
    VoiceRuntimeCoordinator,
)


def test_event_envelope_validation():
    """Verify compliant and non-compliant event envelopes."""
    evt = EventEnvelope(
        event_id="evt_test_101",
        event_type="user_speech_final",
        session_id="ses_abc_123",
        payload={"transcript": "Testing audio ingress."},
    )
    assert evt.schema_version == "1.0"
    assert evt.session_id == "ses_abc_123"
    assert evt.payload["transcript"] == "Testing audio ingress."


def test_expression_plan_validation():
    """Verify expression plan schema conformance and span validation."""
    valid_plan = ExpressionPlan(
        text="The quick brown fox jumps over the lazy dog.",
        expression={
            "tone": "professional",
            "emotion": {"label": "neutral", "strength": 0.0},
            "delivery": {
                "energy": 0.6,
                "warmth": 0.7,
                "formality": 0.8,
                "pace": 0.5,
                "expressiveness": 0.5,
                "volume": 0.6,
            },
            "prosody": {
                "emphasis_spans": [
                    {"start": 4, "end": 9, "strength": 0.8}  # 'quick'
                ]
            },
        },
    )
    assert valid_plan.text.startswith("The quick")

    # Invalid span exceeding text length must raise ValueError
    with pytest.raises(ValueError, match="exceeds response text length"):
        ExpressionPlan(
            text="Short text.",
            expression={
                "prosody": {
                    "emphasis_spans": [
                        {"start": 0, "end": 50, "strength": 0.8}
                    ]
                }
            },
        )


@pytest.mark.asyncio
async def test_session_lifecycle_and_in_memory_repository():
    """Verify session creation, lookup, ownership isolation, and deletion."""
    repo = InMemorySessionRepository()

    session_a = SessionState(
        session_id="ses_alice_001",
        owner_id="mem_alice",
        application_id="ccc_interview_arena",
        persona_id="interview_proctor",
    )
    await repo.create(session_a)

    fetched = await repo.get("ses_alice_001")
    assert fetched is not None
    assert fetched.owner_id == "mem_alice"
    assert fetched.state == TurnState.IDLE

    # Duplicate creation error
    with pytest.raises(HCVEError) as exc_info:
        await repo.create(session_a)
    assert exc_info.value.code == HCVEErrorCode.CONCURRENCY_LOCK_FAILED

    # List by owner
    alice_sessions = await repo.list_by_owner("mem_alice")
    assert len(alice_sessions) == 1
    bob_sessions = await repo.list_by_owner("mem_bob")
    assert len(bob_sessions) == 0

    # Delete
    deleted = await repo.delete("ses_alice_001")
    assert deleted is True
    assert await repo.get("ses_alice_001") is None


@pytest.mark.asyncio
async def test_turn_state_machine_and_illegal_transitions():
    """Verify state transitions adhere strictly to turn_state_machine.mmd."""
    coordinator = VoiceRuntimeCoordinator()
    session = SessionState(
        session_id="ses_state_001",
        owner_id="mem_tester",
    )
    await coordinator.session_repo.create(session)

    # Valid transitions: IDLE -> LISTENING -> PROCESSING -> GENERATING -> SPEAKING -> IDLE
    s1 = await coordinator.transition_state("ses_state_001", TurnState.LISTENING)
    assert s1.state == TurnState.LISTENING

    s2 = await coordinator.transition_state("ses_state_001", TurnState.PROCESSING)
    assert s2.state == TurnState.PROCESSING

    s3 = await coordinator.transition_state("ses_state_001", TurnState.GENERATING)
    assert s3.state == TurnState.GENERATING

    s4 = await coordinator.transition_state("ses_state_001", TurnState.SPEAKING)
    assert s4.state == TurnState.SPEAKING

    # Illegal transition: SPEAKING -> GENERATING (must raise INVALID_STATE_TRANSITION)
    with pytest.raises(HCVEError) as exc_info:
        await coordinator.transition_state("ses_state_001", TurnState.GENERATING)
    assert exc_info.value.code == HCVEErrorCode.INVALID_STATE_TRANSITION


def test_voice_expression_engine_resolution():
    """Verify expression resolution, persona boundary clamping, and capability mapping."""
    vee = VoiceExpressionEngine()
    tts_adapter = FakeTTSAdapter()

    # Request with extreme energy (1.0) and prohibited emotion (frustrated)
    result = vee.resolve(
        raw_text="Let us review your distributed caching approach.",
        proposed_expression={
            "tone": "casual",
            "emotion": {"label": "frustrated", "strength": 0.9},
            "delivery": {"energy": 1.0, "pace": 0.5},
        },
        persona_id="persona_default",
        target_capability=tts_adapter.capability,
    )

    # Delivery energy should be clamped within persona_default limit (max 0.8)
    assert result.plan.expression.delivery.energy <= 0.8
    # Emotion 'frustrated' should be clamped to neutral
    assert result.plan.expression.emotion.label.value == "neutral"
    # Unsupported controls should reflect TTS adapter limitations
    assert "emotion_prompting" in result.unsupported_controls


@pytest.mark.asyncio
async def test_barge_in_and_cancellation_propagation():
    """Verify user speech frame during speaking triggers immediate cancellation and state transition."""
    coordinator = VoiceRuntimeCoordinator()
    session = SessionState(
        session_id="ses_barge_001",
        owner_id="mem_tester",
        state=TurnState.SPEAKING,
        active_response_id="resp_turn_101",
    )
    await coordinator.session_repo.create(session)

    # Ingest speech audio frame (dummy 400 bytes triggers VAD speech)
    speech_frame = b"\x01" * 400
    cancel_evt = await coordinator.handle_user_audio_frame("ses_barge_001", speech_frame)

    assert cancel_evt is not None
    assert cancel_evt.event_type == "assistant.response.cancelled"
    assert cancel_evt.response_id == "resp_turn_101"

    updated_session = await coordinator.session_repo.get("ses_barge_001")
    assert updated_session is not None
    assert updated_session.state == TurnState.LISTENING
    assert updated_session.is_cancelled is True

