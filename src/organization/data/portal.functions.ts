/**
 * Chaos Computer Club India — Live Database Portal Functions
 * High-performance data layer with Stale-While-Revalidate (SWR) caching,
 * in-flight request deduplication, and immediate synchronous state returns.
 */

import { getApiBase, getToken, clearToken } from "@/lib/auth";
import { swrFetch, invalidateSwrCache } from "@/lib/cache/swrCache";
import type {
  AnnouncementFeedItem,
  LeaderboardEntry,
} from "./types";

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Real-time public contest, scoreboard, announcement, and verification proofs.
 * Cached in memory with SWR background revalidation.
 */
export async function getPublicPortalData(force = false) {
  return swrFetch(
    "portal:public_data",
    async () => {
      const backendUrl = getApiBase();

      const [apiContests, apiAnnouncements, apiProofs] = await Promise.all([
        fetchWithTimeout(`${backendUrl}/contests`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetchWithTimeout(`${backendUrl}/feed/announcements`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetchWithTimeout(`${backendUrl}/verify/proofs`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
      ]);

      const firstSlug = apiContests && apiContests.length > 0 ? apiContests[0].slug : null;
      const standings = firstSlug
        ? await fetchWithTimeout(`${backendUrl}/scoreboards/${firstSlug}`)
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => [])
        : [];

      const normalizedContests = (apiContests || []).map((c: any) => ({
        ...c,
        problems: (c.problems || []).map((p: any) => ({
          ...p,
          index: p.problem_index ?? p.index ?? "—",
          problem_index: p.problem_index ?? p.index ?? "—",
        })),
      }));

      const problems: any[] = normalizedContests.flatMap((c: any) =>
        (c.problems || []).map((p: any) => ({
          contest_id: c.id,
          problem_index: p.problem_index,
          index: p.problem_index,
          title: p.title,
          topic: p.topic,
          points: p.points,
          solved_count: p.solved_count ?? 0,
          first_ac_seconds: p.first_ac_seconds,
          editorial_summary: p.editorial_summary ?? "Editorial verified and sealed.",
        }))
      );

      return {
        contests: normalizedContests,
        problems: problems || [],
        standings: (standings || []) as any[],
        announcements: (apiAnnouncements || []) as AnnouncementFeedItem[],
        proofs: (apiProofs || []) as any[],
      };
    },
    {
      staleTime: 20000, // 20 seconds fresh
      ttl: 300000, // 5 minutes TTL
      forceRefresh: force,
      persistSession: true,
    }
  );
}

/**
 * Real-time full member profile, rating trajectory, active pass, and cryptographic proofs.
 * Cached per session/token with instant SWR hydration.
 */
export async function getMemberProfileData(force = false) {
  const token = getToken();
  const cacheKey = "member:profile:full";

  return swrFetch(
    cacheKey,
    async () => {
      const backendUrl = getApiBase();
      if (!token) {
        return {
          member: null,
          ratingHistory: [],
          recentBattles: [],
          campusPass: null,
          proofs: [],
          achievements: [],
        };
      }

      try {
        const res = await fetch(`${backendUrl}/auth/profile/full`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.status === 401) {
          clearToken();
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("ccc:session-invalidated"));
          }
          return {
            member: null,
            ratingHistory: [],
            recentBattles: [],
            campusPass: null,
            proofs: [],
            achievements: [],
          };
        }
        if (res.ok) {
          const data = await res.json();
          const rHistory = Array.isArray(data.ratingHistory)
            ? data.ratingHistory
            : (Array.isArray(data.history) ? data.history : []);
          const rBattles = Array.isArray(data.recentBattles)
            ? data.recentBattles
            : (Array.isArray(data.battles) ? data.battles : []);
          return {
            member: data.member || null,
            ratingHistory: rHistory,
            history: rHistory,
            recentBattles: rBattles,
            battles: rBattles,
            campusPass: data.campusPass || null,
            proofs: Array.isArray(data.proofs) ? data.proofs : [],
            achievements: Array.isArray(data.achievements) ? data.achievements : [],
          };
        }
      } catch {
        // Fallback on network failure
      }

      return {
        member: null,
        ratingHistory: [],
        history: [],
        recentBattles: [],
        battles: [],
        campusPass: null,
        proofs: [],
        achievements: [],
      };
    },
    {
      staleTime: 20000, // 20 seconds
      ttl: 300000,
      forceRefresh: force,
      persistSession: true,
    }
  );
}

/**
 * Real-time university leaderboard with star division brackets.
 * Cached with SWR so switching to /leaderboard renders instantly (0ms).
 */
export async function getUniversityLeaderboardData(
  force = false,
  limit?: number,
  offset?: number,
  department?: string,
  batch?: string,
  tier?: string
) {
  const queryParams = new URLSearchParams();
  if (limit !== undefined) queryParams.set("limit", String(limit));
  if (offset !== undefined) queryParams.set("offset", String(offset));
  if (department) queryParams.set("department", department);
  if (batch) queryParams.set("batch", batch);
  if (tier) queryParams.set("tier", tier);
  const qs = queryParams.toString();
  const cacheKey = `leaderboard:university${qs ? `:${qs}` : ""}`;

  return swrFetch(
    cacheKey,
    async () => {
      const backendUrl = getApiBase();
      const res = await fetch(`${backendUrl}/leaderboard${qs ? `?${qs}` : ""}`).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        return (data || []) as LeaderboardEntry[];
      }
      return [] as LeaderboardEntry[];
    },
    {
      staleTime: 30000, // 30s
      ttl: 300000,
      forceRefresh: force,
      persistSession: true,
    }
  );
}


export type RatingBucket = { min: number; max: number; count: number };
export type RatingDistribution = { total: number; buckets: RatingBucket[] };

/**
 * Real rating distribution from the DB.
 */
export async function getRatingDistribution(force = false) {
  return swrFetch(
    "leaderboard:distribution",
    async () => {
      const backendUrl = getApiBase();
      const res = await fetch(`${backendUrl}/leaderboard/distribution`).catch(() => null);
      if (res && res.ok) {
        return (await res.json()) as RatingDistribution;
      }
      return { total: 0, buckets: [] } as RatingDistribution;
    },
    {
      staleTime: 60000, // 1 minute
      ttl: 600000,
      forceRefresh: force,
      persistSession: true,
    }
  );
}

/**
 * Fetch any student's public competitive profile by handle or ID (LeetCode-style).
 * Cached with SWR so visiting any profile is instant.
 */
export async function getStudentProfileData(handle: string, force = false) {
  const token = getToken();
  const cleanHandle = (handle || "").replace(/^@+/, "").trim().toLowerCase();
  const cacheKey = `student:profile:${cleanHandle}`;

  return swrFetch(
    cacheKey,
    async () => {
      const backendUrl = getApiBase();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      try {
        const res = await fetch(`${backendUrl}/auth/profile/${encodeURIComponent(cleanHandle)}`, {
          headers,
        });
        if (res.ok) {
          const data = await res.json();
          const rHistory = Array.isArray(data.ratingHistory)
            ? data.ratingHistory
            : (Array.isArray(data.history) ? data.history : []);
          const rBattles = Array.isArray(data.recentBattles)
            ? data.recentBattles
            : (Array.isArray(data.battles) ? data.battles : []);
          return {
            member: data.member || null,
            ratingHistory: rHistory,
            history: rHistory,
            recentBattles: rBattles,
            battles: rBattles,
            problemStats: data.problemStats || {
              total_solved: 0,
              easy_solved: 0,
              medium_solved: 0,
              hard_solved: 0,
              total_submissions: 0,
              acceptance_rate: 0,
              topics: [],
            },
            submissionCalendar: data.submissionCalendar || {},
            proofs: Array.isArray(data.proofs) ? data.proofs : [],
            achievements: Array.isArray(data.achievements) ? data.achievements : [],
          };
        }
      } catch (err) {
        console.error("Failed to load student profile:", err);
      }

      return {
        member: null,
        ratingHistory: [],
        history: [],
        recentBattles: [],
        battles: [],
        problemStats: {
          total_solved: 0,
          easy_solved: 0,
          medium_solved: 0,
          hard_solved: 0,
          total_submissions: 0,
          acceptance_rate: 0,
          topics: [],
        },
        submissionCalendar: {},
        proofs: [],
        achievements: [],
      };
    },
    {
      staleTime: 30000, // 30s
      ttl: 300000, // 5m
      forceRefresh: force,
      persistSession: true,
    }
  );
}

export { invalidateSwrCache };

