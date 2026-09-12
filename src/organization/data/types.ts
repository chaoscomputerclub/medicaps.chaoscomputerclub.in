/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

/**
 * Portal data contracts.
 *
 * These types are the shape the eventual API is expected to return: snake_case
 * field names, ISO-8601 timestamp strings, explicit nulls (never `undefined`)
 * for "no value", and counts as plain numbers. Swapping the mock layer in
 * `src/portal/api.ts` for real network calls should not require changing any
 * screen.
 */

export type ISODateString = string;

export type MemberStats = {
  problems_solved: number;
  events_attended: number;
  current_streak_days: number;
  contributions: number;
};

export type Member = {
  id: string;
  handle: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  year: number | null;
  branch: string | null;
  skills: string[];
  joined_at: ISODateString;
  stats: MemberStats;
};

export type AchievementTier = "milestone" | "progress";

export type Achievement = {
  id: string;
  name: string;
  description: string;
  tier: AchievementTier;
  earned_at: ISODateString | null;
  /** Present when the achievement is countable; `null` for one-off milestones. */
  progress: { current: number; target: number } | null;
};

export type EventKind = "hackathon" | "meetup" | "contest";
export type EventMode = "onsite" | "online";
/** The signed-in member's relationship to the event. */
export type RsvpStatus = "confirmed" | "pending" | "waitlisted" | "none";
export type EventState = "open" | "closed" | "past";

export type ClubEvent = {
  id: string;
  slug: string;
  title: string;
  kind: EventKind;
  mode: EventMode;
  summary: string;
  description: string;
  starts_at: ISODateString;
  ends_at: ISODateString;
  location: string | null;
  join_url: string | null;
  capacity: number | null;
  registered_count: number;
  state: EventState;
  rsvp_status: RsvpStatus;
  tags: string[];
};

export type Difficulty = "easy" | "medium" | "hard";
export type ProblemStatus = "unsolved" | "attempted" | "solved";

export type Problem = {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  status: ProblemStatus;
  summary: string;
  prompt: string;
  constraints: string[];
  starter_code: string;
  language: string;
  attempts: number;
  solved_by_count: number;
  published_at: ISODateString;
};

export type ActivityKind =
  | "problem_solved"
  | "problem_attempted"
  | "event_attended"
  | "event_registered"
  | "contribution"
  | "achievement_earned";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string | null;
  occurred_at: ISODateString;
};

export type Submission = {
  id: string;
  problem_id: string;
  language: string;
  code: string;
  note: string | null;
  submitted_at: ISODateString;
  /** No execution engine yet — every mock submission is queued. */
  state: "queued";
};

/**
 * Which fixture set a screen reads from.
 * `member` = an established member with history.
 * `new_member` = a freshly joined account, used to exercise zero-states.
 */
export type DataMode = "member" | "new_member";

/* ---------------------------------------------------------------------------
 * Contests, standings and leaderboards
 * ------------------------------------------------------------------------- */

export type ContestState = "upcoming" | "live" | "finished";
export type ContestFormat = "icpc" | "ladder" | "sprint" | "teardown";

export type ContestProblemRef = {
  index: string;
  problem_slug: string;
  title: string;
  difficulty: Difficulty;
  points: number;
  solved_by_count: number;
  /** The signed-in member's result for this contest problem. */
  member_result: "solved" | "attempted" | "untouched";
};

export type StandingRow = {
  rank: number;
  member_id: string;
  handle: string;
  full_name: string;
  solved: number;
  penalty_minutes: number;
  score: number;
  /** Positive means the member climbed this contest. */
  rating_delta: number | null;
  is_you: boolean;
};

export type Contest = {
  id: string;
  slug: string;
  title: string;
  format: ContestFormat;
  season: string;
  state: ContestState;
  summary: string;
  description: string;
  rules: string[];
  starts_at: ISODateString;
  ends_at: ISODateString;
  duration_minutes: number;
  rated: boolean;
  registered_count: number;
  problem_count: number;
  registered: boolean;
  editorial_url: string | null;
  problems: ContestProblemRef[];
  standings: StandingRow[];
};

export type LeaderboardScope = "season" | "all_time" | "rookies";

export type LeaderboardRow = {
  rank: number;
  previous_rank: number | null;
  member_id: string;
  handle: string;
  full_name: string;
  year: number | null;
  branch: string | null;
  rating: number;
  problems_solved: number;
  contests_played: number;
  contributions: number;
  streak_days: number;
  is_you: boolean;
};
