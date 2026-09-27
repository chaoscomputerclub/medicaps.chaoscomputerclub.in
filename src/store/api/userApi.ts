import { baseApi } from "./baseApi";
import type { Member, UpdateProfilePayload } from "@/lib/auth";
import type { FullProfilePayload } from "@/organization/data/queries";

export const userApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCurrentUser: builder.query<Member, void>({
      query: () => "/auth/me",
      providesTags: (result) =>
        result ? [{ type: "User", id: result.id }] : [{ type: "User", id: "ME" }],
    }),

    getFullProfile: builder.query<FullProfilePayload, void>({
      query: () => "/auth/profile/full",
      providesTags: (result) =>
        result?.member
          ? [
              { type: "Profile", id: result.member.id },
              { type: "Profile", id: "ME" },
              { type: "Rating", id: result.member.id },
            ]
          : [{ type: "Profile", id: "ME" }],
    }),

    getStudentProfile: builder.query<FullProfilePayload, string>({
      query: (handle) => `/auth/profile/${encodeURIComponent(handle)}`,
      providesTags: (result, _error, handle) => [
        { type: "Profile" as const, id: handle.toLowerCase() },
        ...(result?.member ? [{ type: "Profile" as const, id: result.member.id }] : []),
      ],
    }),

    checkHandleAvailability: builder.query<{ available: boolean; handle: string }, string>({
      query: (handle) => `/auth/check-handle?handle=${encodeURIComponent(handle)}`,
    }),

    updateProfile: builder.mutation<Member, UpdateProfilePayload>({
      query: (payload) => ({
        url: "/auth/profile",
        method: "PUT",
        body: payload,
      }),
      invalidatesTags: (_result, _error, _arg) => [
        { type: "User", id: "ME" },
        { type: "Profile", id: "ME" },
        { type: "Leaderboard" },
      ],
    }),

    deleteAccount: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: "/auth/account",
        method: "DELETE",
      }),
      invalidatesTags: ["User", "Profile", "Rating", "CampusPass"],
    }),
  }),
});

export const {
  useGetCurrentUserQuery,
  useGetFullProfileQuery,
  useGetStudentProfileQuery,
  useCheckHandleAvailabilityQuery,
  useUpdateProfileMutation,
  useDeleteAccountMutation,
} = userApi;
