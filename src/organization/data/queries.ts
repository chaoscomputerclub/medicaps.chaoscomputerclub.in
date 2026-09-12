/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { queryOptions } from "@tanstack/react-query";
import * as api from "./api";
import type { DataMode, LeaderboardScope } from "./types";

/**
 * Query keys are namespaced by data mode so switching between the established
 * member and the brand-new member fixture set refetches instead of reusing cache.
 */
export const portalQueries = {
  member: (mode: DataMode) =>
    queryOptions({ queryKey: ["portal", mode, "member"], queryFn: () => api.getMember(mode) }),
  events: (mode: DataMode) =>
    queryOptions({ queryKey: ["portal", mode, "events"], queryFn: () => api.listEvents(mode) }),
  event: (mode: DataMode, slug: string) =>
    queryOptions({
      queryKey: ["portal", mode, "event", slug],
      queryFn: () => api.getEvent(mode, slug),
    }),
  problems: (mode: DataMode) =>
    queryOptions({ queryKey: ["portal", mode, "problems"], queryFn: () => api.listProblems(mode) }),
  problem: (mode: DataMode, slug: string) =>
    queryOptions({
      queryKey: ["portal", mode, "problem", slug],
      queryFn: () => api.getProblem(mode, slug),
    }),
  submissions: (mode: DataMode, problemId: string) =>
    queryOptions({
      queryKey: ["portal", mode, "submissions", problemId],
      queryFn: () => api.listSubmissions(mode, problemId),
    }),
  activity: (mode: DataMode) =>
    queryOptions({ queryKey: ["portal", mode, "activity"], queryFn: () => api.listActivity(mode) }),
  achievements: (mode: DataMode) =>
    queryOptions({
      queryKey: ["portal", mode, "achievements"],
      queryFn: () => api.listAchievements(mode),
    }),
};

/** Competition surfaces: contests, standings and the season leaderboard. */
export const competitionQueries = {
  contests: (mode: DataMode) =>
    queryOptions({ queryKey: ["portal", mode, "contests"], queryFn: () => api.listContests(mode) }),
  contest: (mode: DataMode, slug: string) =>
    queryOptions({
      queryKey: ["portal", mode, "contest", slug],
      queryFn: () => api.getContest(mode, slug),
    }),
  leaderboard: (mode: DataMode, scope: LeaderboardScope) =>
    queryOptions({
      queryKey: ["portal", mode, "leaderboard", scope],
      queryFn: () => api.getLeaderboard(mode, scope),
    }),
};
