import { baseApi } from "./baseApi";
import type { StudentFollowItem } from "@/organization/data/types";

export interface FollowListResponse {
  items: StudentFollowItem[];
  count: number;
}

export const socialApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyFollowingIds: builder.query<string[], void>({
      query: () => "/social/my-following-ids",
      transformResponse: (res: { following_ids?: string[] }) =>
        Array.isArray(res?.following_ids) ? Array.from(new Set(res.following_ids)) : [],
      providesTags: [{ type: "Social", id: "MY_FOLLOWING" }],
    }),

    getFollowers: builder.query<FollowListResponse, { handle: string; limit?: number; offset?: number }>({
      query: ({ handle, limit = 50, offset = 0 }) =>
        `/social/${encodeURIComponent(handle.replace(/^@+/, ""))}/followers?limit=${limit}&offset=${offset}`,
      transformResponse: (raw: any) => ({
        items: Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [],
        count: typeof raw?.count === "number" ? raw.count : Array.isArray(raw) ? raw.length : 0,
      }),
      providesTags: (_res, _err, { handle }) => [{ type: "Social", id: `FOLLOWERS_${handle}` }],
    }),

    getFollowing: builder.query<FollowListResponse, { handle: string; limit?: number; offset?: number }>({
      query: ({ handle, limit = 50, offset = 0 }) =>
        `/social/${encodeURIComponent(handle.replace(/^@+/, ""))}/following?limit=${limit}&offset=${offset}`,
      transformResponse: (raw: any) => ({
        items: Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [],
        count: typeof raw?.count === "number" ? raw.count : Array.isArray(raw) ? raw.length : 0,
      }),
      providesTags: (_res, _err, { handle }) => [{ type: "Social", id: `FOLLOWING_${handle}` }],
    }),

    followUser: builder.mutation<{ success: boolean; followers_count?: number }, string>({
      query: (handle) => ({
        url: `/social/follow/${encodeURIComponent(handle.replace(/^@+/, ""))}`,
        method: "POST",
      }),
      invalidatesTags: (_res, _err, handle) => [
        { type: "Social", id: "MY_FOLLOWING" },
        { type: "Social", id: `FOLLOWERS_${handle}` },
        { type: "Profile", id: handle.toLowerCase() },
        { type: "Profile", id: "ME" },
        { type: "Leaderboard" },
      ],
    }),

    unfollowUser: builder.mutation<{ success: boolean; followers_count?: number }, string>({
      query: (handle) => ({
        url: `/social/unfollow/${encodeURIComponent(handle.replace(/^@+/, ""))}`,
        method: "POST",
      }),
      invalidatesTags: (_res, _err, handle) => [
        { type: "Social", id: "MY_FOLLOWING" },
        { type: "Social", id: `FOLLOWERS_${handle}` },
        { type: "Profile", id: handle.toLowerCase() },
        { type: "Profile", id: "ME" },
        { type: "Leaderboard" },
      ],
    }),
  }),
});

export const {
  useGetMyFollowingIdsQuery,
  useGetFollowersQuery,
  useGetFollowingQuery,
  useFollowUserMutation,
  useUnfollowUserMutation,
} = socialApi;
