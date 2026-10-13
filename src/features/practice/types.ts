/**
 * Chaos Computer Club Medi-Caps — Practice Platform Types
 * Canonical data contracts matching backend schemas and domain models.
 */

export type ProblemDifficulty = "EASY" | "MEDIUM" | "HARD";
export type ProblemStatusFilter = "ALL" | "SOLVED" | "ATTEMPTED" | "UNATTEMPTED";
export type MemberProblemStatus = "SOLVED" | "ATTEMPTED" | "UNATTEMPTED";

export interface PracticeTopic {
  name: string;
  slug: string;
  count: number;
}

export interface PracticeProblemSummary {
  id: string;
  slug: string;
  title: string;
  difficulty: ProblemDifficulty;
  topic: string;
  problem_index?: string | null;
  time_limit: number;
  memory_limit: number;
  tags?: string[];
  user_status: MemberProblemStatus;
  total_submissions: number;
  accepted_submissions: number;
  acceptance_rate: number;
}

export interface PracticeProblemListResponse {
  items: PracticeProblemSummary[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  summary: {
    total_published?: number;
    total_problems?: number;
    solved_count: number;
    attempted_count: number;
  };
}

export interface PracticeSampleTestcase {
  testcase_id: string;
  input: string;
  expected_output: string;
  explanation?: string;
}

export interface PracticeEditorial {
  approach?: string;
  algorithm?: string;
  correctness?: string;
  complexity?: string;
  code?: string;
}

export interface PracticeProblemDetail {
  id: string;
  slug: string;
  title: string;
  difficulty: ProblemDifficulty;
  topic: string;
  problem_index?: string | null;
  description: string;
  constraints: string;
  time_limit: number;
  memory_limit: number;
  tags?: string[];
  hints?: string[];
  editorial?: PracticeEditorial | null;
  execution_mode: string;
  function_signature?: any;
  starter_code?: Record<string, string>;
  sample_testcases?: PracticeSampleTestcase[];
  samples?: PracticeSampleTestcase[];
  user_status: MemberProblemStatus;
  total_submissions?: number;
  accepted_submissions?: number;
  acceptance_rate?: number;
}

export interface PracticeRunTestCaseResult {
  testcase_id: string;
  status: string;
  passed: boolean;
  input: string;
  expected_output: string;
  actual_output: string;
  runtime_ms: number;
  error?: string;
}

export interface PracticeRunResult {
  verdict: string;
  runtime_ms: number;
  memory_kb: number;
  testcases: PracticeRunTestCaseResult[];
  compile_error?: string;
}

export interface PracticeSubmitResult {
  submission_id: string;
  status: string;
  verdict: string;
  score: number;
  runtime: number;
  memory: number;
  passed_count: number;
  total_testcases: number;
  compile_error?: string;
  first_failing_case?: {
    testcase_id?: string;
    input?: string;
    expected_output?: string;
    actual_output?: string;
    error?: string;
  };
  is_first_solve?: boolean;
  user_status: MemberProblemStatus;
}

export interface PracticeSubmissionRecord {
  id: string;
  status: string;
  verdict: string;
  language: string;
  runtime: number | null;
  memory: number | null;
  submitted_at: string;
  score: number;
  code?: string;
  error_message?: string;
}

export interface ActivityDay {
  date: string; // YYYY-MM-DD
  activity: number;
  unique_problems: number;
  accepted: number;
}

export interface PracticeActivityResponse {
  year: number;
  days: ActivityDay[];
  summary: {
    active_days: number;
    total_problems: number;
    total_accepted: number;
    current_streak: number;
    longest_streak: number;
  };
}

export interface PracticeStatsResponse {
  problems: {
    solved: number;
    attempted: number;
    total: number;
  };
  difficulty: {
    easy: { solved: number; total: number };
    medium: { solved: number; total: number };
    hard: { solved: number; total: number };
  };
}
