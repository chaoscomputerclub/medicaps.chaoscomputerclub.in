/**
 * Contest domain types — the single shape the UI layer consumes.
 * Every value originates from the FastAPI contest service; nothing here is static.
 */

export type ContestStatus = "upcoming" | "live" | "finished";
export type ContestCadence = "weekly" | "biweekly" | "special";

export type ContestSummary = {
  id: string;
  slug: string;
  title: string;
  season: string;
  summary: string;
  status: ContestStatus;
  cadence: ContestCadence;
  edition: number | null;
  starts_at: string;
  ends_at: string;
  check_in_opens_at: string;
  venue: string;
  seat_capacity: number;
  registered_count: number;
  problem_count: number;
  environment: string;
  prize_pool: string | null;
  sponsor: string | null;
  rules: string[];
  chief_proctors: string[];
  registered: boolean;
};

export type ContestProblemPreview = {
  problem_index: string;
  title: string;
  topic: string;
  points: number;
  solved_count: number;
};

export type RegistrationStatus = {
  registered: boolean;
  contest_slug: string;
  contest_status: ContestStatus | null;
  registered_at: string | null;
  assessment_taken: boolean;
  assessment_score: number | null;
  assessment_rank: number | null;
  assessment_status: string | null;
  is_top_30_qualified: boolean;
  can_take_assessment: boolean;
  can_enter_live_contest: boolean;
  eligibility_message: string | null;
};

export type RankingRow = {
  rank: number;
  handle: string;
  full_name: string;
  department: string;
  batch: string;
  total_score: number;
  penalty_minutes: number;
  status: string;
  is_top_30_qualified: boolean;
};

export type AssessmentRanking = {
  contest_slug: string;
  cutoff: number;
  total_participants: number;
  /** False while the 24-hour entry window is still open — ranking stays sealed. */
  released: boolean;
  releases_at: string | null;
  message: string | null;
  rows: RankingRow[];
};

/** Round 2 (offline final) verified standings. */
export type FinalStandingRow = {
  rank: number;
  handle: string;
  full_name: string;
  department: string;
  batch: string;
  division: string;
  score: number;
  solved: number;
  penalty_minutes: number;
  rating_delta: number | null;
};

export type CampusPass = {
  pass_code: string;
  member_name: string;
  handle: string;
  prn_hash: string;
  contest_title: string;
  seat: string;
  venue: string;
  check_in_opens_at: string;
  status: "issued" | "checked_in" | "expired";
};

export type ParticipationRecord = {
  contest_slug: string;
  contest_title: string;
  season: string;
  status: ContestStatus;
  participated_at: string;
  starts_at: string | null;
  ends_at: string | null;
  venue: string | null;
  score: number | null;
  rank: number | null;
  participants: number;
  outcome: "registered" | "live" | "qualified" | "not_qualified" | "pending";
};

/** Phase of the two-round funnel, derived from contest + registration state. */
export type ContestPhase =
  | "registration_open"
  | "assessment_open"
  | "assessment_submitted"
  | "assessment_closed"
  | "final_live"
  | "complete";
