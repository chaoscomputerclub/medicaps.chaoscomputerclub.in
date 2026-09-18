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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <Link
        to={`/portal/contests/${contestSlug}`}
        className="inline-flex items-center gap-2 font-mono text-xs text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Back to contest
      </Link>

      <header className="rounded-none border border-white/10 bg-zinc-900/60 p-6 md:p-8 backdrop-blur-md shadow-xl space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-none border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-lime-400">
          Round 2 · Offline Campus Final
        </span>
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
          {contest ? `${contest.title} — Final Results` : "Final Results"}
        </h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          {contest
            ? `Held ${formatWhen(contest.starts_at)} at ${contest.venue}. Proctored, air-gapped, and verified.`
            : "Proctored, air-gapped, and verified standings."}
        </p>
      </header>

      {rows.length === 0 ? (
        <Card className="rounded-none border-dashed border-white/10 bg-zinc-900/40">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Trophy className="size-8 text-zinc-500" />
            <strong className="text-sm font-bold text-white">Results are not published yet</strong>
            <p className="max-w-sm text-xs text-zinc-400">
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
                  "rounded-none border border-white/10 bg-zinc-900/60 backdrop-blur-md shadow-xl transition-all",
                  index === 0 && "border-lime-400/50 shadow-lime-400/10",
                )}
              >
                <CardHeader className="gap-2">
                  <div className="flex items-center justify-between">
                    {index === 0 ? (
                      <Trophy className="size-5 text-lime-400" />
                    ) : index === 1 ? (
                      <Medal className="size-5 text-zinc-300" />
                    ) : (
                      <Award className="size-5 text-amber-500" />
                    )}
                    <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                      Rank {row.rank}
                    </span>
                  </div>
                  <CardTitle className="text-base font-bold text-white">{row.full_name}</CardTitle>
                  <p className="font-mono text-xs text-zinc-400">
                    @{row.handle} · {row.department} · {row.batch}
                  </p>
                  <p className="font-mono text-sm font-bold tabular-nums text-lime-400">
                    {row.score} pts · {row.solved} solved
                  </p>
                </CardHeader>
              </Card>
            ))}
          </section>

          <div className="overflow-hidden rounded-none border border-white/10 bg-zinc-900/60 backdrop-blur-md shadow-xl">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/10 bg-zinc-950/80 hover:bg-zinc-950/80">
                  <TableHead className="w-16 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                    Rank
                  </TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                    Finalist
                  </TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                    Division
                  </TableHead>
                  <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                    Solved
                  </TableHead>
                  <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                    Score
                  </TableHead>
                  <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                    Penalty
                  </TableHead>
                  <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest text-zinc-400">
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
        <Button asChild variant="outline" className="rounded-none font-mono text-xs uppercase border-white/10">
          <Link to={`/portal/contests/${contestSlug}/results`}>
            Round 1 ranking
          </Link>
        </Button>
        <Button asChild variant="ghost" className="rounded-none font-mono text-xs uppercase text-zinc-400 hover:text-white">
          <Link to="/portal/my-contests">My contests</Link>
        </Button>
      </div>
    </div>
  );
}

function FinalRow({ row }: { row: FinalStandingRow }) {
  return (
    <TableRow className="border-b border-white/5 hover:bg-zinc-800/40 transition-colors">
      <TableCell className="font-mono text-xs font-bold tabular-nums text-white">{row.rank}</TableCell>
      <TableCell>
        <div className="flex flex-col">
          <Link
            to={`/portal/profile/${row.handle}`}
            className="text-sm font-semibold text-white hover:text-lime-400 hover:underline transition-colors w-fit"
          >
            {row.full_name}
          </Link>
          <Link
            to={`/portal/profile/${row.handle}`}
            className="font-mono text-[10px] text-zinc-400 hover:text-white transition-colors w-fit"
          >
            @{row.handle} · {row.department} · {row.batch}
          </Link>
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs text-zinc-400">{row.division}</TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums text-white">{row.solved}</TableCell>
      <TableCell className="text-right font-mono text-xs font-bold tabular-nums text-lime-400">
        {row.score}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums text-zinc-400">
        {row.penalty_minutes}m
      </TableCell>
      <TableCell className="text-right">
        {row.rating_delta == null ? (
          <span className="font-mono text-xs text-zinc-500">—</span>
        ) : (
          <Badge
            variant="outline"
            className={cn(
              "rounded-none font-mono text-[10px] uppercase tabular-nums",
              row.rating_delta >= 0
                ? "border-lime-400/40 text-lime-400 bg-lime-400/10"
                : "border-rose-500/40 text-rose-300 bg-rose-950/20",
            )}
          >
            {row.rating_delta >= 0 ? `+${row.rating_delta}` : row.rating_delta}
          </Badge>
        )}
      </TableCell>
    </TableRow>
  );
}
