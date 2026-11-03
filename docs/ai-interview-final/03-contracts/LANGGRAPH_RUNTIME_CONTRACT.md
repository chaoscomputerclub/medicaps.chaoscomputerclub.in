# LangGraph Runtime Contract

## 1. Purpose and boundary

LangGraph controls the interview dialogue workflow. It is not the source of truth for authorization, session lifecycle, SQL transactions, idempotency or user consent.

The existing graph already defines typed state and planning/evaluation/report structures. Preserve useful logic but change checkpointing and execution boundaries.

## 2. Durable checkpointing

- Replace `MemorySaver` with a persistent checkpointer compatible with the installed LangGraph package.
- PostgreSQL is the preferred durable checkpoint store because it is already authoritative.
- Pin and test the exact checkpointer package/version in `backend/requirements.txt`.
- Initialize checkpointer lifecycle in application lifespan; close pools on shutdown.
- Thread ID is server-generated: `interview:{session_id}`.
- Checkpoint metadata includes session ID and graph version, not PII.
- Every resume validates session ownership and checkpoint/session mapping.
- A checkpoint is not proof that a turn was committed; reconcile it against relational rows.

## 3. State contract

Graph state must contain only serializable workflow data:
- session_id
- graph_version
- plan_version
- rubric_version
- current state and question index
- bounded candidate context references/text
- current question identifiers and content
- finalized answer identifier/text reference
- evaluation structured output
- bounded follow-up count
- next action and reason code
- retry/attempt metadata
- last committed DB event/turn identifier

Must not contain:
- AsyncSession or ORM session objects
- FastAPI Request/Response
- provider client instances
- API keys or tokens
- raw audio bytes
- PRN, email, phone or unrelated identifiers
- unbounded transcript/history.

## 4. Nodes

1. `load_authorized_session`
2. `load_confirmed_candidate_context`
3. `validate_or_create_plan`
4. `select_next_question`
5. `persist_question_and_transition`
6. `await_candidate_answer` (interrupt boundary; HTTP worker is not held open)
7. `load_finalized_answer`
8. `analyze_answer`
9. `validate_evidence_and_rubric`
10. `choose_next_action`
11. `persist_evaluation_and_transition`
12. `finalize_report`
13. `reconcile_checkpoint_and_database`
14. `recover_or_fail`

## 5. Turn processing sequence

1. API authenticates user and checks ownership.
2. Domain service validates session state and active question.
3. Domain service claims turn processing using a DB transaction and fencing token.
4. Answer is inserted idempotently and committed.
5. Graph resumes from the persisted checkpoint with answer ID.
6. Graph loads answer from PostgreSQL; it does not trust a duplicate payload in checkpoint.
7. LLM produces typed evaluation.
8. Application validates schema, score bounds, evidence references and rubric keys.
9. Domain service commits evaluation, state transition and next question/report in a transaction.
10. API returns the committed state or a processing receipt if work is asynchronous.

## 6. Concurrency and retries

- One active processing lease per session turn.
- Lease expiration permits recovery; new worker increments fencing token.
- Every write checks current fencing token.
- Provider retries use bounded exponential backoff with jitter.
- Do not retry validation errors, auth failures or policy rejections.
- Retry only transient network/429/5xx classes within budget.
- A provider timeout after request may have been accepted; use provider idempotency if supported, otherwise record attempt and reconcile before resubmission.
- A candidate-visible question must never be duplicated because of a retry.
- All graph loops have maximum follow-up and total-turn bounds.

## 7. Decision policy

LLM proposes:
- `CLARIFY`
- `PROBE_DEEPER`
- `MOVE_NEXT`
- `SKIP`
- `COMPLETE`

Server validates:
- configured plan still has remaining questions;
- per-topic follow-up budget not exceeded;
- session time/turn budget;
- candidate action permissions;
- no duplicate question;
- state transition allowed.

The graph must never let model output mark a session completed without the application service committing completion.

## 8. Observability

Log:
- session opaque ID
- graph version
- node name
- turn ID
- attempt
- provider name/model alias
- latency and token/cost metadata
- result code

Do not log prompts, raw answers, resumes or secrets by default.
