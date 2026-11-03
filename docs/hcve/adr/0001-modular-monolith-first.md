# ADR-0001: Start with a modular monolith

- **Status:** Proposed
- **Decision date:** 2026-10-31

## Context
The system has multiple logical engines, but early microservice separation would add network hops, deployment complexity, and operational overhead before throughput boundaries are known.

## Decision
Implement as a modular monolith with strict packages/interfaces. Isolate GPU-heavy inference workers as separate processes/services when required by resource scheduling or scaling.

## Consequences
Positive: easier local development, fewer network hops, simpler transactions and debugging.  
Negative: requires disciplined module boundaries and may need later extraction.
