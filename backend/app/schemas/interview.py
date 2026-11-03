"""
Chaos Computer Club — Medi-Caps Chapter
app.schemas.interview — Pydantic Schemas for AI Interview Practice
Implements API_CONTRACTS, RESUME_INTELLIGENCE_CONTRACT & VOICE_INTEGRATION_CONTRACT:
- Configuration, session lifecycle, answer submission with idempotency.
- Resume upload, fact provenance review, consent grant/revocation.
- Candidate profiles and comprehensive reports.
"""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


# ── Configuration & Request Schemas ───────────────────────────────────────────

class InterviewConfigCreate(BaseModel):
    interview_slug: Optional[str] = Field(None, description="Optional published track slug (e.g. backend-engineering)")
    target_role: Optional[str] = Field(None, min_length=2, max_length=100, description="Target job title (e.g. Backend Engineer)")
    experience_level: Literal["ENTRY_LEVEL", "MID_LEVEL", "SENIOR"] = Field("ENTRY_LEVEL", description="Seniority expectation")
    category: Literal[
        "TECHNICAL",
        "CODING",
        "DSA",
        "SYSTEM_DESIGN",
        "BACKEND",
        "FRONTEND",
        "DEVOPS",
        "DATABASE_SQL",
        "BEHAVIORAL",
        "MIXED"
    ] = Field("TECHNICAL", description="Interview category")
    difficulty: Literal["EASY", "MEDIUM", "HARD"] = Field("MEDIUM", description="Target difficulty")
    duration_minutes: Literal[15, 30, 45, 60] = Field(30, description="Session duration in minutes")
    preferred_language: Literal["python", "cpp", "java", "javascript", "typescript"] = Field("python", description="Code language")
    focus_topics: List[str] = Field(default_factory=list, description="Specific topics or technologies to probe")
    job_description: Optional[str] = Field(None, max_length=10000, description="Optional target job description")
    resume_notes: Optional[str] = Field(None, max_length=10000, description="Optional candidate background context")
    resume_id: Optional[str] = Field(None, description="Optional single resume ID")
    resume_asset_ids: List[str] = Field(default_factory=list, description="Verified candidate resume asset IDs")
    mode: Literal["TEXT", "VOICE"] = Field("TEXT", description="Interaction mode (TEXT or VOICE)")
    language: str = Field("en", description="Spoken or written language (e.g. en, hi)")


class InterviewSessionCreateBySlug(BaseModel):
    interview_slug: str = Field(..., min_length=2, max_length=100, description="Slug of the published track to practice")
    resume_id: Optional[str] = Field(None, description="Optional candidate resume asset ID for personalization context")
    mode: Literal["TEXT", "VOICE"] = Field("TEXT", description="Interaction mode (TEXT or VOICE)")
    language: str = Field("en", description="Spoken or written language (e.g. en, hi)")


class InterviewAnswerSubmit(BaseModel):
    idempotency_key: str = Field(..., min_length=8, max_length=64, description="Client-generated unique action UUID")
    answer_text: str = Field(..., min_length=1, description="Student transcript or text response")
    submitted_code: Optional[str] = Field(None, description="Optional code solution for coding track")
    audio_duration_seconds: Optional[float] = Field(None, ge=0.0, description="Optional speech duration")
    transcript_source: Literal["TEXT", "VOICE"] = Field("TEXT", description="Input modality")
    transcript_final: bool = Field(True, description="Whether speech transcript is final")
    client_turn_id: Optional[str] = Field(None, description="Client tracking turn identifier")


class InterviewStateUpdate(BaseModel):
    action: Literal["PAUSE", "RESUME", "COMPLETE", "ABANDON"] = Field(..., description="Lifecycle action")


# ── Candidate Profile & Resume Schemas ────────────────────────────────────────

class CandidateProject(BaseModel):
    title: str = Field(..., max_length=150)
    description: str = Field(..., max_length=1000)
    technologies: List[str] = Field(default_factory=list)
    role: Optional[str] = Field(None, max_length=100)


class CandidateProfileUpdate(BaseModel):
    declared_skills: Optional[List[str]] = None
    preferred_tracks: Optional[List[str]] = None
    declared_projects: Optional[List[CandidateProject]] = None
    learning_goals: Optional[List[str]] = None
    context_consent: Optional[bool] = None


class CandidateProfileResponse(BaseModel):
    id: str
    member_id: str
    declared_skills: List[str] = Field(default_factory=list)
    demonstrated_strengths: List[str] = Field(default_factory=list)
    developmental_gaps: List[str] = Field(default_factory=list)
    preferred_tracks: List[str] = Field(default_factory=list)
    declared_projects: List[Dict[str, Any]] = Field(default_factory=list)
    learning_goals: List[str] = Field(default_factory=list)
    resume_summary: Optional[str] = None
    context_consent: bool = True
    updated_at: datetime


class ResumeUploadResponse(BaseModel):
    asset_id: str
    original_filename: str
    detected_mime_type: str
    size_bytes: int
    scan_status: str
    parse_status: str
    consent_status: str
    created_at: datetime


class ResumeFactItem(BaseModel):
    id: str
    fact_type: str
    normalized_value: str
    source_page: Optional[int] = None
    source_section: Optional[str] = None
    extraction_confidence: float
    candidate_status: str
    candidate_corrected_value: Optional[str] = None


class ResumeDetailResponse(BaseModel):
    asset: ResumeUploadResponse
    facts: List[ResumeFactItem] = Field(default_factory=list)


class ResumeFactUpdateRequest(BaseModel):
    fact_id: str
    candidate_status: Literal["CONFIRMED", "CORRECTED", "REJECTED"]
    candidate_corrected_value: Optional[str] = None


class ResumeConsentRequest(BaseModel):
    consent: bool = True
    purpose: Literal["USE_RESUME_IN_INTERVIEW", "RESUME_PARSE"] = "USE_RESUME_IN_INTERVIEW"


# ── Response Schemas ──────────────────────────────────────────────────────────

class InterviewQuestionSummary(BaseModel):
    id: str
    order_index: int
    parent_question_id: Optional[str] = None
    question_type: str
    topic: str
    title: str
    prompt: str
    code_starter: Optional[str] = None
    judge_problem_slug: Optional[str] = None
    plan_version: str = "1.0"
    competency_key: str = "TECHNICAL_EXECUTION"
    difficulty_level: str = "MEDIUM"
    created_at: datetime


class InterviewAnswerSummary(BaseModel):
    id: str
    question_id: str
    idempotency_key: str
    answer_text: str
    submitted_code: Optional[str] = None
    judge_result: Optional[Dict[str, Any]] = None
    processing_state: str = "COMMITTED"
    transcript_source: str = "TEXT"
    audio_duration_seconds: Optional[float] = None
    created_at: datetime


class InterviewEvaluationSummary(BaseModel):
    id: str
    question_id: str
    answer_id: str
    score: int
    rubric_scores: Dict[str, Any]
    strengths: List[str]
    gaps: List[str]
    evidence_quotes: List[str]
    model_answer: str
    follow_up_recommended: bool
    rubric_version: str = "1.0"
    confidence_band: str = "HIGH"
    created_at: datetime


class InterviewReportDetail(BaseModel):
    id: str
    session_id: str
    overall_score: int
    verdict: str
    executive_summary: str
    dimension_breakdown: Dict[str, Any]
    top_strengths: List[str]
    areas_to_improve: List[str]
    recommended_practice: List[Dict[str, Any]]
    report_version: str = "1.0"
    rubric_version: str = "1.0"
    plan_version: str = "1.0"
    confidence_and_limitations: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class InterviewSessionDetail(BaseModel):
    id: str
    member_id: str
    target_role: str
    experience_level: str
    category: str
    difficulty: str
    duration_minutes: int
    preferred_language: str
    focus_topics: List[str]
    job_description: Optional[str] = None
    resume_notes: Optional[str] = None
    mode: str = "TEXT"
    language: str = "en"
    plan_version: str = "1.0"
    rubric_version: str = "1.0"
    state: str
    version: int = 1
    current_question_index: int
    total_questions_planned: int
    started_at: Optional[datetime] = None
    paused_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    current_question: Optional[InterviewQuestionSummary] = None
    questions: List[InterviewQuestionSummary] = Field(default_factory=list)
    answers: List[InterviewAnswerSummary] = Field(default_factory=list)
    evaluations: List[InterviewEvaluationSummary] = Field(default_factory=list)
    report: Optional[InterviewReportDetail] = None


class InterviewSessionListItem(BaseModel):
    id: str
    target_role: str
    experience_level: str
    category: str
    difficulty: str
    duration_minutes: int
    mode: str = "TEXT"
    state: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    overall_score: Optional[int] = None
    verdict: Optional[str] = None
    total_questions: int = 0
    total_answers: int = 0


class InterviewCategoryInfo(BaseModel):
    id: str
    name: str
    description: str
    badge: str
    icon: str
    default_topics: List[str]
    supports_code: bool
    supports_diagrams: bool


class InterviewTrackSummary(BaseModel):
    slug: str
    title: str
    description: str
    category: str
    domain: str
    difficulty: str
    duration_minutes: int
    topics: List[str] = Field(default_factory=list)
    badge: str
    icon: str
    supports_code: bool = False
    supports_diagrams: bool = False
    version: str = "1.0.0"


class InterviewTrackDetail(InterviewTrackSummary):
    total_questions: int = 4


# ─── ML COMPETENCY GRAPH & PREDICTION SCHEMAS ────────────────────────────────

class CompetencyNodeResponse(BaseModel):
    id: str
    label: str
    domain: str
    description: str
    mastery_prob: float
    uncertainty: float
    evidence_count: int
    status: str
    x: int
    y: int
    prerequisites: List[str] = Field(default_factory=list)


class CompetencyEdgeResponse(BaseModel):
    source: str
    target: str
    relationship: str
    weight: float


class CompetencyGraphResponse(BaseModel):
    session_id: str
    version: str
    nodes: List[CompetencyNodeResponse]
    edges: List[CompetencyEdgeResponse]
    metrics: Dict[str, Any]
    generated_at: str


class PredictionItemResponse(BaseModel):
    competency_id: str
    label: str
    current_mastery_estimate: float
    predicted_response_probability: float
    prediction_target: Dict[str, str]
    confidence_interval: Dict[str, float]
    evidence_count: int
    is_low_evidence: bool
    explanation: str


class SessionPredictionsResponseSchema(BaseModel):
    session_id: str
    model_version: str
    candidate_ability_theta: float
    ability_confidence_interval: Dict[str, float]
    predictions: List[PredictionItemResponse]
    generated_at: str


class AdaptiveNextQuestionResponse(BaseModel):
    question_id: str
    title: str
    prompt: str
    target_competency_id: str
    target_difficulty: str
    selection_score: float
    rationale: str
    candidate_pool_size: int
    scores_breakdown: Dict[str, float] = Field(default_factory=dict)


class CompetencyTaxonomyItem(BaseModel):
    id: str
    label: str
    domain: str
    description: str
    prerequisites: List[str] = Field(default_factory=list)
    related: List[str] = Field(default_factory=list)
    version: str = "1.0"


# ── Database-Driven Domains & Admin Training Schemas ─────────────────────────

class InterviewDomainCreate(BaseModel):
    slug: str = Field(..., min_length=2, max_length=50, pattern=r"^[a-z0-9-]+$")
    name: str = Field(..., min_length=2, max_length=100)
    description: str = Field(..., min_length=10)
    category: Literal["TECHNICAL", "OTHER"] = "TECHNICAL"
    icon_key: str = "code"
    display_order: int = 0
    is_active: bool = True


class InterviewDomainResponse(BaseModel):
    id: str
    slug: str
    name: str
    description: str
    category: str
    icon_key: str
    display_order: int
    is_active: bool
    published_blueprints_count: int = 0
    created_at: str


class AdminBlueprintCreateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=150)
    description: str = Field(..., min_length=10)
    version: str = Field("1.0.0", pattern=r"^\d+\.\d+\.\d+$")
    blueprint_data: Dict[str, Any] = Field(..., description="Full Blueprint definition with nodes, edges, policies")


class AdminBlueprintValidateResponse(BaseModel):
    valid: bool
    errors: List[str] = Field(default_factory=list)
    node_count: int = 0
    edge_count: int = 0
    competencies_covered: List[str] = Field(default_factory=list)
    validated_at: str


class AdminDatasetGenerateResponse(BaseModel):
    blueprint_id: str
    version: str
    synthetic_examples_count: int
    gold_cases_count: int
    adversarial_cases_count: int
    question_bank_count: int
    checksum: str
    generated_at: str


class AdminJudgeEvaluationResponse(BaseModel):
    blueprint_id: str
    version: str
    total_cases_evaluated: int
    mean_absolute_error: float
    rubric_adherence_rate: float
    evidence_grounding_precision: float
    prompt_injection_resistance_rate: float
    gate_verdict: Literal["PASS", "FAIL"]
    details: Dict[str, Any] = Field(default_factory=dict)
    evaluated_at: str


class AdminBlueprintPublishResponse(BaseModel):
    blueprint_id: str
    version: str
    slug: str
    status: str
    published_at: str


class AdminBlueprintCoverageResponse(BaseModel):
    blueprint_id: str
    version: str
    domain: str
    competencies: List[Dict[str, Any]] = Field(default_factory=list)
    difficulty_spread: Dict[str, int] = Field(default_factory=dict)
    total_nodes: int = 0


class AdminBlueprintVersionItem(BaseModel):
    id: str
    version: str
    status: str
    checksum: Optional[str] = None
    published_at: Optional[str] = None
    created_at: str
