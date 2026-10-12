/**
 * Round 2 · Final results and winners — verified offline standings.
 * Redesigned to Strix AI Paradigm (Pure Pitch Black × Electric Lime)
 */

import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { contestApi } from "@/features/contest/api";
import { useSwrData } from "@/lib/cache/swrCache";
import { useRealtimeEvents } from "@/lib/realtime";

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
import { PageHeader } from "@/organization/components/ui";
import { MakoMascot } from "@/components/common/MakoMascot";

import { formatWhen } from "@/features/contest/lifecycle";
import { cn } from "@/lib/utils";
import { CadetProfileHoverCard } from "@/components/ui/CadetProfileHoverCard";
import type { FinalStandingRow } from "@/features/contest/types";
import { ContestFinalResultsSkeleton } from "@/organization/components/skeletons";

export function ContestFinalResultsPage() {
  const { contestSlug = "" } = useParams<{ contestSlug: string }>();

  const { data: finalRows, loading: rowsLoading, revalidate: revalidateRows } = useSwrData<FinalStandingRow[]>(
    `contest:final_standings:${contestSlug}`,
    () => contestApi.finalStandings(contestSlug),
    { ttl: 30 * 1000 }
  );

  const { data: contest, loading: contestLoading, revalidate: revalidateContest } = useSwrData(
    `contest:detail:${contestSlug}`,
    () => contestApi.detail(contestSlug),
    { ttl: 2 * 60 * 1000 }
  );

  useRealtimeEvents(
    contestSlug,
    (event) => {
      if (
        event.event === "contest_concluded" ||
        event.event === "contest_status_changed" ||
        event.event === "contest_finished" ||
        event.event === "top30_qualified"
      ) {
        revalidateRows();
        revalidateContest();
      }
    },
    undefined,
    Boolean(contestSlug)
  );

  useEffect(() => {
    const handleConcluded = () => {
      revalidateRows();
      revalidateContest();
    };
    window.addEventListener("contest:concluded", handleConcluded);
    window.addEventListener("contest:cache_invalidated", handleConcluded);
    return () => {
      window.removeEventListener("contest:concluded", handleConcluded);
      window.removeEventListener("contest:cache_invalidated", handleConcluded);
    };
  }, [revalidateRows, revalidateContest]);

  const rows = finalRows || [];

  if ((rowsLoading || contestLoading) && !finalRows && !contest) {
    return <ContestFinalResultsSkeleton />;
  }

  const podium = rows.slice(0, 3);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Link
        to={`/contests/${contestSlug}`}
        className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-500 hover:text-white transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Back to {contest?.title ?? "Contest"}
      </Link>

      <PageHeader
        kicker="02 // Finals Standings"
        index="ROUND 2 · VERIFIED"
        badge={
          <span className="inline-flex items-center gap-1.5 rounded border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-lime-400">
            Round 2 · Campus Final
          </span>
        }
        title={contest ? `${contest.title} — Final Standings` : "Final Standings"}
        description={contest ? `Conducted ${formatWhen(contest.starts_at)} at ${contest.venue}. Air-gapped & proctor verified.` : "Verified championship standings."}
      />

      {rows.length === 0 ? (
        <Card className="rounded-[24px] border border-white/[0.08] bg-[#1F1F1F]">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center font-sans">
            <MakoMascot variant="winner" size="lg" className="mb-2" />
            <strong className="text-sm font-heading font-bold uppercase tracking-wider text-white">Results Pending Verification</strong>
            <p className="max-w-sm text-xs text-zinc-400 leading-relaxed font-sans">
              Official standings will be unlocked once proctors certify all lab workstation submissions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Top 3 Podium Cards */}
          <section className="grid gap-4 sm:grid-cols-3">
            {podium.map((row, index) => {
              const medalSrc =
                index === 0
                  ? "/matiks-assets/ranks/Gold.webp"
                  : index === 1
                  ? "/matiks-assets/ranks/Silver.webp"
                  : "/matiks-assets/ranks/Bronze.webp";

              return (
                <Card
                  key={row.handle}
                  className={cn(
                    "rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] transition-all",
                    index === 0 && "border-[#B1FA63]/50 ",
                  )}
                >
                  <CardHeader className="gap-2 p-6">
                    <div className="flex items-center justify-between">
                      <div className="size-8 flex items-center justify-center">
                        <img
                          src={medalSrc}
                          alt={`Rank #${index + 1}`}
                          className="size-7 object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                      <span className="font-display text-xl tabular-nums text-zinc-400">
                        #{index + 1}
                      </span>
                    </div>
                  <CardTitle className="text-lg font-normal text-white font-display uppercase tracking-wider">
                    {row.full_name}
                  </CardTitle>
                  <p className="font-mono text-xs text-zinc-400">@{row.handle}</p>
                </CardHeader>
                <CardContent className="space-y-2.5 px-6 pb-6 pt-0 font-sans text-xs">
                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
                    <span className="text-zinc-400 font-heading font-semibold text-[11px] uppercase">Total Score</span>
                    <span className="font-bold text-[#B1FA63] font-mono tabular-nums text-sm">{row.total_score} pts</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-heading font-semibold text-[11px] uppercase">Penalty</span>
                    <span className="text-zinc-300 font-mono tabular-nums">{row.penalty_minutes}m</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-heading font-semibold text-[11px] uppercase">Workstation</span>
                    <span className="text-white font-mono">{row.seat || "Lab"}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

          {/* Full Standings Table */}
          <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#1F1F1F]">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/[0.08] hover:bg-transparent">
                  <TableHead className="w-16 font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-400">Rank</TableHead>
                  <TableHead className="font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-400">Cadet</TableHead>
                  <TableHead className="hidden font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-400 sm:table-cell">Dept</TableHead>
                  <TableHead className="text-right font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-400">Score</TableHead>
                  <TableHead className="hidden text-right font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-400 sm:table-cell">Penalty</TableHead>
                  <TableHead className="text-right font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-400">Workstation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.handle} className="border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors">
                    <TableCell className="font-mono text-xs font-semibold text-white tabular-nums">
                      #{row.rank}
                    </TableCell>
                    <TableCell>
                      <CadetProfileHoverCard
                        handle={row.handle}
                        profile={{
                          handle: row.handle,
                          full_name: row.full_name,
                          department: row.department,
                        }}
                        side="top"
                        align="start"
                      >
                        <div className="inline-flex flex-col cursor-pointer">
                          <Link to={`/profile/${row.handle}`} className="text-xs font-semibold text-white hover:text-[#B1FA63] transition-colors">
                            {row.full_name}
                          </Link>
                          <span className="font-mono text-[10px] text-zinc-400">
                            @{row.handle}
                          </span>
                        </div>
                      </CadetProfileHoverCard>
                    </TableCell>
                    <TableCell className="hidden font-sans text-xs text-zinc-400 sm:table-cell">
                      {row.department}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold tabular-nums text-[#B1FA63]">
                      {row.total_score}
                    </TableCell>
                    <TableCell className="hidden text-right font-mono text-xs tabular-nums text-zinc-400 sm:table-cell">
                      {row.penalty_minutes}m
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-zinc-300">
                      {row.seat || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <div className="pt-2">
        <Button asChild variant="outline" size="sm" className="rounded-[10px]">
          <Link to={`/contests/${contestSlug}`}>Back to Contest Details</Link>
        </Button>
      </div>
    </div>
  );
}
