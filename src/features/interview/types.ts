/**
 * Chaos Computer Club Medi-Caps — AI Interview Types
 * Type definitions matching backend FastAPI interview schemas.
 */

export type InterviewCategory =
  | "TECHNICAL"
  | "CODING"
  | "DSA"
  | "SYSTEM_DESIGN"
  | "BACKEND"
  | "FRONTEND"
  | "DEVOPS"
  | "DATABASE_SQL"
  | "BEHAVIORAL"
  | "MIXED";

export type ExperienceLevel = "ENTRY_LEVEL" | "MID_LEVEL" | "SENIOR";
export type InterviewDifficulty = "EASY" | "MEDIUM" | "HARD";
export type SupportedLanguage = "python" | "cpp" | "java" | "javascript" | "typescript";
export type SessionState =
  | "CREATED"
  | "PREPARING"
  | "ASKING"
  | "LISTENING"
  | "EVALUATING"
  | "FOLLOW_UP"
  | "PAUSED"
  | "COMPLETING"
  | "COMPLETED"
  | "ABANDONED"
  | "FAILED";

export interface InterviewCategoryInfo {
  id: InterviewCategory;
  name: string;
  description: string;
  badge: string;
  icon: string;
  default_topics: string[];
  supports_code: boolean;
  supports_diagrams: boolean;
}

export interface InterviewTrackSummary {
  slug: string;
  title: string;
  description: string;
  category: "TECHNICAL" | "OTHER" | string;
  domain: string;
  difficulty: string;
  duration_minutes: number;
  topics: string[];
  badge: string;
  icon: string;
  supports_code: boolean;
  supports_diagrams: boolean;
  version: string;
}

export interface InterviewTrackDetail extends InterviewTrackSummary {
  total_questions: number;
}

export interface InterviewConfigCreate {
  interview_slug?: string | undefined;
  resume_id?: string | undefined;
  target_role?: string | undefined;
  experience_level?: ExperienceLevel | undefined;
  category?: InterviewCategory | undefined;
  difficulty?: InterviewDifficulty | undefined;
  duration_minutes?: 15 | 30 | 45 | 60 | undefined;
  preferred_language?: SupportedLanguage | undefined;
  focus_topics?: string[] | undefined;
  job_description?: string | undefined;
  resume_notes?: string | undefined;
  resume_asset_ids?: string[] | undefined;
  mode?: "TEXT" | "VOICE" | undefined;
  language?: string | undefined;
}

export interface InterviewAnswerSubmit {
  idempotency_key: string;
  answer_text: string;
  submitted_code?: string | undefined;
  audio_duration_seconds?: number | undefined;
}

export interface InterviewQuestionSummary {
  id: string;
  order_index: number;
  parent_question_id?: string | null;
  question_type: "PRIMARY" | "FOLLOW_UP";
  topic: string;
  title: string;
  prompt: string;
  code_starter?: string | null;
  judge_problem_slug?: string | null;
  created_at: string;
}

export interface InterviewAnswerSummary {
  id: string;
  question_id: string;
  idempotency_key: string;
  answer_text: string;
  submitted_code?: string | null;
  judge_result?: Record<string, unknown> | null;
  created_at: string;
}

export interface InterviewEvaluationSummary {
  id: string;
  question_id: string;
  answer_id: string;
  score: number;
  rubric_scores: Record<string, number>;
  strengths: string[];
  gaps: string[];
  evidence_quotes: string[];
  model_answer: string;
  follow_up_recommended: boolean;
  created_at: string;
}

export interface InterviewReportDetail {
  id: string;
  session_id: string;
  overall_score: number;
  verdict: "STRONG_HIRE" | "HIRE" | "LEANING_HIRE" | "NEUTRAL" | "LEANING_NO_HIRE" | "NO_HIRE";
  executive_summary: string;
  dimension_breakdown: Record<string, number>;
  top_strengths: string[];
  areas_to_improve: string[];
  recommended_practice: Array<{
    topic: string;
    description: string;
    action_type: string;
  }>;
  created_at: string;
}

export interface InterviewSessionDetail {
  id: string;
  member_id: string;
  target_role: string;
  experience_level: ExperienceLevel;
  category: InterviewCategory;
  difficulty: InterviewDifficulty;
  duration_minutes: number;
  preferred_language: SupportedLanguage;
  focus_topics: string[];
  job_description?: string | null;
  resume_notes?: string | null;
  mode?: "TEXT" | "VOICE";
  language?: string;
  plan_version?: string;
  rubric_version?: string;
  version?: number;
  state: SessionState;
  current_question_index: number;
  total_questions_planned: number;
  started_at?: string | null;
  paused_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  current_question?: InterviewQuestionSummary | null;
  questions: InterviewQuestionSummary[];
  answers: InterviewAnswerSummary[];
  evaluations: InterviewEvaluationSummary[];
  report?: InterviewReportDetail | null;
}

export interface InterviewSessionListItem {
  id: string;
  target_role: string;
  experience_level: ExperienceLevel;
  category: InterviewCategory;
  difficulty: InterviewDifficulty;
  duration_minutes: number;
  mode?: string;
  state: SessionState;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  overall_score?: number | null;
  verdict?: string | null;
  total_questions: number;
  total_answers: number;
}

export interface CandidateProject {
  title: string;
  description: string;
  technologies: string[];
  role?: string;
}

export interface CandidateProfile {
  id: string;
  member_id: string;
  declared_skills: string[];
  demonstrated_strengths: string[];
  developmental_gaps: string[];
  preferred_tracks: string[];
  declared_projects: CandidateProject[];
  learning_goals: string[];
  resume_summary?: string | null;
  context_consent: boolean;
  updated_at: string;
}

export interface ResumeUploadResponse {
  asset_id: string;
  original_filename: string;
  detected_mime_type: string;
  size_bytes: number;
  scan_status: string;
  parse_status: string;
  consent_status: string;
  created_at: string;
}

export interface ResumeFactItem {
  id: string;
  fact_type: string;
  normalized_value: string;
  source_page?: number | null;
  source_section?: string | null;
  extraction_confidence: number;
  candidate_status: "UNREVIEWED" | "CONFIRMED" | "CORRECTED" | "REJECTED";
  candidate_corrected_value?: string | null;
}

export interface ResumeDetailResponse {
  asset: ResumeUploadResponse;
  facts: ResumeFactItem[];
}

export interface ResumeFactUpdateRequest {
  fact_id: string;
  candidate_status: "CONFIRMED" | "CORRECTED" | "REJECTED";
  candidate_corrected_value?: string;
}

export interface VoiceBindingResponse {
  interview_session_id: string;
  voice_session_id: string;
  owner_id: string;
  transport: {
    type: string;
    endpoint: string;
    sample_rate_hz: number;
    channels: number;
    codec: string;
  };
  supported_capabilities: string[];
  consent_required: boolean;
  status: string;
}

// ── Level 3 ML Assessment & Competency Types ─────────────────────────────────

export interface CompetencyNode {
  id: string;
  domain: string;
  name: string;
  status: "UNASSESSED" | "DEVELOPING" | "MASTERED" | "GAP";
  mastery_probability: number;
  epistemic_uncertainty: number;
  streak: number;
  history_length: number;
  pos_x: number;
  pos_y: number;
}

export interface CompetencyEdge {
  from_node: string;
  to_node: string;
  relation_type: string;
}

export interface CompetencyGraphResponse {
  session_id: string;
  metrics: {
    assessed_count: number;
    mastered_count: number;
    developing_count: number;
    gap_count: number;
    mean_mastery: number;
    coverage_ratio: number;
  };
  nodes: CompetencyNode[];
  edges: CompetencyEdge[];
}

export interface PredictionItem {
  competency_id: string;
  name: string;
  domain: string;
  predicted_pass_probability: number;
  predicted_score: number;
  confidence_lower: number;
  confidence_upper: number;
  low_evidence_warning: boolean;
}

export interface SessionPredictionsResponse {
  session_id: string;
  candidate_ability_theta: number;
  ability_standard_error: number;
  ability_confidence_interval: [number, number];
  overall_readiness_score: number;
  predictions: PredictionItem[];
}

export interface AdaptiveNextQuestionResponse {
  target_competency_id: string;
  target_competency_name: string;
  target_difficulty: string;
  item_difficulty_b: number;
  item_discrimination_a: number;
  selection_score: number;
  fisher_information: number;
  epistemic_uncertainty: number;
  rationale: string;
}

export interface CompetencyTaxonomyItem {
  id: string;
  domain: string;
  name: string;
  description: string;
  prerequisites: string[];
  default_difficulty: number;
  default_discrimination: number;
}
