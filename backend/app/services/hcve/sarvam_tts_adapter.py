"""
HCVE Sarvam AI Neural Speech Rendering Adapter.
Implements HCVE-050/051 with state-of-the-art Indian Language & Indian English neural synthesis using Sarvam AI Bulbul models.
Supports sub-250ms real-time WebSocket streaming, low-latency chunks, pace modulation, and barge-in cancellation.
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
from typing import AsyncIterator, List, Optional
import httpx
import websockets

from app.services.hcve.contracts import (
    AudioChunkMetadata,
    AudioCodec,
    AudioFormatSpec,
    ExpressionPlan,
    ProviderCapability,
)


class SarvamTTSAdapter:
    """Production Indian AI neural TTS adapter using Sarvam AI Bulbul service.
    
    Supports real-time bidirectional WebSocket streaming (<250ms TTFA),
    REST synthesis fallback, multi-speaker Indian accents, and immediate cancellation.
    """

    DEFAULT_SPEAKER = "shubh_enhi_ads"
    DEFAULT_MODEL = "bulbul:v4-flash"
    DEFAULT_LANGUAGE = "hi-IN"
    REST_ENDPOINT = "https://api.sarvam.ai/text-to-speech"
    WS_ENDPOINT = "wss://api.sarvam.ai/text-to-speech/ws"

    def __init__(
        self,
        api_key: Optional[str] = None,
        default_speaker: str = DEFAULT_SPEAKER,
        default_model: str = DEFAULT_MODEL,
        default_language: str = DEFAULT_LANGUAGE,
    ) -> None:
        self.api_key = api_key or os.getenv("SARVAM_API_KEY", "")
        self.default_speaker = default_speaker
        self.default_model = default_model
        self.default_language = default_language

        self.capability = ProviderCapability(
            provider_id="sarvam_ai_bulbul_v4",
            provider_type="TTS",
            supports_streaming=True,
            supports_cancellation=True,
            supported_codecs=[AudioCodec.MP3, AudioCodec.PCM_S16LE],
            supported_voices=[
                "shubh_enhi_ads",
                "shubh",
                "ritu",
                "ishita",
                "simran",
                "aditya",
                "priya",
                "arvind",
                "kavya",
                "manan",
            ],
            supported_locales=[
                "hi-IN",
                "en-IN",
                "bn-IN",
                "te-IN",
                "ta-IN",
                "mr-IN",
                "gu-IN",
                "kn-IN",
                "pa-IN",
                "ml-IN",
                "od-IN",
            ],
            supports_prosody_tuning=True,
            supports_emotion_prompting=True,
        )

    def _resolve_pace(self, plan: ExpressionPlan) -> float:
        """Convert ExpressionPlan pace (0.0..1.0, neutral=0.5) to Sarvam pace (0.5..2.0, neutral=1.0)."""
        delivery = plan.expression.delivery
        # delivery.pace in [0.0, 1.0], 0.5 is normal speed.
        # Scale: 0.0 -> 0.6x, 0.5 -> 1.0x, 1.0 -> 1.6x
        pace = 1.0 + (delivery.pace - 0.5) * 1.2
        return max(0.5, min(2.0, round(pace, 2)))

    async def synthesize(
        self,
        text: str,
        target_language_code: Optional[str] = None,
        speaker: Optional[str] = None,
        model: Optional[str] = None,
        pace: float = 1.0,
    ) -> bytes:
        """Synthesize complete utterance into MP3 audio bytes via Sarvam REST endpoint."""
        if not self.api_key:
            raise ValueError("SARVAM_API_KEY is not configured on SarvamTTSAdapter.")

        headers = {
            "api-subscription-key": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "text": text,
            "target_language_code": target_language_code or self.default_language,
            "speaker": speaker or self.default_speaker,
            "model": model or self.default_model,
            "pace": pace,
            "speech_sample_rate": 24000,
            "output_audio_codec": "mp3",
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(self.REST_ENDPOINT, json=payload, headers=headers, timeout=25.0)
            resp.raise_for_status()
            data = resp.json()
            audios = data.get("audios", [])
            if not audios:
                raise RuntimeError("Sarvam AI returned empty audio payload.")
            return base64.b64decode(audios[0])

    async def synthesize_stream(
        self,
        plan: ExpressionPlan,
        response_id: str,
        cancel_event: Optional[asyncio.Event] = None,
        voice: Optional[str] = None,
        target_language_code: Optional[str] = None,
    ) -> AsyncIterator[tuple[AudioChunkMetadata, bytes]]:
        """Synthesize utterance as streaming audio chunks via Sarvam WebSocket with real-time cancellation."""
        if not self.api_key:
            raise ValueError("SARVAM_API_KEY is not configured on SarvamTTSAdapter.")

        model = self.default_model
        speaker = voice or self.default_speaker
        lang = target_language_code or self.default_language
        pace = self._resolve_pace(plan)

        ws_uri = f"{self.WS_ENDPOINT}?model={model}&send_completion_event=true"
        headers = [("api-subscription-key", self.api_key)]

        fmt = AudioFormatSpec(
            codec=AudioCodec.MP3,
            sample_rate_hz=24000,
            channels=1,
        )

        chunk_sequence = 0

        try:
            async with websockets.connect(ws_uri, additional_headers=headers) as ws:
                # 1. Send Configuration Handshake
                config_msg = {
                    "type": "config",
                    "data": {
                        "target_language_code": lang,
                        "speaker": speaker,
                        "model": model,
                        "speech_sample_rate": 24000,
                        "pace": pace,
                    },
                }
                await ws.send(json.dumps(config_msg))

                # 2. Stream Utterance Text
                text_msg = {
                    "type": "text",
                    "data": {
                        "text": plan.text,
                    },
                }
                await ws.send(json.dumps(text_msg))

                # 3. Flush Signal
                await ws.send(json.dumps({"type": "flush"}))

                # 4. Stream Incoming Audio Chunks with Barge-In Check
                while True:
                    if cancel_event and cancel_event.is_set():
                        break

                    try:
                        raw_msg = await asyncio.wait_for(ws.recv(), timeout=6.0)
                    except asyncio.TimeoutError:
                        break

                    data = json.loads(raw_msg)
                    msg_type = data.get("type")

                    if msg_type == "audio":
                        audio_base64 = data.get("data", {}).get("audio", "")
                        if audio_base64:
                            chunk_bytes = base64.b64decode(audio_base64)
                            meta = AudioChunkMetadata(
                                response_id=response_id,
                                segment_id=f"seg_{chunk_sequence}",
                                sequence=chunk_sequence,
                                format=fmt,
                                duration_ms=40,
                                payload_ref="inline",
                            )
                            yield meta, chunk_bytes
                            chunk_sequence += 1

                    elif msg_type == "completion":
                        break
                    elif msg_type == "error":
                        raise RuntimeError(f"Sarvam WebSocket error: {data.get('data')}")

        except Exception as ws_err:
            # If WebSocket connection fails, gracefully fallback to REST batch synthesis
            if chunk_sequence == 0 and (not cancel_event or not cancel_event.is_set()):
                audio_bytes = await self.synthesize(
                    text=plan.text,
                    target_language_code=lang,
                    speaker=speaker,
                    model=model,
                    pace=pace,
                )
                meta = AudioChunkMetadata(
                    response_id=response_id,
                    segment_id="seg_0",
                    sequence=0,
                    format=fmt,
                    duration_ms=len(audio_bytes) // 3,
                    payload_ref="inline",
                )
                yield meta, audio_bytes
            else:
                raise ws_err
