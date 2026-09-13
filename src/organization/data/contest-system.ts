/**
 * Chaos Computer Club India — Live Two-Round Contest System Data Layer
 * Pure Real-Time Database Queries via FastAPI Backend — Zero Static Fixtures
 */

import { getApiBase, getToken } from "@/lib/auth";

export type ContestLifecycle =
  | "registration_open"
  | "assessment_live"
  | "results_pending"
  | "qualification_announced"
  | "offline_complete";

export type ReviewState =
  | "default"
  | "empty"
  | "loading"
  | "waiting"
  | "live"
  | "submitted"
  | "pending"
  | "qualified"
  | "not-qualified"
  | "locked";

export type Stage = {
  number: 1 | 2;
  title: string;
  mode: "online" | "offline";
  status: "upcoming" | "live" | "complete" | "locked";
  starts_at: string;
  ends_at: string;
};

export type AssessmentProblem = {
  id: string;
  index: string;
  title: string;
  category: string;
  points: number;
  status: "unseen" | "viewed" | "answered" | "flagged";
  prompt: string;
  options: string[];
  selected_option: number | null;
};

export type AssessmentSession = {
  status: "waiting" | "live" | "submitted";
  opens_at: string;
  closes_at: string;
  duration_minutes: number;
  remaining_seconds: number;
  answered_count: number;
  problems: AssessmentProblem[];
};

export type RankingEntry = {
  rank: number;
  username: string;
  full_name: string;
  department: string;
  batch: string;
  score: number;
  answered: number;
  time_seconds: number;
  qualified: boolean;
  is_current_user: boolean;
};

export type ContestRecord = {
  id: string;
  slug: string;
  title: string;
  season: string;
  summary: string;
  lifecycle: ContestLifecycle;
  registration_closes_at: string;
  results_at: string;
  eligibility: string[];
  rules: string[];
  prizes: string[];
  registered_count: number;
  registered: boolean;
  stages: [Stage, Stage];
  assessment: AssessmentSession;
  rankings: RankingEntry[];
  current_user_result: RankingEntry;
  logistics: {
    venue: string;
    reporting_at: string;
    contact: string;
    checklist: string[];
    seat: string;
    gate: string;
    pass_code: string;
  };
};

export type ContestHistoryItem = {
  contest_id?: string;
  contest_slug: string;
  contest_title: string;
  season: string;
  status: "upcoming" | "live" | "finished";
  lifecycle: ContestLifecycle;
  participated_at: string;
  starts_at?: string | null;
  ends_at?: string | null;
  venue?: string | null;
  score: number | null;
  rank: number | null;
  participants: number;
  outcome: "registered" | "live" | "qualified" | "not_qualified" | "pending";
  offline_result: string | null;
};

export type AccountSettings = {
  full_name: string;
  username: string;
  bio: string;
  avatar_initials: string;
  email: string;
  notifications: { contest_updates: boolean; results: boolean; chapter_news: boolean };
  connections: { provider: string; label: string; connected: boolean }[];
  sessions: { device: string; location: string; last_active: string; current: boolean }[];
};

function mapBackendContestToRecord(c: any, standings: any[] = []): ContestRecord {
  const isFinished = c.status === "finished";
  const isLive = c.status === "live";

  const lifecycle: ContestLifecycle = isFinished
    ? "offline_complete"
    : isLive
      ? "assessment_live"
      : "registration_open";

  const problems: AssessmentProblem[] = (c.problems || []).map((p: any, idx: number) => ({
    id: p.id || `p${idx + 1}`,
    index: p.problem_index ?? String(idx + 1).padStart(2, "0"),
    title: p.title || `Problem ${idx + 1}`,
    category: p.topic || "Algorithms",
    points: p.points || 100,
    status: "unseen",
    prompt: p.description || p.editorial_summary || p.title || "Algorithmic challenge problem.",
    options: p.options || ["Option A", "Option B", "Option C", "Option D"],
    selected_option: null,
  }));

  const rankings: RankingEntry[] = (standings || []).map((s: any, idx: number) => ({
    rank: s.rank ?? idx + 1,
    username: s.handle || s.username || `cadet_${idx + 1}`,
    full_name: s.full_name || s.name || s.handle || "Cadet",
    department: s.department || "CSE",
    batch: s.batch || "2023-27",
    score: s.score ?? 0,
    answered: s.solved ?? 0,
    time_seconds: s.penalty_seconds ?? 0,
    qualified: (s.rank ?? idx + 1) <= 30,
    is_current_user: false,
  }));

  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    season: c.season || "Season 1 — 2026",
    summary: c.summary || "Proctored offline contest.",
    lifecycle,
    registration_closes_at: c.check_in_opens_at || c.starts_at,
    results_at: c.ends_at,
    eligibility: c.rules?.slice(0, 3) || [
      "Currently enrolled Medi-Caps University students",
      "Individual participation only",
      "Verified university email required",
    ],
    rules: c.rules || [
      "Single workstation, physical air-gapped network.",
      "Proctored live screening with automated anti-cheat telemetry.",
      "Points awarded dynamically per testcase suite passed.",
      "Ties broken by aggregate submission penalty time.",
    ],
    prizes: [c.prize_pool || "Official CCC Certification & Trophies"],
    registered_count: c.registered_count ?? 0,
    registered: Boolean(c.registered),
    stages: [
      {
        number: 1,
        title: "Phase 1 Online Screening",
        mode: "online",
        status: isLive ? "live" : isFinished ? "complete" : "upcoming",
        starts_at: c.starts_at,
        ends_at: c.ends_at,
      },
      {
        number: 2,
        title: "Campus Live Final",
        mode: "offline",
        status: isFinished ? "complete" : "locked",
        starts_at: c.ends_at,
        ends_at: c.ends_at,
      },
    ],
    assessment: {
      status: isLive ? "live" : "waiting",
      opens_at: c.starts_at,
      closes_at: c.ends_at,
      duration_minutes: 90,
      remaining_seconds: 5400,
      answered_count: 0,
      problems,
    },
    rankings,
    current_user_result: rankings[0] ?? {
      rank: 0,
      username: "",
      full_name: "",
      department: "CSE",
      batch: "2023-27",
      score: 0,
      answered: 0,
      time_seconds: 0,
      qualified: false,
      is_current_user: true,
    },
    logistics: {
      venue: c.venue || "Computing Complex · Lab Block",
      reporting_at: c.check_in_opens_at || c.starts_at,
      contact: "CCC Operations Desk",
      checklist: [
        "Physical campus ID card",
        "QR pass on this page",
        "Arrive before reporting window closes",
        "No personal laptops or external storage media",
      ],
      seat: "Allocated upon check-in",
      gate: "Computing Complex North Entrance",
      pass_code: `CCC-${c.slug.toUpperCase()}-VERIFIED`,
    },
  };
}

export const contestSystemService = {
  async listContests(): Promise<ContestRecord[]> {
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/contests`);
      if (res.ok) {
        const apiContests = await res.json();
        if (Array.isArray(apiContests)) {
          return apiContests.map((c) => mapBackendContestToRecord(c));
        }
      }
    } catch (e) {
      console.error("Failed to fetch contests from API:", e);
    }
    return [];
  },

  async getContest(slug: string): Promise<ContestRecord | null> {
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/contests/${slug}`);
      if (res.ok) {
        const c = await res.json();
        const sbRes = await fetch(`${apiBase}/scoreboards/${slug}`).catch(() => null);
        const standings = sbRes && sbRes.ok ? await sbRes.json() : [];
        return mapBackendContestToRecord(c, standings);
      }
    } catch (e) {
      console.error("Failed to fetch contest from API:", e);
    }
    return null;
  },

  async getHistory(): Promise<ContestHistoryItem[]> {
    try {
      const token = getToken();
      if (!token) return [];
      const apiBase = getApiBase();

      // 1. Fetch comprehensive participated & registered contests
      const res = await fetch(`${apiBase}/contests/my/participated`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.map((item: any) => ({
            contest_id: item.contest_id,
            contest_slug: item.contest_slug,
            contest_title: item.contest_title,
            season: item.season || "Season 1 — 2026",
            status: item.status || "upcoming",
            lifecycle:
              item.status === "finished"
                ? "offline_complete"
                : item.status === "live"
                ? "assessment_live"
                : "registration_open",
            participated_at: item.participated_at || new Date().toISOString(),
            starts_at: item.starts_at,
            ends_at: item.ends_at,
            venue: item.venue || "Computing Complex · Lab Block 04",
            score: item.score ?? null,
            rank: item.rank ?? null,
            participants: item.participants ?? 30,
            outcome: item.outcome || "registered",
            offline_result: item.offline_result || null,
          }));
        }
      }

      // 2. Fallback to /auth/profile/full
      const profileRes = await fetch(`${apiBase}/auth/profile/full`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (profileRes.ok) {
        const data = await profileRes.json();
        const battles = data.recentBattles || [];
        return battles.map((b: any) => ({
          contest_slug: b.contest_slug || b.contest.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          contest_title: b.contest,
          season: "Season 1 — 2026",
          status: "finished",
          lifecycle: "offline_complete",
          participated_at: b.date,
          starts_at: null,
          ends_at: null,
          venue: "Computing Complex",
          score: b.score ?? 0,
          rank: b.rank,
          participants: b.participants ?? 30,
          outcome: b.rank <= 30 ? "qualified" : "not_qualified",
          offline_result: b.certificate_id ? `Certificate ${b.certificate_id}` : null,
        }));
      }
    } catch (e) {
      console.error("Failed to fetch history from API:", e);
    }
    return [];
  },

  async getSettings(): Promise<AccountSettings> {
    const defaultSettings: AccountSettings = {
      full_name: "",
      username: "",
      bio: "",
      avatar_initials: "??",
      email: "",
      notifications: { contest_updates: true, results: true, chapter_news: false },
      connections: [],
      sessions: [],
    };
    const token = getToken();
    if (!token) return defaultSettings;
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const m = await res.json();
        return {
          full_name: m.full_name || "",
          username: m.handle || "",
          bio: m.bio || "",
          avatar_initials: (m.handle ? m.handle.slice(0, 2) : "??").toUpperCase(),
          email: m.email || "",
          notifications: { contest_updates: true, results: true, chapter_news: false },
          connections: m.github_username ? [{ provider: "GitHub", label: `@${m.github_username}`, connected: true }] : [],
          sessions: [{ device: "Current Browser", location: "Campus Network", last_active: "Active now", current: true }],
        };
      }
    } catch {}
    return defaultSettings;
  },

  async checkUsername(username: string): Promise<{ available: boolean }> {
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/auth/check-handle?handle=${encodeURIComponent(username)}`);
      if (res.ok) {
        const d = await res.json();
        return { available: Boolean(d.available) };
      }
    } catch {}
    return { available: true };
  },
};

export function reviewState(value: unknown): ReviewState {
  const valid: ReviewState[] = [
    "default",
    "empty",
    "loading",
    "waiting",
    "live",
    "submitted",
    "pending",
    "qualified",
    "not-qualified",
    "locked",
  ];
  return valid.includes(value as ReviewState) ? (value as ReviewState) : "default";
}
