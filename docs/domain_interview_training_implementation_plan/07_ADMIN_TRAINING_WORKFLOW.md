# 07 — Admin Training Workflow

## Lifecycle
Draft → Curriculum Ready → Blueprint Ready → Dataset Prepared → Validating → Approved → Published → Retired.

A domain is not candidate-visible until it has an active published blueprint.

## Workflow
1. Create domain record and define target role/level/scope.
2. Map competencies and concepts to the global taxonomy.
3. Define prerequisites and graph.
4. Generate node instructions, question policies, rubrics, and fallbacks.
5. Generate question bank and varied response examples.
6. Generate adversarial cases and coverage tests.
7. Run schema, graph, retrieval, and judge validators.
8. Run independent coding-agent critique.
9. Review high-impact content and gold labels.
10. Approve and publish immutable version.
11. Monitor quality and create a new version for changes.

## Minimum admin tools
Domain/status list, blueprint version list, structured artifact import, graph preview, validation, coverage report, sample simulation, dataset provenance, judge-vs-gold report, approve/publish/retire.

A visual graph editor is optional. Start with validated JSON/YAML import if it fits the existing codebase.

## Per-domain artifacts
`domain.yaml`, `competencies.json`, `concepts.json`, `graph.json`, `question_bank.jsonl`, `rubrics.json`, `synthetic_examples.jsonl`, `gold_cases.template.jsonl`, `adversarial_cases.jsonl`, `coverage_report.md`, `validation_report.md`.

Each artifact records domain slug, blueprint/schema version, generation provenance, and review state. Gold templates are not gold until independently reviewed and labeled.
