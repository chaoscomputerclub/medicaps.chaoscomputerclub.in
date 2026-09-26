<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

# ⚡ DEVELOPMENT & DEPLOYMENT PROTOCOL (GITHUB CI/CD)

## 1. Automated GitHub Actions CI/CD Pipeline
- **Pull Request & CI Quality Gate (`.github/workflows/pr_check.yml`)**:
  - Automatically triggered on all pushes and PRs targeting `main` and on `workflow_dispatch`.
  - Runs 3 parallel verification gates:
    1. **Frontend Gate**: TypeScript type check (`tsc --noEmit`), Vite production build (`npm run build`), and 100% interactive button & backend connectivity audit.
    2. **Playwright E2E & A11y Gate**: Headless Chromium running all 17 E2E tests (including full platform inter-navigation suite), WCAG 2.2 AA accessibility audits, and runtime error boundary sentinel. Reports uploaded as job artifacts.
    3. **Backend QA & Contract Gate**: Ephemeral PostgreSQL 16 & Redis 7 service containers executing the 51-endpoint API contract QA suite, dynamic contest lifecycle tests, webhook/SSE pub-sub tests, and strict QR gate security tests.
- **Production Deployment Pipeline (`.github/workflows/deploy.yml`)**:
  - Pushing to `origin/main` automatically triggers GitHub CI/CD:
    - Compiles the Student Portal (`npm run build`).
    - Connects to the production server via SSH, pulls updates, syncs backend code, and restarts services.
    - Deploys production web bundles, reloads Nginx, and validates live health endpoints.
  - Agents and developers do **NOT** have to run slow local SSH deploys or wait on `./scripts/gsd_sync.sh`. Simply push commits to `main` when instructed, and GitHub handles the deployment asynchronously in the cloud.
  - Push only when instructed by the user or when features are tested and verified locally.

## 2. Core Engineering Principles
- **Bias for Action**: Directly investigate root causes and fix them completely.
- **Production Standard**: Zero placeholders, zero TODOs in user paths, resilient error handling.
- **Verification**: Run `npm run build` or relevant tests locally to verify code correctness.

## 3. Mandatory Frontend Standards: Anti-Slop & Web Interface Guidelines

> [!CRITICAL]
> **STRICT BAN ON INVENTED AI DESIGN PHILOSOPHIES**  
> All agents and developers working on this codebase are **strictly forbidden** from generating generic AI frontend "slop" or inventing personal design heuristics.  
> You MUST strictly adhere to the project's [**`DESIGN.md`**](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/DESIGN.md), **Taste Skill v2**, and the **Vercel Web Interface Guidelines**.

### 3.1 Design Read & Calibrated Dials
Before writing any frontend code, execute the one-line Design Read:
*"Reading this as: Cybersecurity & Competitive Programming Arena for Medi-Caps University students and proctors, with a tactical dark-terminal language, leaning toward Tailwind v4 + Radix + Geist Mono."*

Strictly apply the three calibrated dials:
- **`DESIGN_VARIANCE: 8`** — Asymmetrical bento grids, split-screen Monaco IDE, tactical telemetry monitors.
- **`MOTION_INTENSITY: 6`** — Snappy 150–200ms cubic-bezier transitions, GPU hardware-accelerated (`transform`, `opacity`), zero infinite distracting loops.
- **`VISUAL_DENSITY: 8`** — High information density, monospace tabular numerals (`tabular-nums`), compact telemetry badges.

### 3.2 The 7 Pillars of Frontend Execution
1. **Interactions:** Keyboard works everywhere (Tab/Enter/Esc). Visible focus rings on all controls (`:focus-visible` ring-2 ring-orange-500). Hit targets $\ge 24\text{px}$ on desktop, $\ge 44\text{px}$ on mobile. Never substitute `<a>`/`<Link>` with `<div>`/`<button>` for navigation.
2. **Animations:** Honor `prefers-reduced-motion`. NEVER use `transition: all`. Only animate GPU properties (`transform`, `opacity`).
3. **Layout & Safe Areas:** Optical alignment ($\pm 1\text{px}$). Respect mobile notches with `env(safe-area-inset-*)`. `overscroll-behavior: contain` on modals and editors.
4. **Content & Typography:** Tabular numbers for countdowns, ratings, memory stats, and rankings. Glued units with non-breaking spaces (`10&nbsp;MB`, `2.0&nbsp;s`, `⌘&nbsp;+&nbsp;K`). Typographic quotes (“ ”) and true ellipsis (`…`). All states designed (Loading, Empty, Error, Success).
5. **Forms:** Mobile input font size strictly $\ge 16\text{px}$ to prevent iOS Safari auto-zoom. Never block typing or paste. `Enter` submits single-field forms; `⌘/⌃ + Enter` submits in `<textarea>`. Labels linked via `htmlFor`.
6. **Depth & Polish:** Layered dual shadows. Crisp semi-transparent borders (`border-white/10`) over obsidian backgrounds (`#09090b` / `#18181b`). Nested concentric radii ($r_{\text{child}} = r_{\text{parent}} - \text{padding}$). `color-scheme: dark` on root `<html>`.
7. **Component Sourcing & Verification:** Sourcing UI primitives must rely on **Radix UI Primitives** and modern patterns from **21st.dev**. Validate rendering and accessibility via **Playwright CLI** (`npx @playwright/cli snapshot`).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
