/**
 * Contest API client — thin typed transport over the FastAPI contest service.
 * All requests go through the same-origin /api gateway, so tokens and cookies
 * stay on one origin and no CORS pre-flight is required.
 */

import { getApiBase, getToken } from "@/lib/auth";
import type {
  AssessmentRanking,
  CampusPass,
  ContestCadence,
  ContestProblemPreview,
  ContestSummary,
  ParticipationRecord,
  RegistrationStatus,
  FinalStandingRow,
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
  };
}

export const contestApi = {
  async list(): Promise<ContestSummary[]> {
    const raw = await request<Record<string, any>[]>("/contests");
    return raw.map(toContestSummary);
  },

  async detail(slug: string): Promise<ContestSummary> {
    const raw = await request<Record<string, any>>(`/contests/${encodeURIComponent(slug)}`);
    return toContestSummary(raw);
  },

  async problems(slug: string): Promise<ContestProblemPreview[]> {
    const raw = await request<Record<string, any>[]>(
      `/contests/${encodeURIComponent(slug)}/problems`,
    );
    return raw.map((p, index) => ({
      problem_index: String(p["problem_index"] ?? index + 1),
      title: String(p["title"] ?? `Problem ${index + 1}`),
      topic: String(p["topic"] ?? "Algorithms"),
      points: Number(p["points"] ?? 100),
      solved_count: Number(p["solved_count"] ?? 0),
    }));
  },

  async registrationStatus(slug: string): Promise<RegistrationStatus | null> {
    if (!getToken()) return null;
    try {
      const raw = await request<Record<string, any>>(
        `/contests/${encodeURIComponent(slug)}/registration-status`,
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
        can_enter_live_contest: Boolean(raw["can_enter_live_contest"]),
        eligibility_message: raw["eligibility_message"] ?? null,
      };
    } catch (error) {
      if (error instanceof ContestApiError && (error.status === 401 || error.status === 403)) {
        return null;
      }
      throw error;
    }
  },

  register(slug: string) {
    return request<{ registered: boolean; message: string; registered_count: number }>(
      `/contests/${encodeURIComponent(slug)}/register`,
      { method: "POST" },
    );
  },

  checkIn(slug: string) {
    return request<{ success?: boolean; status?: string; message?: string }>(
      `/contests/${encodeURIComponent(slug)}/check-in`,
      { method: "POST" },
    );
  },

  async ranking(slug: string): Promise<AssessmentRanking> {
    const raw = await request<Record<string, any>>(
      `/assessment/${encodeURIComponent(slug)}/leaderboard`,
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

  async finalStandings(slug: string): Promise<FinalStandingRow[]> {
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


  async myPass(): Promise<CampusPass | null> {
    if (!getToken()) return null;
    try {
      const raw = await request<Record<string, any>>("/passes/my-pass");
      return {
        pass_code: String(raw["pass_code"]),
        member_name: String(raw["member_name"] ?? ""),
        handle: String(raw["handle"] ?? ""),
        prn_hash: String(raw["prn_hash"] ?? ""),
        contest_title: String(raw["contest_title"] ?? ""),
        seat: String(raw["seat"] ?? "Assigned at check-in"),
        venue: String(raw["venue"] ?? ""),
        check_in_opens_at: String(raw["check_in_opens_at"]),
        status: (raw["status"] ?? "issued") as CampusPass["status"],
      };
    } catch (error) {
      if (error instanceof ContestApiError && error.status === 404) return null;
      throw error;
    }
  },

  async participated(): Promise<ParticipationRecord[]> {
    if (!getToken()) return [];
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
      participants: Number(item["participants"] ?? 0),
      outcome: (item["outcome"] ?? "registered") as ParticipationRecord["outcome"],
    }));
  },
};

type ContestStatusAlias = ParticipationRecord["status"];
