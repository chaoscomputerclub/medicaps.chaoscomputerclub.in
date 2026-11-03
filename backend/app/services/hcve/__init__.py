"""
HCVE Service Package Initializer.
Exports contracts, session managers, expression engine, adapters, and voice runtime coordinator.
"""

from app.services.hcve.adapters import (
    FakeLLMAdapter,
    FakeSTTAdapter,
    FakeTTSAdapter,
    FakeVADAdapter,
    VADResult,
)
from app.services.hcve.contracts import (
    AudioChunkMetadata,
    AudioCodec,
    AudioFormatSpec,
    AudioTransportConfig,
    DeliverySpec,
    EmotionLabel,
    EmotionSpec,
    EmphasisSpan,
    EventEnvelope,
    ExpressionDetails,
    ExpressionPlan,
    HCVEError,
    HCVEErrorCode,
    LanguageSpec,
    PersonalitySpec,
    ProsodySpec,
    ProviderCapability,
    RenderingSpec,
    SegmentStrategy,
    SpeakingStyle,
    ToneEnum,
    TransportType,
    VoiceSpec,
)
from app.services.hcve.expression import (
    PersonaProfile,
    ResolvedExpressionResult,
    VoiceExpressionEngine,
)
from app.services.hcve.runtime import VoiceRuntimeCoordinator
from app.services.hcve.edge_tts_adapter import EdgeTTSAdapter
from app.services.hcve.sarvam_tts_adapter import SarvamTTSAdapter
from app.services.hcve.transport import (
    AudioEgressSequencer,
    AudioFrame,
    AudioIngressBuffer,
)
from app.services.hcve.session import (
    InMemorySessionRepository,
    RedisSessionRepository,
    SessionConfig,
    SessionRepository,
    SessionState,
    TurnState,
    VALID_STATE_TRANSITIONS,
)

__all__ = [
    "AudioChunkMetadata",
    "AudioCodec",
    "AudioEgressSequencer",
    "AudioFormatSpec",
    "AudioFrame",
    "AudioIngressBuffer",
    "AudioTransportConfig",
    "DeliverySpec",
    "EdgeTTSAdapter",
    "EmotionLabel",
    "EmotionSpec",
    "EmphasisSpan",
    "EventEnvelope",
    "ExpressionDetails",
    "ExpressionPlan",
    "FakeLLMAdapter",
    "FakeSTTAdapter",
    "FakeTTSAdapter",
    "FakeVADAdapter",
    "HCVEError",
    "HCVEErrorCode",
    "InMemorySessionRepository",
    "LanguageSpec",
    "PersonalitySpec",
    "PersonaProfile",
    "ProsodySpec",
    "ProviderCapability",
    "RedisSessionRepository",
    "RenderingSpec",
    "ResolvedExpressionResult",
    "SarvamTTSAdapter",
    "SegmentStrategy",
    "SessionConfig",
    "SessionRepository",
    "SessionState",
    "SpeakingStyle",
    "ToneEnum",
    "TransportType",
    "TurnState",
    "VADResult",
    "VALID_STATE_TRANSITIONS",
    "VoiceExpressionEngine",
    "VoiceRuntimeCoordinator",
    "VoiceSpec",
]
