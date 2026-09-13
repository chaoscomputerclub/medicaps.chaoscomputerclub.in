/**
 * CCC Medi-Caps — Auth helpers
 * Manages JWT token in localStorage and API calls for authentication.
 * Dynamically resolves API base URL for ultra-flexible multi-domain deployment.
 */

export function getApiBase(): string {
  const envUrl =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env as Record<string, string>)["VITE_API_URL"]
      : undefined;

  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    // 1. Localhost development fallback
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:8000/api";
    }

    // 2. Production: Always use relative /api on current origin
    // Nginx reverse-proxies /api/ directly to FastAPI backend, preventing CORS or stale domain issues
    return `${window.location.origin}/api`;
  }

  // SSR fallback
  const ssrUrl = process.env["BACKEND_URL"] || process.env["VITE_API_URL"];
  if (ssrUrl && ssrUrl.trim()) return ssrUrl.trim().replace(/\/+$/, "");
  return "https://medicaps.chaoscomputerclub.in/api";
}

const TOKEN_KEY = "ccc_medicaps_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length < 2 || !parts[1]) return false;
    const payload = JSON.parse(atob(parts[1]));
    const now = Math.floor(Date.now() / 1000);
    return typeof payload.exp === "number" && payload.exp > now;
  } catch {
    return false;
  }
}

export interface Member {
  id: string;
  handle: string | null;
  full_name: string | null;
  email: string;
  prn: string | null;
  department: string | null;
  batch: string | null;
  rating: number;
  peak_rating: number;
  attendance_count: number;
  attendance_total: number;
  is_core_member: boolean;
  is_onboarded: boolean;
  avatar_url: string | null;
  bio?: string | null;
  github_username?: string | null;
  linkedin_url?: string | null;
  followers_count?: number;
  following_count?: number;
  tier?: string | null;
  university_rank?: number;
}

export interface UpdateProfilePayload {
  handle?: string;
  full_name?: string;
  department?: string;
  batch?: string;
  bio?: string;
  github_username?: string;
  linkedin_url?: string;
  avatar_url?: string;
}

export interface AuthResult {
  access_token: string;
  token_type: string;
  is_new_user: boolean;
  member: Member;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiBase = getApiBase();
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${apiBase}${path}`, { ...init, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Request failed" }));
      let msg = "Request failed";
      if (typeof err.detail === "string") {
        msg = err.detail;
      } else if (Array.isArray(err.detail) && err.detail.length > 0) {
        msg =
          err.detail[0]?.msg?.replace(/^Value error,\s*/i, "") ||
          err.detail[0]?.msg ||
          "Validation error";
      } else if (err.message) {
        msg = err.message;
      }
      throw new Error(msg);
    }
    return res.json();
  } catch (err: any) {
    if (err?.message === "Failed to fetch") {
      throw new Error(
        `Unable to connect to authentication server (${apiBase}). Please check server status.`,
      );
    }
    throw err;
  }
}

export function isMedicapsEmail(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const domain = email.split("@")[1]?.trim().toLowerCase();
  return domain === "medicaps.ac.in" || Boolean(domain?.endsWith(".medicaps.ac.in"));
}

// ── Email OTP ──────────────────────────────────────────────────────────────

export async function sendOTP(
  email: string,
): Promise<{ sent: boolean; email: string; transaction_id?: string; dev_otp?: string }> {
  return apiFetch("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyOTP(
  email: string,
  code: string,
  transaction_id?: string,
): Promise<AuthResult> {
  return apiFetch("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({
      email,
      code,
      otp: code,
      transaction_id: transaction_id || undefined,
    }),
  });
}

// ── Google OAuth ───────────────────────────────────────────────────────────

export function getGoogleLoginURL(): string {
  return `${getApiBase()}/auth/google/login`;
}

// ── Onboarding ─────────────────────────────────────────────────────────────

export interface CompleteOnboardingPayload {
  handle: string;
  full_name: string;
  prn?: string;
  department?: string;
  batch?: string;
}

export async function completeOnboarding(
  data: CompleteOnboardingPayload,
): Promise<{ success: boolean; member: Member }> {
  return apiFetch("/auth/complete-onboarding", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function checkHandle(
  handle: string,
): Promise<{ available: boolean; handle: string; reason?: string }> {
  return apiFetch<{ available: boolean; handle: string; reason?: string }>(
    `/auth/check-handle?handle=${encodeURIComponent(handle)}`,
  );
}

// ── Me ─────────────────────────────────────────────────────────────────────

export async function getMe(): Promise<{ success: boolean; member: Member }> {
  return apiFetch("/auth/me");
}

export async function deleteAccount(): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>("/auth/me", {
    method: "DELETE",
  });
}

export function logout(): void {
  clearToken();
  window.location.href = "/auth";
}

// ── Assessment APIs (Powered by Interleet Engine) ──────────────────────────

export async function fetchAssessmentData(contestSlug: string): Promise<any> {
  return apiFetch(`/assessment/${contestSlug}`);
}

export async function runAssessmentCode(
  contestSlug: string,
  payload: { problem_id: string; language: string; code: string; custom_stdin?: string },
): Promise<any> {
  return apiFetch(`/assessment/${contestSlug}/run`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function submitAssessmentCode(
  contestSlug: string,
  payload: { problem_id: string; language: string; code: string },
): Promise<any> {
  return apiFetch(`/assessment/${contestSlug}/submit`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendAssessmentTelemetry(
  contestSlug: string,
  eventType: string,
): Promise<any> {
  return apiFetch(`/assessment/${contestSlug}/telemetry`, {
    method: "POST",
    body: JSON.stringify({ event_type: eventType }),
  });
}

export async function finishAssessmentTest(contestSlug: string): Promise<any> {
  return apiFetch(`/assessment/${contestSlug}/finish`, {
    method: "POST",
  });
}

export async function fetchAssessmentLeaderboard(contestSlug: string): Promise<any> {
  return apiFetch(`/assessment/${contestSlug}/leaderboard`);
}

export async function updateProfile(
  data: UpdateProfilePayload,
): Promise<{ success: boolean; message: string; member: Member }> {
  return apiFetch<{ success: boolean; message: string; member: Member }>("/auth/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
