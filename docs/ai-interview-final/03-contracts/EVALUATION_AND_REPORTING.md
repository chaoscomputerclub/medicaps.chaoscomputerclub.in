# Evaluation and Reporting Contract

## Principles

- Evaluate answer content and reasoning, not accent, charisma, verbosity, typing speed or protected traits.
- Every score is tied to a rubric dimension and answer evidence.
- Model output is a draft evaluation until schema and evidence validation passes.
- Reports are practice guidance, not hiring decisions or job-performance predictions.

## Suggested rubric dimensions

Technical/role track:
- correctness and conceptual understanding;
- depth and implementation detail;
- reasoning and trade-off analysis;
- debugging/problem decomposition;
- reliability/security awareness;
- communication clarity of technical explanation.

Behavioral:
- situation/context;
- candidate's specific task/action;
- reasoning and ownership;
- outcome/impact;
- reflection/learning.

System design:
- requirements and constraints;
- API/data modeling;
- architecture and component boundaries;
- scalability and performance;
- reliability/failure handling;
- security/privacy;
- trade-offs and bottlenecks.

QA/SDET:
- test strategy and coverage;
- risk prioritization;
- automation design;
- failure diagnosis;
- reliability/flakiness control;
- CI integration.

Rubrics are versioned. Do not mix scores across rubric versions without explicit normalization.

## Evaluation output

```json
{
  "rubric_version": "backend-entry-v1",
  "score": 76,
  "dimension_scores": {
    "correctness": 80,
    "depth": 70,
    "tradeoffs": 75,
    "reliability": 78
  },
  "strengths": ["Explained transaction boundary clearly"],
  "gaps": ["Did not cover retry idempotency"],
  "evidence": [
    {
      "answer_id": "uuid",
      "quote": "I would persist the event in the same transaction...",
      "dimension": "reliability"
    }
  ],
  "follow_up": {
    "recommended": true,
    "reason_code": "MISSING_FAILURE_MODE",
    "question": "How would you prevent duplicate publication after a worker restart?"
  },
  "limitations": ["Assessment is based only on this interview response."]
}
```

Evidence quotes must be exact substrings of the stored answer or explicitly marked as paraphrase. Never fabricate a quote.

## Score validation

- Scores are integers 0–100.
- Dimension keys must match the pinned rubric.
- Missing dimensions must be explicitly marked unavailable, not silently assigned zero.
- Overall score aggregation is deterministic and documented.
- Model-provided score is not accepted if output fails schema, references unknown dimensions or includes fabricated evidence.
- Evaluation errors can be retried without duplicating the answer.

## Report

Include:
- overall practice score and band;
- rubric/plan version;
- summary;
- strengths;
- improvement areas;
- per-question feedback;
- evidence quotes;
- suggested model answer/answer outline;
- practice recommendations;
- limitations and confidence.

Avoid `LEANING_HIRE` or other employment verdicts. Use neutral bands such as `FOUNDATIONAL`, `DEVELOPING`, `PROFICIENT`, `STRONG`, with rubric documentation.
