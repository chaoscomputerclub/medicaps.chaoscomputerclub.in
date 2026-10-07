/**
 * Contest Navigation & Route State Machine
 * Canonical URL generators and semantic action resolvers for the competitive programming arena.
 *
 * Invariants:
 *  - NAV-001: Review action navigates to selected problem review route.
 *  - NAV-002: Summary route only opens from explicit summary action.
 *  - NAV-003: Contest status must not change the semantic destination of Review.
 *  - NAV-004: URL problem identifier must match the rendered problem.
 *  - NAV-005: Review route must never automatically enter live solve mode.
 *  - NAV-006: Back/forward navigation preserves route semantics.
 *  - NAV-007: Direct review URL renders the requested problem.
 */

import { slugifyProblem } from "@/lib/utils";

export interface ProblemNavigationTarget {
  contestSlug: string;
  problemSlug?: string;
  problemTitle?: string;
  problemIndex?: string;
}

/**
 * Returns canonical Problem Review URL (/contests/:slug/problems/:problemSlug/review)
 * Preserves the exact problem identity clicked by the user.
 */
export function getProblemReviewUrl(contestSlug: string, problemSlugOrTitle: string, problemIndex?: string): string {
  const pSlug = problemIndex
    ? slugifyProblem(problemSlugOrTitle, problemIndex)
    : problemSlugOrTitle;
  return `/contests/${encodeURIComponent(contestSlug)}/problems/${encodeURIComponent(pSlug)}/review`;
}

/**
 * Returns canonical Problem Solve URL (/contests/:slug/problems/:problemSlug)
 * Used during live contest mode for active code writing and submission.
 */
export function getProblemSolveUrl(contestSlug: string, problemSlugOrTitle: string, problemIndex?: string): string {
  const pSlug = problemIndex
    ? slugifyProblem(problemSlugOrTitle, problemIndex)
    : problemSlugOrTitle;
  return `/contests/${encodeURIComponent(contestSlug)}/problems/${encodeURIComponent(pSlug)}`;
}

/**
 * Returns canonical Contest Summary URL (/contests/:slug/summary)
 * Opened ONLY when competitor or reviewer explicitly triggers "View Summary".
 */
export function getContestSummaryUrl(contestSlug: string): string {
  return `/contests/${encodeURIComponent(contestSlug)}/summary`;
}

/**
 * Returns canonical Contest Standings URL (/contests/:slug/results)
 */
export function getContestStandingsUrl(contestSlug: string): string {
  return `/contests/${encodeURIComponent(contestSlug)}/results`;
}

/**
 * Returns canonical Contest Overview URL (/contests/:slug)
 */
export function getContestOverviewUrl(contestSlug: string): string {
  return `/contests/${encodeURIComponent(contestSlug)}`;
}

/**
 * Evaluates whether a contest is finished/concluded based on status or ends_at timestamp.
 */
export function isContestConcluded(contest: { status?: string; ends_at?: string } | null | undefined): boolean {
  if (!contest) return false;
  if (contest.status === "finished" || contest.status === "concluded" || contest.status === "archived") {
    return true;
  }
  if (contest.ends_at) {
    const endMs = new Date(contest.ends_at).getTime();
    if (!Number.isNaN(endMs) && endMs < Date.now()) {
      return true;
    }
  }
  return false;
}
