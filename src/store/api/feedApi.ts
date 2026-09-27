import { baseApi } from "./baseApi";
import type { AnnouncementFeedItem, OfflineContest } from "@/organization/data/types";
import { normalizeContestSummary } from "./contestApi";
import type { ContestSummary } from "@/features/contest/types";

export interface PublicPortalData {
  contests: ContestSummary[];
  announcements: AnnouncementFeedItem[];
  standings: any[];
  problems: any[];
  proofs: any[];
}

export const feedApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAnnouncements: builder.query<AnnouncementFeedItem[], void>({
      query: () => "/feed/announcements",
      providesTags: [{ type: "Announcement", id: "LIST" }],
    }),

    getPublicPortalData: builder.query<PublicPortalData, void>({
      async queryFn(_arg, _queryApi, _extraOptions, fetchWithBQ) {
        try {
          const [contestsRes, announcementsRes] = await Promise.all([
            fetchWithBQ("/contests"),
            fetchWithBQ("/feed/announcements"),
          ]);

          const rawContests = Array.isArray(contestsRes.data) ? (contestsRes.data as Record<string, any>[]) : [];
          const rawAnnouncements = Array.isArray(announcementsRes.data)
            ? (announcementsRes.data as AnnouncementFeedItem[])
            : [];

          const filteredContests = rawContests.filter((r) => {
            const slug = String(r["slug"] ?? "").toLowerCase();
            const title = String(r["title"] ?? "").toLowerCase();
            if (slug === "dev-assessment-round" || slug === "dev-offline-final") return false;
            if (slug === "biweekly-contest-1") return false;
            if (title.startsWith("[dev] round 1") || title.startsWith("[dev] round 2")) return false;
            return true;
          });

          const normalizedContests = filteredContests.map(normalizeContestSummary);

          // Get first slug for preliminary standings if available
          let standings: any[] = [];
          const firstContest = normalizedContests[0];
          if (firstContest?.slug) {
            const sbRes = await fetchWithBQ(`/scoreboards/${encodeURIComponent(firstContest.slug)}`);
            if (Array.isArray(sbRes.data)) {
              standings = sbRes.data;
            }
          }

          const problems: any[] = rawContests.flatMap((c: any) =>
            (c.problems || []).map((p: any) => ({
              contest_id: c.id,
              problem_index: p.problem_index ?? p.index ?? "—",
              index: p.problem_index ?? p.index ?? "—",
              title: p.title,
              topic: p.topic ?? "Algorithms",
              points: p.points ?? 100,
              solved_count: p.solved_count ?? 0,
              first_ac_seconds: p.first_ac_seconds,
              editorial_summary: p.editorial_summary ?? "Editorial verified and sealed.",
            }))
          );

          return {
            data: {
              contests: normalizedContests,
              announcements: rawAnnouncements,
              standings,
              problems,
              proofs: [],
            },
          };
        } catch (err: any) {
          return {
            error: {
              status: "CUSTOM_ERROR",
              message: err?.message || "Failed to load public portal data",
            },
          };
        }
      },
      providesTags: [
        { type: "Contest", id: "LIST" },
        { type: "Announcement", id: "LIST" },
        { type: "Leaderboard", id: "SCOREBOARD" },
      ],
    }),
  }),
});

export const {
  useGetAnnouncementsQuery,
  useGetPublicPortalDataQuery,
} = feedApi;
