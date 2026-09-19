/**
 * Chaos Computer Club — Admin Contest & Assessment API Transport
 * Type-safe HTTP transport connecting to /api/admin/contests/*
 */

import { getApiBase, getToken } from "@/lib/auth";

export interface TestCaseItem {
  stdin: string;
  expected_output: string;
  explanation?: string;
  weight?: number;
}

export interface ProblemPayload {
  problem_index: string;
  title: string;
  topic?: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  points: number;
  description: string;
  input_format?: string;
  output_format?: string;
  constraints?: string;
  time_limit: number;
  memory_limit: number;
  starter_codes?: Record<string, string>;
  sample_testcases: TestCaseItem[];
  hidden_testcases: TestCaseItem[];
  target?: "contest" | "assessment" | "both";
}

export interface AssessmentConfig {
  id?: string;
  slug?: string;
  title?: string;
  summary?: string;
  duration_minutes: number;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active: boolean;
  max_violations: number;
  created_at?: string | null;
}

export interface AdminContestSummary {
  id: string;
  slug: string;
  title: string;
  season: string;
  status: "upcoming" | "live" | "finished";
  division: string;
  cadence: string;
  edition?: number | null;
  starts_at: string;
  ends_at: string;
  check_in_opens_at: string;
  venue: string;
  seat_capacity: number;
  registered_count: number;
  problem_count: number;
  has_assessment: boolean;
  assessment_duration?: number | null;
  assessment_active?: boolean;
  environment: string;
  summary: string;
  rules: string[];
}

export interface AdminContestDetail {
  contest: AdminContestSummary & {
    chief_proctors: string[];
    prize_pool?: string | null;
    sponsor?: string | null;
    banner_url?: string | null;
  };
  assessment?: AssessmentConfig | null;
  contest_problems: (ProblemPayload & { id?: string; solved_count?: number })[];
  assessment_problems: (ProblemPayload & { id?: string })[];
}

export interface ContestCreatePayload {
  title: string;
  slug?: string;
  season: string;
  cadence: "weekly" | "biweekly" | "special";
  edition?: number;
  division: "open" | "division_1" | "division_2" | "division_3";
  starts_at: string;
  ends_at?: string;
  check_in_opens_at?: string;
  venue: string;
  seat_capacity: number;
  environment: string;
  chief_proctors?: string[];
  prize_pool?: string;
  sponsor?: string;
  summary: string;
  rules?: string[];
  banner_url?: string;
  initialize_screening?: boolean;
}

export interface ContestUpdatePayload {
  title?: string;
  season?: string;
  cadence?: string;
  edition?: number;
  division?: string;
  status?: string;
  starts_at?: string;
  ends_at?: string;
  check_in_opens_at?: string;
  venue?: string;
  seat_capacity?: number;
  environment?: string;
  chief_proctors?: string[];
  prize_pool?: string;
  sponsor?: string;
  summary?: string;
  rules?: string[];
  banner_url?: string;
}

export interface AssessmentUpdatePayload {
  title?: string;
  summary?: string;
  duration_minutes?: number;
  starts_at?: string | null;
  ends_at?: string | null;
  max_violations?: number;
  is_active?: boolean;
}

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const proctorKey = localStorage.getItem("ccc_proctor_key") || "1337";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Proctor-Key": proctorKey,
    "X-Admin-Key": proctorKey,
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message = errorData.detail || errorData.message || `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return res.json();
}

export const adminContestApi = {
  async list(): Promise<AdminContestSummary[]> {
    return adminFetch<AdminContestSummary[]>("/admin/contests");
  },

  async getDetail(slug: string): Promise<AdminContestDetail> {
    return adminFetch<AdminContestDetail>(`/admin/contests/${encodeURIComponent(slug)}`);
  },

  async create(payload: ContestCreatePayload): Promise<any> {
    return adminFetch("/admin/contests", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async update(slug: string, payload: ContestUpdatePayload): Promise<any> {
    return adminFetch(`/admin/contests/${encodeURIComponent(slug)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async delete(slug: string): Promise<any> {
    return adminFetch(`/admin/contests/${encodeURIComponent(slug)}`, {
      method: "DELETE",
    });
  },

  async changeStatus(slug: string, status: string, autoQualifyTop30 = true): Promise<any> {
    return adminFetch(`/admin/contests/${encodeURIComponent(slug)}/status`, {
      method: "POST",
      body: JSON.stringify({ status, auto_qualify_top_30: autoQualifyTop30 }),
    });
  },

  async clone(slug: string, payload: { new_title: string; new_slug?: string; starts_at: string; ends_at?: string; new_edition?: number }): Promise<any> {
    return adminFetch(`/admin/contests/${encodeURIComponent(slug)}/clone`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async launchPreset(payload: { cadence: string; edition: number; starts_in_hours: number; venue?: string; prize_pool?: string }): Promise<any> {
    return adminFetch("/admin/contests/preset/launch", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateAssessment(slug: string, payload: AssessmentUpdatePayload): Promise<any> {
    return adminFetch(`/admin/contests/${encodeURIComponent(slug)}/assessment`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async saveProblem(slug: string, payload: ProblemPayload, target: "contest" | "assessment" | "both" = "both"): Promise<any> {
    return adminFetch(`/admin/contests/${encodeURIComponent(slug)}/problems?target=${target}`, {
      method: "POST",
      body: JSON.stringify({ ...payload, target }),
    });
  },

  async deleteProblem(slug: string, problemIndex: string, target: "contest" | "assessment" | "both" = "both"): Promise<any> {
    return adminFetch(`/admin/contests/${encodeURIComponent(slug)}/problems/${encodeURIComponent(problemIndex)}?target=${target}`, {
      method: "DELETE",
    });
  },

  async syncProblems(slug: string, direction: "contest_to_assessment" | "assessment_to_contest"): Promise<any> {
    return adminFetch(`/admin/contests/${encodeURIComponent(slug)}/problems/sync`, {
      method: "POST",
      body: JSON.stringify({ direction }),
    });
  },
};
