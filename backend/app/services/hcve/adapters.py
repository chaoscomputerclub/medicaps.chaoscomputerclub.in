"""
HCVE Provider Adapters & Fake Test Adapters.
Implements HCVE-020 (VAD), HCVE-021 (STT), HCVE-031 (LLM), HCVE-050/051 (TTS).
Provides deterministic test doubles and provider capability discovery.
"""

from __future__ import annotations

import asyncio
from typing import AsyncIterator, List, Optional
from pydantic import BaseModel

from app.services.hcve.contracts import (
    AudioChunkMetadata,
    AudioCodec,
    AudioFormatSpec,
    ExpressionPlan,
    ProviderCapability,
)


class VADResult(BaseModel):
    is_speech: bool
    confidence: float
    is_speech_start: bool = False
    is_speech_end: bool = False


class FakeVADAdapter:
    """Deterministic VAD double for automated unit & integration testing."""

    def __init__(self, speech_frames: Optional[set[int]] = None) -> None:
        self.speech_frames = speech_frames or set()
        self.frame_counter = 0

    def process_frame(self, frame_bytes: bytes) -> VADResult:
        self.frame_counter += 1
        is_speech = self.frame_counter in self.speech_frames or len(frame_bytes) > 200
        return VADResult(
            is_speech=is_speech,
            confidence=0.95 if is_speech else 0.05,
            is_speech_start=is_speech and self.frame_counter == 1,
            is_speech_end=not is_speech and (self.frame_counter - 1) in self.speech_frames,
        )


class FakeSTTAdapter:
    """Deterministic streaming STT double emitting partial and final transcripts."""

    def __init__(self, predefined_script: Optional[List[str]] = None) -> None:
        self.script = predefined_script or ["Hello interviewer,", "I am ready for the technical evaluation."]
        self.capability = ProviderCapability(
            provider_id="fake_stt_v1",
            provider_type="STT",
            supports_streaming=True,
            supports_cancellation=True,
            supported_locales=["en-IN", "en-US"],
        )

    async def stream_transcribe(self, audio_frames: AsyncIterator[bytes]) -> AsyncIterator[dict]:
        async for _ in audio_frames:
            for i, chunk in enumerate(self.script):
                is_final = (i == len(self.script) - 1)
                yield {
                    "text": chunk,
                    "is_final": is_final,
                    "confidence": 0.98,
                }
                await asyncio.sleep(0.01)
            break


class FakeLLMAdapter:
    """Deterministic LLM double supporting streaming text tokens and structured expression."""

    def __init__(self, responses: Optional[List[str]] = None) -> None:
        self.responses = responses or ["Welcome to the Chaos Computer Club interview simulation. Let's begin."]
        self.call_count = 0
        self.capability = ProviderCapability(
            provider_id="fake_llm_v1",
            provider_type="LLM",
            supports_streaming=True,
            supports_cancellation=True,
        )

    async def generate_response_stream(
        self,
        prompt: str,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> AsyncIterator[str]:
        resp = self.responses[self.call_count % len(self.responses)]
        self.call_count += 1
        words = resp.split(" ")
        for w in words:
            if cancel_event and cancel_event.is_set():
                break
            yield w + " "
            await asyncio.sleep(0.01)


class FakeTTSAdapter:
    """Deterministic TTS double generating synthesized audio chunks with response-level cancellation."""

    def __init__(self) -> None:
        self.capability = ProviderCapability(
            provider_id="fake_tts_v1",
            provider_type="TTS",
            supports_streaming=True,
            supports_cancellation=True,
            supported_codecs=[AudioCodec.PCM_S16LE],
            supported_voices=["voice_standard", "proctor_calm"],
            supports_prosody_tuning=True,
            supports_emotion_prompting=False,
        )

    async def synthesize_stream(
        self,
        plan: ExpressionPlan,
        response_id: str,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> AsyncIterator[tuple[AudioChunkMetadata, bytes]]:
        # Simulate generating 3 discrete audio chunks
        for seq in range(3):
            if cancel_event and cancel_event.is_set():
                break
            meta = AudioChunkMetadata(
                response_id=response_id,
                segment_id=f"seg_{seq}",
                sequence=seq,
                format=AudioFormatSpec(codec=AudioCodec.PCM_S16LE, sample_rate_hz=24000, channels=1),
                duration_ms=100,
                payload_ref="inline",
            )
            dummy_pcm_bytes = b"\x00" * 4800  # 100ms of 24kHz 16-bit mono
            yield meta, dummy_pcm_bytes
            await asyncio.sleep(0.02)

