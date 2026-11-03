"""
HCVE Edge-TTS Neural Speech Rendering Adapter.
Implements HCVE-050/051 with real neural multi-lingual synthesis using edge-tts.
Complies with §10 Open-Source-First Implementation Policy.
"""

from __future__ import annotations

import asyncio
from typing import AsyncIterator, List, Optional
import edge_tts

from app.services.hcve.contracts import (
    AudioChunkMetadata,
    AudioCodec,
    AudioFormatSpec,
    ExpressionPlan,
    ProviderCapability,
)


class EdgeTTSAdapter:
    """Production open-source neural TTS adapter using Microsoft Edge TTS service.
    
    Supports real-time streaming, low-latency chunks, rate/volume prosody modulation,
    and cancellation propagation.
    """

    DEFAULT_VOICE = "hi-IN-MadhurNeural"  # High-fidelity Indian Hindi Male Neural Voice

    def __init__(self, default_voice: str = DEFAULT_VOICE) -> None:
        self.default_voice = default_voice
        self.capability = ProviderCapability(
            provider_id="edge_tts_neural_v1",
            provider_type="TTS",
            supports_streaming=True,
            supports_cancellation=True,
            supported_codecs=[AudioCodec.MP3, AudioCodec.PCM_S16LE],
            supported_voices=[
                "hi-IN-MadhurNeural",  # Hindi Male (Friendly, Warm)
                "hi-IN-SwaraNeural",   # Hindi Female (Clear, Professional)
                "en-IN-PrabhatNeural", # Indian English Male
                "en-IN-NeerjaNeural",  # Indian English Female
            ],
            supported_locales=["hi-IN", "en-IN", "en-US"],
            supports_prosody_tuning=True,
            supports_emotion_prompting=False,
        )

    def _resolve_prosody(self, plan: ExpressionPlan) -> tuple[str, str]:
        """Convert ExpressionPlan delivery parameters into EdgeTTS rate and volume strings."""
        delivery = plan.expression.delivery
        
        # Pace: 0.5 is neutral (0%). Map 0.0..1.0 to -30%..+30%
        pace_offset = round((delivery.pace - 0.5) * 60)
        rate_str = f"{'+' if pace_offset >= 0 else ''}{pace_offset}%"
        
        # Volume: 0.5 is neutral (0%). Map 0.0..1.0 to -25%..+25%
        vol_offset = round((delivery.volume - 0.5) * 50)
        vol_str = f"{'+' if vol_offset >= 0 else ''}{vol_offset}%"
        
        return rate_str, vol_str

    async def synthesize(
        self,
        text: str,
        voice: Optional[str] = None,
        rate: str = "+0%",
        volume: str = "+0%",
    ) -> bytes:
        """Synthesize complete utterance into audio bytes."""
        target_voice = voice or self.default_voice
        communicate = edge_tts.Communicate(text=text, voice=target_voice, rate=rate, volume=volume)
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
        return audio_data

    async def synthesize_stream(
        self,
        plan: ExpressionPlan,
        response_id: str,
        cancel_event: Optional[asyncio.Event] = None,
        voice: Optional[str] = None,
    ) -> AsyncIterator[tuple[AudioChunkMetadata, bytes]]:
        """Synthesize utterance as streaming audio chunks with immediate cancellation support."""
        target_voice = voice or self.default_voice
        rate_str, vol_str = self._resolve_prosody(plan)
        
        communicate = edge_tts.Communicate(
            text=plan.text,
            voice=target_voice,
            rate=rate_str,
            volume=vol_str,
        )
        
        fmt = AudioFormatSpec(
            codec=AudioCodec.MP3,
            sample_rate_hz=24000,
            channels=1,
        )
        
        chunk_sequence = 0
        async for chunk in communicate.stream():
            if cancel_event and cancel_event.is_set():
                break
                
            if chunk["type"] == "audio" and len(chunk["data"]) > 0:
                meta = AudioChunkMetadata(
                    response_id=response_id,
                    segment_id=f"seg_{chunk_sequence}",
                    sequence=chunk_sequence,
                    format=fmt,
                    duration_ms=40,  # Approximate ~40ms per packet chunk
                    payload_ref="inline",
                )
                yield meta, chunk["data"]
                chunk_sequence += 1
