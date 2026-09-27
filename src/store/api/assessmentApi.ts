import { baseApi } from "./baseApi";
import type { AssessmentProblemData } from "../slices/assessmentSlice";

export interface AssessmentDataResponse {
  assessment: {
    id: string;
    slug: string;
    title: string;
    summary: string;
    duration_minutes: number;
    max_violations: number;
    starts_at?: string;
    ends_at?: string;
    is_open?: boolean;
    opens_in_seconds?: number;
    closes_in_seconds?: number;
  };
  session?: {
    id: string;
    status: string;
    started_at: string;
    remaining_seconds: number;
    total_score: number;
    anti_cheat_violations: number;
    is_top_30_qualified: boolean;
    is_resumed?: boolean;
  } | null;
  problems: AssessmentProblemData[];
}

export const assessmentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAssessmentData: builder.query<AssessmentDataResponse, string>({
      query: (slug) => `/assessment/${encodeURIComponent(slug)}`,
      providesTags: (_res, _err, slug) => [{ type: "Assessment", id: slug }],
    }),

    runAssessmentCode: builder.mutation<
      any,
      { slug: string; body: { problem_id: string; language: string; code: string; custom_input?: string } }
    >({
      query: ({ slug, body }) => ({
        url: `/assessment/${encodeURIComponent(slug)}/run`,
        method: "POST",
        body,
      }),
    }),

    submitAssessmentCode: builder.mutation<
      any,
      { slug: string; body: { problem_id: string; language: string; code: string } }
    >({
      query: ({ slug, body }) => ({
        url: `/assessment/${encodeURIComponent(slug)}/submit`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_res, _err, { slug }) => [
        { type: "Assessment", id: slug },
        { type: "Leaderboard", id: `ASSESSMENT_${slug}` },
      ],
    }),

    finishAssessment: builder.mutation<
      any,
      { slug: string; body?: Record<string, any> }
    >({
      query: ({ slug, body = {} }) => ({
        url: `/assessment/${encodeURIComponent(slug)}/finish`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_res, _err, { slug }) => [
        { type: "Assessment", id: slug },
        { type: "Contest", id: slug },
        { type: "Contest", id: `REG_${slug}` },
        { type: "Leaderboard", id: `ASSESSMENT_${slug}` },
      ],
    }),
  }),
});

export const {
  useGetAssessmentDataQuery,
  useRunAssessmentCodeMutation,
  useSubmitAssessmentCodeMutation,
  useFinishAssessmentMutation,
} = assessmentApi;
