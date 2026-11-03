# CCC AI Interview Practice v2 — Repository Audit & Implementation Plan

**Document Version:** 2.0.0  
**Status:** Audit Complete — Ready for Implementation  
**Standard:** `CCC_AI_Interview_Requirements_v2.md`  

---

## 1. Executive Summary

This document fulfills **EPIC 0 (`AUD-01` through `AUD-06`)** from `CCC_AI_Interview_Requirements_v2.md`. It evaluates the target v2 requirements against the actual Chaos Computer Club (CCC) Medi-Caps codebase, confirms technological compatibility (including LangGraph), documents approved deviations, and establishes an implementation plan for the text-based MVP.

---

## 2. Repository Audit Findings (EPIC 0)

### 2.1 AUD-01: Frontend Architecture & Conventions
- **Language & Types:** The codebase is **100% TypeScript (`.tsx` and `.ts`)**, not plain `.jsx`. The CI pipeline (`pr_check.yml`) enforces `tsc --noEmit` on every pull request and push to `main`.
  - *Deviation Approval:* In accordance with the Repository-First Rule (Section 12 of v2), frontend code must use `.tsx` rather than `.jsx` to preserve full type safety and pass the mandatory CI compilation gate.
- **State Management:** Redux Toolkit (`@reduxjs/toolkit`) with custom typed hooks (`useAppDispatch`, `useAppSelector`).
- **Routing:** React Router DOM v6 with dynamic code-splitting via `lazyWithRetry` (`src/lib/lazyWithRetry.ts`) and custom route preloaders.
- **Design System:** Tailwind CSS v4, dark obsidian tactical terminal theme (`#09090b` / `#18181b`), Radix UI primitives, `lucide-react` icons, Monaco Editor (`@monaco-editor/react`).

### 2.2 AUD-02: FastAPI Structure, Auth & Async Conventions
- **Async Framework:** FastAPI 0.115+ running under Python 3.12 with `uvicorn[standard]`.
- **Authentication:** Asymmetric RS256 JWT tokens. HTTP endpoints authenticate via `Depends(get_current_member)`. Tokens are accompanied by HttpOnly refresh cookies with silent client-side refresh (`/api/auth/refresh`).
- **Surface Versioning:** All new domain routers are mounted under `/api/v1/` via `app/api/v1/router.py` as well as `/api/` for backwards compatibility.
- **Validation:** Pydantic v2 schemas for all request payloads, responses, and structured LLM outputs.

### 2.3 AUD-03: PostgreSQL Schema, Redis & Deployment
- **Database:** PostgreSQL 16+ accessed asynchronously via `asyncpg` and SQLAlchemy 2.0.
- **Migrations & Integrity:** Self-healing DDL lifecycle managed via `ensure_database_integrity()` in `app/core/db.py`. Tables and composite indexes are created with `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.
- **Short-Lived Coordination:** Redis 7 is available for pub/sub events (`event_broadcaster.py`) and distributed locks. As mandated by v2, PostgreSQL remains the sole authoritative source of truth.

### 2.4 AUD-04: LLM Integrations & Test Infrastructure
- **LLM Adapter Layer:** Abstract `LLMProvider` contract (`app.services.llm.provider.LLMProvider`) decoupling domain logic from model vendors.
- **Mock Provider:** `DeterministicMockLLMProvider` enables hermetic, zero-cost, air-gapped test execution in CI/CD without network calls or external API keys.
- **Production Providers:** Gemini 2.5 Flash (`GeminiProvider`) and OpenAI/OpenRouter compatible (`OpenAICompatibleProvider`).
- **Test Framework:** `pytest` + `pytest-asyncio` with transactional database fixtures and dependency overrides.

### 2.5 AUD-05: Current-vs-Target Architecture & Reuse
- **Reuse:**
  - Existing category registry (`app/services/interview/category_registry.py`) providing 10 curated tracks.
  - Candidate context builder (`app/services/interview/candidate_context_service.py`) extracting profile facts.
  - Pluggable LLM factory (`app/services/llm/factory.py`).
  - Frontend Redux slice (`src/store/slices/interviewSlice.ts`), API client (`src/features/interview/api.ts`), and UI pages.
- **Target v2 Evolution:**
  - Re-architect session orchestration from custom procedural state machine to **LangGraph (`StateGraph`)**.
  - Formulate typed `InterviewGraphState` containing session metadata, candidate context, plan agenda, turn transcript, active question, answer evaluation, and loop bounds.
  - Implement 12 formal graph nodes with conditional routing edges (`probe_deeper`, `move_on`, `end_interview`, `recover`).
  - Integrate LangGraph checkpointer for state checkpointing and recovery.

### 2.6 AUD-06: LangGraph Compatibility Verification
- **Installation Verification:** `langgraph-1.2.18` (with `langchain-core-1.7.0`, `langgraph-checkpoint-4.3.1`, `langgraph-prebuilt-1.1.1`) was installed into `./backend/.venv` under Python 3.12.12.
- **Dependency Conflicts:** Zero dependency conflicts found. Pydantic 2.13 and SQLAlchemy 2.0 co-exist seamlessly.
- **CI Dependency Update:** `langgraph>=0.2.0` added to `backend/requirements.txt`.

---

## 3. LangGraph Architecture Design (v2)

### 3.1 Typed Graph State (`InterviewGraphState`)
```python
from typing import TypedDict, List, Dict, Any, Optional

class InterviewGraphState(TypedDict):
    session_id: str
    member_id: str
    target_role: str
    category: str
    experience_level: str
    difficulty: str
    duration_minutes: int
    focus_topics: List[str]
    candidate_context: str
    
    # Plan & Agenda
    total_questions_planned: int
    current_question_index: int
    agenda: List[Dict[str, Any]]
    
    # Active Turn
    active_question_id: Optional[str]
    active_question_title: Optional[str]
    active_question_prompt: Optional[str]
    active_question_type: str  # PRIMARY | FOLLOW_UP
    
    # Candidate Answer
    last_answer_text: Optional[str]
    last_submitted_code: Optional[str]
    last_idempotency_key: Optional[str]
    
    # Turn Evaluation
    last_score: Optional[int]
    last_strengths: List[str]
    last_gaps: List[str]
    last_evidence_quotes: List[str]
    last_model_answer: Optional[str]
    follow_up_recommended: bool
    suggested_follow_up: Optional[str]
    
    # Loop Bounds & Lifecycle
    follow_up_count_current_topic: int
    max_follow_ups_per_topic: int
    lifecycle_state: str  # ASKING | EVALUATING | COMPLETED | FAILED
    error_message: Optional[str]
```

### 3.2 Graph Nodes & Transitions
```
                [load_session_and_profile]
                            │
                            ▼
              [retrieve_relevant_context]
                            │
                            ▼
            [validate_or_initialize_plan]
                            │
                            ▼
                  [select_next_question]
                            │
                            ▼
                    [present_question]
                            │
                            ▼
                (await_candidate_answer) <─── API boundary returns to candidate
                            │ (candidate submits turn)
                            ▼
                     [analyze_answer]
                            │
                            ▼
              [validate_evidence_and_score]
                            │
                            ▼
             [choose_follow_up_or_next_topic]
                    /              \
       (probe_deeper)              (move_on)
             │                          │
             ▼                          ▼
   [select_next_question]      [select_next_question]
             \                          /
              \── (agenda exhausted) ──/
                            │
                            ▼
                    [finalize_report]
                            │
                            ▼
                        [__end__]
```

---

## 4. Implementation Phasing & Task Breakdown

1. **EPIC 2: LangGraph Orchestration Service (`backend/app/services/interview/langgraph_orchestrator.py`)**
   - Define `InterviewGraphState`.
   - Build all graph nodes with typed schemas and provider adapters.
   - Configure conditional edges with loop limits (max 1 follow-up per topic, max total turns = planned questions + 2).
   - Add MemorySaver checkpointer and session ID binding.
   - Wire LangGraph orchestrator into `backend/app/routers/interview.py`.

2. **EPIC 5: Automated Verification & Test Coverage (`backend/tests/test_ai_interview.py`)**
   - Verify LangGraph execution through the deterministic mock provider.
   - Validate state persistence, checkpointer resumption, and idempotency guarantees.
   - Verify 403 authorization gates and final report synthesis.

3. **Frontend & Polish Verification**
   - Run `npm run typecheck` (`tsc --noEmit`) to verify 0 errors.
   - Run `npm run build` to verify clean Vite production bundle.
   - Increment version in `config.py`, `.env`, and `package.json` per CCC protocol.
