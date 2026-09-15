/**
 * Round 2 · Final results and winners — verified offline standings.
 */

import { Link, useParams } from "react-router-dom";
import { contestApi } from "@/features/contest/api";
import { useSwrData } from "@/lib/cache/swrCache";

import { ArrowLeft, Award, Medal, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatWhen } from "@/features/contest/lifecycle";
import { cn } from "@/lib/utils";
import type { FinalStandingRow } from "@/features/contest/types";
import { ContestFinalResultsSkeleton } from "@/organization/components/skeletons";

export function ContestFinalResultsPage() {
  const { contestSlug = "" } = useParams<{ contestSlug: string }>();

  const { data: finalRows, loading: rowsLoading } = useSwrData<FinalStandingRow[]>(
    `contest:final_standings:${contestSlug}`,
    () => contestApi.finalStandings(contestSlug),
    { ttl: 30 * 1000 }
  );

  const { data: contest, loading: contestLoading } = useSwrData(
    `contest:detail:${contestSlug}`,
    () => contestApi.detail(contestSlug),
    { ttl: 2 * 60 * 1000 }
  );

  const rows = finalRows || [];

  if ((rowsLoading || contestLoading) && !finalRows && !contest) {
    return <ContestFinalResultsSkeleton />;
  }

  const podium = rows.slice(0, 3);

  return (
    <div className="page-wrap space-y-6">
      <Link
        to={`/portal/contests/${contestSlug}`}>
        <ArrowLeft />
        Back to contest
      </Link>

      <header className="space-y-2">
        <p className="kicker">Round 2 · Offline campus final</p>
        <h1 className="text-2xl font-black uppercase tracking-tight text-white">
          {contest ? `${contest.title} — final results` : "Final results"}
        </h1>
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          {contest
            ? `Held ${formatWhen(contest.starts_at)} at ${contest.venue}. Proctored, air-gapped, and verified.`
            : "Proctored, air-gapped, and verified standings."}
        </p>
      </header>

      {rows.length === 0 ? (
        <Card className="rounded-none border-dashed border-[var(--line)] bg-transparent">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Trophy className="size-6 text-[var(--muted)]" />
            <strong className="text-sm text-white">Results are not published yet</strong>
            <p className="max-w-sm text-xs text-[var(--muted)]">
              Final standings appear here once the proctors verify every submission from the venue.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            {podium.map((row, index) => (
              <Card
                key={row.handle}
                className={cn(
                  "rounded-none border-[var(--line)] bg-[var(--surface-1)]",
                  index === 0 && "border-[var(--accent)]/60",
                )}
              >
                <CardHeader className="gap-2">
                  {index === 0 ? (
                    <Trophy className="size-4 text-[var(--accent)]" />
                  ) : index === 1 ? (
                    <Medal className="size-4 text-[var(--accent)]" />
                  ) : (
                    <Award className="size-4 text-[var(--accent)]" />
                  )}
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
                    Rank {row.rank}
                  </span>
                  <CardTitle className="text-base font-bold text-white">{row.full_name}</CardTitle>
                  <p className="font-mono text-xs text-[var(--muted)]">
                    @{row.handle} · {row.department} · {row.batch}
                  </p>
                  <p className="font-mono text-sm text-[var(--accent)]">
                    {row.score} pts · {row.solved} solved
                  </p>
                </CardHeader>
              </Card>
            ))}
          </section>

          <div className="border border-[var(--line)] bg-[var(--surface-1)]">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--line)]">
                  <TableHead className="w-16 font-mono text-[10px] uppercase tracking-widest">
                    Rank
                  </TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-widest">
                    Finalist
                  </TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-widest">
                    Division
                  </TableHead>
                  <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest">
                    Solved
                  </TableHead>
                  <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest">
                    Score
                  </TableHead>
                  <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest">
                    Penalty
                  </TableHead>
                  <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest">
                    Rating
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <FinalRow key={`${row.handle}-${row.rank}`} row={row} />
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline" className="rounded-none font-mono text-xs uppercase">
          <Link to={`/portal/contests/${contestSlug}/results`}>
            Round 1 ranking
          </Link>
        </Button>
        <Button asChild variant="ghost" className="rounded-none font-mono text-xs uppercase">
          <Link to="/portal/my-contests">My contests</Link>
        </Button>
      </div>
    </div>
  );
}

function FinalRow({ row }: { row: FinalStandingRow }) {
  return (
    <TableRow className="border-[var(--line)]">
      <TableCell className="font-mono text-xs font-bold text-white">{row.rank}</TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-white">{row.full_name}</span>
          <span className="font-mono text-[10px] text-[var(--muted)]">
            @{row.handle} · {row.department} · {row.batch}
          </span>
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs text-[var(--muted)]">{row.division}</TableCell>
      <TableCell className="text-right font-mono text-xs text-white">{row.solved}</TableCell>
      <TableCell className="text-right font-mono text-xs font-bold text-[var(--accent)]">
        {row.score}
      </TableCell>
      <TableCell className="text-right font-mono text-xs text-[var(--muted)]">
        {row.penalty_minutes}m
      </TableCell>
      <TableCell className="text-right">
        {row.rating_delta == null ? (
          <span className="font-mono text-xs text-[var(--muted)]">—</span>
        ) : (
          <Badge
            variant="outline"
            className={cn(
              "rounded-none font-mono text-[10px] uppercase",
              row.rating_delta >= 0
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-rose-500/40 text-rose-300",
            )}
          >
            {row.rating_delta >= 0 ? `+${row.rating_delta}` : row.rating_delta}
          </Badge>
        )}
      </TableCell>
    </TableRow>
  );
}
