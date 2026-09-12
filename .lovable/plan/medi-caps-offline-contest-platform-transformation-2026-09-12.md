# Medi-Caps Offline Contest Platform Transformation

## Goal
Transform the uploaded Medi-Caps Chapter portal into a production-grade, offline-first campus contest operations platform. Preserve the supplied CCC visual system and metallic logo while removing all browser-editor and generic problem-grinding behavior.

## Foundation and integration
- Import the uploaded application’s organization modules, shared controls, logo, and route structure into the current TanStack Start project without copying generated output or repository metadata.
- Adapt its SPA-only setup to the existing server-rendered TanStack Start shell, query client, route conventions, error boundaries, and generated route tree.
- Keep the locked visual language: void black surfaces, bone text, disciplined acid-lime states, hairline borders, 0–2px corners, Inter Tight, Inter, JetBrains Mono, and the single editorial easing curve.
- Load the required fonts through the document head and provide distinct metadata for every content route.
- Activate Lovable Cloud for durable institutional accounts, OTP enrollment, official contest records, attendance, result proofs, and certificate verification. Seed the requested realistic Medi-Caps records so the initial experience is complete.

## Phase 1 — Offline contest data architecture
- Replace online problem, code editor, queued submission, generic event, and mock member concepts with typed offline-domain models:
  - `OfflineContest`, `ContestProblem`, `ProblemTelemetry`, `ScoreboardEntry`, `Division`, `RatingTier`, `RatingHistoryPoint`, `TrustProof`, `CampusPass`, `AnnouncementFeedItem`, `OfflineBattleResult`, `Achievement`, and institutional member identity.
- Model exact campus details: departments, batches, PRN/enrollment hashes, venues, lab seats, check-in windows, air-gapped environments, proctors, divisions, rating thresholds, penalties, podiums, attendance, and proof status.
- Populate rich records for Chaos Arena: Season 02, Campus Clash: Winter Algothon, Fresher Induction Sprint ’26, and Lab Battle 04, including A–F telemetry and realistic ranking histories.
- Replace old API/query surfaces with offline contest, leaderboard, profile, announcements, registration, campus pass, and proof-verification queries.
- Add secure Cloud tables and row-level access rules for members, contests, problems, standings, rating history, attendance, announcements, campus passes, and trust proofs; keep privileged proof issuance server-side.

## Phase 2 — Specialized data graphics
- Build `RatingChart`: responsive SVG trajectory, smooth curve, division threshold guides, scrubber points, and accessible contest tooltips.
- Build `ScoreboardMatrix`: dense sticky columns, division switching, member/department/batch search, exact solve times, wrong-attempt penalties, unsolved cells, and first-AC markers.
- Build `ProofBadge` and proof inspector: certificate ID/hash entry, SHA-256 digest display, attendance stamp, proctor seal, immutable verification details, valid/invalid states, and copy controls.
- Build `CampusPassCard`: high-contrast printable/downloadable pass with member identity, PRN hash, venue, seat, check-in window, verification status, and scannable QR code.
- Build compact rating sparklines, activity heatmap, rating-tier badges, live countdown, and stat surfaces with restrained pointer telemetry and reduced-motion fallbacks.

## Phase 3 — Route overhaul

### `/portal`
- Deliver a command dashboard with a live on-premise ticker, countdown, lab allocation, check-in state, scoreboard action, rating/peak/rank/attendance strip, campus bulletin, editorial feed, and five-row recent battle matrix with proof hashes.

### `/portal/contests`
- Build live, upcoming, and archive views using URL-backed filters.
- Show division eligibility, campus date/check-in, venue, capacity, problem count, sponsor/prize data, registration, and entry-pass state.

### `/portal/contests/$contestSlug`
- Add the complete briefing bar, air-gapped toolchain rules, chief proctors, division switcher, instant search/filtering, problem metadata, and full CodeChef/LeetCode-style scoreboard telemetry.
- Keep problem sheets and editorials read-only after contests; never expose an in-browser code editor.

### `/portal/leaderboard`
- Implement 1★–5★ university tiers, semester/all-time switch, department and batch filters, rank movement, rating sparklines, streaks, podiums, and CCC Core tags.

### `/portal/verify`
- Add standalone certificate verification plus reusable modal inspection from hashes shown elsewhere.
- Verify certificate ID or digest against official proof records and clearly distinguish authentic, revoked, and unknown results.

### `/portal/profile`
- Build the member dossier with rating progression, current division benchmark, offline activity heatmap, achievement set, attendance history, verified results, and digital campus pass.

### `/portal/problems`
- Repurpose the list and detail views as a read-only archive of offline problem sheets and post-contest editorials, with contest provenance and no submission UI.

### `/login`, `/signup`, `/recover`
- Retain the industrial terminal treatment and metallic CCC identity.
- Add Medi-Caps PRN/enrollment validation, institutional email OTP, department/batch enrollment fields, and clear credential recovery states backed by Lovable Cloud.

### Shared portal shell
- Rework navigation around Operations, Contests, Leaderboard, Verify, Archives, and Dossier.
- Remove the developer-only fixture mode toggle and generic Events surface; route legacy event links cleanly to the contest schedule.
- Keep mobile navigation compact and make large matrices horizontally usable without compressing telemetry.

## Phase 4 — Production validation
- Confirm all buttons, tabs, filters, search, registration, proof inspection, QR/pass actions, OTP flows, and route transitions work.
- Validate desktop at 1440px, tablet at 768px, and mobile at 375px, including table overflow, sticky columns, chart tooltips, and text containment.
- Check semantic headings, keyboard focus, table labels, reduced motion, contrast, and downloadable/printable pass output.
- Verify every route’s title, description, Open Graph metadata, and social card metadata.
- Confirm logo and favicon return successfully, remove all online-editor language and forbidden dummy copy, run focused checks, and pass the project’s automated build/type validation.

## Technical notes
- Use TanStack Query loaders for initial route data and URL search parameters for shareable filters.
- Use existing design-system controls rather than raw interactive elements.
- Use Web Crypto/server-side hashing for digest verification; never issue trusted proofs solely in the browser.
- Preserve exact timestamp and penalty arithmetic as structured data rather than formatting it into fixtures.
- Keep the UI useful while data is pending, empty, invalid, or unavailable, with route-level error and not-found states.
