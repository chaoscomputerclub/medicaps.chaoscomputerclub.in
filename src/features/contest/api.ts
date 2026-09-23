/**
 * Contest API client — thin typed transport over the FastAPI contest service.
 * Integrated with SWR memory caching, in-flight promise deduplication, and
 * automatic cache invalidation upon mutations.
 */

import { getApiBase, getToken } from "@/lib/auth";
import { swrFetch, invalidateSwrCache } from "@/lib/cache/swrCache";
import type {
  AssessmentRanking,
  CampusPass,
  ContestCadence,
  ContestProblemPreview,
  ContestSummary,
  ParticipationRecord,
  RegistrationStatus,
  FinalStandingRow,
  ContestArenaData,
  ArenaRunResult,
  ArenaSubmitResult,
} from "./types";

export class ContestApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ContestApiError";
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

  const proctorKey = typeof localStorage !== "undefined" ? localStorage.getItem("ccc_proctor_key") : null;
  if (proctorKey) {
    headers["X-Proctor-Key"] = proctorKey;
    headers["X-Admin-Key"] = proctorKey;
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBase()}${path}`, { ...init, headers });
  } catch {
    throw new ContestApiError("The contest service is unreachable right now.", 0);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: unknown } | null;
    const detail = typeof payload?.detail === "string" ? payload.detail : "Contest request failed.";
    throw new ContestApiError(detail, response.status);
  }
  return (await response.json()) as T;
}

function cadenceOf(title: string, slug: string): ContestCadence {
  const haystack = `${title} ${slug}`.toLowerCase();
  if (haystack.includes("biweekly") || haystack.includes("bi-weekly")) return "biweekly";
  if (haystack.includes("weekly")) return "weekly";
  return "special";
}

function editionOf(title: string, slug: string): number | null {
  const match = `${title} ${slug}`.match(/(?:contest|edition|#)\s*(\d{1,4})/i);
  return match?.[1] ? Number(match[1]) : null;
}

function toContestSummary(raw: Record<string, any>): ContestSummary {
  const title = String(raw["title"] ?? "Untitled contest");
  const slug = String(raw["slug"] ?? "");
  return {
    id: String(raw["id"] ?? slug),
    slug,
    title,
    season: String(raw["season"] ?? ""),
    summary: String(raw["summary"] ?? ""),
    status: (raw["status"] ?? "upcoming") as ContestSummary["status"],
    cadence: cadenceOf(title, slug),
    edition: editionOf(title, slug),
    starts_at: String(raw["starts_at"]),
    ends_at: String(raw["ends_at"]),
    check_in_opens_at: String(raw["check_in_opens_at"] ?? raw["starts_at"]),
    venue: String(raw["venue"] ?? "Campus computing complex"),
    seat_capacity: Number(raw["seat_capacity"] ?? 0),
    registered_count: Number(raw["registered_count"] ?? 0),
    problem_count: Number(raw["problem_count"] ?? 0),
    environment: String(raw["environment"] ?? ""),
    prize_pool: raw["prize_pool"] ?? null,
    sponsor: raw["sponsor"] ?? null,
    rules: Array.isArray(raw["rules"]) ? raw["rules"].map(String) : [],
    chief_proctors: Array.isArray(raw["chief_proctors"]) ? raw["chief_proctors"].map(String) : [],
    registered: Boolean(raw["registered"]),
    banner_url: raw["banner_url"] ?? null,
    assessment: raw["assessment"]
      ? {
          id: String(raw["assessment"]["id"] ?? ""),
          slug: String(raw["assessment"]["slug"] ?? ""),
          title: String(raw["assessment"]["title"] ?? ""),
          starts_at: String(raw["assessment"]["starts_at"] ?? ""),
          ends_at: String(raw["assessment"]["ends_at"] ?? ""),
          duration_minutes: Number(raw["assessment"]["duration_minutes"] ?? 120),
          is_active: Boolean(raw["assessment"]["is_active"]),
        }
      : null,
  };
}

export const contestApi = {
  async list(force = false): Promise<ContestSummary[]> {
    return swrFetch(
      "contests:list",
      async () => {
        let raw: Record<string, any>[] = [];
        try {
          raw = await request<Record<string, any>[]>("/contests");
        } catch {
          raw = [];
        }

        // Filter out obsolete standalone screening, dev records, and deprecated biweekly
        const filtered = raw.filter((r) => {
          const slug = String(r["slug"] ?? "").toLowerCase();
          const title = String(r["title"] ?? "").toLowerCase();
          if (slug === "dev-assessment-round" || slug === "dev-offline-final") return false;
          if (slug === "biweekly-contest-1") return false; // deprecated
          if (title.startsWith("[dev] round 1") || title.startsWith("[dev] round 2")) return false;
          return true;
        });

        return filtered.map(toContestSummary);
      },
      {
        staleTime: 30000,
        ttl: 300000,
        forceRefresh: force,
        persistSession: true,
      }
    );
  },

  async detail(slug: string, force = false): Promise<ContestSummary> {
    return swrFetch(
      `contest:detail:${slug}`,
      async () => {
        const raw = await request<Record<string, any>>(`/contests/${encodeURIComponent(slug)}`);
        return toContestSummary(raw);
      },
      {
        staleTime: 30000,
        ttl: 300000,
        forceRefresh: force,
        persistSession: true,
      }
    );
  },

  async problems(slug: string, force = false): Promise<ContestProblemPreview[]> {
    return swrFetch(
      `contest:problems:${slug}`,
      async () => {
        const raw = await request<Record<string, any>[]>(
          `/contests/${encodeURIComponent(slug)}/problems`
        );
        return raw.map((p, index) => ({
          problem_index: String(p["problem_index"] ?? index + 1),
          title: String(p["title"] ?? `Problem ${index + 1}`),
          topic: String(p["topic"] ?? "Algorithms"),
          points: Number(p["points"] ?? 100),
          solved_count: Number(p["solved_count"] ?? 0),
        }));
      },
      {
        staleTime: 60000,
        ttl: 600000,
        forceRefresh: force,
        persistSession: true,
      }
    );
  },

  async registrationStatus(slug: string, force = false): Promise<RegistrationStatus | null> {
    if (!getToken()) return null;
    return swrFetch(
      `contest:reg_status:${slug}`,
      async () => {
        try {
          const raw = await request<Record<string, any>>(
            `/contests/${encodeURIComponent(slug)}/registration-status`
          );
          return {
            registered: Boolean(raw["registered"]),
            contest_slug: slug,
            contest_status: (raw["contest_status"] ?? null) as RegistrationStatus["contest_status"],
            registered_at: raw["registered_at"] ?? null,
            assessment_taken: Boolean(raw["assessment_taken"]),
            assessment_score: raw["assessment_score"] ?? null,
            assessment_rank: raw["assessment_rank"] ?? null,
            assessment_status: raw["assessment_status"] ?? null,
            is_top_30_qualified: Boolean(raw["is_top_30_qualified"]),
            can_take_assessment: Boolean(raw["can_take_assessment"]),
            can_resume_assessment: Boolean(raw["can_resume_assessment"]),
            can_enter_live_contest: Boolean(raw["can_enter_live_contest"]),
            eligibility_message: raw["eligibility_message"] ?? null,
            is_dev_bypass: Boolean(raw["is_dev_bypass"]),
            remaining_seconds: raw["remaining_seconds"] ?? null,
            anti_cheat_violations: raw["anti_cheat_violations"] ?? 0,
            max_violations: raw["max_violations"] ?? 3,
          };
        } catch (error) {
          if (error instanceof ContestApiError && (error.status === 401 || error.status === 403)) {
            return null;
          }
          throw error;
        }
      },
      {
        staleTime: 15000,
        ttl: 120000,
        forceRefresh: force,
      }
    );
  },

  async register(slug: string) {
    const res = await request<{ registered: boolean; message: string; registered_count: number }>(
      `/contests/${encodeURIComponent(slug)}/register`,
      { method: "POST" }
    );
    // Invalidate caches across the platform
    invalidateSwrCache("contests:*");
    invalidateSwrCache(`contest:*:${slug}*`);
    invalidateSwrCache("portal:*");
    invalidateSwrCache("passes:*");
    return res;
  },

  async unregister(slug: string) {
    const res = await request<{ registered: boolean; message: string; registered_count: number }>(
      `/contests/${encodeURIComponent(slug)}/unregister`,
      { method: "POST" }
    );
    invalidateSwrCache("contests:*");
    invalidateSwrCache(`contest:*:${slug}*`);
    invalidateSwrCache("portal:*");
    invalidateSwrCache("passes:*");
    return res;
  },

  async checkIn(slug: string) {
    const res = await request<{ success?: boolean; status?: string; message?: string }>(
      `/contests/${encodeURIComponent(slug)}/check-in`,
      { method: "POST" }
    );
    invalidateSwrCache("contests:*");
    invalidateSwrCache(`contest:*:${slug}*`);
    invalidateSwrCache("portal:*");
    return res;
  },

  async ranking(slug: string, force = false): Promise<AssessmentRanking> {
    return swrFetch(
      `contest:ranking:${slug}`,
      async () => {
        const raw = await request<Record<string, any>>(
          `/assessment/${encodeURIComponent(slug)}/leaderboard`
        );
        const rows = Array.isArray(raw["leaderboard"]) ? raw["leaderboard"] : [];
        return {
          contest_slug: slug,
          cutoff: Number(raw["cutoff_rank"] ?? raw["cutoff"] ?? 30),
          total_participants: Number(raw["total_participants"] ?? rows.length),
          released: raw["released"] === undefined ? true : Boolean(raw["released"]),
          releases_at: raw["releases_at"] ?? null,
          message: typeof raw["message"] === "string" ? raw["message"] : null,
          rows: rows.map((r: Record<string, any>, index: number) => ({
            rank: Number(r["rank"] ?? index + 1),
            handle: String(r["handle"] ?? "cadet"),
            full_name: String(r["full_name"] ?? r["handle"] ?? "Cadet"),
            department: String(r["department"] ?? "—"),
            batch: String(r["batch"] ?? "—"),
            total_score: Number(r["total_score"] ?? 0),
            penalty_minutes: Number(r["penalty_minutes"] ?? 0),
            status: String(r["status"] ?? "submitted"),
            is_top_30_qualified: Boolean(r["is_top_30_qualified"]),
          })),
        };
      },
      {
        staleTime: 15000,
        ttl: 120000,
        forceRefresh: force,
      }
    );
  },

  async finalStandings(slug: string, force = false): Promise<FinalStandingRow[]> {
    return swrFetch(
      `contest:final_standings:${slug}`,
      async () => {
        const raw = await request<Record<string, any>[]>(`/scoreboards/${encodeURIComponent(slug)}`);
        return raw
          .map((r) => ({
            rank: Number(r["rank"] ?? 0),
            handle: String(r["handle"] ?? "cadet"),
            full_name: String(r["full_name"] ?? r["handle"] ?? "Cadet"),
            department: String(r["department"] ?? "—"),
            batch: String(r["batch"] ?? "—"),
            division: String(r["division"] ?? "—"),
            score: Number(r["score"] ?? 0),
            solved: Number(r["solved"] ?? 0),
            penalty_minutes: Math.round(Number(r["penalty_seconds"] ?? 0) / 60),
            rating_delta: r["rating_delta"] == null ? null : Number(r["rating_delta"]),
          }))
          .sort((a, b) => a.rank - b.rank);
      },
      {
        staleTime: 30000,
        ttl: 300000,
        forceRefresh: force,
        persistSession: true,
      }
    );
  },

  async myPass(): Promise<CampusPass | null> {
    if (!getToken()) return null;
    return swrFetch(
      "passes:my_pass",
      async () => {
        try {
          const raw = await request<Record<string, any>>("/passes/my-pass");
          return {
            pass_code: String(raw["pass_code"]),
            member_name: String(raw["member_name"] ?? ""),
            handle: String(raw["handle"] ?? ""),
            prn_hash: String(raw["prn_hash"] ?? ""),
            contest_title: String(raw["contest_title"] ?? ""),
            seat: String(raw["seat"] ?? raw["seat_number"] ?? "Assigned at check-in"),
            venue: String(raw["venue"] ?? ""),
            check_in_opens_at: String(raw["check_in_opens_at"]),
            status: (raw["status"] ?? raw["check_in_status"] ?? "issued") as CampusPass["status"],
          };
        } catch (error) {
          if (error instanceof ContestApiError && error.status === 404) return null;
          throw error;
        }
      },
      { staleTime: 30000, ttl: 300000 }
    );
  },

  async contestPass(slug: string): Promise<CampusPass | null> {
    if (!getToken()) return null;
    return swrFetch(
      `passes:contest:${slug}`,
      async () => {
        try {
          const raw = await request<Record<string, any>>(`/passes/contest/${encodeURIComponent(slug)}/my-pass`);
          return {
            pass_code: String(raw["pass_code"]),
            member_name: String(raw["member_name"] ?? ""),
            handle: String(raw["handle"] ?? ""),
            prn_hash: String(raw["prn_hash"] ?? ""),
            contest_title: String(raw["contest_title"] ?? ""),
            seat: String(raw["seat"] ?? raw["seat_number"] ?? "Assigned at check-in"),
            venue: String(raw["venue"] ?? ""),
            check_in_opens_at: String(raw["check_in_opens_at"]),
            status: (raw["status"] ?? raw["check_in_status"] ?? "issued") as CampusPass["status"],
          };
        } catch (error) {
          if (error instanceof ContestApiError && error.status === 404) return null;
          return null;
        }
      },
      { staleTime: 30000, ttl: 300000 }
    );
  },

  async verifyProctorPass(payload: { pass_code_or_qr: string; contest_slug?: string }) {
    return request<{
      valid: boolean;
      status: string;
      message: string;
      pass_code?: string;
      seat_number?: string;
      contest_title?: string;
      candidate_name?: string;
      handle?: string;
      department?: string;
      batch?: string;
      qualification_rank?: number;
      screening_score?: number;
      checked_in_at?: string;
      checked_in_by?: string;
    }>("/passes/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async qualifyTop30(slug: string) {
    const res = await request<{ success: boolean; qualified_count: number; qualifiers: any[] }>(
      `/assessment/${encodeURIComponent(slug)}/qualify-top30`,
      { method: "POST" }
    );
    invalidateSwrCache("contests:*");
    invalidateSwrCache(`contest:*:${slug}*`);
    return res;
  },

  async attendees(slug: string) {
    return request<any[]>(`/passes/contest/${encodeURIComponent(slug)}/attendees`);
  },

  async resetDevSession(slug: string) {
    const res = await request<{ success: boolean; message: string }>(
      `/assessment/${encodeURIComponent(slug)}/reset-dev-session`,
      { method: "POST" }
    );
    invalidateSwrCache("contests:*");
    invalidateSwrCache(`contest:*:${slug}*`);
    return res;
  },

  async participated(force = false): Promise<ParticipationRecord[]> {
    if (!getToken()) return [];
    return swrFetch(
      "contests:my_participated",
      async () => {
        const raw = await request<Record<string, any>[]>("/contests/my/participated");
        return raw.map((item) => ({
          contest_slug: String(item["contest_slug"]),
          contest_title: String(item["contest_title"]),
          season: String(item["season"] ?? ""),
          status: (item["status"] ?? "upcoming") as ContestStatusAlias,
          participated_at: String(item["participated_at"] ?? new Date().toISOString()),
          starts_at: item["starts_at"] ?? null,
          ends_at: item["ends_at"] ?? null,
          venue: item["venue"] ?? null,
          score: item["score"] ?? null,
          rank: item["rank"] ?? null,
          rating_delta: item["rating_delta"] ?? null,
          participants: Number(item["participants"] ?? 0),
          outcome: (item["outcome"] ?? "registered") as ParticipationRecord["outcome"],
          assessment_submitted: Boolean(
            item["assessment_submitted"] ||
            (item["score"] !== null && item["score"] !== undefined) ||
            item["outcome"] === "submitted" ||
            item["outcome"] === "qualified"
          ),
          assessment_score: item["assessment_score"] ?? item["score"] ?? null,
        }));
      },
      {
        staleTime: 20000,
        ttl: 300000,
        forceRefresh: force,
        persistSession: true,
      }
    );
  },

  async arena(slug: string): Promise<ContestArenaData> {
    return await request<ContestArenaData>(`/contests/${encodeURIComponent(slug)}/arena`);
  },

  async runArenaCode(slug: string, payload: { problem_id: string; language: string; code: string; custom_stdin?: string }): Promise<ArenaRunResult> {
    return await request<ArenaRunResult>(`/contests/${encodeURIComponent(slug)}/arena/run`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async submitArenaCode(slug: string, payload: { problem_id: string; language: string; code: string }): Promise<ArenaSubmitResult> {
    const res = await request<ArenaSubmitResult>(`/contests/${encodeURIComponent(slug)}/arena/submit`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    invalidateSwrCache(`contest:ranking:${slug}*`);
    invalidateSwrCache(`contest:final_standings:${slug}*`);
    return res;
  },

  async finishContest(slug: string): Promise<{ success: boolean; message: string; total_score?: number }> {
    const res = await request<{ success: boolean; message: string; total_score?: number }>(
      `/assessment/${encodeURIComponent(slug)}/finish`,
      { method: "POST" }
    );
    invalidateSwrCache("contests:*");
    invalidateSwrCache(`contest:*:${slug}*`);
    invalidateSwrCache(`contest:reg_status:${slug}*`);
    return res;
  },
};

type ContestStatusAlias = ParticipationRecord["status"];
