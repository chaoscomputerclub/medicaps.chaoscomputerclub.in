# 01 — UX and Frontend Requirements

## 1. Design direction

Keep the existing dark visual language and sidebar. Preserve working layout primitives and design tokens. The experience should be simple, compact, and immediately actionable. Do not add complex setup steps or expose ML/graph terminology to candidates.

## 2. Interview Arena landing page

Recommended order:

1. **Header:** `AI Interview Arena` and one-line description.
2. **Resume action:** `Upload resume` / uploaded-resume status. This is optional.
3. **Technical interviews:** cards for published tracks.
4. **Other rounds:** HR and Behavioral cards.
5. **Interview history:** recent sessions and links to reports.

Remove:
- `New Interview` or any equivalent custom interview action.
- Empty or non-functional `Curated Track Disciplines` section.
- Generic start button that does not identify an interview.
- Candidate-facing graph/ML configuration.
- Unnecessary multi-step configuration wizard.

## 3. Track card

Each card should contain:
- Track name.
- Short description.
- Optional level/duration metadata when defined by the blueprint.
- Published/available state.
- One clear action: `Practice`.

Do not show a card if no active published blueprint is available. If a catalog category is empty, hide it or show a purposeful empty state rather than a broken placeholder.

## 4. Track detail

Keep this screen concise:
- Track title and description.
- What it covers (topics from the blueprint's public metadata).
- Round type (Technical, HR, Behavioral, System Design, etc.).
- Duration or question count only if configured.
- Resume context indicator if a processed resume is available.
- `Start interview` action.

Do not allow the candidate to modify graph nodes, rubrics, difficulty policies, or question-generation instructions.

## 5. Resume upload interaction

- Accept PDF and DOCX, subject to configured size limits.
- Show file name, upload progress, processing state, success, or actionable failure.
- Allow retry and replacement.
- Explain briefly that resume context personalizes questions but does not guarantee that listed skills are accepted as proven.
- Do not block ordinary practice when no resume exists.
- Do not start an interview against a partially processed resume unless the product explicitly supports a safe degraded mode.

## 6. Interview room

The interview room should show:
- Current question.
- Response input appropriate to the question type (text initially; voice/coding only if already supported or separately scoped).
- Submit/continue action.
- Progress indicator that does not reveal hidden evaluation logic.
- Connection/submission state.
- Clear recovery behavior for network errors.

Do not display the full internal graph or hidden scoring rubric to the candidate.

## 7. Results and history

Results should show:
- Overall assessment.
- Competency-level outcomes.
- Strengths and improvement areas.
- Evidence-linked feedback.
- Suggested topics for further practice.
- Clear distinction between observed answer performance and resume-derived context.

History states:
- In progress.
- Completed.
- Interrupted/expired.
- Failed (with retry or support guidance where appropriate).

## 8. Frontend state requirements

Model UI states explicitly:
- Catalog loading / loaded / empty / failed.
- Resume absent / uploading / processing / ready / failed.
- Session creating / ready / active / submitting / completed / interrupted / failed.
- Report loading / ready / failed.

Avoid optimistic navigation into an interview before the backend confirms session creation and returns a valid initial question or session state.
