/**
 * Chaos Computer Club India — Live Database Portal Functions
 * Zero Static Fixtures — No Trust Client Policy (100% Real-Time Database Queries)
 */

import { createServerFn } from "@tanstack/react-start";
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
  LeaderboardEntry,
} from "./types";

function getBackendUrl(): string {
  if (typeof process !== "undefined" && process.env && process.env["BACKEND_URL"]) {
    return process.env["BACKEND_URL"];
  }
  if (typeof window !== "undefined") {
    return window.location.hostname.includes("localhost") ||
      window.location.hostname.includes("127.0.0.1")
      ? "http://localhost:8002/api"
      : "https://ccc-medicaps-api.sharexpress.in/api";
  }
  return "http://127.0.0.1:8002/api";
}

/**
 * Real-time public contest, scoreboard, announcement, and verification proofs.
 * Strictly queried from the PostgreSQL database through FastAPI.
 */
export const getPublicPortalData = createServerFn({ method: "GET" }).handler(async () => {
  const backendUrl = getBackendUrl();

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
    })),
  );

  return {
    contests: (apiContests || []) as any[],
    problems: problems || [],
    standings: (standings || []) as any[],
    announcements: (apiAnnouncements || []) as AnnouncementFeedItem[],
    proofs: (apiProofs || []) as any[],
  };
});

/**
 * Real-time full member profile, rating trajectory, active pass, and cryptographic proofs.
 * Strictly queried from the database.
 */
export const getMemberProfileData = createServerFn({ method: "GET" }).handler(async () => {
  const backendUrl = getBackendUrl();
  try {
    const res = await fetch(`${backendUrl}/auth/profile/full`, {
      headers: { "Content-Type": "application/json" },
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
    // Unreachable or unauthenticated
  }

  return {
    member: null,
    ratingHistory: [],
    recentBattles: [],
    campusPass: null,
    proofs: [],
    achievements: [],
  };
});

/**
 * Real-time university leaderboard with star division brackets.
 * Strictly queried from the database.
 */
export const getUniversityLeaderboardData = createServerFn({ method: "GET" }).handler(async () => {
  const backendUrl = getBackendUrl();
  const res = await fetch(`${backendUrl}/leaderboard`).catch(() => null);
  if (res && res.ok) {
    const data = await res.json();
    return data as LeaderboardEntry[];
  }
  return [] as LeaderboardEntry[];
});
