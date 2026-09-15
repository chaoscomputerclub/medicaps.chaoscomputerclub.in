# ⚡ GET SHIT DONE (GSD) AI FRAMEWORK

## Overview
The **Get Shit Done (GSD) AI Framework** is the mandatory operational standard for all AI agents working on the Chaos Computer Club Medi-Caps Chapter repository. It mandates direct execution, production-grade implementation, uncompromising reliability, and continuous deployment synchronization between Local, GitHub, and the Remote Production Server.

---

## 1. The 5 Core GSD Tenets

1. **Extreme Ownership & Bias for Action**:
   - Never ask trivial questions or wait when requirements are clear from the codebase context.
   - Investigate, discover root causes directly, and implement the complete fix.

2. **Root-Cause Engineering (Zero Band-Aids)**:
   - Identify and eliminate underlying architectural, state, or concurrency bugs.
   - Do not apply superficial surface fixes that break on page refresh or state change.

3. **No Placeholders & No Broken Assumptions**:
   - Every single component, route, handler, and database model must be 100% functional.
   - Never leave `// TODO`, fake mock responses in production paths, or unlinked buttons.

4. **Self-Healing & Local Verification**:
   - Always run `npm run build` / unit tests after writing code.
   - Fix all compilation, linting, or type errors immediately before committing.

5. **Mandatory GitHub Push & Server Sync Loop**:
   - Every modification cycle MUST be committed, pushed to `origin/main` (GitHub), and pulled to the production server (`root@143.198.38.205`).

---

## 2. GitHub Continuous Push & Pull Protocol

For every completed unit of work or fix:
1. **Local Verification**: Run `npm run build` and ensure 0 TypeScript / bundling errors.
2. **Git Commit & Push**:
   ```bash
   git add -A
   git commit -m "<type>(<scope>): <concise message>"
   git push origin main
   ```
3. **Server Pull & Service Sync**:
   Execute the automated GSD sync script:
   ```bash
   ./scripts/gsd_sync.sh "<commit message>"
   ```
   Or manually pull on the remote server:
   ```bash
   ssh -i ~/.ssh/shopground_era_key root@143.198.38.205 "cd /root/projects/medicaps.chaoscomputerclub.in && git pull origin main && systemctl restart ccc-medicaps-api"
   ```
4. **Health Check Validation**: Verify `https://medicaps-api.chaoscomputerclub.in/api/health` returns `status: operational`.

---

## 3. Architecture Invariants
- **Authentication**: JWT RS256 Asymmetric Cryptography with HS256 fallback. Stored in `localStorage` under `ccc_medicaps_token`. Token expiry: 7 days (`10080` minutes).
- **Institution Isolation**: Institutional emails strictly restricted to `@medicaps.ac.in`.
- **Database & Services**: SQLAlchemy Async with PostgreSQL / SQLite fallback, Redis for OTP sessions, CodeBox for sandboxed code execution.
