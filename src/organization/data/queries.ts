import { queryOptions } from "@tanstack/react-query";
import { achievements, announcements, campusPass, contests, leaderboard, member, proofs, ratingHistory, recentBattles } from "./fixtures";
import { getPublicPortalData } from "./portal.functions";
import type { AnnouncementFeedItem, ContestProblem, OfflineContest, ProblemTelemetry, ScoreboardEntry, TrustProof } from "./types";

const asyncValue=<T,>(value:T)=>async()=>value;

async function publicRecords() {
  try {
    const data = await getPublicPortalData();
    const mappedContests: OfflineContest[] = data.contests.map((record) => {
      const fallback = contests.find((contest) => contest.slug === record.slug);
      const contestProblems: ContestProblem[] = data.problems
        .filter((problem) => problem.contest_id === record.id)
        .map((problem) => ({
          index: problem.problem_index,
          title: problem.title,
          topic: problem.topic,
          points: problem.points,
          solved_count: problem.solved_count,
          first_ac_seconds: problem.first_ac_seconds,
          editorial: problem.editorial_summary ?? "Editorial pending sealed review.",
        }));
      const contestStandings: ScoreboardEntry[] = data.standings
        .filter((entry) => entry.contest_id === record.id)
        .map((entry) => ({
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
          is_you: entry.handle === member.handle,
          problems: Array.isArray(entry.telemetry) ? entry.telemetry as ProblemTelemetry[] : [],
        }));
      return {
        id: record.id,
        slug: record.slug,
        title: record.title,
        season: record.season,
        status: record.status as OfflineContest["status"],
        division: record.division === "open" ? "overall" : record.division as OfflineContest["division"],
        starts_at: record.starts_at,
        ends_at: record.ends_at,
        check_in_opens_at: record.check_in_opens_at,
        venue: record.venue,
        seat_capacity: record.seat_capacity,
        registered_count: record.registered_count,
        problem_count: record.problem_count,
        environment: record.environment,
        chief_proctors: record.chief_proctors,
        prize_pool: record.prize_pool,
        sponsor: record.sponsor,
        summary: record.summary,
        rules: record.rules,
        problems: contestProblems.length ? contestProblems : fallback?.problems ?? [],
        standings: contestStandings.length ? contestStandings : fallback?.standings ?? [],
        registered: fallback?.registered ?? false,
      };
    });
    return {
      contests: mappedContests.length ? mappedContests : contests,
      announcements: (data.announcements.length ? data.announcements : announcements) as AnnouncementFeedItem[],
      proofs: (data.proofs.length ? data.proofs.map((proof) => {
        const contest = data.contests.find((item) => item.id === proof.contest_id);
        return { ...proof, contest_slug: contest?.slug ?? "", status: proof.status as TrustProof["status"] };
      }) : proofs) as TrustProof[],
    };
  } catch {
    return { contests, announcements, proofs };
  }
}

const publicQuery=queryOptions({queryKey:["portal","public-records"],queryFn:publicRecords});
export const portalQueries={member:()=>queryOptions({queryKey:["portal","member"],queryFn:asyncValue(member)}),contests:()=>queryOptions({queryKey:["portal","contests"],queryFn:async()=> (await publicRecords()).contests}),contest:(slug:string)=>queryOptions({queryKey:["portal","contest",slug],queryFn:async()=> (await publicRecords()).contests.find(c=>c.slug===slug)??null}),leaderboard:()=>queryOptions({queryKey:["portal","leaderboard"],queryFn:asyncValue(leaderboard)}),announcements:()=>queryOptions({queryKey:["portal","announcements"],queryFn:async()=> (await publicRecords()).announcements}),proofs:()=>queryOptions({queryKey:["portal","proofs"],queryFn:async()=> (await publicRecords()).proofs}),publicRecords:()=>publicQuery,ratingHistory:()=>queryOptions({queryKey:["portal","rating-history"],queryFn:asyncValue(ratingHistory)}),recentBattles:()=>queryOptions({queryKey:["portal","recent-battles"],queryFn:asyncValue(recentBattles)}),campusPass:()=>queryOptions({queryKey:["portal","campus-pass"],queryFn:asyncValue(campusPass)}),achievements:()=>queryOptions({queryKey:["portal","achievements"],queryFn:asyncValue(achievements)})};
