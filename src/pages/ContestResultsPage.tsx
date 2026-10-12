import { useState, useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { contestApi } from "@/features/contest/api";
import { useSwrData } from "@/lib/cache/swrCache";
import { useRealtimeEvents } from "@/lib/realtime";
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

  const { data: rankingData, loading: rankLoading, revalidate: revalidateRanking } = useSwrData<AssessmentRanking>(
    `contest:ranking:${contestSlug}`,
    () => contestApi.ranking(contestSlug),
    { ttl: 30 * 1000 }
  );

  const { data: contest, loading: contestLoading, revalidate: revalidateContest } = useSwrData(
    `contest:detail:${contestSlug}`,
    () => contestApi.detail(contestSlug),
    { ttl: 2 * 60 * 1000 }
  );

  const { data: registration, revalidate: revalidateRegistration } = useSwrData(
    `contest:registration:${contestSlug}`,
    () => contestApi.registrationStatus(contestSlug),
    { ttl: 2 * 60 * 1000 }
  );

  useRealtimeEvents(
    contestSlug,
    (event) => {
      if (
        event.event === "contest_concluded" ||
        event.event === "contest_status_changed" ||
        event.event === "contest_finished" ||
        event.event === "top30_qualified" ||
        event.event === "submission_evaluated" ||
        event.event === "assessment_finished"
      ) {
        revalidateRanking();
        revalidateContest();
        revalidateRegistration();
      }
    },
    undefined,
    Boolean(contestSlug)
  );

  useEffect(() => {
    const handleConcluded = () => {
      revalidateRanking();
      revalidateContest();
      revalidateRegistration();
    };
    window.addEventListener("contest:concluded", handleConcluded);
    window.addEventListener("contest:cache_invalidated", handleConcluded);
    return () => {
      window.removeEventListener("contest:concluded", handleConcluded);
      window.removeEventListener("contest:cache_invalidated", handleConcluded);
    };
  }, [revalidateRanking, revalidateContest, revalidateRegistration]);

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
        <div className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] p-6 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[16px] border border-[#B1FA63]/40 bg-[#171717] text-center text-[#B1FA63]">
                <div>
                  <div className="text-2xl font-normal font-display tabular-nums leading-none">
                    #{myRow.rank}
                  </div>
                  <div className="mt-1 font-heading font-bold text-[9px] uppercase tracking-wider text-zinc-400">Rank</div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#B1FA63]/30 bg-[#B1FA63]/10 px-2.5 py-0.5 font-heading font-bold text-[10px] uppercase tracking-wider text-[#B1FA63]">
                    <Trophy className="size-3 text-[#B1FA63]" />
                    Verified Finish
                  </span>
                  {myRow.rank <= 3 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 font-heading font-bold text-[10px] uppercase tracking-wider text-amber-300">
                      <Crown className="size-3 text-amber-400" />
                      Podium
                    </span>
                  )}
                </div>
                <p className="text-2xl font-normal text-white font-display uppercase tracking-wide">
                  {myRow.total_score} <span className="font-heading text-xs font-bold text-zinc-400">points</span>
                </p>
                <p className="text-xs text-zinc-400 font-sans">
                  {myRow.full_name} · {myRow.department || "Engineering"} · {myRow.penalty_minutes}m penalty
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="flex items-center gap-2 shrink-0">
              <Button asChild variant="outline" size="sm" className="rounded-[10px]">
                <Link to="/leaderboard">University Leaderboard →</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <PageHeader
          kicker="01 // Contest Standings"
          index="STANDINGS"
          badge={
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B1FA63]/30 bg-[#B1FA63]/10 px-3 py-1 font-heading font-bold text-[10px] uppercase tracking-wider text-[#B1FA63]">
              <Trophy className="size-3 text-[#B1FA63]" />
              Official Standings
            </span>
          }
          title={contest ? `${contest.title} Standings` : "Contest Standings"}
          description="Official contest standings. Ranked by total points, then penalty time."
        />
      )}


      {contest?.status === "upcoming" ? (
        <div className="rounded-[24px] border border-amber-500/20 bg-[#1F1F1F] p-8 sm:p-10 text-center space-y-4 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
          <div className="mx-auto flex size-14 items-center justify-center">
            <img
              src="/matiks-assets/icons/smart75-local-seatLock.png"
              alt="Standings sealed"
              className="size-10 object-contain drop-shadow"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-widest text-amber-400 font-heading font-bold block">
              Standings Sealed
            </span>
            <h2 className="text-2xl font-normal text-white font-display uppercase tracking-wider">
              Standings Unlock When Contest Goes Live
            </h2>
            <p className="text-xs text-zinc-400 max-w-md mx-auto font-sans leading-relaxed">
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
          <Button asChild variant="outline" size="sm" className="rounded-[10px]">
            <Link to={`/contests/${contestSlug}`}>Back to Contest Overview</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Filters + Search */}
          <div className="flex flex-wrap items-center gap-3">
            {departments.length > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant={deptFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDeptFilter("all")}
                  className="rounded-[10px]"
                >
                  All
                </Button>
                {departments.map((dept) => (
                  <Button
                    key={dept}
                    variant={deptFilter === dept ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDeptFilter(dept)}
                    className="rounded-[10px]"
                  >
                    {dept}
                  </Button>
                ))}
              </div>
            )}

            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
              <Input
                value={query}
                onChange={(e) => setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set("query", e.target.value); return p; })}
                placeholder="Search cadet or handle..."
                className="rounded-[10px] border-white/[0.08] bg-[#171717] pl-9 font-sans text-xs text-white placeholder:text-zinc-500 focus-visible:border-[#B1FA63]"
              />
            </div>

            <div className="ml-auto flex items-center gap-2 text-xs text-zinc-400 font-heading font-semibold">
              <Award className="size-3.5 text-zinc-400" />
              <span><span className="tabular-nums font-bold text-white font-mono">{ranking.total_participants}</span> competitors</span>
            </div>
          </div>

          {/* Standings Table */}
          <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/[0.08] hover:bg-transparent">
                  <TableHead className="w-16 font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-400">Rank</TableHead>
                  <TableHead className="font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-400">Cadet</TableHead>
                  <TableHead className="hidden font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-400 sm:table-cell">Dept</TableHead>
                  <TableHead className="text-right font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-400">Score</TableHead>
                  <TableHead className="hidden text-right font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-400 sm:table-cell">Penalty</TableHead>
                  <TableHead className="text-right font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-400">Standing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow className="border-b border-white/[0.06]">
                    <TableCell colSpan={6} className="py-12 text-center font-sans text-xs text-zinc-500">
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
        <Button asChild variant="outline" size="sm">
          <Link to={`/contests/${contestSlug}`}>Contest Details</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
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
            <img
              src={
                row.rank === 1
                  ? "/matiks-assets/ranks/gold_icon.webp"
                  : row.rank === 2
                  ? "/matiks-assets/ranks/silver_icon.webp"
                  : "/matiks-assets/ranks/bronze_icon.webp"
              }
              alt={`Rank #${row.rank}`}
              className="size-3.5 object-contain shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
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
