# 01 — Database-Driven Domain Catalog

## Requirement
Every active domain with a published valid blueprint must appear automatically in the candidate catalog. No fixed frontend list or domain-specific page implementation.

## Suggested schema
`interview_domains`: id, slug (unique), name, description, category, icon_key, display_order, is_active, timestamps.

`interview_blueprints`: id, domain_id, slug, title, description, status, active_version_id.

`interview_blueprint_versions`: id, blueprint_id, version, schema_version, curriculum_version, taxonomy_version, prompt_pack_version, evaluation_pack_version, status, checksum, published_at, created_by.

Related versioned data: competencies, concepts, graph_nodes, graph_edges, question_templates, question_bank, evaluation_rubrics, transition_rules, reference_sources, training_examples, evaluation_cases, validation_results.

Use relational tables for queryable entities and relationships. JSON configuration may be used for node policies if schema-validated and versioned. Avoid one opaque blob for the whole system.

## API
- `GET /api/interview-domains`: active domains with at least one published blueprint; supports category/search/pagination.
- `GET /api/interview-domains/{slug}`: public domain details and published interview types.
- `GET /api/interviews/{slug}`: public metadata and coverage summary.

Never expose hidden prompts, answer keys, private sources, internal rubrics, or training data.

## Frontend
Render cards from API data. Use a safe icon registry with a neutral fallback. Hide inactive/unpublished domains. Adding a valid published database record must make it visible without frontend deployment.

## Integrity
Slugs are unique. Published blueprints must reference active domains. Historical sessions retain their blueprint version. Retire/soft-delete rather than destructively deleting records used by historical sessions.
