"""
HCVE Voice Expression Engine (VEE).
Implements HCVE-040, HCVE-041, HCVE-044:
- Persona Controller with versioned constraints and allowed ranges.
- Expression plan validation and range normalization.
- Conflict resolution (precedence: safety > application policy > user prefs > defaults > LLM proposals).
- Capability mapping to target TTS providers.
"""

from __future__ import annotations

import copy
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.services.hcve.contracts import (
    DeliverySpec,
    EmotionLabel,
    EmotionSpec,
    EmphasisSpan,
    ExpressionDetails,
    ExpressionPlan,
    HCVEError,
    HCVEErrorCode,
    LanguageSpec,
    PersonalitySpec,
    ProsodySpec,
    ProviderCapability,
    RenderingSpec,
    SpeakingStyle,
    ToneEnum,
    VoiceSpec,
)


class PersonaProfile(BaseModel):
    profile_id: str = Field(default="persona_default")
    version: str = Field(default="1.0")
    allowed_tones: List[ToneEnum] = Field(
        default_factory=lambda: [
            ToneEnum.NEUTRAL,
            ToneEnum.PROFESSIONAL,
            ToneEnum.CASUAL,
            ToneEnum.REASSURING,
            ToneEnum.CURIOUS,
        ]
    )
    prohibited_emotions: List[EmotionLabel] = Field(
        default_factory=lambda: [EmotionLabel.FRUSTRATED, EmotionLabel.SAD]
    )
    delivery_limits: Dict[str, tuple[float, float]] = Field(
        default_factory=lambda: {
            "energy": (0.2, 0.8),
            "warmth": (0.3, 0.9),
            "formality": (0.1, 0.9),
            "pace": (0.3, 0.7),
            "expressiveness": (0.2, 0.8),
            "volume": (0.3, 0.8),
        }
    )
    default_voice_id: str = Field(default="voice_standard")
    default_speaking_style: SpeakingStyle = Field(default=SpeakingStyle.CONVERSATIONAL)


class ResolvedExpressionResult(BaseModel):
    plan: ExpressionPlan
    applied_controls: Dict[str, Any]
    approximated_controls: Dict[str, Any]
    unsupported_controls: List[str]


class VoiceExpressionEngine:
    """Provider-neutral Voice Expression Engine and Controller."""

    def __init__(self, personas: Optional[Dict[str, PersonaProfile]] = None) -> None:
        self._personas: Dict[str, PersonaProfile] = personas or {
            "persona_default": PersonaProfile(),
            "interview_proctor": PersonaProfile(
                profile_id="interview_proctor",
                version="1.0",
                allowed_tones=[ToneEnum.PROFESSIONAL, ToneEnum.SERIOUS, ToneEnum.REASSURING, ToneEnum.NEUTRAL],
                prohibited_emotions=[EmotionLabel.FRUSTRATED, EmotionLabel.EXCITED, EmotionLabel.SAD],
                default_voice_id="proctor_calm",
                default_speaking_style=SpeakingStyle.MEASURED,
            ),
        }

    def register_persona(self, profile: PersonaProfile) -> None:
        self._personas[profile.profile_id] = profile

    def get_persona(self, profile_id: str) -> PersonaProfile:
        return self._personas.get(profile_id, self._personas["persona_default"])

    def resolve(
        self,
        raw_text: str,
        proposed_expression: Optional[Dict[str, Any]] = None,
        persona_id: str = "persona_default",
        user_voice_pref: Optional[str] = None,
        target_capability: Optional[ProviderCapability] = None,
    ) -> ResolvedExpressionResult:
        """Resolve proposed expression against persona constraints and target provider capabilities."""
        persona = self.get_persona(persona_id)
        applied: Dict[str, Any] = {}
        approximated: Dict[str, Any] = {}
        unsupported: List[str] = []

        proposed = proposed_expression or {}
        proposed_tone = proposed.get("tone", ToneEnum.NEUTRAL.value)
        proposed_emotion = proposed.get("emotion", {})
        proposed_delivery = proposed.get("delivery", {})
        proposed_prosody = proposed.get("prosody", {})

        # 1. Resolve Tone
        try:
            tone_enum = ToneEnum(proposed_tone)
        except ValueError:
            tone_enum = ToneEnum.NEUTRAL

        if tone_enum not in persona.allowed_tones:
            approximated["tone"] = f"{tone_enum.value} clamped to {ToneEnum.NEUTRAL.value}"
            tone_enum = ToneEnum.NEUTRAL
        applied["tone"] = tone_enum.value

        # 2. Resolve Emotion
        emotion_label_str = proposed_emotion.get("label", EmotionLabel.NEUTRAL.value)
        try:
            emotion_label = EmotionLabel(emotion_label_str)
        except ValueError:
            emotion_label = EmotionLabel.NEUTRAL

        raw_proposed_emotion = emotion_label
        if emotion_label in persona.prohibited_emotions:
            approximated["emotion"] = f"{emotion_label.value} prohibited by persona; clamped to neutral"
            emotion_label = EmotionLabel.NEUTRAL

        emotion_strength = float(proposed_emotion.get("strength", 0.0))
        emotion_strength = max(0.0, min(1.0, emotion_strength))
        applied["emotion"] = {"label": emotion_label.value, "strength": emotion_strength}

        # 3. Resolve Delivery (Clamping within persona limits)
        delivery_dict: Dict[str, float] = {}
        for dim, (min_val, max_val) in persona.delivery_limits.items():
            req_val = float(proposed_delivery.get(dim, 0.5))
            clamped = max(min_val, min(max_val, req_val))
            if clamped != req_val:
                approximated[f"delivery.{dim}"] = f"{req_val} clamped to [{min_val}, {max_val}]"
            delivery_dict[dim] = clamped
        applied["delivery"] = delivery_dict

        # 4. Resolve Voice Identity
        selected_voice = user_voice_pref or proposed.get("voice_id") or persona.default_voice_id
        applied["voice_id"] = selected_voice

        # 5. Check Target Capability Mapping
        if target_capability:
            if not target_capability.supports_prosody_tuning and proposed_prosody:
                unsupported.append("prosody_tuning")
            if not target_capability.supports_emotion_prompting and raw_proposed_emotion != EmotionLabel.NEUTRAL:
                unsupported.append("emotion_prompting")
                approximated["emotion_fallback"] = "Target provider lacks emotion support; rendered with standard tone"

        # 6. Build Validated Plan
        plan = ExpressionPlan(
            text=raw_text,
            language=LanguageSpec(locale="en-IN"),
            personality=PersonalitySpec(profile_id=persona.profile_id, version=persona.version),
            expression=ExpressionDetails(
                tone=tone_enum,
                emotion=EmotionSpec(label=emotion_label, strength=emotion_strength),
                delivery=DeliverySpec(**delivery_dict),
                prosody=ProsodySpec(
                    speaking_style=persona.default_speaking_style,
                    pitch_variation=0.5,
                ),
            ),
            voice=VoiceSpec(
                provider=target_capability.provider_id if target_capability else "synthetic_default",
                voice_id=selected_voice,
            ),
            rendering=RenderingSpec(streaming=True, allow_interruption=True),
        )

        return ResolvedExpressionResult(
            plan=plan,
            applied_controls=applied,
            approximated_controls=approximated,
            unsupported_controls=unsupported,
        )
