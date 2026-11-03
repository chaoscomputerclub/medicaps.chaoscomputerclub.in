# 06 — Admin Authoring and Publishing

## 1. Purpose

The platform owner prepares and maintains every interview. Candidate-facing functionality is read-only with respect to interview definitions.

## 2. Authoring capabilities

Admin can:
- Create a draft interview definition.
- Select category/domain.
- Define public catalog metadata.
- Add, edit, and connect graph nodes.
- Map nodes to global competencies.
- Configure question instructions and allowed formats.
- Define evaluation rubrics and evidence indicators.
- Configure difficulty progression and transition policies.
- Define completion and retry policies.
- Run graph validation and sample simulations.
- Publish a new immutable version.
- Retire an old interview version.

If an authoring UI does not exist, first determine whether a secure internal JSON/YAML authoring workflow is sufficient for the current implementation. Do not build a large visual graph editor unless explicitly approved.

## 3. Validation before publish

Required validation:
- Schema validation.
- Unique node IDs.
- Valid entry and terminal nodes.
- Valid edge references.
- Reachability analysis.
- Bounded cycles.
- No dead ends.
- All question nodes have valid instructions and rubrics.
- All competencies exist.
- Every generated question has fallback behavior.
- Completion policy is satisfiable.
- Prompt injection and unsafe-content checks.
- Simulation over representative candidate paths.

## 4. Versioning

- Draft edits do not affect active sessions.
- Publish creates an immutable version.
- Active catalog points to one published version per logical interview unless multi-version rollout is explicitly configured.
- Existing sessions remain pinned to their original version.
- Rollback changes the active version pointer; it does not mutate old versions.
- Retired versions remain available for historical report interpretation.

## 5. Model and prompt release

Track independently:
- Blueprint version.
- Question-generation prompt version.
- Evaluation prompt/model version.
- Embedding model version.
- Competency taxonomy version.
- Runtime algorithm version.

A session records the versions used so results can be reproduced and audited.
