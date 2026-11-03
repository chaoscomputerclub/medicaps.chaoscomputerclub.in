# Test Matrix and Release Gates

## Unit tests

- State transition matrix: every allowed and rejected transition.
- Idempotency key: same/same, same/different, concurrent duplicates.
- Provider factory per environment.
- Provider output schema and malformed response.
- Candidate context redaction and token budget.
- Resume MIME/size/page limits and extraction provenance.
- Rubric score aggregation and evidence quote validation.
- HCVE sequence fencing and stale output discard.

## Integration tests

- Fresh DB migration.
- Upgrade DB migration from current schema.
- Session create/start/answer/evaluate/complete.
- Crash after answer insert before graph resume.
- Crash after provider response before evaluation commit.
- Crash after evaluation commit before response.
- Worker lease expiry and fencing.
- Persistent checkpoint survives application restart.
- Cross-member access denied for session/question/answer/report/resume/voice.
- Provider timeout/429/5xx and recovery.
- Redis unavailable behavior.
- Resume deletion propagation.
- Voice session closed on interview completion.

## Frontend tests

- Dashboard loading/empty/error.
- Configuration validation.
- Refresh and restore active session.
- Double-submit prevention and same idempotency key retry.
- Pause/resume/complete.
- Resume upload/review/consent/delete.
- Voice permission denied and text fallback.
- Transcript provisional/final state.
- Report evidence navigation.
- Keyboard-only and screen-reader checks.

## End-to-end scenarios

1. Text technical interview from setup to report.
2. Resume upload → review → consent → personalized probe.
3. Candidate pauses, closes tab, returns and resumes.
4. Network disconnect during answer submit; retry does not duplicate.
5. LLM provider unavailable; session recovers without false output.
6. Voice STT partial transcript then final transcript; only final transcript submitted.
7. Candidate interrupts TTS; stale audio discarded.
8. Unauthorized member attempts another candidate's voice/session/report.
9. Candidate deletes resume; facts are not used by later session.
10. Complete interview and inspect report version/provenance.

## Release gates

- All P0 backlog tasks done.
- No critical/high security finding open.
- Production cannot start with mock provider.
- Checkpoint survives process restart.
- No PRN/direct identifier in model prompts or logs.
- No cross-member data access.
- Idempotency/concurrency tests pass.
- Backup and restore tested.
- Provider credentials/quotas verified.
- SLOs measured and accepted.
- Text fallback operational if voice unavailable.
- Candidate consent and deletion flows verified.
- Rollback/forward-fix plan rehearsed.
