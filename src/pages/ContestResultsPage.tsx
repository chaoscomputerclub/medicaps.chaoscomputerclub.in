import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { contestApi } from "@/features/contest/api";
import { useSwrData } from "@/lib/cache/swrCache";
import { ArrowLeft, Award, Clock, Crown, Lock, Search, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CadetProfileHoverCard } from "@/components/ui/CadetProfileHoverCard";
import type { RankingRow, AssessmentRanking } from "@/features/contest/types";
import { ContestResultsSkeleton } from "@/organization/components/skeletons";
import { PageHeader } from "@/organization/components/ui";

export function ContestResultsPage() {
  const { contestSlug = "" } = useParams<{ contestSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("query") || "";
  const [deptFilter, setDeptFilter] = useState<string>("all");

  const { data: rankingData, loading: rankLoading } = useSwrData<AssessmentRanking>(
    `contest:ranking:${contestSlug}`,
    () => contestApi.ranking(contestSlug),
    { ttl: 30 * 1000 }
  );

  const { data: contest, loading: contestLoading } = useSwrData(
    `contest:detail:${contestSlug}`,
    () => contestApi.detail(contestSlug),
    { ttl: 2 * 60 * 1000 }
  );

  const { data: registration } = useSwrData(
    `contest:registration:${contestSlug}`,
    () => contestApi.registrationStatus(contestSlug),
    { ttl: 2 * 60 * 1000 }
  );

  const ranking = rankingData || {
    contest_slug: contestSlug,
    cutoff: 0,
    total_participants: 0,
    released: true,
    releases_at: null,
    message: null,
    rows: [],
  };

  const myHandle = registration?.assessment_rank
    ? ranking.rows.find((row) => row.rank === registration.assessment_rank)?.handle
    : undefined;

  const myRow = myHandle ? ranking.rows.find((row) => row.handle === myHandle) : undefined;

  // Extract distinct departments for filtering
  const departments = Array.from(
    new Set(ranking.rows.map((r) => r.department).filter(Boolean))
  ) as string[];

  const rows = ranking.rows.filter((row) => {
    const q = (query || "").toLowerCase();
    const matchesQuery =
      !q ||
      (row.handle || "").toLowerCase().includes(q) ||
      (row.full_name || "").toLowerCase().includes(q);
    const matchesDept = deptFilter === "all" || row.department === deptFilter;
    return matchesQuery && matchesDept;
  });

  if ((rankLoading || contestLoading) && !rankingData && !contest) {
    return <ContestResultsSkeleton />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      {/* Back button */}
      <Link
        to={`/contests/${contestSlug}`}
        className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-500 hover:text-white transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Back to {contest?.title ?? "Contest"}
      </Link>

      {/* Your Standing Hero */}
      {myRow ? (
        <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-lime-400/40 bg-lime-400/10 text-center font-mono text-lime-400">
                <div>
                  <div className="text-xl font-semibold tabular-nums leading-none">
                    #{myRow.rank}
                  </div>
                  <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">Rank</div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-lime-400">
                    <Trophy className="size-3 text-lime-400" />
                    Verified Finish
                  </span>
                  {myRow.rank <= 3 && (
                    <span className="inline-flex items-center gap-1 rounded border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                      <Crown className="size-3 text-amber-400" />
                      Podium
                    </span>
                  )}
                </div>
                <p className="text-lg font-semibold text-white font-mono tabular-nums">
                  {myRow.total_score} <span className="font-sans text-xs font-normal text-zinc-500">points</span>
                </p>
                <p className="text-xs text-zinc-400 font-mono">
                  {myRow.full_name} · {myRow.department || "Engineering"} · {myRow.penalty_minutes}m penalty
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="flex items-center gap-2 shrink-0">
              <Button asChild variant="outline" className="rounded-md border-white/10 bg-black font-mono text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-white/20">
                <Link to="/leaderboard">University Leaderboard →</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <PageHeader
          kicker="01 // Leaderboard"
          index="STANDINGS"
          badge={
            <span className="inline-flex items-center gap-1.5 rounded border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-lime-400">
              <Trophy className="size-3 text-lime-400" />
              Official Standings
            </span>
          }
          title={contest ? `${contest.title} Standings` : "Contest Standings"}
          description="Official contest standings. Ranked by total points, then penalty time."
        />
      )}


      {contest?.status === "upcoming" ? (
        <div className="rounded-lg border border-amber-500/30 bg-zinc-950 p-8 text-center space-y-4 font-mono">
          <div className="mx-auto flex size-12 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <Lock className="size-6" />
          </div>
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-widest text-amber-400 font-semibold block">
              Standings Sealed
            </span>
            <h2 className="text-lg font-semibold text-white font-sans">
              Standings Unlock When Contest Goes Live
            </h2>
            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
              Official standings and scoreboards will populate once {contest.title} begins at{" "}
              {new Date(contest.starts_at).toLocaleString("en-IN", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZoneName: "short",
              })}.
            </p>
          </div>
          <Button asChild variant="outline" className="border-white/10 bg-black font-mono text-xs text-zinc-300 hover:bg-lime-400 hover:text-black hover:border-lime-400">
            <Link to={`/contests/${contestSlug}`}>Back to Contest Overview</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Filters + Search */}
          <div className="flex flex-wrap items-center gap-3">
            {departments.length > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDeptFilter("all")}
                  className={cn(
                    "rounded-md px-3 py-1 font-mono text-xs uppercase tracking-wider transition-colors",
                    deptFilter === "all"
                      ? "bg-lime-400 text-black font-semibold"
                      : "border border-white/8 bg-black text-zinc-400 hover:text-white"
                  )}
                >
                  All
                </button>
                {departments.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setDeptFilter(dept)}
                    className={cn(
                      "rounded-md px-3 py-1 font-mono text-xs uppercase tracking-wider transition-colors",
                      deptFilter === dept
                        ? "bg-lime-400 text-black font-semibold"
                        : "border border-white/8 bg-black text-zinc-400 hover:text-white"
                    )}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            )}

            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
              <Input
                value={query}
                onChange={(e) => setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set("query", e.target.value); return p; })}
                placeholder="Search cadet or handle..."
                className="rounded-md border-white/10 bg-black pl-8 font-mono text-xs text-white placeholder:text-zinc-600 focus-visible:border-lime-400"
              />
            </div>

            <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500 font-mono">
              <Award className="size-3.5 text-zinc-400" />
              <span><span className="tabular-nums font-semibold text-white">{ranking.total_participants}</span> competitors</span>
            </div>
          </div>

          {/* Standings Table */}
          <div className="overflow-hidden rounded-lg border border-white/8 bg-black">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/8 hover:bg-transparent">
                  <TableHead className="w-16 font-mono text-[10px] uppercase text-zinc-500">Rank</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase text-zinc-500">Cadet</TableHead>
                  <TableHead className="hidden font-mono text-[10px] uppercase text-zinc-500 sm:table-cell">Dept</TableHead>
                  <TableHead className="text-right font-mono text-[10px] uppercase text-zinc-500">Score</TableHead>
                  <TableHead className="hidden text-right font-mono text-[10px] uppercase text-zinc-500 sm:table-cell">Penalty</TableHead>
                  <TableHead className="text-right font-mono text-[10px] uppercase text-zinc-500">Standing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow className="border-b border-white/6">
                    <TableCell colSpan={6} className="py-12 text-center font-mono text-xs text-zinc-600">
                      {query ? "No submissions match this search filter." : "No contest submissions recorded yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <RankRow
                      key={`${row.handle}-${row.rank}`}
                      row={row}
                      isMe={row.handle === myHandle}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Bottom Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button asChild variant="outline" className="rounded-md border-white/10 bg-black font-mono text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-white/20">
          <Link to={`/contests/${contestSlug}`}>Contest Details</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-md border-white/10 bg-black font-mono text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-white/20">
          <Link to="/leaderboard">University Leaderboard →</Link>
        </Button>
      </div>
    </div>
  );
}

function RankRow({
  row,
  isMe,
}: {
  row: RankingRow;
  isMe: boolean;
}) {
  const isPodium = row.rank <= 3;
  return (
    <TableRow className={cn("border-b border-white/6 hover:bg-zinc-950 transition-colors", isMe && "bg-lime-400/10 hover:bg-lime-400/15")}>
      <TableCell className="font-mono text-xs font-semibold text-white">
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          {isPodium && (
            <Crown
              className={cn(
                "size-3",
                row.rank === 1 ? "text-amber-400" : row.rank === 2 ? "text-zinc-300" : "text-amber-600"
              )}
            />
          )}
          {row.rank}
        </span>
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
            <Link to={`/profile/${row.handle}`} className="text-xs font-semibold text-white hover:text-lime-400 transition-colors">
              {row.full_name}
            </Link>
            <span className="font-mono text-[10px] text-zinc-500">
              @{row.handle}
            </span>
          </div>
        </CadetProfileHoverCard>
      </TableCell>
      <TableCell className="hidden font-mono text-xs text-zinc-400 sm:table-cell">
        {row.department || "—"}
      </TableCell>
      <TableCell className="text-right font-mono text-xs font-semibold tabular-nums text-lime-400">
        {row.total_score}
      </TableCell>
      <TableCell className="hidden text-right font-mono text-xs tabular-nums text-zinc-500 sm:table-cell">
        {row.penalty_minutes}m
      </TableCell>
      <TableCell className="text-right">
        <span className={cn(
          "rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider font-semibold",
          isPodium
            ? "border border-amber-400/30 bg-amber-400/10 text-amber-300"
            : row.status === "in_progress"
            ? "border border-blue-500/30 bg-blue-500/10 text-blue-400"
            : "border border-white/8 bg-black text-zinc-400"
        )}>
          {isPodium ? "Podium" : row.status === "in_progress" ? "In Progress" : "Ranked"}
        </span>
      </TableCell>
    </TableRow>
  );
}
