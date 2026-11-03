# 04 — Adaptive Runtime and ML Requirements

## 1. Runtime objective

Execute the admin-authored graph predictably while adapting question selection and difficulty using observed candidate responses. Adaptation changes session traversal and question instances, not the published blueprint.

## 2. Runtime initialization

On session creation:
1. Resolve the active published blueprint.
2. Pin exact blueprint version and model/prompt versions.
3. Load competency taxonomy references.
4. Initialize session graph state from entry nodes and authored defaults.
5. Attach optional resume context reference.
6. Initialize competency estimates with explicit prior confidence.
7. Select an eligible entry node.
8. Generate or retrieve a valid question.
9. Persist session state before returning it to the client.

## 3. Candidate state

Maintain separate fields for:
- Prior estimate (before interview).
- Observed evidence.
- Current estimate.
- Confidence/uncertainty.
- Evidence count and recency.
- Last assessed timestamp.
- Prediction (optional and clearly labeled).

Do not collapse these into one score.

## 4. Node selection

Selection must respect hard constraints first:
- Node is part of pinned blueprint version.
- Prerequisites are satisfied.
- Node is not completed beyond its attempt policy.
- Node is not excluded by safety or session policy.
- Maximum session length has not been exceeded.
- An outgoing path remains available.

Only then apply adaptive ranking among eligible nodes.

Possible ranking signals:
- Competency uncertainty.
- Importance/weight in blueprint.
- Evidence gaps.
- Previous performance.
- Difficulty progression policy.
- Coverage requirements.
- Resume-relevant project context (as a personalization signal, not a score).

The authored blueprint remains authoritative. ML cannot bypass required nodes or create arbitrary nodes.

## 5. Algorithm policy

Algorithms are pluggable and selected according to data sufficiency and offline evaluation:

- **Bayesian Knowledge Tracing (BKT):** concept-level mastery estimates when the assumptions and evidence volume are suitable.
- **Item Response Theory (IRT):** candidate ability/question difficulty calibration when enough calibrated response data exists.
- **Contextual bandit (e.g. LinUCB or Thompson Sampling):** ranking eligible questions when reward definition, exploration limits, and sufficient logged data exist.
- **State-space/Kalman filtering:** smoothing noisy sequential estimates where a defensible observation model exists.
- **LLM evaluator:** structured rubric-based evidence extraction; never directly mutates authoritative state without validation.
- **Rules-based baseline:** mandatory fallback when learned models are unavailable or not yet validated.

Do not claim that every algorithm is active from day one. Ship a deterministic, explainable rules-based runtime first, then enable learned components behind feature flags after offline validation.

## 6. Evaluation contract

Evaluator input:
- Blueprint and node ID/version.
- Question instance.
- Candidate response.
- Rubric.
- Relevant conversation context.
- Retrieved resume evidence (optional, explicitly labeled unverified).

Evaluator output must be schema-validated:
- Criterion scores.
- Evidence excerpts or response spans.
- Rationale grounded in response.
- Missing/incorrect concepts.
- Confidence.
- Follow-up recommendation within allowed policy.
- Safety/quality flags.

The evaluator must not:
- Invent evidence absent from the response.
- Treat resume claims as demonstrated ability.
- Change node rubric or blueprint.
- Select an arbitrary node outside the blueprint.
- Expose hidden rubric details in candidate-facing feedback.

## 7. Adaptive question policy

- Generate one question at a time unless blueprint explicitly defines otherwise.
- Question must map to the current node's learning objective and competency.
- Validate difficulty, scope, format, and answerability.
- Reject duplicates or near-duplicates within session where feasible.
- Use an approved fallback question if generation fails validation.
- Do not expose expected answer before response submission.
- Record prompt/model version and validation outcome.

## 8. Graph and trend visualization

The graph definition is authored and static for a blueprint version. The candidate's session overlay changes:
- Node status (not started, eligible, active, completed, skipped).
- Observed performance.
- Competency estimate and uncertainty.
- Evidence count.

If a graph visualization is shown, render the immutable blueprint topology plus session overlay. Do not regenerate or reposition graph topology as an ML output. Layout is a presentation concern. Predictions must be visually distinct from observed results and should not be shown without calibrated evidence.

## 9. Completion

Completion is determined by the blueprint's explicit policy:
- Required node coverage.
- Maximum question/step count.
- Time limit, if configured.
- Terminal node reached.
- Early termination rules.

On completion, freeze session assessment state and create a report snapshot. Later model updates must not silently rewrite a historical report.
