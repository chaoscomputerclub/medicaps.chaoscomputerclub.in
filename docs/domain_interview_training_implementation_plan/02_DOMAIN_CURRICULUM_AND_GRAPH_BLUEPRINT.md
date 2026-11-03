# 02 — Domain Curriculum and Graph Blueprint

## Required domain package
Every domain must include: purpose, target role/level, scope/exclusions, competency map, concept curriculum, prerequisites, graph nodes/edges, node instructions, question policies, rubrics, misconceptions, follow-up rules, approved references, gold evaluation cases, adversarial tests, fallbacks, coverage report.

## Curriculum hierarchy
Domain → Interview Blueprint → Round → Competencies → Concepts → Prerequisites and observable indicators. Graph nodes reference competencies and concepts.

## Example competency coverage

**Frontend:** semantic HTML/accessibility, CSS/layout, JavaScript, event loop, browser rendering, React, state, performance, testing, security.

**Backend:** programming fundamentals, concurrency, API design, auth, data modeling, SQL/indexing, caching, distributed systems, reliability, observability, security.

**Python:** object model, iterators/generators, decorators, context managers, exceptions, async/concurrency, memory/performance, packaging, typing, testing.

**Machine Learning:** data preparation/leakage, supervised/unsupervised learning, validation, bias/variance, regularization, metrics/calibration, feature engineering, deep learning, deployment, drift, responsible ML.

These are starting outlines, not complete expert-approved curricula. Expand and validate each before publication.

## Required node fields
`node_id`, `node_type`, `competency_ids`, `concept_ids`, `objective`, `interviewer_instructions`, `question_policy`, `difficulty_policy`, `rubric_id`, `expected_evidence`, `common_misconceptions`, `follow_up_policy`, `entry_conditions`, `exit_conditions`, `fallback_question_ids`, `max_attempts`, `time_budget`, `safety_policy`.

Instructions must specify what to assess, what evidence to seek, how to handle partial/wrong/ambiguous answers, what not to reveal, and which next nodes are allowed.

## Graph validation
Block publish for missing entry/terminal nodes, broken edges, unreachable required nodes, unbounded cycles, dead ends, missing rubrics, missing fallbacks, uncovered required competencies, invalid transitions, or insufficient gold-test coverage.

Runtime may adapt traversal only among eligible nodes and allowed edges. It cannot invent nodes or mutate graph topology.
