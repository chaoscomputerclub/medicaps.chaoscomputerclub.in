# Two-Round Contest System UI

## Goal
Build a complete mock-driven contest experience that makes the platform’s defining journey unmistakable:

```text
Registration → Round 1 online assessment → ranked results → Top 30 cutoff
                                                        ├─ qualified → Round 2 logistics + QR pass
                                                        └─ not qualified → respectful result state
```

This pass is presentation-only. It will not add backend tables, scoring, judging, or real access enforcement.

## Pages and states

### Contests hub
- Replace generic contest rows with two-stage contest summaries.
- Show lifecycle states: registration open, assessment live, results pending, qualification announced, and offline round complete.
- Preserve URL-backed filtering and add a designed empty result.

### Contest overview
- Give the two-round format prominent visual weight.
- Present the complete timeline, eligibility, rules, prizes, and contextual next action.
- Include registered waiting and registration-confirmed states as calm, durable page content.

### Online assessment
- Add a focused assessment route using the existing portal/problem visual language.
- Design pre-start waiting room, active timed assessment, final-submit confirmation, and submitted state.
- Include persistent time remaining, problem navigation, response workspace, progress, and leave warning.
- Keep all interactions local and visual; no code runner or scoring engine will be introduced.

### Assessment results
- Add searchable, sortable, filterable standings.
- Pin the current user’s result above the full list.
- Insert a clear Top 30 qualification divider without visually punishing participants below it.
- Design results-pending, qualified, and not-qualified outcomes.

### Qualification milestone
- Add a dedicated qualification page with confirmation, next steps, and a route into Round 2 logistics.
- Keep the moment celebratory within the existing restrained CCC motion and color system.

### Offline round access and logistics
- Show event countdown, venue, date/time, arrival checklist, and operational notices.
- Qualified state includes the existing-style QR campus pass and seat/check-in details.
- Non-qualified and pending users see an informative locked state rather than an error page.

### My contests and settings
- Add a personal contest history showing assessment rank, score, and qualification outcome.
- Add settings with persistent sub-navigation for profile, notifications/connections/sessions, and danger zone.
- Username availability uses a debounced mock service and inline status feedback.

## Mock data contract
- Create a typed contest service module as the only source of contest UI data.
- Model contest lifecycle, two rounds, registration, assessment session, rankings, qualification, logistics, QR pass, personal history, and account settings.
- Expose asynchronous query functions with realistic response shapes and short mock latency.
- URL search parameters will select review states such as `waiting`, `live`, `submitted`, `pending`, `qualified`, `not-qualified`, and `locked`.
- Document the contract in the data module so a future API can implement the same interface.

## Shared implementation
- Reuse the existing `Button`, `Input`, `Select`, `Switch`, `Dialog`, table, and skeleton primitives.
- Add focused shared contest components for the two-stage indicator, timeline, state banner, result summary, cutoff row, and QR logistics pass.
- Extend the current semantic CSS tokens and sharp architectural patterns only; no new palette, typography, card language, or animation system.
- Update portal navigation for My Contests and Settings, with all referenced routes created together.

## Validation
- Verify every content route has unique metadata.
- Exercise all URL-driven states and key interactions in Chromium.
- Check desktop and mobile layouts, keyboard focus, overflow, layout stability, and browser console errors.
- Confirm the existing dashboard, problems, authentication, profile, leaderboard, and verification pages remain visually coherent.

## Decisions applied
- Every contest uses the full two-round format; no one-round variant in this pass.
- Round 2 uses a QR campus access pass.
- Review states are directly linkable through URL search parameters.
- The uploaded export is a visual/pattern reference only; its backend, Redux, judge engine, and raw hardcoded styling will not be copied.
