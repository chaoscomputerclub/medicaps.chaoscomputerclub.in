"""
HCVE (Human Conversational Voice Engine) domain contracts and models.
Implements HCVE-002: Versioned schemas, event envelopes, expression plans,
provider capability descriptors, and standard error taxonomy.
"""

from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


def rfc3339_now() -> str:
    """Return RFC 3339 formatted UTC timestamp string."""
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Error Taxonomy
# ---------------------------------------------------------------------------

class HCVEErrorCode(str, enum.Enum):
    # Session Errors
    SESSION_NOT_FOUND = "SESSION_NOT_FOUND"
    SESSION_EXPIRED = "SESSION_EXPIRED"
    SESSION_CLOSED = "SESSION_CLOSED"
    SESSION_LIMIT_EXCEEDED = "SESSION_LIMIT_EXCEEDED"
    UNAUTHORIZED_SESSION_ACCESS = "UNAUTHORIZED_SESSION_ACCESS"

    # Transport / Media Errors
    UNSUPPORTED_TRANSPORT = "UNSUPPORTED_TRANSPORT"
    INVALID_AUDIO_FORMAT = "INVALID_AUDIO_FORMAT"
    FRAME_SEQUENCE_ERROR = "FRAME_SEQUENCE_ERROR"
    BUFFER_OVERFLOW = "BUFFER_OVERFLOW"
    AUDIO_EGRESS_DROPPED = "AUDIO_EGRESS_DROPPED"

    # Turn / Runtime Lifecycle Errors
    INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION"
    STALE_TURN_REJECTED = "STALE_TURN_REJECTED"
    RESPONSE_CANCELLED = "RESPONSE_CANCELLED"
    CONCURRENCY_LOCK_FAILED = "CONCURRENCY_LOCK_FAILED"

    # Provider / Adapter Errors
    PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE"
    PROVIDER_TIMEOUT = "PROVIDER_TIMEOUT"
    PROVIDER_CAPABILITY_UNSUPPORTED = "PROVIDER_CAPABILITY_UNSUPPORTED"
    MALFORMED_MODEL_OUTPUT = "MALFORMED_MODEL_OUTPUT"

    # Expression / Validation Errors
    INVALID_EXPRESSION_PLAN = "INVALID_EXPRESSION_PLAN"
    INVALID_EMPHASIS_SPAN = "INVALID_EMPHASIS_SPAN"
    PERSONA_CONFLICT = "PERSONA_CONFLICT"


class HCVEError(Exception):
    """Base application exception for HCVE."""

    def __init__(
        self,
        code: HCVEErrorCode,
        message: str,
        session_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.session_id = session_id
        self.details = details or {}


# ---------------------------------------------------------------------------
# Event Envelope Contract (contracts/schemas/event-envelope.schema.json)
# ---------------------------------------------------------------------------

class EventEnvelope(BaseModel):
    schema_version: str = Field(default="1.0", description="Contract schema version")
    event_id: str = Field(..., min_length=1, description="Opaque unique event identifier")
    event_type: str = Field(..., min_length=1, description="Deterministic event type name")
    session_id: str = Field(..., min_length=1, description="Session identifier")
    turn_id: Optional[str] = Field(None, description="Optional turn identifier")
    response_id: Optional[str] = Field(None, description="Optional response identifier")
    timestamp: str = Field(default_factory=rfc3339_now, description="RFC 3339 UTC timestamp")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Event payload dictionary")

    model_config = {"extra": "forbid"}


# ---------------------------------------------------------------------------
# Audio Transport Contracts
# ---------------------------------------------------------------------------

class AudioCodec(str, enum.Enum):
    PCM_S16LE = "pcm_s16le"
    OPUS = "opus"
    AAC = "aac"
    MP3 = "mp3"


class AudioFormatSpec(BaseModel):
    codec: AudioCodec = Field(default=AudioCodec.PCM_S16LE)
    sample_rate_hz: int = Field(default=24000, ge=8000, le=48000)
    channels: int = Field(default=1, ge=1, le=2)

    model_config = {"extra": "forbid"}


class TransportType(str, enum.Enum):
    WEBRTC = "webrtc"
    WEBSOCKET = "websocket"


class AudioTransportConfig(BaseModel):
    type: TransportType = Field(default=TransportType.WEBSOCKET)
    audio_input: AudioFormatSpec = Field(
        default_factory=lambda: AudioFormatSpec(codec=AudioCodec.PCM_S16LE, sample_rate_hz=16000, channels=1)
    )
    audio_output: AudioFormatSpec = Field(
        default_factory=lambda: AudioFormatSpec(codec=AudioCodec.PCM_S16LE, sample_rate_hz=24000, channels=1)
    )

    model_config = {"extra": "forbid"}


class AudioChunkMetadata(BaseModel):
    response_id: str = Field(..., min_length=1)
    segment_id: str = Field(..., min_length=1)
    sequence: int = Field(..., ge=0)
    format: AudioFormatSpec = Field(default_factory=AudioFormatSpec)
    duration_ms: int = Field(..., ge=0)
    payload_ref: str = Field(default="inline")

    model_config = {"extra": "forbid"}


# ---------------------------------------------------------------------------
# Expression Plan Contract (contracts/schemas/expression_plan.schema.json)
# ---------------------------------------------------------------------------

class ToneEnum(str, enum.Enum):
    NEUTRAL = "neutral"
    CASUAL = "casual"
    SERIOUS = "serious"
    PROFESSIONAL = "professional"
    REASSURING = "reassuring"
    CURIOUS = "curious"
    EMPATHETIC = "empathetic"
    ASSERTIVE = "assertive"


class EmotionLabel(str, enum.Enum):
    NEUTRAL = "neutral"
    HAPPY = "happy"
    CONCERNED = "concerned"
    CURIOUS = "curious"
    SAD = "sad"
    EXCITED = "excited"
    CALM = "calm"
    FRUSTRATED = "frustrated"


class SpeakingStyle(str, enum.Enum):
    CONVERSATIONAL = "conversational"
    NARRATIVE = "narrative"
    EXPLANATORY = "explanatory"
    ANNOUNCING = "announcing"
    WHISPERED = "whispered"
    MEASURED = "measured"


class SegmentStrategy(str, enum.Enum):
    SENTENCE = "sentence"
    PHRASE = "phrase"
    PROVIDER_NATIVE = "provider_native"


class LanguageSpec(BaseModel):
    locale: str = Field(default="en-IN")
    pronunciation_profile: Optional[str] = None
    code_switching: bool = False

    model_config = {"extra": "forbid"}


class PersonalitySpec(BaseModel):
    profile_id: str = Field(default="persona_default")
    version: Optional[str] = None

    model_config = {"extra": "forbid"}


class EmotionSpec(BaseModel):
    label: EmotionLabel = Field(default=EmotionLabel.NEUTRAL)
    strength: float = Field(default=0.0, ge=0.0, le=1.0)

    model_config = {"extra": "forbid"}


class DeliverySpec(BaseModel):
    energy: float = Field(default=0.5, ge=0.0, le=1.0)
    warmth: float = Field(default=0.5, ge=0.0, le=1.0)
    formality: float = Field(default=0.5, ge=0.0, le=1.0)
    pace: float = Field(default=0.5, ge=0.0, le=1.0)
    expressiveness: float = Field(default=0.5, ge=0.0, le=1.0)
    volume: float = Field(default=0.5, ge=0.0, le=1.0)

    model_config = {"extra": "forbid"}


class EmphasisSpan(BaseModel):
    start: int = Field(..., ge=0)
    end: int = Field(..., ge=1)
    strength: float = Field(default=0.5, ge=0.0, le=1.0)

    model_config = {"extra": "forbid"}

    @model_validator(mode="after")
    def validate_span_order(self) -> EmphasisSpan:
        if self.end <= self.start:
            raise ValueError(f"EmphasisSpan end index ({self.end}) must be strictly greater than start ({self.start})")
        return self


class ProsodySpec(BaseModel):
    speaking_style: Optional[SpeakingStyle] = SpeakingStyle.CONVERSATIONAL
    pitch_variation: Optional[float] = Field(default=0.5, ge=0.0, le=1.0)
    pauses_ms: Optional[List[int]] = Field(default_factory=list)
    emphasis_spans: Optional[List[EmphasisSpan]] = Field(default_factory=list)

    model_config = {"extra": "forbid"}


class ExpressionDetails(BaseModel):
    tone: ToneEnum = Field(default=ToneEnum.NEUTRAL)
    emotion: EmotionSpec = Field(default_factory=EmotionSpec)
    delivery: DeliverySpec = Field(default_factory=DeliverySpec)
    prosody: Optional[ProsodySpec] = Field(default_factory=ProsodySpec)

    model_config = {"extra": "forbid"}


class VoiceSpec(BaseModel):
    provider: str = Field(default="synthetic_default")
    voice_id: str = Field(default="voice_standard")
    consistency_profile: Optional[str] = None

    model_config = {"extra": "forbid"}


class RenderingSpec(BaseModel):
    streaming: bool = True
    allow_interruption: bool = True
    segment_strategy: Optional[SegmentStrategy] = SegmentStrategy.SENTENCE

    model_config = {"extra": "forbid"}


class ExpressionPlan(BaseModel):
    schema_version: Literal["1.0"] = "1.0"
    text: str = Field(..., min_length=1)
    language: LanguageSpec = Field(default_factory=LanguageSpec)
    personality: PersonalitySpec = Field(default_factory=PersonalitySpec)
    expression: ExpressionDetails = Field(default_factory=ExpressionDetails)
    voice: VoiceSpec = Field(default_factory=VoiceSpec)
    rendering: RenderingSpec = Field(default_factory=RenderingSpec)

    model_config = {"extra": "forbid"}

    @model_validator(mode="after")
    def validate_emphasis_spans_in_text(self) -> ExpressionPlan:
        text_len = len(self.text)
        if self.expression and self.expression.prosody and self.expression.prosody.emphasis_spans:
            for span in self.expression.prosody.emphasis_spans:
                if span.end > text_len:
                    raise ValueError(
                        f"Emphasis span [start={span.start}, end={span.end}] exceeds response text length ({text_len})"
                    )
        return self


# ---------------------------------------------------------------------------
# Provider Capability Metadata
# ---------------------------------------------------------------------------

class ProviderCapability(BaseModel):
    provider_id: str
    provider_type: Literal["STT", "LLM", "TTS", "VAD"]
    supports_streaming: bool = True
    supports_cancellation: bool = True
    supported_locales: List[str] = Field(default_factory=lambda: ["en-IN", "en-US"])
    supported_codecs: List[AudioCodec] = Field(default_factory=lambda: [AudioCodec.PCM_S16LE])
    supports_prosody_tuning: bool = False
    supports_emotion_prompting: bool = False
    supported_voices: List[str] = Field(default_factory=list)

    model_config = {"extra": "forbid"}

