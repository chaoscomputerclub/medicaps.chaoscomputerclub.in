# 00 — Vision and Architecture Decisions

## Objective
Build a reusable platform where every interview domain is prepared before candidates use it. A domain row in the database is not enough: it must have a complete, validated, published blueprint.

## Roles
**Admin/platform owner:** defines domains, target roles, curriculum, competency map, graph, node instructions, question policies, rubrics, approved references, examples, and release versions.

**Candidate:** selects a published interview, optionally uploads a resume, answers questions, and receives feedback.

**Coding agent:** development-time authoring and QA assistant. It drafts curricula, graph nodes, question examples, rubrics, synthetic examples, adversarial tests, and implementation code; critiques artifacts and runs validators. Generated material remains draft until approved.

**Runtime interview engine:** loads the published pack, asks questions, evaluates answers, updates session state, and selects allowed next nodes.

## Non-negotiable decisions
1. Database-driven domain catalog; adding a published domain requires no frontend code change.
2. Candidate custom-interview creation does not exist.
3. Published blueprints are immutable and versioned.
4. Every session pins a blueprint, prompt, evaluator, taxonomy, and runtime version.
5. Candidate state never mutates the source blueprint.
6. Candidate does not supply API keys; secrets stay server-side.
7. Resume is optional and provides unverified context, not proof of skill.
8. Candidate responses are not used for training by default.
9. Rules-based fallback exists when inference or ML components fail.
10. Fine-tuning is optional and must demonstrate measurable improvement over a baseline.

## Meaning of “pre-training”
This project separates:
- Curriculum preparation: scope, concepts, competencies, prerequisites.
- Blueprint preparation: graph, node instructions, question policies, rubrics, transitions.
- Knowledge preparation: approved corpus, chunking, embeddings, retrieval tests.
- Behavior preparation: system instructions, output schemas, examples, safety rules.
- Evaluation preparation: gold cases, calibration examples, adversarial tests.
- Model training: actual fine-tuning of a compatible model, only when data, licensing, compute, and evaluation support it.

Prompts, graph configuration, retrieval indexes, and in-context examples prepare runtime behavior; they do not change foundation-model weights.
