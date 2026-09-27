import { baseApi } from "./baseApi";
import type { LeaderboardEntry } from "@/organization/data/types";
import type { RatingDistribution } from "@/organization/data/portal.functions";

export interface LeaderboardQueryParams {
  department?: string;
  batch?: string;
  division?: string;
  limit?: number;
  offset?: number;
}

export const leaderboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUniversityLeaderboard: builder.query<LeaderboardEntry[], LeaderboardQueryParams | void>({
      query: (params) => {
        if (!params) return "/leaderboard";
        const searchParams = new URLSearchParams();
        if (params.department && params.department !== "all") searchParams.set("department", params.department);
        if (params.batch && params.batch !== "all") searchParams.set("batch", params.batch);
        if (params.division && params.division !== "all") searchParams.set("division", params.division);
        if (params.limit) searchParams.set("limit", String(params.limit));
        if (params.offset) searchParams.set("offset", String(params.offset));
        const qs = searchParams.toString();
        return `/leaderboard${qs ? `?${qs}` : ""}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ handle }) => ({ type: "Leaderboard" as const, id: handle })),
              { type: "Leaderboard", id: "UNIVERSITY" },
            ]
          : [{ type: "Leaderboard", id: "UNIVERSITY" }],
    }),

    getRatingDistribution: builder.query<RatingDistribution, void>({
      query: () => "/leaderboard/distribution",
      providesTags: [{ type: "Rating", id: "DISTRIBUTION" }],
    }),
  }),
});

export const {
  useGetUniversityLeaderboardQuery,
  useGetRatingDistributionQuery,
} = leaderboardApi;
