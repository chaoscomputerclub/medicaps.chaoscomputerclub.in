# 00 — Product Scope and Principles

## 1. Product objective

Turn the existing AI Interview Arena page into a straightforward interview-practice catalog. The platform owner creates and prepares interview experiences in advance. Candidates choose from those published experiences and practice; they do not configure or create interviews.

## 2. Actors

### Candidate
- Browse published interview tracks.
- Open an interview detail view.
- Optionally upload a resume.
- Start, pause/resume where supported, and complete a session.
- View feedback, scores, and past sessions.

### Admin / Interview Author
- Create and maintain interview definitions.
- Define graph nodes, edges, competencies, prompts, rubrics, constraints, and completion rules.
- Validate and publish immutable versions.
- Retire or replace published versions.
- Review operational and quality metrics.

### System
- Execute the selected published blueprint.
- Initialize session-specific state.
- Retrieve relevant resume context when available.
- Select eligible nodes and questions according to authored rules.
- Evaluate responses against node rubrics.
- Update session state and generate a final report.

## 3. Candidate-facing catalog

Initial catalog categories:

### Technical interviews
- Frontend
- Backend
- Python
- Java
- C++
- Data Structures and Algorithms
- Database
- Machine Learning
- AI / LLM Engineering
- DevOps and Cloud
- System Design
- Cybersecurity (only when an approved blueprint exists)

### Other rounds
- HR
- Behavioral

The catalog must be data-driven from published backend records. Do not hardcode the entire catalog in the frontend. A category may be hidden when it has no published interview.

## 4. Required candidate journeys

### Journey A — Practice without resume
1. Candidate opens Interview Arena.
2. Candidate browses categories and published tracks.
3. Candidate selects a track.
4. Candidate sees a concise description and `Start interview` action.
5. Backend creates a session using the currently published blueprint version.
6. Candidate enters the interview.

### Journey B — Practice with resume
1. Candidate uploads a PDF or DOCX resume.
2. Backend validates and processes the file asynchronously.
3. Candidate sees processing status.
4. On successful processing, candidate selects a published interview.
5. Session starts with the selected blueprint plus retrieved candidate-specific resume context.
6. Resume-derived claims are treated as unverified context until tested.

### Journey C — History and report
1. Candidate sees previous sessions.
2. Candidate opens a completed session.
3. Candidate views overall feedback, competency results, evidence, and areas to improve.
4. The report distinguishes observed performance from resume claims and model predictions.

## 5. Product invariants

- No candidate custom-interview flow exists.
- Resume upload is optional.
- A resume never changes the published graph topology or node instructions.
- Every session pins a specific blueprint version.
- Runtime state is per session and never mutates the published blueprint.
- Every score must be traceable to response evidence and a rubric.
- The system must not claim a skill is proven solely because it appears in a resume.
- The interview must remain usable if resume parsing or vector retrieval is unavailable.
- Admin publishing must validate graph integrity before a version can become active.

## 6. Scope boundaries

In scope:
- Catalog, track detail, session creation, resume upload, graph runtime, adaptive selection, evaluation, report, history, admin authoring/publishing.

Out of scope unless already present and explicitly retained:
- Candidate-created interviews.
- Public graph editing.
- Candidate training-data uploads for model fine-tuning.
- Automatic global model retraining from one candidate's answers.
- Unreviewed self-modifying graph topology.
