import * as fixtures from "./fixtures";
import type {
  Achievement,
  Contest,
  LeaderboardRow,
  LeaderboardScope,
  ActivityItem,
  ClubEvent,
  DataMode,
  Member,
  Problem,
  ProblemStatus,
  RsvpStatus,
  Submission,
} from "./types";

/**
 * Mock data source. Every function is async, returns plain JSON-shaped data and
 * throws on failure — the same contract a fetch wrapper would have. Replacing
 * the bodies with network calls is the only change needed to go live.
 */

const LATENCY = 420;
const wait = (ms = LATENCY) => new Promise((r) => setTimeout(r, ms));

/** Session-local mutable copies so RSVP/submission actions persist while browsing. */
let eventsState: ClubEvent[] = fixtures.events.map((e) => ({ ...e }));
let problemsState: Problem[] = fixtures.problems.map((p) => ({ ...p }));
let submissionsState: Submission[] = [...fixtures.submissions];
let memberState: Member = { ...fixtures.member };

const emptyEvents = (): ClubEvent[] =>
  fixtures.events
    .filter((e) => e.state !== "past")
    .map((e) => ({ ...e, rsvp_status: "none" as RsvpStatus }));

const emptyProblems = (): Problem[] =>
  fixtures.problems.map((p) => ({
    ...p,
    status: "unsolved" as ProblemStatus,
    attempts: 0,
  }));

export async function getMember(mode: DataMode): Promise<Member> {
  await wait();
  return mode === "member" ? { ...memberState } : { ...fixtures.newMember };
}

export async function updateMember(
  mode: DataMode,
  patch: Partial<Pick<Member, "full_name" | "bio" | "skills" | "year" | "branch">>,
): Promise<Member> {
  await wait(300);
  if (mode === "member") {
    memberState = { ...memberState, ...patch };
    return { ...memberState };
  }
  return { ...fixtures.newMember, ...patch };
}

export async function listEvents(mode: DataMode): Promise<ClubEvent[]> {
  await wait();
  return mode === "member" ? eventsState.map((e) => ({ ...e })) : emptyEvents();
}

export async function getEvent(mode: DataMode, slug: string): Promise<ClubEvent | null> {
  await wait();
  const source = mode === "member" ? eventsState : emptyEvents();
  return source.find((e) => e.slug === slug) ?? null;
}

export async function setRsvp(
  mode: DataMode,
  slug: string,
  status: RsvpStatus,
): Promise<ClubEvent> {
  await wait(280);
  const target = eventsState.find((e) => e.slug === slug);
  if (!target) throw new Error("Event not found");
  const wasIn = target.rsvp_status === "confirmed";
  const isIn = status === "confirmed";
  const updated: ClubEvent = {
    ...target,
    rsvp_status: status,
    registered_count: target.registered_count + (isIn ? 1 : 0) - (wasIn ? 1 : 0),
  };
  if (mode === "member") {
    eventsState = eventsState.map((e) => (e.slug === slug ? updated : e));
  }
  return updated;
}

export async function listProblems(mode: DataMode): Promise<Problem[]> {
  await wait();
  return mode === "member" ? problemsState.map((p) => ({ ...p })) : emptyProblems();
}

export async function getProblem(mode: DataMode, slug: string): Promise<Problem | null> {
  await wait();
  const source = mode === "member" ? problemsState : emptyProblems();
  return source.find((p) => p.slug === slug) ?? null;
}

export async function submitAttempt(
  mode: DataMode,
  input: { problem_id: string; language: string; code: string; note: string | null },
): Promise<Submission> {
  await wait(650);
  if (!input.code.trim()) throw new Error("Write something before submitting.");
  const submission: Submission = {
    id: `sub_${Math.random().toString(36).slice(2, 10)}`,
    problem_id: input.problem_id,
    language: input.language,
    code: input.code,
    note: input.note,
    submitted_at: new Date().toISOString(),
    state: "queued",
  };
  if (mode === "member") {
    submissionsState = [submission, ...submissionsState];
    problemsState = problemsState.map((p) =>
      p.id === input.problem_id
        ? {
            ...p,
            attempts: p.attempts + 1,
            status: p.status === "solved" ? "solved" : "attempted",
          }
        : p,
    );
  }
  return submission;
}

export async function listSubmissions(mode: DataMode, problemId: string): Promise<Submission[]> {
  await wait(250);
  if (mode !== "member") return [];
  return submissionsState.filter((s) => s.problem_id === problemId);
}

export async function listActivity(mode: DataMode): Promise<ActivityItem[]> {
  await wait();
  return mode === "member" ? fixtures.activity.map((a) => ({ ...a })) : [];
}

export async function listAchievements(mode: DataMode): Promise<Achievement[]> {
  await wait();
  return mode === "member"
    ? fixtures.achievements.map((a) => ({ ...a }))
    : fixtures.newMemberAchievements.map((a) => ({ ...a }));
}

/** Mock OTP sign-in. Any six-digit code is accepted at this stage. */
export async function requestOtp(email: string): Promise<{ sent_to: string; expires_in: number }> {
  await wait(500);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");
  return { sent_to: email, expires_in: 600 };
}

export async function verifyOtp(email: string, code: string): Promise<{ member_id: string }> {
  await wait(600);
  if (!/^\d{6}$/.test(code)) throw new Error("That code is incomplete.");
  return {
    member_id: email === fixtures.newMember.email ? fixtures.newMember.id : fixtures.member.id,
  };
}

/* ---------------------------------------------------------------------------
 * Contests and leaderboards
 * ------------------------------------------------------------------------- */

let contestsState: Contest[] = fixtures.contests.map((c) => ({ ...c }));

const emptyContests = (): Contest[] =>
  fixtures.contests
    .filter((c) => c.state !== "finished")
    .map((c) => ({
      ...c,
      registered: false,
      standings: [],
      problems: c.problems.map((p) => ({ ...p, member_result: "untouched" as const })),
    }));

export async function listContests(mode: DataMode): Promise<Contest[]> {
  await wait();
  return mode === "member" ? contestsState.map((c) => ({ ...c })) : emptyContests();
}

export async function getContest(mode: DataMode, slug: string): Promise<Contest | null> {
  await wait();
  const source = mode === "member" ? contestsState : emptyContests();
  return source.find((c) => c.slug === slug) ?? null;
}

export async function setContestRegistration(
  mode: DataMode,
  slug: string,
  registered: boolean,
): Promise<Contest> {
  await wait(280);
  const target = contestsState.find((c) => c.slug === slug);
  if (!target) throw new Error("Contest not found");
  if (target.state === "finished") throw new Error("This contest is already over.");
  const updated: Contest = {
    ...target,
    registered,
    registered_count: target.registered_count + (registered ? 1 : 0) - (target.registered ? 1 : 0),
  };
  if (mode === "member") {
    contestsState = contestsState.map((c) => (c.slug === slug ? updated : c));
  }
  return updated;
}

export async function getLeaderboard(
  mode: DataMode,
  scope: LeaderboardScope,
): Promise<LeaderboardRow[]> {
  await wait();
  const rows = scope === "rookies" ? fixtures.rookieLeaderboard : fixtures.leaderboard;
  const ordered =
    scope === "all_time"
      ? [...rows]
          .sort((a, b) => b.problems_solved - a.problems_solved)
          .map((r, i) => ({ ...r, rank: i + 1 }))
      : rows.map((r) => ({ ...r }));
  if (mode === "member") return ordered;
  // A brand-new member appears on the board but with nothing behind them.
  return ordered.map((r) =>
    r.member_id === fixtures.newMember.id
      ? {
          ...r,
          is_you: true,
          rating: 0,
          problems_solved: 0,
          contests_played: 0,
          contributions: 0,
          streak_days: 0,
          previous_rank: null,
        }
      : { ...r, is_you: false },
  );
}
