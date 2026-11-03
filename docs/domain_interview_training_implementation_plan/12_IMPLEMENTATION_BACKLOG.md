# 12 — Implementation Backlog

## Epic 0: Repository audit (P0)
- [ ] Inspect frontend/backend, DB, auth, queues, storage, LLM/embedding integrations.
- [ ] Run app and reproduce current flow.
- [ ] Map reusable code and gaps with exact file paths.
- [ ] Write gap report and migration/rollback plan.
- [ ] Establish regression baseline.

## Epic 1: Database-driven catalog (P0)
- [ ] Domain/blueprint/version schema and migrations.
- [ ] Published version pointer and seed/import mechanism.
- [ ] Catalog APIs and API-driven cards.
- [ ] Verify DB addition appears without frontend change.

## Epic 2: Curriculum and graph contracts (P0)
- [ ] Competency/concept/node/edge schemas.
- [ ] Schema and graph validators.
- [ ] Coverage validation.
- [ ] Immutable publish/version pinning.
- [ ] Seed one representative domain completely.

## Epic 3: Coding-agent authoring (P0/P1)
- [ ] Artifact templates.
- [ ] Curriculum/node/question/rubric generation workflow.
- [ ] Independent critique pass.
- [ ] Automated validators and admin approval gate.
- [ ] Provenance and checksums.

## Epic 4: Dataset and judge harness (P1)
- [ ] Dataset JSONL schemas and registry.
- [ ] Diverse synthetic examples and adversarial cases.
- [ ] Duplicate/coverage checks.
- [ ] Locked gold-set workflow.
- [ ] Judge-vs-gold report.

## Epic 5: Runtime (P0)
- [ ] Inference adapter.
- [ ] Existing provider reuse or approved local runtime.
- [ ] Node-constrained question generation.
- [ ] Structured judge and evidence validation.
- [ ] Deterministic graph transition baseline.
- [ ] Fallback question bank.
- [ ] Version pinning.

## Epic 6: Retrieval/resume (P1)
- [ ] Approved domain corpus ingestion.
- [ ] Chunking, embeddings, metadata, retrieval tests.
- [ ] Candidate-scoped optional resume context.
- [ ] Keep claims separate from demonstrated skill.

## Epic 7: Fine-tuning (P2, conditional)
- [ ] Assess model license, compute, data volume/quality, baseline gap.
- [ ] Build reproducible training only if justified.
- [ ] Evaluate against locked holdout.
- [ ] Register artifact, canary, rollback, monitor drift.

## Epic 8: Security/release (P0)
- [ ] Candidate/admin access control.
- [ ] Secret management and isolation tests.
- [ ] Idempotency, rate limits, prompt-injection tests.
- [ ] End-to-end regression and runbook.

Recommended order: audit → catalog → blueprint → one complete domain → runtime baseline → dataset/judge harness → additional domains → resume → optional fine-tuning.
