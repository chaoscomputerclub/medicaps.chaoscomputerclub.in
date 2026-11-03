# 03 — Pretraining and Agent Preparation

## Preparation layers
A. **Curriculum:** domain scope, target role, levels, competencies, concepts, prerequisites, observable evidence, exclusions.

B. **Interviewer behavior:** tone, opening, question phrasing, probing, clarification, handling partial/wrong/off-topic answers, transitions, uncertainty, candidate-safe behavior.

C. **Node instructions:** objective, question constraints, rubric, expected evidence, alternative valid approaches, misconceptions, follow-up branches, depth/time limits, prohibited assumptions.

D. **Knowledge:** approved sources with owner/license/date/version; parse, clean, chunk, tag, embed, index by domain; run retrieval relevance and provenance tests.

E. **Examples:** strong, average, weak, partial, incorrect, subtly misleading, alternative-valid, ambiguous, and follow-up answer examples.

F. **Evaluation:** reviewer-approved gold cases, judge comparison, agreement analysis, confidence calibration, abstention thresholds, adversarial cases.

## Coding agent workflow
Use the coding agent to inspect existing code/data, draft domain curricula and graph definitions, generate diverse question/answer examples, draft rubric anchors, find missing coverage, generate adversarial tests, run validators, critique its first-pass output, and produce a change report.

All generated artifacts are drafts. Require admin/domain-expert review before publication. Never fabricate citations or call agent-generated labels human gold labels.

## Runtime preparation
A published pack should include versioned system instructions, node instructions, graph, taxonomy mapping, approved corpus/index version, question bank, rubrics, gold dataset, adversarial suite, runtime policy, fallbacks, and validation report.

At session start the runtime loads these artifacts and initializes session state. It does not retrain a foundation model for every candidate.

## Important limitation
An interactive coding-agent session is not automatically callable by the deployed app. Live interview generation/judging needs a supported authorized inference runtime: existing server-side provider integration, a self-hosted model, or an approved managed endpoint. Do not automate/scrape a chat UI as a production API.

Actual fine-tuning requires a trainable model, permitted license, reviewed dataset, training infrastructure, train/validation/test split, baseline comparison, artifact registry, deployment, and rollback.
