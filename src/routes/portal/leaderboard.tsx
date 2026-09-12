/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  EmptyState,
  ErrorState,
  MetaList,
  PageHeader,
  Panel,
  PanelHeader,
  RankDelta,
  RouteFade,
  RowSkeletons,
  StatBlock,
} from "@/organization/components/ui";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDataMode } from "@/organization/data/data-mode";
import { competitionQueries } from "@/organization/data/queries";
import type { LeaderboardScope } from "@/organization/data/types";

export const Route = createFileRoute("/portal/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — CCC Member Portal" },
      {
        name: "description",
        content: "Season standings by rating, problems solved, contests played and contributions.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LeaderboardPage,
});

const SCOPE_NOTE: Record<LeaderboardScope, string> = {
  season:
    "Rating from this season's rated ladders only. Sprints and teardown rounds do not move it.",
  all_time: "Ordered by problems solved since joining. Nothing here resets between seasons.",
  rookies: "First and second years only — the board most people should actually compare against.",
};

function LeaderboardPage() {
  const { mode } = useDataMode();
  const [scope, setScope] = useState<LeaderboardScope>("season");
  const { data, isPending, isError, refetch } = useQuery(
    competitionQueries.leaderboard(mode, scope),
  );

  const rows = data ?? [];
  const you = rows.find((r) => r.is_you) ?? null;
  const top = rows[0] ?? null;

  return (
    <RouteFade>
      <PageHeader
        title="Leaderboard"
        description="Merit over labels. The board exists to show you who to ask for help, not to rank people as human beings."
      />

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatBlock
          label="Your rank"
          value={you ? you.rank : "—"}
          hint={you && you.previous_rank ? `Previously ${you.previous_rank}` : "New to this board"}
        />
        <StatBlock
          label="Your rating"
          value={you ? you.rating : 0}
          hint="Rated ladders only, this season"
        />
        <StatBlock
          label="Solved"
          value={you ? you.problems_solved : 0}
          hint={top ? `Top of board: ${top.problems_solved}` : "No comparison yet"}
        />
        <StatBlock
          label="Ranked members"
          value={rows.length}
          hint="Everyone with at least one scored round"
        />
      </section>

      <Tabs value={scope} onValueChange={(v) => setScope(v as LeaderboardScope)} className="mt-6">
        <TabsList className="rounded-none border border-border bg-surface p-0">
          {(
            [
              ["season", "This season"],
              ["all_time", "All time"],
              ["rookies", "Rookies"],
            ] as const
          ).map(([v, l]) => (
            <TabsTrigger
              key={v}
              value={v}
              className="rounded-none font-mono text-[0.625rem] tracking-[0.16em] uppercase"
            >
              {l}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <p className="mt-3 max-w-2xl text-[0.8125rem] leading-relaxed text-muted-foreground">
        {SCOPE_NOTE[scope]}
      </p>

      <Panel className="mt-4">
        <PanelHeader
          title="Standings"
          aside={
            <span className="font-mono text-[0.625rem] tabular-nums text-subtle-foreground">
              {isPending ? "loading" : `${rows.length} rows`}
            </span>
          }
        />
        {isPending ? (
          <div className="p-4">
            <RowSkeletons count={8} />
          </div>
        ) : isError ? (
          <div className="p-4">
            <ErrorState
              message="The leaderboard couldn't be loaded."
              onRetry={() => void refetch()}
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Nobody has been scored yet"
              description="The board fills in after the first rated ladder of the season."
            />
          </div>
        ) : (
          <>
            {/* Table on wide screens */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[46rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      "#",
                      "Δ",
                      "Member",
                      "Year",
                      "Rating",
                      "Solved",
                      "Contests",
                      "Contribs",
                      "Streak",
                    ].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="px-3 py-2.5 font-mono text-[0.5625rem] tracking-[0.16em] text-subtle-foreground uppercase"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.member_id}
                      className={
                        r.is_you
                          ? "border-b border-border bg-surface-raised"
                          : "border-b border-border transition-colors duration-150 ease-editorial hover:bg-surface-raised"
                      }
                    >
                      <td className="px-3 py-3 font-mono text-[0.75rem] tabular-nums text-index">
                        {r.rank}
                      </td>
                      <td className="px-3 py-3">
                        <RankDelta rank={r.rank} previous={r.previous_rank} />
                      </td>
                      <td className="px-3 py-3">
                        <span className="block text-[0.8125rem] text-foreground">
                          {r.full_name}
                          {r.is_you ? " (you)" : ""}
                        </span>
                        <span className="font-mono text-[0.625rem] text-subtle-foreground">
                          @{r.handle} · {r.branch}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-[0.75rem] tabular-nums text-muted-foreground">
                        {r.year ?? "—"}
                      </td>
                      <td className="px-3 py-3 font-mono text-[0.75rem] tabular-nums text-foreground">
                        {r.rating}
                      </td>
                      <td className="px-3 py-3 font-mono text-[0.75rem] tabular-nums text-foreground">
                        {r.problems_solved}
                      </td>
                      <td className="px-3 py-3 font-mono text-[0.75rem] tabular-nums text-muted-foreground">
                        {r.contests_played}
                      </td>
                      <td className="px-3 py-3 font-mono text-[0.75rem] tabular-nums text-muted-foreground">
                        {r.contributions}
                      </td>
                      <td className="px-3 py-3 font-mono text-[0.75rem] tabular-nums text-muted-foreground">
                        {r.streak_days}d
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Stacked cards on narrow screens */}
            <ul className="divide-y divide-border md:hidden">
              {rows.map((r) => (
                <li
                  key={r.member_id}
                  className={r.is_you ? "bg-surface-raised px-4 py-3.5" : "px-4 py-3.5"}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0">
                      <span className="font-mono text-[0.6875rem] tabular-nums text-index">
                        {r.rank}
                      </span>{" "}
                      <span className="text-[0.8125rem] text-foreground">
                        {r.full_name}
                        {r.is_you ? " (you)" : ""}
                      </span>
                    </span>
                    <RankDelta rank={r.rank} previous={r.previous_rank} />
                  </div>
                  <p className="mt-1.5 font-mono text-[0.625rem] tabular-nums text-subtle-foreground">
                    {r.rating} rating · {r.problems_solved} solved · {r.contests_played} contests ·{" "}
                    {r.streak_days}d streak
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="How the numbers are produced" />
          <MetaList
            items={[
              ["Rating", "Elo-style, updated after each rated ladder, reset every season"],
              ["Solved", "Distinct problems with at least one accepted submission"],
              ["Contests", "Rounds where you submitted at least once"],
              ["Contributions", "Editorials, problem fixes, sessions run, reviews given"],
              ["Streak", "Consecutive days with a solve, review or session"],
            ]}
          />
        </Panel>
        <Panel>
          <PanelHeader title="Climbing it" />
          <div className="space-y-3 px-4 py-4 text-[0.8125rem] leading-relaxed text-muted-foreground">
            <p>
              Rating moves fastest through rated ladders, but the people at the top of this board
              got there by writing editorials for problems they failed. Explaining a solve is worth
              more than adding another easy one.
            </p>
            <p>
              If you are stuck below the halfway line, pick the person three rows above you and ask
              them how they read a problem statement. That is what the board is for.
            </p>
            <Link
              to="/portal/contests"
              className="inline-block font-mono text-[0.625rem] tracking-[0.16em] text-accent uppercase hover:underline"
            >
              Enter the next round →
            </Link>
          </div>
        </Panel>
      </div>
    </RouteFade>
  );
}
