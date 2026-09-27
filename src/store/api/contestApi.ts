import { baseApi } from "./baseApi";
import type {
  ContestSummary,
  RegistrationStatus,
  CampusPass,
  ContestProblemPreview,
  AssessmentRanking,
  FinalStandingRow,
  ParticipationRecord,
  ContestArenaData,
  ArenaRunResult,
  ArenaSubmitResult,
  ContestCadence,
} from "@/features/contest/types";

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

export function normalizeContestSummary(raw: Record<string, any>): ContestSummary {
  const title = String(raw["title"] ?? "Untitled contest");
  const slug = String(raw["slug"] ?? "");
  const statusRaw = raw["status"];
  const status =
    statusRaw === "finished" || statusRaw === "concluded" || statusRaw === "completed" || statusRaw === "past"
      ? "finished"
      : statusRaw === "live"
      ? "live"
      : "upcoming";

  return {
    id: String(raw["id"] ?? slug),
    slug,
    title,
    season: String(raw["season"] ?? ""),
    summary: String(raw["summary"] ?? ""),
    status,
    cadence: cadenceOf(title, slug),
    edition: editionOf(title, slug),
    starts_at: String(raw["starts_at"]),
    ends_at: String(raw["ends_at"]),
    check_in_opens_at: String(raw["check_in_opens_at"] ?? raw["starts_at"]),
    venue: String(raw["venue"] ?? "Campus computing complex"),
    division: raw["division"] ? String(raw["division"]) : undefined,
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

export const contestApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getContests: builder.query<ContestSummary[], void>({
      query: () => "/contests",
      transformResponse: (raw: Record<string, any>[]) => {
        if (!Array.isArray(raw)) return [];
        const filtered = raw.filter((r) => {
          const slug = String(r["slug"] ?? "").toLowerCase();
          const title = String(r["title"] ?? "").toLowerCase();
          if (slug === "dev-assessment-round" || slug === "dev-offline-final") return false;
          if (slug === "biweekly-contest-1") return false;
          if (title.startsWith("[dev] round 1") || title.startsWith("[dev] round 2")) return false;
          return true;
        });
        return filtered.map(normalizeContestSummary);
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ slug }) => ({ type: "Contest" as const, id: slug })),
              { type: "Contest", id: "LIST" },
            ]
          : [{ type: "Contest", id: "LIST" }],
    }),

    getContestDetail: builder.query<ContestSummary, string>({
      query: (slug) => `/contests/${encodeURIComponent(slug)}`,
      transformResponse: (raw: Record<string, any>) => normalizeContestSummary(raw),
      providesTags: (_result, _error, slug) => [{ type: "Contest", id: slug }],
    }),

    getContestProblems: builder.query<ContestProblemPreview[], string>({
      query: (slug) => `/contests/${encodeURIComponent(slug)}/problems`,
      transformResponse: (raw: Record<string, any>[]) => {
        if (!Array.isArray(raw)) return [];
        return raw.map((p, index) => ({
          problem_index: String(p["problem_index"] ?? index + 1),
          title: String(p["title"] ?? `Problem ${index + 1}`),
          topic: String(p["topic"] ?? "Algorithms"),
          points: Number(p["points"] ?? 100),
          solved_count: Number(p["solved_count"] ?? 0),
        }));
      },
      providesTags: (_result, _error, slug) => [{ type: "ContestProblem", id: slug }],
    }),

    getContestRegistration: builder.query<RegistrationStatus | null, string>({
      query: (slug) => `/contests/${encodeURIComponent(slug)}/registration-status`,
      transformResponse: (raw: Record<string, any>, _meta, slug) => {
        if (!raw) return null;
        return {
          registered: Boolean(raw["registered"]),
          status: (raw["status"] ?? null) as string | null,
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
      },
      providesTags: (_result, _error, slug) => [{ type: "Contest", id: `REG_${slug}` }],
    }),

    getContestRanking: builder.query<AssessmentRanking, string>({
      query: (slug) => `/assessment/${encodeURIComponent(slug)}/leaderboard`,
      transformResponse: (raw: Record<string, any>, _meta, slug) => {
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
      providesTags: (_result, _error, slug) => [{ type: "Leaderboard", id: `ASSESSMENT_${slug}` }],
    }),

    getContestFinalStandings: builder.query<FinalStandingRow[], string>({
      query: (slug) => `/scoreboards/${encodeURIComponent(slug)}`,
      transformResponse: (raw: Record<string, any>[]) => {
        if (!Array.isArray(raw)) return [];
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
      providesTags: (_result, _error, slug) => [{ type: "Leaderboard", id: `SCOREBOARD_${slug}` }],
    }),

    getMyCampusPass: builder.query<CampusPass | null, void>({
      query: () => "/passes/my-pass",
      transformResponse: (raw: Record<string, any>) => {
        if (!raw || !raw["pass_code"]) return null;
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
      },
      providesTags: [{ type: "CampusPass", id: "ME" }],
    }),

    getContestCampusPass: builder.query<CampusPass | null, string>({
      query: (slug) => `/passes/contest/${encodeURIComponent(slug)}/my-pass`,
      transformResponse: (raw: Record<string, any>) => {
        if (!raw || !raw["pass_code"]) return null;
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
      },
      providesTags: (_result, _error, slug) => [{ type: "CampusPass", id: slug }],
    }),

    getMyParticipations: builder.query<ParticipationRecord[], void>({
      query: () => "/contests/my/participated",
      providesTags: [{ type: "Contest", id: "PARTICIPATIONS" }],
    }),

    getContestArena: builder.query<ContestArenaData, string>({
      query: (slug) => `/contests/${encodeURIComponent(slug)}/arena`,
      providesTags: (_result, _error, slug) => [
        { type: "Contest", id: slug },
        { type: "ContestProblem", id: slug },
      ],
    }),

    registerContest: builder.mutation<
      { registered: boolean; message: string; registered_count: number },
      string
    >({
      query: (slug) => ({
        url: `/contests/${encodeURIComponent(slug)}/register`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, slug) => [
        { type: "Contest", id: slug },
        { type: "Contest", id: "LIST" },
        { type: "Contest", id: `REG_${slug}` },
        { type: "CampusPass", id: "ME" },
        { type: "CampusPass", id: slug },
      ],
    }),

    unregisterContest: builder.mutation<
      { registered: boolean; message: string; registered_count: number },
      string
    >({
      query: (slug) => ({
        url: `/contests/${encodeURIComponent(slug)}/unregister`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, slug) => [
        { type: "Contest", id: slug },
        { type: "Contest", id: "LIST" },
        { type: "Contest", id: `REG_${slug}` },
        { type: "CampusPass", id: "ME" },
        { type: "CampusPass", id: slug },
      ],
    }),

    checkInContest: builder.mutation<
      { success?: boolean; status?: string; message?: string },
      string
    >({
      query: (slug) => ({
        url: `/contests/${encodeURIComponent(slug)}/check-in`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, slug) => [
        { type: "Contest", id: slug },
        { type: "Contest", id: `REG_${slug}` },
        { type: "CampusPass", id: slug },
        { type: "CampusPass", id: "ME" },
      ],
    }),

    runContestCode: builder.mutation<
      ArenaRunResult,
      { slug: string; body: { problem_id: string; language: string; code: string; custom_input?: string } }
    >({
      query: ({ slug, body }) => ({
        url: `/contests/${encodeURIComponent(slug)}/run`,
        method: "POST",
        body,
      }),
    }),

    submitContestCode: builder.mutation<
      ArenaSubmitResult,
      { slug: string; body: { problem_id: string; language: string; code: string } }
    >({
      query: ({ slug, body }) => ({
        url: `/contests/${encodeURIComponent(slug)}/submit`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { slug }) => [
        { type: "Submission", id: slug },
        { type: "Leaderboard", id: `SCOREBOARD_${slug}` },
        { type: "ContestProblem", id: slug },
      ],
    }),
  }),
});

export const {
  useGetContestsQuery,
  useGetContestDetailQuery,
  useGetContestProblemsQuery,
  useGetContestRegistrationQuery,
  useGetContestRankingQuery,
  useGetContestFinalStandingsQuery,
  useGetMyCampusPassQuery,
  useGetContestCampusPassQuery,
  useGetMyParticipationsQuery,
  useGetContestArenaQuery,
  useRegisterContestMutation,
  useUnregisterContestMutation,
  useCheckInContestMutation,
  useRunContestCodeMutation,
  useSubmitContestCodeMutation,
} = contestApi;
