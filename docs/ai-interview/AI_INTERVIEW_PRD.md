# Chaos Computer Club — Medi-Caps Chapter
# AI Interview Practice: Product Requirements Document (PRD)
**Version:** 1.0.0  
**Feature:** AI Interview Practice  
**Status:** In Active Engineering  

---

## 1. Product Vision & Mission

The **AI Interview Practice** platform provides students at Medi-Caps University and CCC cadets with an evidence-based, realistic technical interview preparation arena. Rather than acting as a superficial ChatGPT wrapper or static question dispenser, the system emulates an elite technical hiring manager who:
1. Understands the candidate's explicit target role, seniority level, and declared technical background.
2. Formulates an adaptive, multi-question interview plan across 10 specialized categories.
3. Probes the candidate's technical reasoning with targeted follow-up questions when answers are vague or incomplete.
4. Integrates with the actual CCC coding judge for code verification.
5. Produces a calibrated post-interview report with rubric-based dimensional scoring, transcript evidence, model solutions, and actionable revision recommendations.

---

## 2. Target Personas

| Persona | Motivation | Primary Track | Key Need |
| :--- | :--- | :--- | :--- |
| **Cadet / Student Developer** | Cracking campus placements and off-campus internships (FAANG / Tier-1). | Data Structures, Algorithms, Coding Interview | Code execution validation, edge-case analysis, time complexity grilling. |
| **Senior Student / Lead** | Preparing for high-scale backend / full-stack engineering roles. | System Design, Backend Engineering | Trade-off analysis (CAP theorem, caching, queues, failure modes). |
| **All Members** | Overcoming behavioral anxiety and structuring STAR-method responses. | Behavioral & Leadership | Structured rubric evaluation of communication, ownership, and learning from failure. |

---

## 3. Detailed Feature Specifications

### Feature A: Interview Dashboard
- **Route:** `/interview`
- **Capabilities:**
  - "Start Interview" CTA opening configuration modal.
  - Active / In-progress Session Banner: Immediate recovery prompt if an active session exists in `ASKING`, `AWAITING_ANSWER`, or `PAUSED` state.
  - Category selector filter (Technical, Coding, DSA, System Design, Backend, Frontend, DevOps, SQL, Behavioral, Mixed).
  - Session History Table: Date, category, target role, duration, final score, status badge, action menu (View Report, Continue, Delete).
  - Topic Strength & Weakness Matrix: Evidence-backed summary of topics requiring reinforcement.
  - State guards: Explicit empty states when zero interviews exist; loading skeletons matching CCC dark aesthetic.

### Feature B: Interview Configuration
- **Configuration Inputs:**
  - `target_role`: String (e.g., "Full-Stack Engineer", "Backend Developer", "DevOps Engineer").
  - `experience_level`: Enum (`ENTRY_LEVEL`, `MID_LEVEL`, `SENIOR`).
  - `category`: Enum (10 categories registry).
  - `difficulty`: Enum (`EASY`, `MEDIUM`, `HARD`).
  - `duration_minutes`: Integer (15, 30, 45, 60 min).
  - `preferred_language`: Enum (`python`, `cpp`, `java`, `javascript`, `typescript`).
  - `focus_topics`: List of tags (e.g. `["PostgreSQL", "Kafka", "Redis", "Distributed Systems"]`).
  - `job_description`: Optional text snippet.
  - `resume_notes`: Optional text / project summary.
- **Backend Validation:** Validated via Pydantic schema before creating the `InterviewSession` entity in state `CREATED`.

### Feature C: Candidate Intelligence & Bounded Context
- Candidate information sources:
  - Account Profile (`MemberProfile`: handle, full_name, college department, year).
  - Practice history (problems solved, favorite languages).
  - Provided resume / project summary notes.
- Invariants:
  - Bounded context injection: Total candidate context injected into prompts is capped at 1,500 tokens.
  - Privacy: Candidates can view, edit, or purge their profile notes at any time.

### Feature D: Adaptive Interviewer State Machine & Turn Lifecycle
- Single Question Delivery: Exactly one primary question active at a time.
- Follow-up Heuristics:
  - If answer is brief (< 25 words) or missing technical justification: Formulate a probing follow-up ("Can you elaborate on how you would handle network partitions in that scenario?").
  - If answer demonstrates mastery: Advance to next planned topic or increase depth.
- Maximum turns per session governed by configured duration.

### Feature E: Text Interview Workspace
- **Route:** `/interview/:sessionId`
- **Components:**
  - Header: Session breadcrumb, active topic badge, countdown timer, Pause/Resume toggle, End Interview button.
  - Central Transcript: Chronological feed of interviewer questions, follow-ups, and student answers.
  - Active Question Banner: Prominent card displaying the current question and topic tags.
  - Answer Composer: Textarea with keyboard shortcuts (`Cmd/Ctrl + Enter` to submit), word counter, clear status indicators (Awaiting Answer, Evaluating, Thinking).
  - Idempotent submission: Prevent accidental double-submission via unique client-generated action keys.

### Feature F: Voice Interview Support
- Pluggable Web Speech API client:
  - Speech-to-Text: Browser `webkitSpeechRecognition` with live interim results and finalized text output.
  - Text-to-Speech: Browser `speechSynthesis` with pause/stop controls and natural pacing.
  - Text fallback: Automatic seamless fallback to keyboard text composer whenever microphone access is denied or speech recognition is unsupported.

### Feature G: Coding Interview Harness
- Integrated Monaco editor alongside transcript.
- "Run Code" executes against permitted visible testcases via the backend judge provider.
- "Submit Code" evaluates against hidden testcases.
- AI discusses algorithmic choices, edge cases, and Big-O complexity based on actual judge outcomes.

### Feature H & I: System Design & Behavioral Tracks
- System Design: Probing questions on functional/non-functional requirements, API schemas, data models, scalability, and operational trade-offs.
- Behavioral: STAR-method assessment evaluating Situation, Task, Action, and Result with constructive coaching.

### Feature J: Evidence-Based Evaluation & Coaching Report
- **Route:** `/interview/:sessionId/report`
- Evaluation Dimensions (0 - 100):
  - Technical Correctness
  - Depth of Understanding
  - Problem Solving & Architecture
  - Communication & Articulation
  - Trade-off Awareness
- Detailed Breakdown per Question:
  - Candidate Answer transcript
  - What was correct & commended
  - Gaps, inaccuracies, or missed edge cases
  - Exemplary / Stronger Answer explanation
  - Targeted follow-up recommendations (e.g., links to specific CCC practice problems).

---

## 4. Success Metrics & Quality Standards

1. **Zero Data Loss:** 100% of finalized answers and generated evaluations persisted durably to PostgreSQL.
2. **Crash Resilience:** Browser tab close, refresh, or network blip during an active interview resumes seamlessly without progress loss.
3. **No Hallucinated Execution:** AI never states code passed testcases unless the sandbox judge explicitly returned `ACCEPTED`.
4. **Sub-200ms Interactive Latency:** UI interactions remain snappy and zero-lag adhering to CCC frontend design standards.
