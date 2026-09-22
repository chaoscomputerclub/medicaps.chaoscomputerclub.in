/**
 * Chaos Computer Club India — Real-Time Database Query Definitions
 * Memoized Profile Data Layer + Single Unified Query Instance
 */

export function queryOptions<T extends Record<string, any>>(opts: T): T {
  return opts;
}
import { getToken, getApiBase, clearToken, isAuthenticated } from "@/lib/auth";
import { invalidateSwrCache } from "@/lib/cache/swrCache";
import {
  getPublicPortalData,
  getMemberProfileData,
  getUniversityLeaderboardData,
  getRatingDistribution,
} from "./portal.functions";
import type {
  AnnouncementFeedItem,
  ContestProblem,
  OfflineContest,
  ProblemTelemetry,
  ScoreboardEntry,
  TrustProof,
  MemberProfile,
  RatingHistoryPoint,
  CampusPass,
  OfflineBattleResult,
  Achievement,
} from "./types";

export type FullProfilePayload = {
  member: MemberProfile;
  ratingHistory: RatingHistoryPoint[];
  recentBattles: OfflineBattleResult[];
  campusPass: CampusPass;
  proofs: TrustProof[];
  achievements: Achievement[];
};

export const defaultMemberProfile: MemberProfile = {
  id: "",
  handle: "",
  full_name: "",
  email: "",
  prn: "—",
  department: "CSE",
  batch: "2023-27",
  rating: 1200,
  peak_rating: 1200,
  peak_contest: "Campus Standby",
  university_rank: 0,
  active_members: 0,
  attendance_count: 0,
  attendance_total: 0,
  is_core_member: false,
  is_onboarded: false,
  tier: "1★ Explorer",
  podiums: 0,
  streak: 0,
  followers_count: 0,
  following_count: 0,
  bio: null,
  github_username: null,
  linkedin_url: null,
  avatar_url: null,
};

export const defaultCampusPass: CampusPass = {
  pass_code: "NONE",
  member_name: "",
  handle: "—",
  prn_hash: "N/A",
  contest_title: "Campus Session",
  seat: "Unassigned",
  venue: "Campus Center",
  check_in_opens_at: new Date().toISOString(),
  status: "expired",
};

// In-memory memoization caches
let fullProfilePromise: Promise<FullProfilePayload> | null = null;
let fullProfileCache: { data: FullProfilePayload; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let publicRecordsPromise: Promise<any> | null = null;
let publicRecordsCache: { data: any; timestamp: number } | null = null;

export async function fetchFullProfileData(force = false): Promise<FullProfilePayload> {
  if (typeof window !== "undefined") {
    if (force) {
      fullProfileCache = null;
      fullProfilePromise = null;
    }

    // 1. Check in-memory memoized cache
    if (!force && fullProfileCache && Date.now() - fullProfileCache.timestamp < CACHE_TTL) {
      return fullProfileCache.data;
    }

    // 2. Reuse in-flight promise to eliminate duplicate parallel fetches
    if (!force && fullProfilePromise) {
      return fullProfilePromise;
    }

    const token = getToken();
    if (!token) {
      return {
        member: defaultMemberProfile,
        ratingHistory: [],
        recentBattles: [],
        campusPass: defaultCampusPass,
        proofs: [],
        achievements: [],
      };
    }

    const apiBase = getApiBase();
    fullProfilePromise = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const res = await fetch(`${apiBase}/auth/profile/full`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          const payload: FullProfilePayload = {
            member: { ...defaultMemberProfile, ...(data.member || {}) },
            ratingHistory: Array.isArray(data.ratingHistory) ? data.ratingHistory : [],
            recentBattles: Array.isArray(data.recentBattles) ? data.recentBattles : [],
            campusPass: data.campusPass || defaultCampusPass,
            proofs: Array.isArray(data.proofs) ? data.proofs : [],
            achievements: Array.isArray(data.achievements) ? data.achievements : [],
          };
          fullProfileCache = { data: payload, timestamp: Date.now() };
          return payload;
        }
        if (res.status === 401) {
          const authed = isAuthenticated();
          if (!authed) {
            clearToken();
            fullProfileCache = null;
            if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
              window.location.href = "/auth";
            }
          }
        }
      } catch {
        // Fallback on network failure without destroying session
      } finally {
        fullProfilePromise = null;
      }

      return {
        member: defaultMemberProfile,
        ratingHistory: [],
        recentBattles: [],
        campusPass: defaultCampusPass,
        proofs: [],
        achievements: [],
      };
    })();

    return fullProfilePromise;
  }

  // During SSR, return safe defaults without throwing
  return {
    member: defaultMemberProfile,
    ratingHistory: [],
    recentBattles: [],
    campusPass: defaultCampusPass,
    proofs: [],
    achievements: [],
  };
}

/**
 * Eagerly preloads and memoizes full profile details before route transition
 */
export async function preloadFullProfile(tokenOverride?: string): Promise<FullProfilePayload> {
  if (tokenOverride && typeof window !== "undefined") {
    localStorage.setItem("ccc_medicaps_token", tokenOverride);
  }
  return await fetchFullProfileData(true);
}

async function publicRecords() {
  if (publicRecordsCache && Date.now() - publicRecordsCache.timestamp < CACHE_TTL) {
    return publicRecordsCache.data;
  }
  if (publicRecordsPromise) {
    return publicRecordsPromise;
  }

  publicRecordsPromise = (async () => {
    try {
      const data = await getPublicPortalData();
      const mappedContests: OfflineContest[] = (data.contests || []).map((record: any) => {
        const contestProblems: ContestProblem[] = (data.problems || [])
          .filter((problem: any) => problem.contest_id === record.id)
          .map((problem: any) => ({
            index: problem.problem_index ?? problem.index,
            title: problem.title,
            topic: problem.topic,
            points: problem.points,
            solved_count: problem.solved_count ?? 0,
            first_ac_seconds: problem.first_ac_seconds,
            editorial: problem.editorial_summary ?? "Editorial verified and sealed.",
          }));
        const contestStandings: ScoreboardEntry[] = (data.standings || [])
          .filter((entry: any) => entry.contest_id === record.id)
          .map((entry: any) => ({
            rank: entry.rank,
            handle: entry.handle,
            full_name: entry.full_name,
            department: entry.department as ScoreboardEntry["department"],
            batch: entry.batch as ScoreboardEntry["batch"],
            division: entry.division as ScoreboardEntry["division"],
            score: entry.score,
            solved: entry.solved,
            penalty_seconds: entry.penalty_seconds,
            rating_delta: entry.rating_delta ?? 0,
            is_you: false,
            problems: Array.isArray(entry.telemetry) ? (entry.telemetry as ProblemTelemetry[]) : [],
          }));
        return {
          id: record.id,
          slug: record.slug,
          title: record.title,
          season: record.season,
          status: record.status as OfflineContest["status"],
          division:
            record.division === "open"
              ? "overall"
              : (record.division as OfflineContest["division"]),
          starts_at: record.starts_at,
          ends_at: record.ends_at,
          check_in_opens_at: record.check_in_opens_at,
          venue: record.venue,
          seat_capacity: record.seat_capacity,
          registered_count: record.registered_count,
          problem_count: record.problem_count,
          environment: record.environment,
          chief_proctors: record.chief_proctors || [],
          prize_pool: record.prize_pool,
          sponsor: record.sponsor,
          summary: record.summary,
          rules: record.rules || [],
          problems: contestProblems,
          standings: contestStandings,
          registered: false,
        };
      });

      const proofs: TrustProof[] = (data.proofs || []).map((proof: any) => {
        const contest = (data.contests || []).find((item: any) => item.id === proof.contest_id);
        return {
          certificate_id: proof.certificate_id,
          contest_slug: contest?.slug ?? "chaos-arena-2026",
          contest_title: proof.contest_title,
          member_handle: proof.member_handle,
          session_uuid: proof.session_uuid,
          prn_hash: proof.prn_hash,
          sha256_digest: proof.sha256_digest,
          proctor_stamp: proof.proctor_stamp,
          attendance_stamp: proof.attendance_stamp,
          score: proof.score,
          rank: proof.rank,
          issued_at: proof.issued_at,
          status: proof.status === "revoked" ? "revoked" : "valid",
        };
      });

      const result = {
        contests: mappedContests,
        announcements: (data.announcements || []) as AnnouncementFeedItem[],
        proofs,
      };
      publicRecordsCache = { data: result, timestamp: Date.now() };
      return result;
    } finally {
      publicRecordsPromise = null;
    }
  })();

  return publicRecordsPromise;
}

export const portalQueries = {
  fullProfile: () =>
    queryOptions({
      queryKey: ["portal", "full-profile"],
      queryFn: () => fetchFullProfileData(),
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    }),
  member: () =>
    queryOptions({
      queryKey: ["portal", "full-profile"],
      queryFn: () => fetchFullProfileData(),
      select: (data: FullProfilePayload) => data.member,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    }),
  ratingHistory: () =>
    queryOptions({
      queryKey: ["portal", "full-profile"],
      queryFn: () => fetchFullProfileData(),
      select: (data: FullProfilePayload) => data.ratingHistory,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    }),
  recentBattles: () =>
    queryOptions({
      queryKey: ["portal", "full-profile"],
      queryFn: () => fetchFullProfileData(),
      select: (data: FullProfilePayload) => data.recentBattles,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    }),
  campusPass: () =>
    queryOptions({
      queryKey: ["portal", "full-profile"],
      queryFn: () => fetchFullProfileData(),
      select: (data: FullProfilePayload) => data.campusPass,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    }),
  achievements: () =>
    queryOptions({
      queryKey: ["portal", "full-profile"],
      queryFn: () => fetchFullProfileData(),
      select: (data: FullProfilePayload) => data.achievements,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    }),
  contests: () =>
    queryOptions({
      queryKey: ["portal", "public-records"],
      queryFn: () => publicRecords(),
      select: (data: any) => data.contests as OfflineContest[],
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    }),
  contest: (slug: string) =>
    queryOptions({
      queryKey: ["portal", "public-records"],
      queryFn: () => publicRecords(),
      select: (data: any) =>
        (data.contests as OfflineContest[]).find((c) => c.slug === slug) ?? null,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    }),
  announcements: () =>
    queryOptions({
      queryKey: ["portal", "public-records"],
      queryFn: () => publicRecords(),
      select: (data: any) => data.announcements as AnnouncementFeedItem[],
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    }),
  proofs: () =>
    queryOptions({
      queryKey: ["portal", "public-records"],
      queryFn: () => publicRecords(),
      select: (data: any) => data.proofs as TrustProof[],
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    }),
  leaderboard: () =>
    queryOptions({
      queryKey: ["portal", "leaderboard"],
      queryFn: () => getUniversityLeaderboardData(),
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    }),
  ratingDistribution: () =>
    queryOptions({
      queryKey: ["portal", "rating-distribution"],
      queryFn: () => getRatingDistribution(),
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    }),
  publicRecords: () =>
    queryOptions({
      queryKey: ["portal", "public-records"],
      queryFn: () => publicRecords(),
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    }),
};

export function invalidateFullProfileCache(): void {
  fullProfileCache = null;
  fullProfilePromise = null;
  invalidateSwrCache("member:profile:*");
  invalidateSwrCache("student:profile:*");
  invalidateSwrCache("leaderboard:*");
}
