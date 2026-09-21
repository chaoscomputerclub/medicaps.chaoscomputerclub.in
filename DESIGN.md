# DESIGN.md — Chaos Computer Club (CCC) Medi-Caps Chapter Design System
<!-- Conforms to Google Stitch DESIGN.md Specification & Awesome DESIGN.md Standard -->
<!-- Powered by Taste Skill (Anti-Slop Framework) & Vercel Web Interface Guidelines -->

---

## 1. Visual Theme & Atmosphere

### 1.1 Mood & Atmosphere
The CCC Medi-Caps Chapter platform is a **high-precision competitive programming tournament arena and cybersecurity command center**, built on the **Strix AI Design Paradigm ([app.strix.ai](https://app.strix.ai))**.

- **Dominant Tone:** Pure pitch black canvas (`#000000`) paired with sharp, high-contrast **Electric Lime** accents (`#CCFF00` / `lime-400`) and crisp pure white (`#ffffff`).
- **Texture & Light:** Void-black surfaces with razor-thin hairline borders (`1px solid rgba(255,255,255,0.08)`). Zero muddy grey card backgrounds (`#18181b`, `#27272a`). Zero blurry glassmorphic overlays. Zero gradient meshes.
- **SaaS Micro-Radius Standard:** Micro-radius across all surfaces (`rounded-lg` 8px for containers/cards, `rounded-md` 6px for buttons/inputs, `rounded` 4px for status badges).

### 1.2 The Three Design Dials (Taste Skill Configuration)
Every frontend surface in this repository is governed by the three calibrated dials:

| Dial | Value (1-10) | Calibration Rationale |
| :--- | :---: | :--- |
| **`DESIGN_VARIANCE`** | **`7`** | Abstracted, disciplined layout: high signal-to-noise ratio, bento telemetry strips, surgical split-pane Monaco IDE, zero visual clutter. |
| **`MOTION_INTENSITY`** | **`5`** | Snappy 150ms transitions, hardware-accelerated GPU transforms (`transform`, `opacity`), live status pulse indicators, and zero gratuitous infinite-loop animations. |
| **`VISUAL_DENSITY`** | **`7`** | High-signal information density: tabular numeric leaderboards (`tabular-nums`), dense testcase matrices, and real-time execution statistics without bloated marketing filler. |

---

## 2. Color Palette & Semantic Roles

All colors are strictly mapped to semantic functional roles. Ad-hoc hex codes in components are strictly prohibited.

| Semantic Token | Hex Code | HSL / Tailwind | Functional Role |
| :--- | :--- | :--- | :--- |
| `--bg-canvas` | `#000000` | `black` | Primary viewport background (root layout) |
| `--bg-surface` | `#000000` | `black` | Top-level containers, sidebar shells, cards (pure pitch black) |
| `--bg-surface-elevated`| `#050505` | `zinc-950` | Sub-panels, code editor background |
| `--bg-surface-hover` | `#0f0f0f` | `zinc-900/60` | Hover highlight on secondary buttons and table rows |
| `--accent-brand` | `#CCFF00` | `lime-400` | Primary action buttons, active tab indicators, focus rings |
| `--accent-brand-hover` | `#d8ff33` | `lime-300` | Active/hover state for primary action buttons |
| `--accent-brand-subtle`| `rgba(204,255,0,0.08)`| `lime-400/8` | Active badges, selected list rows, subtle highlights |
| `--accent-cyan` | `#00e5ff` | `cyan-400` | Telemetry countdowns, SSE stream status |
| `--status-success` | `#CCFF00` | `lime-400` | Accepted (`AC`), checked-in campus pass, system operational |
| `--status-error` | `#ff3344` | `red-500` | Wrong Answer (`WA`), Runtime Error, disqualified session |
| `--status-warning` | `#f59e0b` | `amber-500` | Time Limit Exceeded (`TLE`), anti-cheat warning trigger |
| `--border-hairline` | `rgba(255,255,255,0.08)` | `white/8` | Standard card and container perimeter borders |
| `--border-active` | `rgba(255,255,255,0.18)` | `white/18` | Active input borders, table header dividers |
| `--border-accent` | `#CCFF00` | `lime-400` | Focused inputs, active contest phase outline |
| `--text-primary` | `#ffffff` | `white` | Headings, primary labels, code editor syntax foreground |
| `--text-secondary` | `#a1a1aa` | `zinc-400` | Subtitles, metadata labels, testcase parameters |
| `--text-muted` | `#71717a` | `zinc-500` | Timestamps, disabled control text, keyboard hints |

---

## 3. Typography Rules & Scale Hierarchy

### 3.1 Font Stack
- **Primary Interface:** `Geist Sans`, `Inter`, or `Outfit` — modern neo-grotesque sans-serif with optical kerning and tall x-height.
- **Monospace & Code:** `Geist Mono` or `JetBrains Mono` — crisp ligature support, distinct glyphs for `0`/`O` and `1`/`l`/`I`.

### 3.2 Typographic Rules (Vercel Guidelines Compliance)
1. **Tabular Numbers Everywhere:** Always apply `font-variant-numeric: tabular-nums` (or `font-mono`) to countdown timers, Elo ratings, scoreboard ranks, memory stats, and clock timestamps so numbers do not jump during updates.
2. **Non-Breaking Spaces (`&nbsp;`):** Glue units, shortcuts, and brand acronyms together: `10&nbsp;MB`, `2.0&nbsp;s`, `256&nbsp;MB`, `⌘&nbsp;+&nbsp;K`, `CCC&nbsp;Portal`.
3. **No Widows or Orphans:** Never leave a single word hanging on the last line of a modal description or challenge summary.
4. **Typographic Quotes:** Use curly quotes (“ ” and ‘ ’) instead of straight typewriter quotes (" ').
5. **Ellipsis Character:** Use the true single character `…` (`&#8230;`) for menus with follow-ups ("Rename…") and loading states ("Compiling…", "Submitting…"), never three periods `...`.

### 3.3 Typography Hierarchy

| Level | Size | Line Height | Weight | Tracking | Case | Semantic Tag |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Display** | 36px–44px | 1.15 | 800 (Bold) | `-0.03em` | Sentence Case | `<h1>` |
| **Section Title** | 22px–26px | 1.25 | 700 (Bold) | `-0.02em` | Title Case | `<h2>` |
| **Card Header** | 16px–18px | 1.35 | 600 (Semibold) | `-0.01em` | Title Case | `<h3>` |
| **Body (Default)** | 14px | 1.50 | 400 (Regular) | `normal` | Sentence Case | `<p>` |
| **Small / Metadata** | 12px | 1.40 | 500 (Medium) | `+0.01em` | Sentence Case | `<span>` |
| **Eyebrow / Badge** | 11px | 1.20 | 700 (Bold) | `+0.06em` | UPPERCASE | `<span>` |
| **Code / Tabular** | 13px | 1.45 | 500 (Medium) | `normal` | Mono | `<code>` |

---

## 4. Component Stylings & Specifications

### 4.1 Buttons & Interactive Controls
- **Hit Targets:** Minimum $24\text{px} \times 24\text{px}$ visual hit area on desktop; **minimum $44\text{px} \times 44\text{px}$** on touch/mobile devices.
- **Focus Rings:** Every button, link, and input MUST show a clear, visible `:focus-visible` ring (`ring-2 ring-lime-400 ring-offset-2 ring-offset-black`). Never suppress focus rings.
- **Zero Border Radius:** All buttons and interactive elements must have `rounded-none`.
- **Loading State Rule:** During an in-flight submission, the button MUST remain enabled until click, show an inline spinning indicator, and **preserve its original label** (e.g., `<Spinner /> Submitting…`).
- **Destructive Actions:** Actions that disqualify a cadet, reset a session, or revoke a campus pass MUST require explicit confirmation or provide an undo grace window.

```tsx
// Canonical Primary Button Pattern
<button 
  type="submit"
  disabled={isPending}
  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-black bg-lime-400 hover:bg-lime-300 active:bg-lime-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
>
  {isPending ? (
    <>
      <Loader2 className="w-4 h-4 animate-spin text-black" />
      <span>Submitting…</span>
    </>
  ) : (
    <span>Submit Solution</span>
  )}
</button>
```

### 4.2 Cards & Surface Containers
- **Zero Radius Standard:** Strictly `rounded-none` across all containers, cards, modals, and panels. No rounded corners.
- **Border Treatment:** Layer crisp semi-transparent borders `border border-white/10` over deep black surfaces to ensure sharp edge definition without muddy gradients.

### 4.3 Forms & Inputs
- **Mobile Input Font Size:** All `<input>` and `<textarea>` elements must have `font-size: 16px` (or `text-base` on mobile viewports) to prevent iOS Safari auto-zoom/pan on focus.
- **Never Block Typing or Paste:** Never block keystrokes or disable paste in inputs. Accept raw input and display inline validation messages.
- **Keyboard Submission:** Pressing `Enter` on single-field forms submits. In `<textarea>`, `⌘/⌃ + Enter` submits; `Enter` creates a new line.
- **Associated Labels:** Every control MUST be linked to an explicit `<label htmlFor="...">` so clicking the label focuses the input.
- **Error Placement:** Errors MUST appear directly beneath the offending input, with polite `aria-live="polite"` announcements.

---

## 5. Layout Principles & Spacing Scale

### 5.1 Grid & Spacing Scale
- **Base Grid:** Strictly 4px / 8px spacing rhythm (`p-2`, `p-4`, `p-6`, `gap-3`, `gap-6`).
- **Optical Alignment:** Adjust positioning by $\pm 1\text{px}$ when visual balance overrides pure geometric centers (e.g., play icons, chevrons, status dots).
- **Safe Area Insets:** Account for mobile notches and browser navigation chrome using CSS safe areas:
  ```css
  padding-bottom: env(safe-area-inset-bottom, 16px);
  padding-top: env(safe-area-inset-top, 16px);
  ```
- **No Excessive Scrollbars:** Modals and code editors must set `overscroll-behavior: contain` to prevent background scroll chaining.

---

## 6. Depth, Elevation & Surface Hierarchy

Elevation in the CCC Medi-Caps design system is achieved through **calibrated surface luminance and dual-layer lighting**, not blur shadows.

```css
/* Surface Elevation Tiers */
--elevation-0: #09090b; /* Viewport Canvas */
--elevation-1: #0f0f11; /* Section Containers, Sidebars */
--elevation-2: #18181b; /* Cards, Interactive Panels */
--elevation-3: #27272a; /* Floating Modals, Tooltips, Menus */

/* Crisp Dual-Layer Shadow System */
--shadow-card: 0 1px 2px 0 rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08);
--shadow-modal: 0 10px 30px -10px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.12);
```

---

## 7. Do's and Don'ts (The Anti-Slop Guardrails)

### ✅ DO
1. **DO honor `prefers-reduced-motion`:** Provide static or opacity-only transitions for motion-sensitive users.
2. **DO use tabular numbers:** Wrap all scores, timers, and standings in `font-mono tabular-nums`.
3. **DO deep-link everything:** Persist search filters, active tabs, and pagination in the URL query string (`?tab=arena&page=2`).
4. **DO design all states:** Every view must handle **Loading** (stable skeleton), **Empty** (clear CTA forward), **Error** (exit instructions), and **Populated**.
5. **DO use `<a>` or `<Link>` for navigation:** Never attach `onClick={() => navigate()}` to a `<div>` or `<button>` for URL transitions.

### ❌ DON'T
1. **DON'T `transition: all`:** NEVER write `transition: all`. Explicitly enumerate `transition-colors`, `transition-opacity`, or `transition-transform`.
2. **DON'T use AI-purple or blue mesh gradients:** The CCC brand is built on obsidian, amber-orange, and telemetry cyan.
3. **DON'T block copy or paste:** Cadets must be able to paste code stubs into the editor and copy problem statements freely.
4. **DON'T create dead zones:** If a card or control looks clickable, the entire perimeter must be interactive with a pointer cursor.
5. **DON'T ship placeholder UI:** Zero `TODO: implement`, zero disabled dummy buttons without tooltip explanations, and zero mock graphs.

---

## 8. Responsive Behavior & Touch Standards

| Viewport Breakpoint | Target Width | Layout Strategy | Touch Target Minimum |
| :--- | :--- | :--- | :---: |
| **Mobile (`sm`)** | `< 640px` | Single-column stack, bottom navigation, full-screen modals | **$\ge 44\text{px}$** |
| **Tablet (`md`)** | `640px – 1024px` | 2-column bento grid, collapsible drawer navigation | $\ge 36\text{px}$ |
| **Laptop / Desktop (`lg`)** | `1024px – 1440px` | Asymmetric split view (Statement on left, Monaco IDE on right) | $\ge 24\text{px}$ |
| **Ultrawide (`xl` / `2xl`)** | `> 1440px` | Centered max-w-7xl canvas, fixed telemetry sidecar panels | $\ge 24\text{px}$ |

---

## 9. Agent Prompt Guide & Component Sourcing

When asking or prompting AI coding agents to implement frontend features in this codebase:

### 9.1 Required Agent Preamble
```markdown
Follow DESIGN.md and Web Interface Guidelines strictly.
Apply Taste Skill dials: DESIGN_VARIANCE=8, MOTION_INTENSITY=6, VISUAL_DENSITY=8.
Use obsidian dark theme (#09090b / #18181b) with orange-500 (#f97316) accents and tabular numbers.
Never use transition: all, never block paste, ensure focus-visible on all controls, and hit targets >= 44px on mobile.
```

### 9.2 Component Sourcing Standard (21st.dev / Radix)
- Sourcing UI primitives must rely on **Radix UI Primitives** (`@radix-ui/react-*`), **Tailwind CSS v4**, and modern patterns from **21st.dev**.
- Avoid hand-rolling raw un-accessible modals, dropdowns, or tooltips when battle-tested Radix primitives already exist in `src/components/ui/`.
- Validate all newly rendered components in the browser using the token-efficient **Playwright CLI** (`npx @playwright/cli`) to verify accessibility trees and ensure zero layout shifts.
