# Frontend UX and State Contract

## Repository constraints

Use React 19, TypeScript, Vite, Redux Toolkit, React Router and the existing design system. Do not introduce a separate frontend framework or duplicate state manager.

## Screens

1. Interview dashboard
2. Interview catalogue
3. Configuration modal/page
4. Resume upload and extraction review
5. Plan confirmation
6. Text workspace
7. Voice workspace
8. Session recovery/paused state
9. Report
10. Candidate profile/context settings
11. Admin catalogue/rubric management (only if enabled)

## Server state is authoritative

- Redux may cache API responses and transient UI state.
- After page refresh, fetch session detail from API.
- Do not trust localStorage as the source of lifecycle truth.
- Never locally mark an answer as committed before server acknowledgement.
- Keep idempotency key for retry of the same answer payload.
- If same request returns processing, poll or subscribe using the documented contract.

## Required states

Dashboard:
- loading
- empty
- populated
- API error/retry
- stale cache warning if relevant

Workspace:
- preparing
- asking
- awaiting answer
- submitting
- processing
- follow-up ready
- paused
- reconnecting
- failed/recoverable
- completing
- completed

Voice:
- permission request
- permission denied
- microphone active
- provisional transcript
- final transcript review
- TTS speaking
- interrupted
- reconnecting
- text fallback

Resume:
- uploading
- scanning
- extracting
- review required
- confirmed
- rejected
- failed
- deleting

## Interaction rules

- One question visible as the current primary question.
- Preserve chronological transcript.
- Disable duplicate submit while pending.
- On network failure, offer retry with same idempotency key.
- Distinguish transient error from terminal failure.
- Pause/resume must call API and render returned state.
- Completion must be confirmed when it irreversibly ends the session.
- Report evidence opens the corresponding answer/question.
- AI disclosure and consent visible at the right point, not buried in terms.

## Accessibility

- Full keyboard navigation.
- Focus management on question changes and dialogs.
- Announce processing and error state with accessible live regions.
- Do not rely on color alone for state.
- Provide text controls and captions for voice.
- Respect reduced motion.
- Maintain readable contrast and responsive layout.
