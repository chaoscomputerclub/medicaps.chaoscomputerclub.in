# Forensic Bug History & Regression Index

**Last Scanned:** 2026-10-05 06:23:47 UTC  
**Total Historical Bugs Identified:** `246`  
**Covered by Automated Tests:** `208` | **Regression Gaps:** `38`

## Summary by Severity

- 🔴 **CRITICAL:** 9
- 🟠 **HIGH:** 118
- 🟡 **MEDIUM:** 12
- ⚪ **LOW:** 107

## Historical Bug Index

| Bug ID | Commit | Severity | Category | Title | Test Status |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `REG-0001` | `cd7a74f` | **LOW** | `DEPLOYMENT` | fix(deploy): read VERSION from tracked backend/.env.example for remote env sync | ✅ COVERED |
| `REG-0002` | `d4c96e3` | **LOW** | `DEPLOYMENT` | fix(deploy): sync VERSION into production .env and perform systemctl restart | ✅ COVERED |
| `REG-0003` | `97ee49f` | **LOW** | `DEPLOYMENT` | fix(ci): ensure clean git sync on remote server during deployment | ✅ COVERED |
| `REG-0004` | `a967950` | **CRITICAL** | `CROSS_USER_LEAK` | feat(architecture): production state consistency, ACID, and concurrency hardenin | ✅ COVERED |
| `REG-0005` | `7dea5c2` | **HIGH** | `JUDGE_EXECUTION` | fix(judge): remove spurious stdout prefix from stderr on success, fix python nul | ✅ COVERED |
| `REG-0006` | `c4f1e8d` | **LOW** | `STATE_MANAGEMENT` | fix(judge): fix Rust runner f-string escaping and bump version to 1.0.3 | ✅ COVERED |
| `REG-0007` | `3c2c09c` | **LOW** | `STATE_MANAGEMENT` | fix(judge): unify multi-language FUNCTION contract, add typescript capability an | ✅ COVERED |
| `REG-0008` | `78055fd` | **HIGH** | `AUTH_SESSION` | fix(judge): rebuild multi-language execution pipeline and canonical runner proto | ✅ COVERED |
| `REG-0009` | `eeeccbc` | **HIGH** | `REQUEST_RACE` | fix(judge): harden all language adapters stdin parsing | ✅ COVERED |
| `REG-0010` | `7e27a42` | **HIGH** | `SSE_ORDERING` | fix(judge): harden JS/TS adapter stdin parsing for LeetCode param=value format | ✅ COVERED |
| `REG-0011` | `e49f6ad` | **HIGH** | `DISTRIBUTED_EXECUTION` | fix(judge): remediate distributed execution contract, source partitioning, and v | ✅ COVERED |
| `REG-0012` | `35c29d6` | **LOW** | `PERFORMANCE` | fix(router): accurately record queue latency upon claim rather than completion | ✅ COVERED |
| `REG-0013` | `6575876` | **LOW** | `DISTRIBUTED_EXECUTION` | fix(node-agent): mount tmpfs with exec and ensure executable permissions on comp | ✅ COVERED |
| `REG-0014` | `f24003d` | **HIGH** | `DISTRIBUTED_EXECUTION` | fix(node-agent): prevent slot pre-acquisition deadlock during long polling and a | ✅ COVERED |
| `REG-0015` | `3044e4c` | **HIGH** | `SSE_ORDERING` | feat(judge): enable production node-agent compute daemon with compilation cache  | ✅ COVERED |
| `REG-0016` | `29069d0` | **HIGH** | `DISTRIBUTED_EXECUTION` | fix(judge): remediate Codebox compilation bottleneck, telemetry attribution & bo | ✅ COVERED |
| `REG-0017` | `0dea5c3` | **HIGH** | `DISTRIBUTED_EXECUTION` | fix(judge): fix batch poll budget cutoff and circuit-breaker timeout blindspot | ✅ COVERED |
| `REG-0018` | `a980030` | **HIGH** | `AUTH_SESSION` | perf(judge): eliminate ceil(N/4) batch latency via /submissions/batch API | ✅ COVERED |
| `REG-0019` | `d25d28e` | **HIGH** | `REQUEST_RACE` | fix(judge): enforce sandboxing policy on local engine and fallback to Codebox on | ✅ COVERED |
| `REG-0020` | `8d51417` | **HIGH** | `CACHE_INVALIDATION` | fix(judge): resolve Codebox bottleneck and eliminate synthetic telemetry attribu | ✅ COVERED |
| `REG-0021` | `1cf026d` | **HIGH** | `SSE_ORDERING` | feat(judge): language-aware execution pipeline with amortized compilation and to | ✅ COVERED |
| `REG-0022` | `cb9eafe` | **LOW** | `CACHE_INVALIDATION` | fix(perf): zero-lag SPA navigation, SWR cache hydration and runtime safety certi | ✅ COVERED |
| `REG-0023` | `dedff47` | **HIGH** | `STATE_MANAGEMENT` | fix(backend): resolve all latent undefined scope variables and missing imports a | ✅ COVERED |
| `REG-0024` | `aca8bfc` | **HIGH** | `AUTH_SESSION` | fix(backend): import settings in auth_service and seed_service to fix NameError  | ✅ COVERED |
| `REG-0025` | `9c35c9f` | **CRITICAL** | `TRANSACTION` | fix(ui): lock global loading eye to fixed 52px large size across static shell an | ✅ COVERED |
| `REG-0026` | `6618d97` | **LOW** | `STATE_MANAGEMENT` | fix(config): ensure optional string types with default values for core team sett | ✅ COVERED |
| `REG-0027` | `7641ee2` | **HIGH** | `AUTH_SESSION` | fix(auth): auto-elevate core team and chief proctor roster in require_admin_or_c | ✅ COVERED |
| `REG-0028` | `19bd12e` | **LOW** | `SCOREBOARD` | fix(deploy): use bash heredoc for remote deploy script and fix nullable displayR | ✅ COVERED |
| `REG-0029` | `dfb9d21` | **HIGH** | `SSE_ORDERING` | feat(ranking): establish single source of truth for cadet rankings, standings, a | ✅ COVERED |
| `REG-0030` | `5eae81b` | **MEDIUM** | `DISTRIBUTED_EXECUTION` | fix(judge): defensively clamp codebox memory and cpu limits to prevent 422 error | ✅ COVERED |
| `REG-0031` | `14af3bd` | **HIGH** | `AUTH_SESSION` | fix(auth): prevent multiple values TypeError for rating in AuthRepository.create | ✅ COVERED |
| `REG-0032` | `08e0dfc` | **MEDIUM** | `STATE_MANAGEMENT` | fix(core): add list_active and queue_depth methods to eliminate governor autosca | ⚠️ GAP |
| `REG-0033` | `132dfe9` | **HIGH** | `AUTH_SESSION` | fix(fabric): route arena run to node fabric and accept definitive node compilati | ✅ COVERED |
| `REG-0034` | `03f6938` | **HIGH** | `AUTH_SESSION` | fix(e2e): harden Playwright auth fixture routes and ScoreboardMatrix array safet | ✅ COVERED |
| `REG-0035` | `23ace14` | **HIGH** | `AUTH_SESSION` | test(e2e): mock leaderboard and sse event stream in Playwright auth fixture | ✅ COVERED |
| `REG-0036` | `52e6075` | **HIGH** | `SSE_ORDERING` | fix(backend): snapshot ORM attributes before rollback and wire node fabric archi | ✅ COVERED |
| `REG-0037` | `1ef2a5a` | **HIGH** | `AUTH_SESSION` | fix(db): revert invalid expire_on_rollback parameter | ⚠️ GAP |
| `REG-0038` | `4c12d2e` | **MEDIUM** | `AUTH_SESSION` | fix(db): add expire_on_rollback=False to AsyncSessionLocal | ⚠️ GAP |
| `REG-0039` | `602930c` | **MEDIUM** | `AUTH_SESSION` | fix(judge): universal semantic output comparison in Go node/judge agents | ✅ COVERED |
| `REG-0040` | `6eef59b` | **LOW** | `DISTRIBUTED_EXECUTION` | fix(fabric): handle null compile_output in distributed execution result schema | ✅ COVERED |
| `REG-0041` | `0e7c6e0` | **LOW** | `DISTRIBUTED_EXECUTION` | fix(fabric): isolate distributed execution queue to ccc:queue:fabric and harden  | ✅ COVERED |
| `REG-0042` | `ed051b9` | **HIGH** | `REQUEST_RACE` | feat(infra): end-to-end structured trace IDs (X-Request-ID, contextvar, job corr | ⚠️ GAP |
| `REG-0043` | `f58d733` | **MEDIUM** | `STATE_MANAGEMENT` | feat(infra): per-user judge job concurrency limit (max 3 in-flight per user) | ✅ COVERED |
| `REG-0044` | `3d87d3e` | **HIGH** | `AUTH_SESSION` | feat(infra): distributed execution platform — worker registry, resource governor | ✅ COVERED |
| `REG-0045` | `7094408` | **HIGH** | `JUDGE_EXECUTION` | perf(concurrency): harden database connection pool, request coalescing, and sand | ✅ COVERED |
| `REG-0046` | `287bd31` | **HIGH** | `SSE_ORDERING` | fix(perf): eliminate SSE broadcast feedback loop and debounce frontend realtime  | ✅ COVERED |
| `REG-0047` | `713a074` | **LOW** | `FRONTEND_RENDERING` | fix(ui): synchronize and sort portal page kickers and section indices | ⚠️ GAP |
| `REG-0048` | `b9e6fd6` | **LOW** | `FRONTEND_RENDERING` | feat(ui): premium UI/UX redesign and design system standardization | ⚠️ GAP |
| `REG-0049` | `67e0b84` | **CRITICAL** | `DATABASE_CONSISTENCY` | fix(ci): initialize postgresql schema in PR check and harden resource_versions i | ✅ COVERED |
| `REG-0050` | `35c7395` | **LOW** | `STATE_MANAGEMENT` | fix(dashboard): enhance responsive layout, prevent horizontal scroll, and contai | ✅ COVERED |
| `REG-0051` | `8d97b92` | **LOW** | `FRONTEND_RENDERING` | fix(ui): center modals in viewport and render questions with rich readme markdow | ⚠️ GAP |
| `REG-0052` | `db07150` | **LOW** | `STATE_MANAGEMENT` | fix(vite): point local dev server /api proxy to canonical domain https://medicap | ✅ COVERED |
| `REG-0053` | `6af0650` | **CRITICAL** | `DATABASE_CONSISTENCY` | fix(arena): resolve master problem ID and safely handle foreign keys when adding | ✅ COVERED |
| `REG-0054` | `efeff56` | **HIGH** | `STATE_MANAGEMENT` | fix(judge): resolve UnboundLocalError for ComparisonMode in contest execution se | ✅ COVERED |
| `REG-0055` | `28f4a5b` | **LOW** | `ROUTING` | fix(infra): auto-correct localhost FRONTEND_URL in production and sync stress te | ✅ COVERED |
| `REG-0056` | `28a193e` | **CRITICAL** | `DATABASE_CONSISTENCY` | fix(infra): isolate CI/CD deployment from production database, add safety guards | ✅ COVERED |
| `REG-0057` | `7d3da36` | **HIGH** | `AUTH_SESSION` | feat(judge,ui): isolate online judge execution pipeline and standardize global u | ✅ COVERED |
| `REG-0058` | `81e6ef5` | **HIGH** | `AUTH_SESSION` | Revert "feat: remediate Google OAuth verification requirements and establish pub | ⚠️ GAP |
| `REG-0059` | `2dac05d` | **LOW** | `BUILD` | Revert "feat(seo): prerender static HTML for privacy policy, terms, data deletio | ✅ COVERED |
| `REG-0060` | `a562373` | **HIGH** | `AUTH_SESSION` | feat: remediate Google OAuth verification requirements and establish public page | ⚠️ GAP |
| `REG-0061` | `a798a98` | **HIGH** | `RATING` | Revert "feat(rating): replace generic tier names with cool cyberpunk ranks in -- | ✅ COVERED |
| `REG-0062` | `ba3af15` | **HIGH** | `BUILD` | fix(contest): require explicit user consent for contest submission and resolve t | ✅ COVERED |
| `REG-0063` | `4072387` | **LOW** | `DEPLOYMENT` | fix(ci): add production safety guard to all mutating test scripts and eliminate  | ✅ COVERED |
| `REG-0064` | `4503512` | **HIGH** | `SSE_ORDERING` | feat(cache): production CacheSyncEngine — 27/27 adversarial tests passing | ✅ COVERED |
| `REG-0065` | `68561a2` | **HIGH** | `SSE_ORDERING` | feat(social): unify global follower/following telemetry and production resilienc | ✅ COVERED |
| `REG-0066` | `986526b` | **LOW** | `STATE_MANAGEMENT` | fix(contest): enforce zero-trust server validation and prevent instant summary r | ✅ COVERED |
| `REG-0067` | `7f7492e` | **HIGH** | `SSE_ORDERING` | fix(leaderboard): synchronize leaderboard states via strict SSE real-time stream | ✅ COVERED |
| `REG-0068` | `af39c27` | **HIGH** | `AUTH_SESSION` | fix(rating): sync verified RatingHistory ledger across leaderboard and invalidat | ✅ COVERED |
| `REG-0069` | `9daf504` | **LOW** | `BUILD` | fix(attendance): remove hardcoded 6 fallback and align official contest denomina | ✅ COVERED |
| `REG-0070` | `05d6e0a` | **LOW** | `CACHE_INVALIDATION` | fix(vite): isolate student and admin dev cacheDir and add resilient 3-tier lazy  | ✅ COVERED |
| `REG-0071` | `55fdec2` | **HIGH** | `RATING` | fix(contest): enforce single-attempt submission lock, sync ratings & attendance  | ✅ COVERED |
| `REG-0072` | `3dc42a3` | **HIGH** | `RATING` | fix(db): cascade deletion, foreign key constraints, and rating rollback across a | ✅ COVERED |
| `REG-0073` | `7211ba5` | **HIGH** | `SSE_ORDERING` | fix(contests): resolve duplicate LIVE NOW badge and manage completed state with  | ✅ COVERED |
| `REG-0074` | `39371ce` | **HIGH** | `SSE_ORDERING` | fix(contest): resolve arena 500 NameError, real-time SSE lifecycle sync, and are | ✅ COVERED |
| `REG-0075` | `89e0fbb` | **LOW** | `CACHE_INVALIDATION` | perf(navigation): lift prefetch to global delegated listener — covers all links | ⚠️ GAP |
| `REG-0076` | `4dbf716` | **LOW** | `FRONTEND_RENDERING` | fix(a11y): remove nested-interactive role from contest card and update E2E locat | ✅ COVERED |
| `REG-0077` | `d8f80cd` | **LOW** | `SCOREBOARD` | fix(a11y): upgrade ContestsHubPage card subtitles, rank badges, and tabs to text | ✅ COVERED |
| `REG-0078` | `3e245b0` | **HIGH** | `RATING` | fix(a11y): upgrade RatingChart, ScoreboardMatrix, and CampusPassCard empty state | ⚠️ GAP |
| `REG-0079` | `9019bcc` | **LOW** | `FRONTEND_RENDERING` | fix(a11y): upgrade Leaderboard cadet row names and hovercard labels to text-zinc | ✅ COVERED |
| `REG-0080` | `f7d82ec` | **LOW** | `BUILD` | ci(github): configure PR quality gate on all PR events and fix WCAG 2.2 AA color | ⚠️ GAP |
| `REG-0081` | `2ede91f` | **LOW** | `STATE_MANAGEMENT` | fix(ContestLobbyPage): memoize refreshDetail + onExpire to prevent infinite setS | ✅ COVERED |
| `REG-0082` | `23db681` | **LOW** | `STATE_MANAGEMENT` | fix(ContestOverviewPage): memoize onExpire callback to prevent infinite setState | ✅ COVERED |
| `REG-0083` | `4fe84e1` | **HIGH** | `CONTEST_LIFECYCLE` | feat(social): add universal cadet profile hover card and fix contest registratio | ✅ COVERED |
| `REG-0084` | `5e549d7` | **HIGH** | `STATE_MANAGEMENT` | fix(navigation): resolve inter-page and subpage navigation issues across portal | ✅ COVERED |
| `REG-0085` | `f3e8b0c` | **HIGH** | `CONTEST_LIFECYCLE` | fix(backend): seal problem titles, topics, and details in contest responses for  | ✅ COVERED |
| `REG-0086` | `bd40782` | **LOW** | `SCOREBOARD` | fix(contest): validate real-time backend state, fix waiting room lifecycle, seal | ✅ COVERED |
| `REG-0087` | `61a91a6` | **LOW** | `SCOREBOARD` | fix(contest): seal problems for upcoming, dynamic duration, hide standings befor | ✅ COVERED |
| `REG-0088` | `25e74ef` | **LOW** | `FRONTEND_RENDERING` | fix(a11y): elevate page size controls contrast to text-zinc-400 for WCAG AA comp | ⚠️ GAP |
| `REG-0089` | `4291d5e` | **LOW** | `FRONTEND_RENDERING` | fix(a11y): elevate text contrast to meet WCAG 2.2 AA standards on leaderboard | ✅ COVERED |
| `REG-0090` | `b97cbd5` | **HIGH** | `AUTH_SESSION` | fix(e2e): robust cadet session mocking and explicit timeouts for contest flow | ✅ COVERED |
| `REG-0091` | `0602411` | **LOW** | `STATE_MANAGEMENT` | feat(contests): enhance contest hub layout, fix podium avatar overlap, and optim | ✅ COVERED |
| `REG-0092` | `e55fe81` | **HIGH** | `AUTH_SESSION` | fix(auth): keep user logged in persistently with 30-day sessions, proactive keep | ⚠️ GAP |
| `REG-0093` | `2ff4bb5` | **LOW** | `STATE_MANAGEMENT` | revert(theme): remove theme toggling and theme preference features | ⚠️ GAP |
| `REG-0094` | `6f2bccd` | **LOW** | `STATE_MANAGEMENT` | fix(theme): add comprehensive light mode CSS mapping and fix ThemeToggler state  | ✅ COVERED |
| `REG-0095` | `5f41852` | **LOW** | `FRONTEND_RENDERING` | fix(ui): ensure Google sign-in button text remains white on hover | ✅ COVERED |
| `REG-0096` | `06b80fd` | **HIGH** | `AUTH_SESSION` | fix(turnstile): resolve site key dynamically from backend config and add timeout | ✅ COVERED |
| `REG-0097` | `51318b4` | **HIGH** | `AUTH_SESSION` | fix(auth): position Turnstile after submit button, remove green border, protect  | ✅ COVERED |
| `REG-0098` | `183eb6f` | **HIGH** | `AUTH_SESSION` | fix(auth): restore original Strix minimalist auth theme and refine Turnstile sty | ✅ COVERED |
| `REG-0099` | `872ddf7` | **HIGH** | `CONTEST_LIFECYCLE` | fix(contests): disable dev bypass and seal upcoming problems for all users | ✅ COVERED |
| `REG-0100` | `ae3f804` | **HIGH** | `AUTH_SESSION` | fix(frontend): make API base and asset resolution 100% dynamic via env and rever | ✅ COVERED |
| `REG-0101` | `3c5989c` | **HIGH** | `SSE_ORDERING` | fix(deploy): add --delete to frontend rsync to prevent stale asset accumulation | ✅ COVERED |
| `REG-0102` | `0735994` | **LOW** | `DEPLOYMENT` | ci: fix rsync ssh config path resolution in deploy pipeline | ✅ COVERED |
| `REG-0103` | `d32dd18` | **LOW** | `FRONTEND_RENDERING` | fix(ui): add bounds check in LightRays hexToRgb for strict type safety | ✅ COVERED |
| `REG-0104` | `b90f821` | **HIGH** | `REGISTRATION` | fix: resolve PR review items (section kickers, verify arena data-problem-panel a | ✅ COVERED |
| `REG-0105` | `b44d5a5` | **HIGH** | `JUDGE_EXECUTION` | fix(ts): resolve compiler diagnostic errors and strict type safety | ✅ COVERED |
| `REG-0106` | `8b4b4cb` | **LOW** | `STATE_MANAGEMENT` | fix: restore previous theme full height and width with zero unmount flash | ✅ COVERED |
| `REG-0107` | `991b347` | **LOW** | `STATE_MANAGEMENT` | fix: eliminate white flash by enabling premultipliedAlpha and removing WebGL con | ⚠️ GAP |
| `REG-0108` | `cafc57a` | **LOW** | `STATE_MANAGEMENT` | fix: eliminate white flash on exiting contest page by detaching canvas before We | ✅ COVERED |
| `REG-0109` | `a8f3c65` | **LOW** | `STATE_MANAGEMENT` | fix: use exact original ReactBits LightRays implementation and clean trophy disp | ⚠️ GAP |
| `REG-0110` | `7688cb9` | **LOW** | `STATE_MANAGEMENT` | fix: correct GLSL shader syntax and initialize LightRays on mount | ⚠️ GAP |
| `REG-0111` | `15e01d0` | **CRITICAL** | `TRANSACTION` | fix: prevent router lockup on contest page unmount by using React canvas ref | ✅ COVERED |
| `REG-0112` | `bcec2b6` | **CRITICAL** | `CROSS_USER_LEAK` | fix(perf): eliminate navigation lag, WebGL loop leaks, and redundant auth thunks | ⚠️ GAP |
| `REG-0113` | `7feff97` | **LOW** | `STATE_MANAGEMENT` | fix: enforce PRN uniqueness and filter onboarded cadets on leaderboard | ✅ COVERED |
| `REG-0114` | `d634f01` | **LOW** | `STATE_MANAGEMENT` | fix: canonical contest launcher for Weekly 1 and Biweekly 1 with live timers | ✅ COVERED |
| `REG-0115` | `57ed1cc` | **MEDIUM** | `FRONTEND_RENDERING` | fix(ui): eliminate skeleton overflow and pixel-match all page skeletons | ⚠️ GAP |
| `REG-0116` | `a26b4d1` | **LOW** | `STATE_MANAGEMENT` | feat: redefine TRD, PRD, README and refactor to unified CP contest architecture  | ⚠️ GAP |
| `REG-0117` | `f336997` | **HIGH** | `RATING` | fix: replace 1200 elo with email address in portal sidebar | ⚠️ GAP |
| `REG-0118` | `4f2c30a` | **LOW** | `AUTH_SESSION` | fix: throw user outside portal on logout and ensure responsive navigation | ⚠️ GAP |
| `REG-0119` | `13af684` | **HIGH** | `SCOREBOARD` | fix: resolve standing and rank inconsistency for cadets with zero attended conte | ✅ COVERED |
| `REG-0120` | `d2e66a3` | **HIGH** | `STATE_MANAGEMENT` | fix: prevent leaking current user email when viewing another cadet profile | ✅ COVERED |
| `REG-0121` | `1530e2c` | **HIGH** | `SCOREBOARD` | fix: unify rank telemetry and resolve avatar persistence in database | ⚠️ GAP |
| `REG-0122` | `af27ab6` | **HIGH** | `CACHE_INVALIDATION` | fix: resolve profile hydration, SWR cache poisoning, and name/handle formatting | ✅ COVERED |
| `REG-0123` | `ab2d96f` | **HIGH** | `AUTH_SESSION` | perf(frontend): 69% bundle reduction, instant zero-JS bootloader, split vendor-c | ✅ COVERED |
| `REG-0124` | `02a3909` | **MEDIUM** | `STATE_MANAGEMENT` | fix(qa): completely remove email dispatch and verification from GSD pipeline, re | ✅ COVERED |
| `REG-0125` | `bc1b2f3` | **HIGH** | `AUTH_SESSION` | fix(auth): resolve login latency and server connection dropouts | ✅ COVERED |
| `REG-0126` | `8ea063e` | **HIGH** | `AUTH_SESSION` | fix: auth UI — suppress duplicate outer focus-visible outline on inputs to enfor | ✅ COVERED |
| `REG-0127` | `1e538a3` | **HIGH** | `AUTH_SESSION` | fix: auth UI — eliminate cutting effect by removing clipping overflow and fix do | ✅ COVERED |
| `REG-0128` | `d1ab607` | **HIGH** | `AUTH_SESSION` | fix: auth smooth card height/width morphing and eliminate transition flash on su | ✅ COVERED |
| `REG-0129` | `8e9451b` | **HIGH** | `AUTH_SESSION` | fix: auth OTP single lime border (remove double ring) + smoother 380ms transitio | ✅ COVERED |
| `REG-0130` | `8c4d267` | **HIGH** | `STATE_MANAGEMENT` | fix(profile): populate battles, history, proofs, achievements and resolve enroll | ⚠️ GAP |
| `REG-0131` | `ba8fb47` | **MEDIUM** | `STATE_MANAGEMENT` | fix(profile): guard null member in ProfilePage to prevent runtime error | ✅ COVERED |
| `REG-0132` | `7f106dc` | **HIGH** | `SSE_ORDERING` | fix(assessment): import ScoreboardEntry in assessment_controller and Tuple in ha | ✅ COVERED |
| `REG-0133` | `4efcaec` | **MEDIUM** | `STATE_MANAGEMENT` | fix(judge): prepend ts-nocheck in typescript harness to eliminate TS7006 error | ✅ COVERED |
| `REG-0134` | `0bf1115` | **HIGH** | `JUDGE_EXECUTION` | fix(judge): comprehensive multi-language harness upgrade, compiler diagnostics & | ✅ COVERED |
| `REG-0135` | `65c8aba` | **LOW** | `DISTRIBUTED_EXECUTION` | fix(judge): eliminate reflection in Java harness for CodeBox sandbox compliance | ✅ COVERED |
| `REG-0136` | `485b0c9` | **LOW** | `STATE_MANAGEMENT` | fix: strictly restore original pitch black theme while retaining VS Code typogra | ✅ COVERED |
| `REG-0137` | `87e3dbb` | **MEDIUM** | `STATE_MANAGEMENT` | fix: trust API difficulty field directly; drop inaccurate points-based override  | ✅ COVERED |
| `REG-0138` | `9fc2e54` | **LOW** | `STATE_MANAGEMENT` | fix(arena): remove static mock stats and eliminate duplicate bottom run/submit b | ✅ COVERED |
| `REG-0139` | `bc420c4` | **LOW** | `STATE_MANAGEMENT` | fix: strictly remove sidebar from contest summary and apply microservice archite | ✅ COVERED |
| `REG-0140` | `4335580` | **HIGH** | `AUTH_SESSION` | fix: remove hardcoded physical gate checkin and accurately handle arena auth and | ✅ COVERED |
| `REG-0141` | `3f8f13b` | **LOW** | `STATE_MANAGEMENT` | fix: enforce strict problem function name matching in judge harness (anti-cheat) | ✅ COVERED |
| `REG-0142` | `094cae6` | **LOW** | `STATE_MANAGEMENT` | fix: harness polymorphic support for class Solution and standalone functions | ✅ COVERED |
| `REG-0143` | `ea47b9e` | **LOW** | `STATE_MANAGEMENT` | fix: align leetcode problem function naming and types across all 6 languages | ✅ COVERED |
| `REG-0144` | `07ae4e6` | **LOW** | `CACHE_INVALIDATION` | fix: purge legacy template cache in arena and ensure LeetCode function starters  | ✅ COVERED |
| `REG-0145` | `7248376` | **LOW** | `STATE_MANAGEMENT` | fix: remove black background pill from problem points | ⚠️ GAP |
| `REG-0146` | `c0b6de8` | **HIGH** | `SCOREBOARD` | fix: restore scoreboard trophy logo visibility and revert problem points backgro | ✅ COVERED |
| `REG-0147` | `578e09d` | **LOW** | `ROUTING` | fix: monaco code editor bundled loading, leetcode styled problem routes and aren | ✅ COVERED |
| `REG-0148` | `c6826af` | **LOW** | `BUILD` | fix: lobby buttons lime hover and button icon logo spacing | ⚠️ GAP |
| `REG-0149` | `076d720` | **LOW** | `STATE_MANAGEMENT` | fix: switch secondary buttons to lime hover with black text for consistency | ⚠️ GAP |
| `REG-0150` | `4015039` | **LOW** | `FRONTEND_RENDERING` | fix: eliminate all white-on-lime button hover contrast issues site-wide | ⚠️ GAP |
| `REG-0151` | `3d0b120` | **LOW** | `STATE_MANAGEMENT` | fix: restore button variants, fix hover contrast at call sites only | ✅ COVERED |
| `REG-0152` | `44063d5` | **LOW** | `STATE_MANAGEMENT` | fix: bypass submitted state in dev mode and update contest lobby copy | ✅ COVERED |
| `REG-0153` | `b336f2c` | **HIGH** | `AUTH_SESSION` | fix: zero skeleton flash on reload — SWR sessionStorage hydration before Redux r | ✅ COVERED |
| `REG-0154` | `b6fe4ab` | **LOW** | `STATE_MANAGEMENT` | revert: revert button white text and hover consistency commit b5bae66 | ⚠️ GAP |
| `REG-0155` | `72c277e` | **HIGH** | `FRONTEND_RENDERING` | Revert "fix(ui): eliminate white text on lime buttons globally and enforce consi | ✅ COVERED |
| `REG-0156` | `b5bae66` | **LOW** | `FRONTEND_RENDERING` | fix(ui): eliminate white text on lime buttons globally and enforce consistency | ✅ COVERED |
| `REG-0157` | `24c89a9` | **LOW** | `STATE_MANAGEMENT` | fix: style profile page settings button with transparent default and lime-black  | ⚠️ GAP |
| `REG-0158` | `f2accc3` | **LOW** | `STATE_MANAGEMENT` | fix: clean dashboard and contest content to pure LeetCode open format | ✅ COVERED |
| `REG-0159` | `ae82323` | **LOW** | `STATE_MANAGEMENT` | fix(contest): include server_time in get_contest_arena_data response dictionary | ⚠️ GAP |
| `REG-0160` | `f347010` | **LOW** | `STATE_MANAGEMENT` | fix(scripts): ensure models are imported before drop/create in reset_and_seed_db | ✅ COVERED |
| `REG-0161` | `1d0f990` | **HIGH** | `AUTH_SESSION` | fix(auth): remove duplicate-creating self-heal + fix is_new_user + stop onboardi | ✅ COVERED |
| `REG-0162` | `16e7411` | **HIGH** | `RATING` | fix(frontend): add lazyWithRetry and auto-reload recovery for dynamic chunk impo | ✅ COVERED |
| `REG-0163` | `a7a7f6b` | **MEDIUM** | `PERFORMANCE` | perf(platform): apply pagination, lazy loading, and concurrency chunking across  | ✅ COVERED |
| `REG-0164` | `807990c` | **LOW** | `STATE_MANAGEMENT` | fix(portal): harden client-side data layer, normalize problem indexes, and guard | ✅ COVERED |
| `REG-0165` | `1d0b563` | **HIGH** | `SSE_ORDERING` | fix(qa): increase default limit on /verify/proofs to 200, accept gate rejection, | ✅ COVERED |
| `REG-0166` | `8d99d0f` | **LOW** | `FRONTEND_RENDERING` | fix(qa): cascade cleanup SQLite child tables, add leaderboard limit/offset, and  | ✅ COVERED |
| `REG-0167` | `2911e7d` | **LOW** | `BUILD` | fix(qa): add admin GET problems endpoint + TrustProof explicit cleanup + QA scri | ✅ COVERED |
| `REG-0168` | `038d41d` | **HIGH** | `FRONTEND_RENDERING` | fix(qa): resolve cadet dedup UNIQUE crash + rewrite 500-case QA suite with verif | ✅ COVERED |
| `REG-0169` | `9dd7cf6` | **LOW** | `STATE_MANAGEMENT` | fix(qa): safely deduplicate and merge primary cadet profile during tournament si | ✅ COVERED |
| `REG-0170` | `daa34b0` | **HIGH** | `AUTH_SESSION` | fix(auth): resilient OTP delivery fallback when external SMTP relay is unavailab | ✅ COVERED |
| `REG-0171` | `287c09a` | **HIGH** | `AUTH_SESSION` | fix(auth): add ENVIRONMENT setting, safe getattr, and global exception CORS fall | ✅ COVERED |
| `REG-0172` | `8588073` | **HIGH** | `AUTH_SESSION` | fix(auth): proctor key bypass for live contest eligibility middleware | ✅ COVERED |
| `REG-0173` | `5b2e46b` | **HIGH** | `AUTH_SESSION` | fix(auth): proctor key bypass for live contest eligibility middleware | ✅ COVERED |
| `REG-0174` | `c165763` | **LOW** | `STATE_MANAGEMENT` | fix(admin): collision-free PRN generation for 100-cadet simulation and strict ga | ✅ COVERED |
| `REG-0175` | `2e70cba` | **HIGH** | `CACHE_INVALIDATION` | fix(admin-api): resolve delete_cache_pattern import and add time_limit auto-norm | ✅ COVERED |
| `REG-0176` | `0946898` | **LOW** | `STATE_MANAGEMENT` | fix(contests): keep live contests visible in lobby, remove --force purge from sy | ✅ COVERED |
| `REG-0177` | `f3e31ed` | **LOW** | `STATE_MANAGEMENT` | fix: clean lifespan shutdown in backend and update live admin bundles | ✅ COVERED |
| `REG-0178` | `1828537` | **HIGH** | `REGISTRATION` | fix: prevent repeated registration by persisting registered state in contest lis | ✅ COVERED |
| `REG-0179` | `a77a60a` | **HIGH** | `RATING` | fix: remove hardcoded +38 rating mock, wire dynamic rating_delta and truthful co | ✅ COVERED |
| `REG-0180` | `aa7c161` | **HIGH** | `CACHE_INVALIDATION` | fix: auto-refresh user profile on mount, sanitize enrollment numbers from name d | ✅ COVERED |
| `REG-0181` | `36f8225` | **LOW** | `DEPLOYMENT` | fix: preserve production database in rsync and handle unset full_name banner in  | ✅ COVERED |
| `REG-0182` | `bb2c9e7` | **CRITICAL** | `TRANSACTION` | fix: import Lock icon from lucide-react in ContestsHubPage to prevent TypeError  | ✅ COVERED |
| `REG-0183` | `0062683` | **HIGH** | `SSE_ORDERING` | fix: strict 24h assessment window and Top 30 only QR pass gating | ✅ COVERED |
| `REG-0184` | `e98c107` | **LOW** | `STATE_MANAGEMENT` | fix: canonical Wednesday 3:00-4:30 PM contest schedule with strictly immutable t | ✅ COVERED |
| `REG-0185` | `44b6e68` | **LOW** | `CACHE_INVALIDATION` | fix: cache invalidation on profile updates and prevent enrollment IDs as names | ✅ COVERED |
| `REG-0186` | `d73f6b9` | **HIGH** | `AUTH_SESSION` | fix: stop setting capitalized enrollment ID as student full_name in auth middlew | ✅ COVERED |
| `REG-0187` | `e710667` | **HIGH** | `STATE_MANAGEMENT` | fix: remove PRN terminology in favor of Medi-Caps Enrollment Number and resolve  | ✅ COVERED |
| `REG-0188` | `5169edd` | **HIGH** | `STATE_MANAGEMENT` | fix: remove stale profilePrefs JSX references causing runtime crash in ProfilePa | ✅ COVERED |
| `REG-0189` | `a22e231` | **HIGH** | `RATING` | fix: production-grade contest lifecycle — arena auto-close overlay, auto-finish  | ✅ COVERED |
| `REG-0190` | `db88354` | **LOW** | `STATE_MANAGEMENT` | fix(seed): ensure models are initialized before purge and create Weekly Contest  | ✅ COVERED |
| `REG-0191` | `2a281a7` | **HIGH** | `AUTH_SESSION` | fix(auth): enforce persistent session storage, 30d token expiry, and resilient m | ✅ COVERED |
| `REG-0192` | `0808133` | **HIGH** | `AUTH_SESSION` | fix(auth): log OTP and add dev mode fallback when SMTP provider is disabled | ✅ COVERED |
| `REG-0193` | `83203ac` | **LOW** | `STATE_MANAGEMENT` | fix(contest): strengthen cascade deletion and clean purge on contest recreation | ✅ COVERED |
| `REG-0194` | `23fa1ea` | **HIGH** | `SSE_ORDERING` | fix: enforce anti-reattempt guard and hide take assessment after submission | ✅ COVERED |
| `REG-0195` | `14dcf1e` | **LOW** | `BUILD` | fix: remove syncing text on profile follow button | ⚠️ GAP |
| `REG-0196` | `49eb6de` | **LOW** | `CACHE_INVALIDATION` | fix: real-time profile follow button feedback, toast alerts, and automatic SWR r | ⚠️ GAP |
| `REG-0197` | `6257708` | **LOW** | `FRONTEND_RENDERING` | fix: member follow toggle and add full UI button connectivity auditor | ⚠️ GAP |
| `REG-0198` | `e56fba2` | **LOW** | `BUILD` | fix(social): add atomic POST /social/toggle endpoint and connect toggleFollowThu | ✅ COVERED |
| `REG-0199` | `4b50f83` | **LOW** | `STATE_MANAGEMENT` | fix(social): real-time follow/followers synchronization, dual drawer counters, a | ✅ COVERED |
| `REG-0200` | `b46895f` | **MEDIUM** | `ROUTING` | fix(qa): add ErrorBoundary, sanitize profile routes, and expand QA test suite to | ✅ COVERED |
| `REG-0201` | `692d524` | **LOW** | `FRONTEND_RENDERING` | fix(profile): fix React hooks order in ProfilePage and expand comprehensive QA t | ✅ COVERED |
| `REG-0202` | `2157a32` | **LOW** | `BUILD` | fix(social): real-time following count synchronization and automatic following I | ✅ COVERED |
| `REG-0203` | `e2e9e72` | **LOW** | `STATE_MANAGEMENT` | fix(social): robust payload normalization in socialSlice and handle resolution i | ✅ COVERED |
| `REG-0204` | `621027f` | **HIGH** | `RATING` | fix(profile): make RatingDistributionCard props optional and safe against undefi | ✅ COVERED |
| `REG-0205` | `3e9072e` | **HIGH** | `AUTH_SESSION` | fix(auth): import Optional and typing symbols in auth_controller | ✅ COVERED |
| `REG-0206` | `5691ce1` | **LOW** | `STATE_MANAGEMENT` | docs(gsd): record 100% API QA test audit report and fix frontend server reflecti | ✅ COVERED |
| `REG-0207` | `4f91bb7` | **LOW** | `STATE_MANAGEMENT` | fix: correct MemberProfile init and import timedelta in QA test service | ✅ COVERED |
| `REG-0208` | `4e0d4ac` | **CRITICAL** | `DATABASE_CONSISTENCY` | fix: import missing schemas in dynamic contest service | ✅ COVERED |
| `REG-0209` | `1f4b697` | **LOW** | `STATE_MANAGEMENT` | fix: ensure db flush before problem recounting in dynamic contest service | ✅ COVERED |
| `REG-0210` | `56318da` | **LOW** | `STATE_MANAGEMENT` | fix: format starter code templates in dynamic contest service | ✅ COVERED |
| `REG-0211` | `e77bd06` | **LOW** | `ROUTING` | fix(api): update API base URL to active live backend endpoint | ✅ COVERED |
| `REG-0212` | `1095974` | **LOW** | `STATE_MANAGEMENT` | fix(db): purge test cadet accounts and auto-clean test funnel runner | ✅ COVERED |
| `REG-0213` | `1c58edc` | **HIGH** | `REQUEST_RACE` | feat(gsd): add grace period for FastAPI startup and complete GSD sync automation | ✅ COVERED |
| `REG-0214` | `65260be` | **HIGH** | `AUTH_SESSION` | fix(auth): harden session persistence, JWT base64url decoding, and prevent auto- | ✅ COVERED |
| `REG-0215` | `13a1f23` | **HIGH** | `RATING` | fix(middleware): allow public development access to dev-* contests in contest_el | ✅ COVERED |
| `REG-0216` | `216a5cd` | **HIGH** | `STATE_MANAGEMENT` | fix: correctly identify Time Limit Exceeded when timeout exits with signal 15 | ✅ COVERED |
| `REG-0217` | `3982a52` | **HIGH** | `FRONTEND_RENDERING` | test: add comprehensive core engine test suite & fix resource bugs | ✅ COVERED |
| `REG-0218` | `a51c61d` | **HIGH** | `JUDGE_EXECUTION` | chore(engine): increase sandbox memory limits to 1024m for concurrency | ✅ COVERED |
| `REG-0219` | `54bfdef` | **HIGH** | `JUDGE_EXECUTION` | fix(docker-sandbox): properly wrap compile commands in timeout and polish verdic | ✅ COVERED |
| `REG-0220` | `1d6198c` | **HIGH** | `AUTH_SESSION` | feat: production backend hardening | ⚠️ GAP |
| `REG-0221` | `616f594` | **LOW** | `AUTH_SESSION` | fix: block re-entry after assessment is submitted | ✅ COVERED |
| `REG-0222` | `992dfd9` | **HIGH** | `SSE_ORDERING` | fix(seed): anchor Round 1 window so 10s countdown opens assessment for 24 hours | ⚠️ GAP |
| `REG-0223` | `6b9d48f` | **HIGH** | `STATE_MANAGEMENT` | fix(types): resolve alt prop type mismatch in PortalShell AvatarImage | ✅ COVERED |
| `REG-0224` | `0719d2a` | **HIGH** | `STATE_MANAGEMENT` | fix(types): resolve TypeScript nullability errors in AvatarImage and Tabs compon | ✅ COVERED |
| `REG-0225` | `735acf3` | **LOW** | `FRONTEND_RENDERING` | fix(ui): update global font to Open Sans, adjust medium font size, and fix green | ✅ COVERED |
| `REG-0226` | `8142240` | **HIGH** | `SSE_ORDERING` | fix(backend): correct CampusPass and Assessment column queries in eligibility se | ✅ COVERED |
| `REG-0227` | `79083b2` | **LOW** | `AUTH_SESSION` | fix(backend): fix AssessmentSession attribute access to total_score | ✅ COVERED |
| `REG-0228` | `15c03cd` | **HIGH** | `SSE_ORDERING` | fix(contests): hide results for upcoming contests, enforce 24h assessment unlock | ✅ COVERED |
| `REG-0229` | `b6ea832` | **HIGH** | `SSE_ORDERING` | fix(assessment): normalize testcase stdin/input schema and refresh demo problem  | ✅ COVERED |
| `REG-0230` | `532ad55` | **HIGH** | `REQUEST_RACE` | fix(db): safeguard init_db against multi-worker concurrent table creation race i | ✅ COVERED |
| `REG-0231` | `4ae3ef9` | **LOW** | `SCOREBOARD` | fix(leaderboard): audit and eliminate static fallbacks and fake rank oscillation | ✅ COVERED |
| `REG-0232` | `8b9412d` | **LOW** | `FRONTEND_RENDERING` | style: keep background grid fixed and add 30% black overlay | ⚠️ GAP |
| `REG-0233` | `b865e25` | **LOW** | `SCOREBOARD` | fix: hide rank and percentile for users with zero attendance | ✅ COVERED |
| `REG-0234` | `d394fb0` | **LOW** | `STATE_MANAGEMENT` | revert(leaderboard): restore original first version with 8-column layout, filter | ✅ COVERED |
| `REG-0235` | `71786ae` | **HIGH** | `RATING` | fix(leaderboard): enforce fixed table layout, align trend sparkline directly ben | ✅ COVERED |
| `REG-0236` | `42c0816` | **LOW** | `STATE_MANAGEMENT` | fix(leaderboard): remove erroneous question mark badges, restore clean name layo | ✅ COVERED |
| `REG-0237` | `a1571c5` | **HIGH** | `AUTH_SESSION` | style(auth): restore original high-impact heading, hairline divider, and fix Goo | ✅ COVERED |
| `REG-0238` | `46c4503` | **LOW** | `BUILD` | fix(backend): mount social.router with settings.API_PREFIX in main.py | ✅ COVERED |
| `REG-0239` | `9d7d181` | **LOW** | `STATE_MANAGEMENT` | fix(navigation): enforce exact active tab matching in PortalShell to prevent dua | ✅ COVERED |
| `REG-0240` | `a5c27d0` | **HIGH** | `AUTH_SESSION` | fix(portal): resolve SSR UNAUTHORIZED crash and provide complete profile telemet | ✅ COVERED |
| `REG-0241` | `a494d5b` | **HIGH** | `AUTH_SESSION` | fix(auth): preserve transactionId in Redux state upon sendOtp fulfillment | ✅ COVERED |
| `REG-0242` | `36e3a52` | **HIGH** | `AUTH_SESSION` | fix(auth): support dual OTP verification schemas (transaction_id+otp and email+c | ✅ COVERED |
| `REG-0243` | `70ef700` | **HIGH** | `AUTH_SESSION` | fix(auth): resolve isMedicapsEmail runtime reference error and redesign cyber pe | ✅ COVERED |
| `REG-0244` | `0ffb6ff` | **LOW** | `STATE_MANAGEMENT` | fix(email): harden template against mobile/tablet Gmail dark mode inversion and  | ✅ COVERED |
| `REG-0245` | `6a438ac` | **HIGH** | `BUILD` | fix(email): resolve Gmail rendering inconsistencies and dark mode inversions | ✅ COVERED |
| `REG-0246` | `pending` | **HIGH** | `STATE_MANAGEMENT` | fix(stats): eliminate phantom contest 0/1 attendance metric when zero contests exist | ✅ COVERED |

