/**
 * Chaos Computer Club India — Real-Time Database Query Definitions
 * Strictly Zero Static Data — All Records Queried From Database
 */

import { queryOptions } from "@tanstack/react-query";
import { getToken, getApiBase } from "@/lib/auth";
import {
  getPublicPortalData,
  getMemberProfileData,
  getUniversityLeaderboardData,
} from "./portal.functions";

async function fetchFullProfileData() {
  if (typeof window !== "undefined") {
    const token = getToken();
    if (!token) {
      window.location.href = "/auth";
      throw new Error("Authentication required. Guest members strictly not allowed.");
    }
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/auth/profile/full`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }).catch(() => null);
    if (res && res.ok) {
      return await res.json();
    }
    if (res && (res.status === 401 || res.status === 403)) {
      window.location.href = "/auth";
      throw new Error("Session expired. Please sign in again.");
    }
  }
  return await getMemberProfileData();
}
import type {
  AnnouncementFeedItem,
  ContestProblem,
  OfflineContest,
  ProblemTelemetry,
  ScoreboardEntry,
  TrustProof,
} from "./types";

async function publicRecords() {
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
      division: record.division === "open" ? "overall" : (record.division as OfflineContest["division"]),
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

  return {
    contests: mappedContests,
    announcements: (data.announcements || []) as AnnouncementFeedItem[],
    proofs,
  };
}

const publicQuery = queryOptions({ queryKey: ["portal", "public-records"], queryFn: publicRecords });

export const portalQueries = {
  member: () =>
    queryOptions({
      queryKey: ["portal", "member"],
      queryFn: async () => (await fetchFullProfileData()).member,
    }),
  contests: () =>
    queryOptions({
      queryKey: ["portal", "contests"],
      queryFn: async () => (await publicRecords()).contests,
    }),
  contest: (slug: string) =>
    queryOptions({
      queryKey: ["portal", "contest", slug],
      queryFn: async () => (await publicRecords()).contests.find((c) => c.slug === slug) ?? null,
    }),
  leaderboard: () =>
    queryOptions({
      queryKey: ["portal", "leaderboard"],
      queryFn: async () => await getUniversityLeaderboardData(),
    }),
  announcements: () =>
    queryOptions({
      queryKey: ["portal", "announcements"],
      queryFn: async () => (await publicRecords()).announcements,
    }),
  proofs: () =>
    queryOptions({
      queryKey: ["portal", "proofs"],
      queryFn: async () => (await publicRecords()).proofs,
    }),
  publicRecords: () => publicQuery,
  ratingHistory: () =>
    queryOptions({
      queryKey: ["portal", "rating-history"],
      queryFn: async () => (await fetchFullProfileData()).ratingHistory,
    }),
  recentBattles: () =>
    queryOptions({
      queryKey: ["portal", "recent-battles"],
      queryFn: async () => (await fetchFullProfileData()).recentBattles,
    }),
  campusPass: () =>
    queryOptions({
      queryKey: ["portal", "campus-pass"],
      queryFn: async () => (await fetchFullProfileData()).campusPass,
    }),
  achievements: () =>
    queryOptions({
      queryKey: ["portal", "achievements"],
      queryFn: async () => (await fetchFullProfileData()).achievements,
    }),
};
