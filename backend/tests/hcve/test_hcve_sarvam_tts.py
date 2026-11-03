"""
HCVE Sarvam AI Neural Speech Rendering Adapter QA Test.
Verifies:
1. Provider capability discovery for Sarvam AI Bulbul models and voices.
2. Pace translation from ExpressionPlan delivery specifications into Sarvam pace floats.
3. Live neural streaming chunk generation in Hindi with Bulbul v4-flash.
4. Cancellation propagation discarding downstream chunks.
"""

import asyncio
import os
import pytest
from app.services.hcve import (
    AudioCodec,
    ExpressionPlan,
    SarvamTTSAdapter,
)

SARVAM_KEY = os.getenv("SARVAM_API_KEY", "sk_cumsvxzq_aZBBhDwzX6lPRUNuAyKrJdau")


def test_sarvam_tts_capability_discovery():
    """Verify SarvamTTSAdapter advertises supported Indic voices and streaming capabilities."""
    adapter = SarvamTTSAdapter(api_key=SARVAM_KEY)
    cap = adapter.capability

    assert cap.provider_id == "sarvam_ai_bulbul_v4"
    assert cap.supports_streaming is True
    assert cap.supports_cancellation is True
    assert "shubh_enhi_ads" in cap.supported_voices
    assert "shubh" in cap.supported_voices
    assert "hi-IN" in cap.supported_locales
    assert "en-IN" in cap.supported_locales
    assert AudioCodec.MP3 in cap.supported_codecs


def test_sarvam_tts_pace_resolution():
    """Verify delivery specs correctly modulate pace multiplier."""
    adapter = SarvamTTSAdapter(api_key=SARVAM_KEY)
    plan = ExpressionPlan(
        text="परीक्षण वाक्य",
        expression={
            "tone": "reassuring",
            "emotion": {"label": "neutral", "strength": 0.0},
            "delivery": {
                "energy": 0.6,
                "warmth": 0.8,
                "formality": 0.7,
                "pace": 0.5,  # Neutral -> 1.0
                "expressiveness": 0.5,
                "volume": 0.7,
            },
        },
    )

    pace = adapter._resolve_pace(plan)
    assert pace == 1.0

    # Test faster pace
    plan_fast = ExpressionPlan(
        text="परीक्षण वाक्य",
        expression={
            "tone": "reassuring",
            "emotion": {"label": "neutral", "strength": 0.0},
            "delivery": {
                "energy": 0.6,
                "warmth": 0.8,
                "formality": 0.7,
                "pace": 0.8,  # Faster
                "expressiveness": 0.5,
                "volume": 0.7,
            },
        },
    )
    pace_fast = adapter._resolve_pace(plan_fast)
    assert pace_fast > 1.0


@pytest.mark.asyncio
async def test_sarvam_tts_streaming_synthesis_and_cancellation():
    """Verify live streaming synthesis yields ordered chunks and honors cancellation."""
    adapter = SarvamTTSAdapter(api_key=SARVAM_KEY)
    plan = ExpressionPlan(
        text="नमस्ते! रेल सहायता में आपका स्वागत है। बताइए, मैं आपकी क्या मदद कर सकता हूँ?",
        expression={
            "tone": "professional",
            "emotion": {"label": "neutral", "strength": 0.0},
            "delivery": {
                "energy": 0.5,
                "warmth": 0.7,
                "formality": 0.8,
                "pace": 0.5,
                "expressiveness": 0.5,
                "volume": 0.6,
            },
        },
    )

    chunks = []
    cancel_evt = asyncio.Event()

    async for meta, audio_bytes in adapter.synthesize_stream(
        plan=plan,
        response_id="resp_test_sarvam_hindi",
        cancel_event=cancel_evt,
        voice="shubh_enhi_ads",
    ):
        chunks.append((meta, audio_bytes))
        assert meta.response_id == "resp_test_sarvam_hindi"
        assert meta.format.codec == AudioCodec.MP3
        assert len(audio_bytes) > 0

        # Trigger cancellation after receiving the first 2 chunks
        if len(chunks) == 2:
            cancel_evt.set()

    assert len(chunks) == 2  # Cleanly aborted immediately after 2 chunks

