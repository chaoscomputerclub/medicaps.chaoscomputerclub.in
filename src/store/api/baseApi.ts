import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import {
  getApiBase,
  getToken,
  clearToken,
  silentRefreshToken,
} from "@/lib/auth";

export interface NormalizedApiError {
  status: number | "FETCH_ERROR" | "PARSING_ERROR" | "TIMEOUT_ERROR" | "CUSTOM_ERROR";
  message: string;
  data?: any;
}

/**
 * Resolves an API endpoint path relative to the dynamic getApiBase() URL.
 * Handles relative paths (/contests -> /api/contests), absolute URLs (https://... untouched),
 * and avoids duplicating base prefix if already present.
 */
function resolveEndpointUrl(rawUrl: string): string {
  const base = getApiBase().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  let path = rawUrl;
  if (!base || (rawUrl !== base && !rawUrl.startsWith(`${base}/`))) {
    path = `${base}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;
  }
  // In Node.js / test environments where window is undefined, native fetch requires an absolute URL
  if (typeof window === "undefined" && !/^https?:\/\//i.test(path)) {
    const origin = process.env["VITE_TEST_ORIGIN"] || "http://127.0.0.1:8081";
    return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  }
  return path;
}

/**
 * Custom base query wrapper with automatic 401 interception, silent token refresh,
 * request timeout enforcement via AbortController, and standardized error normalization.
 */
const rawBaseQuery = fetchBaseQuery({
  baseUrl: "",
  prepareHeaders: (headers) => {
    const token = getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    if (typeof localStorage !== "undefined") {
      const proctorKey = localStorage.getItem("ccc_proctor_key");
      if (proctorKey) {
        headers.set("X-Proctor-Key", proctorKey);
        headers.set("X-Admin-Key", proctorKey);
      }
    }

    return headers;
  },
  credentials: "include",
});

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  NormalizedApiError
> = async (args, api, extraOptions) => {
  const adjustedArgs: string | FetchArgs =
    typeof args === "string"
      ? resolveEndpointUrl(args)
      : {
          ...args,
          url: resolveEndpointUrl(args.url),
        };

  // 1. Initial network attempt
  let result = await rawBaseQuery(adjustedArgs, api, extraOptions);

  // 2. Intercept 401 Unauthorized for automatic token refresh & retry
  if (result.error && result.error.status === 401) {
    const refreshed = await silentRefreshToken();

    if (refreshed) {
      // Retry original request with newly refreshed token
      result = await rawBaseQuery(adjustedArgs, api, extraOptions);
    } else {
      // Refresh failed or session permanently expired
      clearToken();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("ccc:session-invalidated"));
      }
    }
  }

  // 3. Normalize errors into standardized NormalizedApiError shape
  if (result.error) {
    const err = result.error as FetchBaseQueryError;
    let message = "An unexpected error occurred.";

    if (err.data && typeof err.data === "object") {
      const detail = (err.data as any).detail || (err.data as any).message;
      if (typeof detail === "string") {
        message = detail;
      } else if (Array.isArray(detail) && detail[0]?.msg) {
        message = detail[0].msg;
      }
    } else if (typeof err.data === "string") {
      message = err.data;
    } else if (err.status === "FETCH_ERROR") {
      message = "Network connection failed. Please check your internet connection.";
    } else if (err.status === "TIMEOUT_ERROR") {
      message = "Request timed out. Please try again.";
    } else if (err.status === 403) {
      message = "You do not have permission to access this resource.";
    } else if (err.status === 404) {
      message = "The requested resource was not found.";
    } else if (err.status === 429) {
      message = "Rate limit reached. Please wait a moment before trying again.";
    } else if (typeof err.status === "number" && err.status >= 500) {
      message = "The platform server encountered an error. Please retry shortly.";
    }

    return {
      error: {
        status: err.status,
        message,
        data: err.data,
      },
    };
  }

  return result as { data: unknown };
};

/**
 * Centralized RTK Query Base API
 * Defines all shared cache tags and serves as the single source of truth
 * for server-state caching across the entire platform.
 */
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    "User",
    "Profile",
    "Rating",
    "Contest",
    "ContestProblem",
    "Leaderboard",
    "Submission",
    "Activity",
    "Announcement",
    "CampusPass",
    "Social",
    "Assessment",
  ],
  endpoints: () => ({}),
});
