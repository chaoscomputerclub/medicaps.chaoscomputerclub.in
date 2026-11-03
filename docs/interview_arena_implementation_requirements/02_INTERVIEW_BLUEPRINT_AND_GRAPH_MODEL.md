# 02 — Interview Blueprint and Graph Model

## 1. Core concept

An interview blueprint is an admin-authored, validated, versioned definition of an interview. It contains the graph and all node-level instructions needed to execute the interview. Candidates select a published blueprint; they never author one.

## 2. Blueprint structure

Required fields:
- `blueprint_id`: stable logical identifier.
- `version`: immutable version identifier or semantic version.
- `slug`, `title`, `description`.
- `category`: e.g. Technical, HR, Behavioral.
- `domain`: e.g. Backend, Python, Machine Learning.
- `status`: draft, validating, published, retired.
- `entry_node_ids`.
- `nodes` and `edges`.
- `completion_policy`.
- `runtime_policy`.
- `public_metadata`.
- `created_by`, timestamps, and change history.

## 3. Node contract

Every executable node must define:

| Field | Meaning |
|---|---|
| `node_id` | Stable ID within blueprint version |
| `node_type` | question, assessment, branch, section, terminal |
| `title` | Admin-facing label |
| `competency_ids` | Competencies assessed |
| `learning_objective` | What the node is intended to assess |
| `prerequisites` | Required prior nodes or state conditions |
| `question_policy` | Question format, constraints, and generation instructions |
| `evaluation_rubric` | Criteria, levels, weights, evidence requirements |
| `difficulty_policy` | Allowed difficulty and progression |
| `expected_evidence` | Evidence expected in a strong response |
| `transition_policy` | Conditions for selecting outgoing edges |
| `retry_policy` | Retry/skip behavior, if permitted |
| `max_attempts` | Upper bound |
| `timeout_seconds` | Optional response timeout |
| `safety_constraints` | Disallowed content and validation rules |
| `fallback_question_id` | Approved fallback if generation fails |

A node is not publishable if required instructions or rubric fields are missing.

## 4. Edge contract

Each edge contains:
- `from_node_id`
- `to_node_id`
- `priority`
- `condition` (declarative expression or typed rule, never arbitrary executable code)
- `default` boolean
- optional `reason_code`

Graph rules:
- All referenced nodes must exist.
- Entry nodes must exist.
- No unreachable required nodes.
- Cycles must be explicitly allowed and bounded.
- Every non-terminal path must have a valid continuation or fallback.
- A terminal path must exist.
- Conditions must be deterministic and testable.
- The graph must have a maximum traversal/step limit.

## 5. Competency taxonomy

Use a global, versioned competency taxonomy. A blueprint references competency IDs rather than inventing inconsistent labels per session.

A competency definition may include:
- ID and name.
- Parent competency.
- Description.
- Observable indicators.
- Proficiency levels.
- Related concepts.
- Assessment guidance.

Blueprint nodes map to one or more competencies. Candidate/session estimates are stored separately.

## 6. Separation of immutable and mutable data

Immutable after publication:
- Node definitions.
- Edges.
- Rubrics.
- Prompt templates/instructions.
- Difficulty and transition policies.
- Completion policy.

Mutable per session:
- Current node.
- Visited nodes.
- Candidate responses.
- Evidence.
- Competency estimates and confidence.
- Selected question instance.
- Runtime counters and timestamps.

Published blueprint changes require a new version. An active session remains pinned to the version with which it started.

## 7. Example node (illustrative)

```json
{
  "node_id": "backend.sql.indexing",
  "node_type": "question",
  "competency_ids": ["database.indexing"],
  "learning_objective": "Assess understanding of index selection and trade-offs",
  "question_policy": {
    "format": "scenario",
    "difficulty": ["intermediate", "advanced"],
    "instructions": "Ask one realistic database indexing question. Do not reveal the answer."
  },
  "evaluation_rubric": {
    "criteria": [
      {"id": "correctness", "weight": 0.5},
      {"id": "tradeoffs", "weight": 0.3},
      {"id": "clarity", "weight": 0.2}
    ],
    "scale": [0, 1, 2, 3, 4]
  },
  "expected_evidence": ["query pattern reasoning", "selectivity", "write overhead"],
  "transition_policy": {"type": "score_band"},
  "max_attempts": 1
}
```

## 8. Runtime interpretation

The runtime loads the blueprint version and interprets its policies. LLM output is constrained by node instructions and schema. The model cannot invent new graph nodes, bypass prerequisites, rewrite rubrics, or mutate the published blueprint.
