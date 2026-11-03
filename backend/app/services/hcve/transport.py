"""
HCVE Audio Ingress & Egress Stream Buffers, Sequencer, and Transport Contracts.
Implements HCVE-011 (Ingress with backpressure & reordering) and HCVE-012 (Egress sequencer & stale rejection).
"""

from __future__ import annotations

import asyncio
import time
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from app.services.hcve.contracts import (
    AudioChunkMetadata,
    AudioFormatSpec,
    HCVEError,
    HCVEErrorCode,
)


class AudioFrame(BaseModel):
    session_id: str = Field(..., min_length=1)
    stream_id: str = Field(..., min_length=1)
    sequence: int = Field(..., ge=0)
    timestamp_ms: int = Field(..., ge=0)
    payload_bytes: bytes = Field(...)
    format: AudioFormatSpec = Field(default_factory=AudioFormatSpec)

    model_config = {"arbitrary_types_allowed": True}


class AudioIngressBuffer:
    """Bounded, sequence-ordered buffer for incoming audio frames.
    
    Prevents unbounded memory consumption, rejects duplicate frames,
    handles packet reordering within a jitter window, and signals overflow.
    """

    def __init__(self, max_frames: int = 100, max_payload_bytes: int = 16384) -> None:
        self.max_frames = max_frames
        self.max_payload_bytes = max_payload_bytes
        self._frames: Dict[int, AudioFrame] = {}
        self._expected_seq: int = 0
        self._dropped_count: int = 0
        self._lock = asyncio.Lock()

    async def push_frame(self, frame: AudioFrame) -> None:
        """Validate payload size, check duplicates, and buffer."""
        async with self._lock:
            if len(frame.payload_bytes) > self.max_payload_bytes:
                raise HCVEError(
                    HCVEErrorCode.INVALID_AUDIO_FORMAT,
                    f"Frame payload size ({len(frame.payload_bytes)} bytes) exceeds limit ({self.max_payload_bytes})",
                    session_id=frame.session_id,
                )

            # Ignore stale/duplicate frames
            if frame.sequence < self._expected_seq or frame.sequence in self._frames:
                return

            # Backpressure / overflow check
            if len(self._frames) >= self.max_frames:
                # Drop oldest unconsumed frame to apply backpressure
                oldest_seq = min(self._frames.keys())
                del self._frames[oldest_seq]
                self._dropped_count += 1

            self._frames[frame.sequence] = frame

    async def pop_next_ordered(self) -> Optional[AudioFrame]:
        """Retrieve next frame in strict sequential order."""
        async with self._lock:
            if self._expected_seq in self._frames:
                frame = self._frames.pop(self._expected_seq)
                self._expected_seq += 1
                return frame
            return None

    @property
    def dropped_count(self) -> int:
        return self._dropped_count

    @property
    def buffered_count(self) -> int:
        return len(self._frames)


class AudioEgressSequencer:
    """Manages audio delivery to the client.
    
    Attaches sequence numbers, validates response IDs, and immediately
    drops/rejects any audio chunk belonging to a cancelled response.
    """

    def __init__(self) -> None:
        self._cancelled_responses: set[str] = set()
        self._seq_by_response: Dict[str, int] = {}
        self._lock = asyncio.Lock()

    async def register_cancellation(self, response_id: str) -> None:
        async with self._lock:
            self._cancelled_responses.add(response_id)

    async def is_cancelled(self, response_id: str) -> bool:
        async with self._lock:
            return response_id in self._cancelled_responses

    async def prepare_chunk(
        self,
        response_id: str,
        segment_id: str,
        pcm_bytes: bytes,
        format_spec: AudioFormatSpec,
        duration_ms: int,
    ) -> Optional[tuple[AudioChunkMetadata, bytes]]:
        """Validate response state, attach sequence, and return chunk."""
        async with self._lock:
            if response_id in self._cancelled_responses:
                # Stale chunk rejected per HCVE-012 L5 invariant
                return None

            seq = self._seq_by_response.get(response_id, 0)
            self._seq_by_response[response_id] = seq + 1

            meta = AudioChunkMetadata(
                response_id=response_id,
                segment_id=segment_id,
                sequence=seq,
                format=format_spec,
                duration_ms=duration_ms,
                payload_ref="inline",
            )
            return meta, pcm_bytes
