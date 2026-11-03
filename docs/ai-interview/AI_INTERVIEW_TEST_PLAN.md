# Chaos Computer Club — Medi-Caps Chapter
# AI Interview Practice: Quality Assurance & Test Plan
**Document Version:** 1.0.0  
**Coverage Level:** Unit, Integration, API Contract, State Invariant, End-to-End  

---

## 1. Test Levels & Strategy

```
           / \
          /   \     E2E Flow Tests (Playwright)
         /-----\    - Complete Interview Turn Lifecycle
        /       \   - Browser Tab Reload Recovery
       /---------\  
      /           \ API Contract & State Invariant Tests (pytest)
     /             \- Session State Machine Transitions
    /--------------\- Idempotent Answer Deduplication
   /                \- Ownership & Authorization Security
  /                  \
 /--------------------\ Unit Tests (Mock LLM & Pydantic Schemas)
                       - Prompt Validation, Parsing, Category Registry
```

---

## 2. Test Suites to Execute

### 2.1 Backend pytest Test Suite (`backend/tests/test_ai_interview.py`)
1. **Category Registry & Validation:**
   - Verify all 10 interview categories are registered with default topics and weights.
   - Test invalid category rejection with `422 Unprocessable Entity`.
2. **Session Creation & Ownership:**
   - Test session creation under authenticated user.
   - Verify initial state is `CREATED`.
   - Verify foreign user cannot access or query another member's session (`404` or `403`).
3. **State Machine & Lifecycle Transitions:**
   - Test `start_session`: transitions `CREATED` -> `PREPARING` -> `ASKING` and yields first question.
   - Verify attempting to answer an already completed session is rejected with `400`.
   - Test `pause_session` and `resume_session`.
4. **Idempotent Answer Submission:**
   - Submit answer with `idempotency_key = "uuid-123"`.
   - Re-submit identical request: Verify same answer ID returned and zero duplicate evaluations or questions created.
5. **Adaptive Follow-up vs Next Topic:**
   - Verify short/vague answer triggers a follow-up probing question.
   - Verify comprehensive answer advances to next topic or completes.
6. **Report Generation:**
   - Complete session: Verify `InterviewReport` record created with composite score, dimension breakdown, strengths, areas to improve, and recommendations.
7. **Session Deletion & Cleanup:**
   - Verify deleting session removes all associated questions, answers, and evaluations via database cascade.

### 2.2 Frontend Verification
1. **TypeScript Typecheck:**
   - Run `npm run typecheck` (`tsc --noEmit`) to verify 100% type soundness.
2. **Production Build:**
   - Run `npm run build` to verify Vite bundle compilation without warnings or broken imports.
3. **Interactive Navigation & UI Telemetry:**
   - Verify navbar link `/interview` navigates smoothly to Dashboard.
   - Verify Start Interview modal opens, validates, and routes to `/interview/:id`.
   - Verify answer submission updates transcript and toggles waiting state.
