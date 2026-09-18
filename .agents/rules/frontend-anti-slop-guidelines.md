# 🎨 Anti-Slop Frontend Standard & Web Interface Guidelines
<!-- Powered by Taste Skill v2, Vercel Web Interface Guidelines & Google Stitch DESIGN.md -->

> [!CRITICAL]
> **ABSOLUTE BAN ON INVENTED AI DESIGN PHILOSOPHIES**  
> You are **strictly forbidden** from generating generic AI frontend "slop" or using your own personal heuristics.  
> You MUST strictly adhere to [**`DESIGN.md`**](file:///Users/santushtkotai/Desktop/medicaps.chaoscomputerclub.in/DESIGN.md), **Taste Skill v2**, and the **Vercel Web Interface Guidelines**.

---

## 1. Core Principles & Anti-Slop Discipline

1. **Infer the Room Before Coding:**
   - Always state the one-line Design Read:  
     `"Reading this as: <page kind> for <audience>, with a <vibe> language, leaning toward <design system>."`
   - For this project, the context is strictly: **Cybersecurity & Competitive Programming Arena for Medi-Caps University students and proctors**.

2. **The Three Calibrated Dials:**
   - **`DESIGN_VARIANCE: 8`** — Asymmetric bento layouts, tactical telemetry panels, terminal-grade split IDE workspace.
   - **`MOTION_INTENSITY: 6`** — Crisp, snappy 150–200ms cubic-bezier transitions, GPU hardware-accelerated (`transform`, `opacity`), zero infinite distracting loops.
   - **`VISUAL_DENSITY: 8`** — Cockpit data density, compact telemetry badges, monospace tabular numbers, space-efficient testcase matrices.

3. **Strict Aesthetic Blacklist (Never Generate These Defaults):**
   - ❌ **NO AI-purple or blue mesh gradients** (Use Obsidian `#09090b` + Industrial Orange `#f97316` + Telemetry Cyan `#06b6d4`).
   - ❌ **NO centered floating cards over dark empty voids**.
   - ❌ **NO cards-inside-cards-inside-cards**.
   - ❌ **NO generic glassmorphism on everything** (Use crisp semi-transparent borders `border-white/10` and solid elevated surfaces).
   - ❌ **NO placeholder comments** (`// TODO: implement later`) or disabled dummy buttons without tooltip explanations.

---

## 2. The 7 Pillars of Frontend Excellence (Vercel Guidelines)

### Pillar 1: Interactions
- **Keyboard works everywhere:** All controls operable via Tab, Enter, Space, and Escape. Full WAI-ARIA compliance.
- **Visible, unobscured focus rings:** Every interactive element MUST display `:focus-visible` with high-contrast ring (`ring-2 ring-orange-500 ring-offset-2 ring-offset-zinc-950`). Never set `outline: none` without replacement.
- **Hit target sizing:** Minimum $24\text{px} \times 24\text{px}$ on desktop; **minimum $44\text{px} \times 44\text{px}$ on mobile**.
- **URL as state:** Persist tabs, filters, pagination, and query params in the URL query string (`?tab=...&page=...`).
- **Optimistic updates with recovery:** Update UI immediately on action, reconcile on server response, roll back gracefully with error toast on failure.
- **Loading buttons:** Keep submit enabled until clicked; then disable during in-flight request, show an inline spinner, and **preserve the button label** (`<Spinner /> Submitting…`).
- **Links are links:** Use `<a>` or `<Link>` for navigation. Never substitute with `<button>` or `<div>` for routing.

### Pillar 2: Animations
- **Honor `prefers-reduced-motion`:** Provide static/fade fallbacks.
- **Never `transition: all`:** Explicitly declare only GPU-accelerated animated properties (`transition-colors`, `transition-transform`, `transition-opacity`).
- **Compositor-friendly:** Prioritize `transform` and `opacity`. Avoid animating properties that trigger reflow/repaint (`width`, `height`, `top`, `left`).
- **Interruptible & snappy:** Standard duration 150ms–200ms with cubic-bezier easing. Animations must cancel immediately on user input.

### Pillar 3: Layout
- **Optical alignment:** Adjust $\pm 1\text{px}$ when visual balance overrides pure geometric centers.
- **Responsive coverage:** Mobile ($<640\text{px}$), Tablet ($640\text{px}–1024\text{px}$), Laptop ($1024\text{px}–1440\text{px}$), and Ultrawide ($>1440\text{px}$).
- **Safe area insets:** Respect notches with `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
- **Overscroll containment:** Set `overscroll-behavior: contain` on modals, drawers, and terminal panels.
- **Let the browser size things:** Favor flex/grid and intrinsic CSS sizing over calculating dimensions in JavaScript.

### Pillar 4: Content
- **Tabular numbers for comparisons:** Apply `font-variant-numeric: tabular-nums` (or `font-mono`) to countdown timers, Elo ratings, scores, memory numbers, and rankings so digits don't jitter during updates.
- **Glued units with non-breaking spaces:** Use `&nbsp;` between values and units: `10&nbsp;MB`, `2.0&nbsp;s`, `256&nbsp;MB`, `⌘&nbsp;+&nbsp;K`.
- **Typography quotes & ellipses:** Use curly quotes (“ ”) and the single ellipsis character `…` (`&#8230;`).
- **All states designed:** Every view must handle **Loading** (stable skeleton), **Empty** (clear CTA), **Error** (clear exit guide), and **Success**.
- **Error messages guide the exit:** Never state just what went wrong—tell the cadet or proctor exactly how to fix it.

### Pillar 5: Forms
- **Mobile input size:** `<input>` and `<textarea>` font size is strictly $\ge 16\text{px}$ on mobile (`text-base`) to prevent iOS Safari auto-zoom.
- **Never block typing or paste:** Allow user keystrokes and pasting; provide inline validation errors instead of muting input.
- **Keyboard submission:** `Enter` submits single-input forms. In `<textarea>`, `⌘/⌃ + Enter` submits; `Enter` creates a new line.
- **Labels everywhere:** Every control has an associated `<label htmlFor="...">` that activates the control on click.
- **Error placement:** Display validation errors directly adjacent to the input field, with `aria-live="polite"`.

### Pillar 6: Performance
- **Network latency budget:** UI interactions complete optimistic state in $<16\text{ms}$; API mutations complete in $<500\text{ms}$.
- **No image-caused CLS:** Explicit `width` and `height` dimensions or aspect ratio containers on all media.
- **Virtualize large lists:** Arena leaderboards with $>100$ entries must use virtualization or `content-visibility: auto`.
- **Do not block the main thread:** Heavy syntax parsing or Diff calculations must run off-thread or in microtasks.

### Pillar 7: Depth, Shadows & Border Polish
- **Nested radii rule:** Corner radius of children must be concentric to parent:  
  $$r_{\text{child}} = r_{\text{parent}} - \text{padding}$$
- **Layered lighting:** Combine crisp semi-transparent borders (`border border-white/10`) with dual-layer ambient shadows (`0 1px 2px rgba(0,0,0,0.4)` + `0 0 0 1px rgba(255,255,255,0.08)`).
- **Dark theme color-scheme:** Ensure root `<html>` tag includes `color-scheme: dark` to match browser chrome and native scrollbars.

---

## 3. Technology & Component Sourcing

1. **Component Primitives (21st.dev / Radix UI):**
   - Source components from **Radix UI Primitives** and modern **21st.dev** patterns.
   - Reuse existing design tokens in `src/components/ui/` and `src/organization/`.
   - Never generate ad-hoc unstyled divs for complex widgets (modals, dropdowns, accordions, popovers).

2. **Automated Verification (Playwright CLI):**
   - Before completing frontend work, verify visual correctness and accessibility tree integrity:
     ```bash
     npx @playwright/cli snapshot http://localhost:8081
     ```
   - Check element references and ensure zero console errors, broken hit areas, or overlapping fixed headers.
