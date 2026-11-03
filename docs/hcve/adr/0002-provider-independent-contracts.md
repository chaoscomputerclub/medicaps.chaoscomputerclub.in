# ADR-0002: Provider-independent model adapter contracts

- **Status:** Proposed
- **Decision date:** 2026-10-31

## Context
STT, LLM, and TTS providers differ in streaming, cancellation, languages, voice controls, and payload constraints.

## Decision
Define internal provider-neutral interfaces plus provider capability metadata. Domain logic must not depend on provider-specific request/response types.

## Consequences
Provider replacement is easier, but adapters must explicitly report unsupported or approximated capabilities.
