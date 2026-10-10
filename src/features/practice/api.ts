/**
 * Chaos Computer Club Medi-Caps — Practice API Client
 * Typed transport over FastAPI Practice Platform endpoints.
 * SWR-integrated memory caching, request deduplication, and centralized cache invalidation.
 */

import { getApiBase, getToken } from "@/lib/auth";
import { swrFetch, invalidateSwrCache } from "@/lib/cache/swrCache";
import type {
  PracticeTopic,
  PracticeProblemListResponse,
  PracticeProblemDetail,
  PracticeRunResult,
  PracticeSubmitResult,
  PracticeSubmissionRecord,
  PracticeActivityResponse,
  PracticeStatsResponse,
} from "./types";

export class PracticeApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PracticeApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${getApiBase()}${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch {
    throw new PracticeApiError("The practice platform service is unreachable right now.", 0);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: unknown } | null;
    const detail = typeof payload?.detail === "string" ? payload.detail : "Practice request failed.";
    throw new PracticeApiError(detail, response.status);
  }
  return (await response.json()) as T;
}

export interface PracticeProblemFilters {
  q?: string | undefined;
  difficulty?: string | undefined;
  topic?: string | undefined;
  status?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  sort?: string | undefined;
}

export const practiceApi = {
  /**
   * List canonical DSA topics with problem counts
   */
  getTopics: async (force = false): Promise<PracticeTopic[]> => {
    return swrFetch(
      "practice:topics",
      () => request<PracticeTopic[]>("/practice/topics"),
      { ttl: 10 * 60 * 1000, staleTime: 60 * 1000, forceRefresh: force }
    );
  },

  /**
   * Search and filter published practice problems
   */
  listProblems: async (
    filters: PracticeProblemFilters = {},
    force = false
  ): Promise<PracticeProblemListResponse> => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.difficulty && filters.difficulty !== "ALL") params.set("difficulty", filters.difficulty);
    if (filters.topic && filters.topic !== "ALL") params.set("topic", filters.topic);
    if (filters.status && filters.status !== "ALL") params.set("status", filters.status);
    if (filters.page) params.set("page", String(filters.page));
    if (filters.limit) params.set("limit", String(filters.limit));
    if (filters.sort) params.set("sort", filters.sort);

    const qs = params.toString();
    const cacheKey = `practice:problems:${qs}`;

    return swrFetch(
      cacheKey,
      () => request<PracticeProblemListResponse>(`/practice/problems${qs ? `?${qs}` : ""}`),
      { ttl: 60 * 1000, staleTime: 10 * 1000, forceRefresh: force }
    );
  },

  /**
   * Get single practice problem details
   */
  getProblem: async (slug: string, force = false): Promise<PracticeProblemDetail> => {
    const cacheKey = `practice:problem:${slug.toLowerCase()}`;
    return swrFetch(
      cacheKey,
      () => request<PracticeProblemDetail>(`/practice/problems/${encodeURIComponent(slug)}`),
      { ttl: 5 * 60 * 1000, staleTime: 30 * 1000, forceRefresh: force }
    );
  },

  /**
   * Run code against sample test cases (no submission saved)
   */
  runCode: async (
    slug: string,
    code: string,
    language: string
  ): Promise<PracticeRunResult> => {
    return request<PracticeRunResult>(`/practice/problems/${encodeURIComponent(slug)}/run`, {
      method: "POST",
      body: JSON.stringify({ code, language }),
    });
  },

  /**
   * Submit code against full judge test suite
   */
  submitCode: async (
    slug: string,
    code: string,
    language: string
  ): Promise<PracticeSubmitResult> => {
    const res = await request<PracticeSubmitResult>(`/practice/problems/${encodeURIComponent(slug)}/submit`, {
      method: "POST",
      body: JSON.stringify({ code, language }),
    });

    // Centralized cache invalidation on terminal submission
    invalidateSwrCache(`practice:problem:${slug.toLowerCase()}`);
    invalidateSwrCache("practice:problems:*");
    invalidateSwrCache("practice:submissions:*");
    invalidateSwrCache("practice:activity:*");
    invalidateSwrCache("practice:stats:*");
    invalidateSwrCache("member:profile:full");

    return res;
  },

  /**
   * Get submission history for a problem
   */
  getSubmissions: async (
    slug: string,
    limit = 30,
    offset = 0
  ): Promise<PracticeSubmissionRecord[]> => {
    const qs = `limit=${limit}&offset=${offset}`;
    return request<PracticeSubmissionRecord[]>(
      `/practice/problems/${encodeURIComponent(slug)}/submissions?${qs}`
    );
  },

  /**
   * Get 365-day coding activity graph
   */
  getActivity: async (
    year?: number,
    handle?: string,
    force = false
  ): Promise<PracticeActivityResponse> => {
    const path = handle
      ? `/practice/activity/${encodeURIComponent(handle)}${year ? `?year=${year}` : ""}`
      : `/practice/activity${year ? `?year=${year}` : ""}`;
    const cacheKey = `practice:activity:${handle || "me"}:${year || "current"}`;

    return swrFetch(
      cacheKey,
      () => request<PracticeActivityResponse>(path),
      { ttl: 2 * 60 * 1000, staleTime: 30 * 1000, forceRefresh: force }
    );
  },

  /**
   * Get canonical problem solving stats
   */
  getStats: async (handle?: string, force = false): Promise<PracticeStatsResponse> => {
    const path = handle
      ? `/practice/stats/${encodeURIComponent(handle)}`
      : `/practice/stats`;
    const cacheKey = `practice:stats:${handle || "me"}`;

    return swrFetch(
      cacheKey,
      () => request<PracticeStatsResponse>(path),
      { ttl: 2 * 60 * 1000, staleTime: 30 * 1000, forceRefresh: force }
    );
  },

  /**
   * Get cadet's recent submissions
   */
  getRecentSubmissions: async (
    handle?: string,
    onlyAccepted = false,
    limit = 10,
    force = false
  ): Promise<any[]> => {
    const qs = `limit=${limit}&only_accepted=${onlyAccepted}`;
    const path = handle
      ? `/practice/submissions/recent/${encodeURIComponent(handle)}?${qs}`
      : `/practice/submissions/recent?${qs}`;
    const cacheKey = `practice:submissions:recent:${handle || "me"}:${onlyAccepted}`;

    return swrFetch(
      cacheKey,
      () => request<any[]>(path),
      { ttl: 60 * 1000, staleTime: 15 * 1000, forceRefresh: force }
    );
  },

  /**
   * Reconcile authoritative statistics from raw submissions
   */
  reconcile: async (): Promise<{ success: boolean; reconciled_problems: number }> => {
    const res = await request<{ success: boolean; reconciled_problems: number }>(
      "/practice/reconcile",
      { method: "POST" }
    );
    invalidateSwrCache("practice:*");
    invalidateSwrCache("member:profile:full");
    return res;
  },

  /**
   * Seed institutional DSA challenge suite (Core Team / Admin only)
   */
  seedInstitutionalSuite: async (): Promise<{ message: string; count: number; seeded: string[] }> => {
    const res = await request<{ message: string; count: number; seeded: string[] }>(
      "/admin/problems/seed-institutional-suite",
      { method: "POST" }
    );
    invalidateSwrCache("practice:*");
    return res;
  },
};
