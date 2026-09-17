/**
 * Contest lifecycle rules, mirrored client-side for presentation only.
 * The FastAPI service remains the single authority for eligibility and timers.
 *
 * Rules:
 *  - Round 1 (online assessment) opens 24 hours before the offline final and
 *    closes the moment the final goes live.
 *  - Once a candidate starts Round 1 the 2-hour session timer is immutable.
 *  - Only the Top 30 verified Round 1 scores receive a QR campus pass for Round 2.
 */

import type { ContestPhase, ContestSummary, RegistrationStatus } from "./types";

export const FINALIST_SEATS = 30;
export const ASSESSMENT_WINDOW_HOURS = 24;
export const ASSESSMENT_CLOSES_BEFORE_CONTEST_HOURS = 2;
export const ASSESSMENT_DURATION_MINUTES = 120;

export function assessmentOpensAt(contest: ContestSummary): Date {
  return new Date(
    new Date(contest.starts_at).getTime() - ASSESSMENT_WINDOW_HOURS * 60 * 60 * 1000,
  );
}

export function assessmentClosesAt(contest: ContestSummary): Date {
  return new Date(
    new Date(contest.starts_at).getTime() - ASSESSMENT_CLOSES_BEFORE_CONTEST_HOURS * 60 * 60 * 1000,
  );
}

export function contestPhase(
  contest: ContestSummary,
  registration: RegistrationStatus | null,
  now: number = Date.now(),
): ContestPhase {
  if (contest.status === "finished") return "complete";
  if (contest.status === "live") return "final_live";

  const opens = assessmentOpensAt(contest).getTime();
  const closes = assessmentClosesAt(contest).getTime();

  if (
    registration?.assessment_status === "submitted" ||
    registration?.assessment_status === "completed" ||
    registration?.assessment_taken
  ) {
    return "assessment_submitted";
  }
  if (now < opens) return "registration_open";
  if (now <= closes) return "assessment_open";
  return "assessment_closed";
}

export function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function cadenceLabel(contest: ContestSummary): string {
  if (contest.cadence === "weekly") return "Weekly Contest";
  if (contest.cadence === "biweekly") return "Biweekly Contest";
  return "Special Contest";
}
