# ADR-0003: Support cascaded and native audio model paths

- **Status:** Proposed
- **Decision date:** 2026-10-31

## Context
Cascaded STT → LLM → TTS offers modularity and control but adds latency and can lose acoustic context. Native audio models may provide richer audio interaction but reduce component-level control and portability.

## Decision
Design a common session/runtime and dialogue contract that can route through either a cascaded pipeline or a native audio-to-audio adapter. Start with the cascaded path for debuggability and add native audio support as a separate adapter after benchmarking.

## Consequences
More flexible architecture, but routing and evaluation must account for different capabilities and observable behaviours.
