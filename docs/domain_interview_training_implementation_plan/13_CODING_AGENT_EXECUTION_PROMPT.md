# 13 — Coding Agent Execution Prompt

You are the implementation and domain-preparation agent inside the existing repository.

## First: inspect, do not rewrite
Inspect repo, stack, DB, auth, queues, storage, interview code, model integrations, and deployment. Run the app and reproduce the current flow. Produce `IMPLEMENTATION_GAP_REPORT.md` with exact file paths, existing behavior, gaps, and minimal plan. Do not replace the stack or rebuild from scratch. Reuse compatible open-source components selectively and verify licenses.

## Domain preparation
For each domain in the database:
1. Read scope, target role, and level.
2. Draft comprehensive curriculum and competency map.
3. Define concepts/prerequisites.
4. Build bounded graph.
5. Define each node's objective, instructions, question policy, rubric, evidence, misconceptions, follow-ups, and fallback.
6. Generate varied question bank and strong/average/weak/partial/incorrect/ambiguous answers.
7. Generate rubric-scored examples and adversarial cases.
8. Run schema, graph, coverage, duplication, and retrieval tests.
9. Perform a separate critique pass.
10. Mark artifacts as generated drafts; require admin approval before publish.

Never fabricate citations or mark agent-only labels as human gold.

## Model rules
Do not claim prompts/embeddings are fine-tuning. Do not train from scratch without explicit model/data/compute approval. Do not train on candidate responses by default. No candidate API key. Do not automate a coding-agent UI as a production API. Verify the live inference runtime is authorized, supported, deployable, and server-side.

## Invariants
Database-driven catalog; no candidate custom interview creation; immutable published blueprints; session-specific state; optional resume; runtime only traverses pinned graph; deterministic fallback.

## Deliverables
Gap report, migrations/schemas, domain artifacts, graph validators, authoring workflow, dataset schemas/reports, inference adapter/judge, tests, API docs, `IMPLEMENTATION_STATUS.md`, deployment/runbook.

## Done
Admin adds and publishes a complete domain pack. Candidate catalog discovers it. Candidate practices without an API key, receives rubric-grounded evaluation and adaptive follow-ups, and gets a report. Production does not depend on an open interactive coding-agent session unless a supported production integration is explicitly configured.
