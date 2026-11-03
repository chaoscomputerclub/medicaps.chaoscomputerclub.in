# 04 — Dataset Creation and Quality

## Separate datasets
- `curriculum_corpus`: approved domain knowledge.
- `question_dataset`: question examples and metadata.
- `response_example_dataset`: synthetic or human-authored answers.
- `rubric_dataset`: scoring anchors and evidence.
- `gold_evaluation_dataset`: reviewer-approved judge test cases.
- `adversarial_dataset`: ambiguity, injection, misleading and edge cases.
- `runtime_telemetry_dataset`: operational metadata.
- `candidate_response_dataset`: private production data, excluded from training by default.

## Example record fields
Domain/blueprint version, competency/concept/node IDs, question, response, provenance, criterion scores, evidence spans, rationale, difficulty, language, reviewer status, source/license, dataset split, generation model/prompt version.

## Generation workflow
1. Coding agent generates a diverse draft batch from approved curriculum.
2. Separate critique pass checks correctness, coverage, bias, duplication, ambiguity, and rubric fit.
3. Automated checks validate schema, domain mapping, answerability, source references, and leakage.
4. Admin/reviewer checks high-impact content and a sample of generated records.
5. Approved records are versioned and split.
6. Gold holdout is locked and never used for training.
7. Publish a coverage/provenance report.

## Avoid synthetic feedback loops
Do not use only examples generated and scored by the same model. Include independent review or authoritative references. Keep hidden holdouts. Include multiple correct styles, short/long answers, partial answers, confident errors, and clarification-needed cases. Track synthetic proportion and reviewer approval rate.

## Quality gates
Competency/difficulty coverage, near-duplicate rate, answer correctness, rubric coverage, score distribution, language diversity, bias review, prompt-injection resistance, train/test leakage, provenance completeness.

## Governance
Candidate answers are not training data by default. Any later use requires legal/governance approval, appropriate notice/consent or other lawful basis, redaction, retention/deletion controls, identity separation, and lineage tracking.
