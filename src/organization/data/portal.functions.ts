/**
 * Chaos Computer Club India — Live Database Portal Functions
 * High-performance data layer with Stale-While-Revalidate (SWR) caching,
 * in-flight request deduplication, and immediate synchronous state returns.
 */

import { getApiBase, getToken } from "@/lib/auth";
import { swrFetch, invalidateSwrCache } from "@/lib/cache/swrCache";
import type {
  AnnouncementFeedItem,
  LeaderboardEntry,
} from "./types";

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
        fetch(`${backendUrl}/contests`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch(`${backendUrl}/feed/announcements`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch(`${backendUrl}/verify/proofs`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
      ]);

      const firstSlug = apiContests && apiContests.length > 0 ? apiContests[0].slug : null;
      const standings = firstSlug
        ? await fetch(`${backendUrl}/scoreboards/${firstSlug}`)
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => [])
        : [];

      const problems: any[] = (apiContests || []).flatMap((c: any) =>
        (c.problems || []).map((p: any) => ({
          contest_id: c.id,
          problem_index: p.problem_index ?? p.index,
          title: p.title,
          topic: p.topic,
          points: p.points,
          solved_count: p.solved_count ?? 0,
          first_ac_seconds: p.first_ac_seconds,
          editorial_summary: p.editorial_summary ?? "Editorial verified and sealed.",
        }))
      );

      return {
        contests: (apiContests || []) as any[],
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
  const cacheKey = `profile:full:${token ? token.slice(-16) : "anon"}`;

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
        if (res.ok) {
          const data = await res.json();
          return {
            member: data.member || null,
            ratingHistory: Array.isArray(data.ratingHistory) ? data.ratingHistory : [],
            recentBattles: Array.isArray(data.recentBattles) ? data.recentBattles : [],
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
        recentBattles: [],
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
export async function getUniversityLeaderboardData(force = false) {
  return swrFetch(
    "leaderboard:university",
    async () => {
      const backendUrl = getApiBase();
      const res = await fetch(`${backendUrl}/leaderboard`).catch(() => null);
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

export { invalidateSwrCache };
