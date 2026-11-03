"""
HCVE Edge-TTS Neural Speech Rendering Adapter QA Test.
Verifies:
1. Provider capability discovery for edge-tts neural voices.
2. Prosody translation from ExpressionPlan delivery specifications into rate/volume tags.
3. Live neural streaming chunk generation in Hindi Male voice (hi-IN-MadhurNeural).
4. Cancellation propagation discarding downstream chunks.
"""

import asyncio
import pytest
from app.services.hcve import (
    AudioCodec,
    EdgeTTSAdapter,
    ExpressionPlan,
)


def test_edge_tts_capability_discovery():
    """Verify EdgeTTSAdapter advertises supported Hindi/Indian voices and streaming capabilities."""
    adapter = EdgeTTSAdapter()
    cap = adapter.capability

    assert cap.provider_id == "edge_tts_neural_v1"
    assert cap.supports_streaming is True
    assert cap.supports_cancellation is True
    assert "hi-IN-MadhurNeural" in cap.supported_voices
    assert "en-IN-PrabhatNeural" in cap.supported_voices
    assert AudioCodec.MP3 in cap.supported_codecs


def test_edge_tts_prosody_resolution():
    """Verify delivery specs correctly modulate rate and volume percentages."""
    adapter = EdgeTTSAdapter()
    plan = ExpressionPlan(
        text="परीक्षण वाक्य",
        expression={
            "tone": "reassuring",
            "emotion": {"label": "neutral", "strength": 0.0},
            "delivery": {
                "energy": 0.6,
                "warmth": 0.8,
                "formality": 0.7,
                "pace": 0.6,   # +6% pace
                "expressiveness": 0.5,
                "volume": 0.7, # +10% volume
            },
        },
    )

    rate, vol = adapter._resolve_prosody(plan)
    assert rate == "+6%"
    assert vol == "+10%"


@pytest.mark.asyncio
async def test_edge_tts_streaming_synthesis_and_cancellation():
    """Verify live streaming synthesis yields ordered chunks and honors cancellation."""
    adapter = EdgeTTSAdapter()
    plan = ExpressionPlan(
        text="नमस्ते! रेल सहायता में आपका स्वागत है।",
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
        response_id="resp_test_hindi_male",
        cancel_event=cancel_evt,
        voice="hi-IN-MadhurNeural",
    ):
        chunks.append((meta, audio_bytes))
        assert meta.response_id == "resp_test_hindi_male"
        assert meta.format.codec == AudioCodec.MP3
        assert len(audio_bytes) > 0
        
        # Test cancellation after first 3 chunks
        if len(chunks) == 3:
            cancel_evt.set()

    assert len(chunks) == 3  # Aborted immediately after 3 chunks due to cancellation token
