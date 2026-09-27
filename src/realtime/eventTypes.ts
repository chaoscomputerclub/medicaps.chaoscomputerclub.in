/**
 * Strongly typed real-time event definitions for the Chaos Computer Club platform.
 */

export const RealtimeEventNames = {
  // Rating & User
  RATING_UPDATED: "rating.updated",
  RATINGS_UPDATED: "ratings_updated",
  MEMBER_PROFILE_UPDATED: "member_profile_updated",
  PROFILE_UPDATED: "profile.updated",

  // Contests
  CONTEST_CREATED: "contest.created",
  CONTEST_UPDATED: "contest.updated",
  CONTEST_DELETED: "contest.deleted",
  CONTEST_STATUS_CHANGED: "contest_status_changed",
  CONTEST_CONCLUDED: "contest_concluded",
  CONTEST_FINISHED: "contest_finished",
  CONTEST_REGISTERED: "contest_registered",
  CONTEST_UNREGISTERED: "contest_unregistered",
  CONTEST_TIMER_RESET: "contest_timer_reset",

  // Submissions & Leaderboards
  LEADERBOARD_UPDATED: "leaderboard.updated",
  LEADERBOARD_UPDATED_ALT: "leaderboard_updated",
  SCOREBOARD_UPDATED: "scoreboard.updated",
  SCOREBOARD_UPDATED_ALT: "scoreboard_updated",
  SUBMISSION_CREATED: "submission.created",
  SUBMISSION_QUEUED: "submission.queued",
  SUBMISSION_RUNNING: "submission.running",
  SUBMISSION_JUDGED: "submission.judged",
  SUBMISSION_EVALUATED: "submission_evaluated",

  // Assessments & Passes
  TOP30_QUALIFIED: "top30_qualified",
  ASSESSMENT_FINISHED: "assessment_finished",
  PASS_CHECKED_IN: "pass_checked_in",

  // Feed & Sync
  ACTIVITY_CREATED: "activity.created",
  NOTIFICATION_CREATED: "notification.created",
  ANNOUNCEMENT_CREATED: "announcement.created",
  RESYNC_REQUIRED: "resync_required",
  CACHE_SYNC: "cache_sync",
} as const;

export type RealtimeEventName = (typeof RealtimeEventNames)[keyof typeof RealtimeEventNames];

export interface ServerEventEnvelope<T = any> {
  id?: string | undefined;
  event: string;
  type?: string | undefined;
  aggregate?: string | undefined;
  aggregate_id?: string | undefined;
  version?: number | undefined;
  timestamp?: string | undefined;
  contest_slug?: string | undefined;
  data?: T | undefined;
  payload?: T | undefined;
}
