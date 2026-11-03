# Chaos Computer Club — Medi-Caps Chapter
# AI Interview Practice: Release & Rollout Checklist
**Document Version:** 1.0.0  
**Phase:** Pre-Release Validation Gate  

---

## 1. Pre-Implementation Quality Gates
- [x] CCC Repository audited (`AI_INTERVIEW_ARCHITECTURE_AUDIT.md`).
- [x] Product requirements frozen (`AI_INTERVIEW_PRD.md`).
- [x] Architecture & state machine verified (`AI_INTERVIEW_ARCHITECTURE.md`).
- [x] Hierarchical backlog scoped into reviewable tasks (`AI_INTERVIEW_BACKLOG.md`).
- [x] Multi-tier test plan established (`AI_INTERVIEW_TEST_PLAN.md`).

---

## 2. Implementation Readiness Checklist

### Backend & Database Gates
- [ ] SQLAlchemy models defined in `app/models/interview.py`.
- [ ] Schema evolution DDL registered in `app/core/db.py` (`ensure_database_integrity`).
- [ ] Session state machine validates all transitions.
- [ ] Answer submission enforces unique `idempotency_key`.
- [ ] All routes require `get_current_member` and enforce session ownership.
- [ ] LLM Provider layer includes offline `DeterministicMockLLMProvider` for tests.
- [ ] Automated pytest suite (`backend/tests/test_ai_interview.py`) passes 100%.

### Frontend & UI Gates
- [ ] Redux Toolkit slice created in `src/store/slices/interviewSlice.ts`.
- [ ] API client functions implemented in `src/features/interview/api.ts`.
- [ ] Routes registered in `src/AppRoutes.tsx` (`/interview`, `/interview/:sessionId`, `/interview/:sessionId/report`).
- [ ] Navigation link added to `PortalShell.tsx`.
- [ ] Responsive UI adhering to CCC dark-terminal theme (`#09090b` / `#18181b`).
- [ ] Keyboard navigation (`Enter` / `Cmd+Enter`) and accessible ARIA attributes.
- [ ] `npm run typecheck` (`tsc --noEmit`) passes with 0 errors.
- [ ] `npm run build` succeeds cleanly.

---

## 3. Rollout & Rollback Strategy

### Rollout Protocol
1. **Local Test Gate:** Run complete backend test suite and frontend build check.
2. **Semantic Version Increment:** Increment semantic version in `config.py`, `.env`, and `package.json` per Version Increment Protocol.
3. **Continuous Deployment:** Push to `main` for automated GitHub Actions CI/CD deployment.
4. **Post-Deploy Sanity Probe:** `curl -s https://medicaps.chaoscomputerclub.in/api/health` validates operational status.

### Rollback Protocol
- If unpredicted runtime errors occur on live endpoints:
  - Feature flag toggle or unmount route `/interview` in `AppRoutes.tsx`.
  - Database schema additions are additive (`CREATE TABLE IF NOT EXISTS`, nullable fields) ensuring zero regression on existing contest/practice flows.
