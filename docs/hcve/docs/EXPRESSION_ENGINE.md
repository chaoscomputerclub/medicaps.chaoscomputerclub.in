# Voice Expression Engine Specification

## 1. Purpose

The Voice Expression Engine (VEE) is a provider-independent interpretation layer between response planning and speech synthesis. It accepts proposed expression metadata, applies policy and persona constraints, normalizes values, and maps the result to provider capabilities.

It does not itself make a TTS model expressive beyond that model's actual capabilities.

## 2. Conceptual dimensions

| Dimension | Meaning | Example |
|---|---|---|
| Personality | Stable identity and behavioural constraints | direct, composed, concise |
| Tone | Communicative stance | casual, serious, reassuring |
| Emotion | Intended affective colour | concerned, curious, neutral |
| Delivery | Physical vocal execution | energy, pace, loudness |
| Prosody | Rhythm and melodic structure | pauses, emphasis, pitch variation |
| Language | Language and pronunciation rules | en-IN, hi-IN |
| Voice identity | Selected voice and consistency constraints | voice profile ID |

## 3. Resolution precedence

Recommended precedence:
1. Platform safety and legal constraints.
2. Application-level persona policy.
3. Explicit user-selected voice preferences.
4. Conversation designer defaults.
5. LLM-proposed expression.
6. Optional inferred vocal cues, used only as weak context.

An inferred cue must never silently override an explicit user instruction.

## 4. Normalized expression plan

See `../contracts/schemas/expression_plan.schema.json`.

All numeric ranges must be documented and provider-independent. The initial schema uses normalized values in `[0, 1]` for abstract controls. These are not universal acoustic units; adapters translate them to provider-specific controls.

## 5. Controller behaviour

### Persona Controller
Loads a versioned persona profile and returns allowed ranges, defaults, and prohibited combinations.

### Tone Controller
Maps communicative intent to a normalized tone label and recommended delivery defaults. It must not equate tone labels with emotion labels.

### Emotion Controller
Accepts explicit intended emotion with confidence/strength. It must support neutral/no-emotion and avoid overacting.

### Delivery Controller
Normalizes pace, energy, loudness, and expressiveness. Loudness should be constrained by output policy and client normalization.

### Prosody Controller
Converts pauses, emphasis spans, and speaking style into provider-supported controls. Text spans must be validated against the actual response text.

### Language Controller
Sets language, locale, pronunciation lexicon, and code-switching hints. It must not fabricate an accent capability.

### Conflict Resolver
Example conflict: persona says “calm and measured” while LLM proposes “high energy and rapid pace.” Resolver applies persona bounds and records the override.

### Capability Mapper
For each requested control, returns one of:
- `applied`
- `approximated`
- `unsupported`
- `ignored_by_policy`

## 6. Text alignment

Emphasis spans and pauses must refer to stable text offsets or segment IDs. If the text is modified after expression planning, alignment must be recalculated or discarded.

## 7. Streaming expression

Expression can vary by segment, but changes should be smoothed to avoid abrupt vocal shifts. A provider may require one expression setting per synthesis request; in that case segment boundaries become the control boundary.

## 8. Validation rules

- Unknown schema versions are rejected or migrated explicitly.
- Unknown fields are rejected in strict mode and ignored with warning in forward-compatible mode.
- Enum values are allowlisted.
- Numeric values are finite and range checked.
- Pause durations have upper bounds.
- Emphasis spans must be within text bounds.
- Voice IDs must exist in configured provider registry.
- The renderer must receive a resolved plan, not raw LLM output.
