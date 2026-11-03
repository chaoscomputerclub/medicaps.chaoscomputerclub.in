# Interview Arena — Implementation Requirements Pack

**Purpose:** Implement a simple candidate-facing interview practice experience backed by administrator-authored, versioned interview blueprints and adaptive graph execution.

## Product decisions (authoritative)

1. Candidates do **not** create custom interviews.
2. All interview tracks, round types, graph structures, node instructions, question policies, rubrics, and transition rules are authored and published by the platform owner/admin.
3. Candidates only browse available interviews, optionally upload a resume, select an interview, and practice.
4. Resume upload personalizes context; it does not create or alter the published interview blueprint.
5. Every session executes a published, versioned graph. Candidate-specific runtime state is stored separately from the immutable blueprint.
6. The UI remains simple. No graph editor, ML configuration, custom interview builder, or complex setup wizard is exposed to candidates.
7. The implementation agent must inspect the existing repository, reuse its architecture and working components, and make incremental changes. Do not rebuild from scratch or replace the existing stack without a documented technical reason.

## Pack contents

| Chunk | Document | Purpose |
|---|---|---|
| 00 | `00_PRODUCT_SCOPE_AND_PRINCIPLES.md` | Scope, actors, constraints, user journeys |
| 01 | `01_UX_AND_FRONTEND_REQUIREMENTS.md` | Candidate screens and interactions |
| 02 | `02_INTERVIEW_BLUEPRINT_AND_GRAPH_MODEL.md` | Admin-authored graph and node contract |
| 03 | `03_RESUME_INTELLIGENCE_PIPELINE.md` | Optional resume ingestion and candidate context |
| 04 | `04_ADAPTIVE_RUNTIME_AND_ML_REQUIREMENTS.md` | Session state, evaluation, node selection |
| 05 | `05_BACKEND_APIS_AND_DATA_MODEL.md` | Services, APIs, persistence contracts |
| 06 | `06_ADMIN_AUTHORING_AND_PUBLISHING.md` | Blueprint authoring, validation, versioning |
| 07 | `07_SECURITY_PRIVACY_AND_RELIABILITY.md` | Security, privacy, failure handling |
| 08 | `08_TESTING_AND_ACCEPTANCE_CRITERIA.md` | Test strategy and release gates |
| 09 | `09_IMPLEMENTATION_BACKLOG.md` | Sequenced engineering work items |
| 10 | `10_AGENT_EXECUTION_GUIDE.md` | Instructions for coding agents |
| 11 | `diagrams/ARCHITECTURE_AND_FLOWS.md` | Mermaid architecture and sequence diagrams |

## Implementation order

Start with repository discovery and current-flow diagnosis. Then implement the catalog and candidate journey, followed by blueprint data contracts, runtime execution, resume intelligence, admin publishing, reporting, and hardening. Do not make resume processing a prerequisite for a normal interview.

## Non-goals

- Candidate-created or candidate-edited interviews.
- Candidate-facing graph/node editing.
- Candidate-facing model training or ML configuration.
- Automatically changing the published blueprint based on an individual candidate.
- Treating resume claims as verified skills.
- Replacing the existing application stack without an evidence-based migration proposal.

## Definition of done

A candidate can select any published interview and start without a resume. They can optionally upload a resume and use it as additional retrieval context. The same published blueprint is used for every candidate on that blueprint version, while each session maintains independent competency estimates, evidence, graph traversal state, and adaptive question history.
