import { Link, useParams, useSearchParams } from "react-router-dom";
import { contestApi } from "@/features/contest/api";
import { useSwrData } from "@/lib/cache/swrCache";
import { ArrowLeft, Crown, Lock, QrCode, Search, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FINALIST_SEATS } from "@/features/contest/lifecycle";
import { cn } from "@/lib/utils";
import type { RankingRow, AssessmentRanking } from "@/features/contest/types";
import { ContestResultsSkeleton } from "@/organization/components/skeletons";

const FILTERS = ["all", "qualified", "eliminated"] as const;
type FilterKey = (typeof FILTERS)[number];

export function ContestResultsPage() {
  const { contestSlug = "" } = useParams<{ contestSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("query") || "";
  const filter = (searchParams.get("filter") as FilterKey) || "all";

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
    cutoff: 30,
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
  const isQualified = myRow ? myRow.rank <= ranking.cutoff : false;

  const rows = ranking.rows.filter((row) => {
    const matchesQuery =
      !query ||
      row.handle.toLowerCase().includes(query.toLowerCase()) ||
      row.full_name.toLowerCase().includes(query.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "qualified" && row.rank <= ranking.cutoff) ||
      (filter === "eliminated" && row.rank > ranking.cutoff);
    return matchesQuery && matchesFilter;
  });

  if ((rankLoading || contestLoading) && !rankingData && !contest) {
    return <ContestResultsSkeleton />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      {/* Back */}
      <Link
        to={`/portal/contests/${contestSlug}`}
        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-zinc-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="size-4" /> {contest?.title ?? "Back to contest"}
      </Link>

      {/* ─── YOUR STANDING HERO ───────────────────────────── */}
      {myRow ? (
        <div
          className={cn(
            "relative overflow-hidden rounded-none border bg-zinc-900/60 backdrop-blur-md transition-all shadow-xl",
            isQualified ? "border-lime-400/40 shadow-lime-400/5" : "border-white/10"
          )}
        >
          {isQualified && (
            <div className="h-1 w-full bg-gradient-to-r from-lime-400 to-amber-500" />
          )}
          <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              {/* Rank number */}
              <div
                className={cn(
                  "flex h-16 w-16 shrink-0 items-center justify-center rounded-none border text-center font-mono",
                  isQualified
                    ? "border-lime-400/40 bg-lime-400/10 shadow-inner"
                    : "border-white/10 bg-zinc-800/50"
                )}
              >
                <div>
                  <div className={cn("text-2xl font-black leading-none font-mono tabular-nums", isQualified ? "text-lime-400" : "text-white")}>
                    #{myRow.rank}
                  </div>
                  <div className="mt-1 font-mono text-[9px] uppercase tracking-widest text-zinc-400">rank</div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-none border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest",
                      isQualified
                        ? "border-lime-400/40 bg-lime-400/10 text-lime-400"
                        : "border-amber-500/40 bg-amber-950/30 text-amber-400"
                    )}
                  >
                    {isQualified ? "✓ Qualified for Final" : "Below the cut"}
                  </span>
                </div>
                <p className="text-xl font-bold text-white font-mono tabular-nums">
                  {myRow.total_score} <span className="font-sans text-sm font-normal text-zinc-400">points</span>
                </p>
                <p className="text-xs text-zinc-400">
                  {myRow.full_name} · {myRow.department} · Penalty <span className="font-mono tabular-nums">{myRow.penalty_minutes}m</span>
                </p>
              </div>
            </div>

            {/* CTA based on result */}
            {isQualified ? (
              <Button asChild className="rounded-none bg-lime-400 font-mono text-xs font-bold uppercase tracking-wider text-black hover:bg-lime-400 shrink-0 shadow-lg shadow-lime-400/20 active:scale-[0.98]">
                <Link to={`/portal/contests/${contestSlug}/qualified`}>
                  <QrCode className="mr-2 size-4" /> View Campus Pass
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" className="rounded-none border-white/10 bg-zinc-900/60 font-mono text-xs text-zinc-300 hover:border-white/20 hover:text-white shrink-0 active:scale-[0.98]">
                <Link to="/portal/leaderboard">University Leaderboard →</Link>
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* Header for non-participants */
        <header className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">
            Round 1 · Online Assessment
          </p>
          <h1 className="text-3xl font-black tracking-tight text-white">
            {contest?.title ?? "Assessment Ranking"}
          </h1>
          <p className="text-sm text-zinc-400">
            Ranked by score, then by penalty time. Cut-off at rank {ranking.cutoff}.
          </p>
        </header>
      )}

      {/* ─── RANKING SEALED NOTICE ───────────────────────── */}
      {!ranking.released && (
        <div className="flex items-start gap-4 rounded-none border border-amber-500/30 bg-amber-950/20 p-5 backdrop-blur-md">
          <Lock className="mt-0.5 size-5 shrink-0 text-amber-400" />
          <div className="space-y-1">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              Ranking Sealed
            </p>
            <p className="text-sm text-zinc-400">
              {ranking.message ?? "Results stay hidden while the assessment window is open — no candidate can pace against live rivals."}
            </p>
            {ranking.releases_at && (
              <p className="font-mono text-xs text-lime-400">
                Publishes {new Date(ranking.releases_at).toLocaleString("en-IN")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── FILTERS + SEARCH ────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Pill filters */}
        <div className="flex items-center gap-1.5">
          {FILTERS.map((key) => (
            <button
              key={key}
              onClick={() => setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set("filter", key); return p; })}
              className={cn(
                "rounded-none px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-all",
                filter === key
                  ? "bg-lime-400 text-black font-bold shadow-md shadow-lime-400/20"
                  : "border border-white/10 bg-zinc-900/60 text-zinc-400 hover:border-white/20 hover:text-white"
              )}
            >
              {key}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={query}
            onChange={(e) => setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set("query", e.target.value); return p; })}
            placeholder="Search name or handle..."
            className="rounded-none border-white/10 bg-zinc-900/60 pl-9 font-mono text-xs text-white placeholder:text-zinc-500 focus-visible:border-lime-400/60"
          />
        </div>

        {/* Stats inline */}
        <div className="ml-auto flex items-center gap-4 text-xs text-zinc-400 font-mono">
          <span className="flex items-center gap-1.5">
            <Trophy className="size-3.5 text-lime-400" />
            <span className="tabular-nums font-bold text-white">{ranking.total_participants}</span> participants
          </span>
          <span className="text-zinc-700">·</span>
          <span><span className="tabular-nums font-bold text-white">{ranking.cutoff}</span> finalist seats</span>
        </div>
      </div>

      {/* ─── RANKINGS TABLE ──────────────────────────────── */}
      <div className="overflow-hidden rounded-none border border-white/10 bg-zinc-900/50 backdrop-blur-md shadow-xl">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-white/10 bg-zinc-950/40 hover:bg-transparent">
              <TableHead className="w-16 font-mono text-[10px] uppercase tracking-widest text-zinc-400">Rank</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">Cadet</TableHead>
              <TableHead className="hidden font-mono text-[10px] uppercase tracking-widest text-zinc-400 sm:table-cell">Dept</TableHead>
              <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest text-zinc-400">Score</TableHead>
              <TableHead className="hidden text-right font-mono text-[10px] uppercase tracking-widest text-zinc-400 sm:table-cell">Penalty</TableHead>
              <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest text-zinc-400">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="border-b border-white/5">
                <TableCell colSpan={6} className="py-12 text-center font-mono text-xs text-zinc-500">
                  No submissions match this view.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <RankRow
                  key={`${row.handle}-${row.rank}`}
                  row={row}
                  cutoff={ranking.cutoff}
                  isMe={row.handle === myHandle}
                  showCutLine={filter === "all" && row.rank === ranking.cutoff + 1 && index > 0}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ─── BOTTOM ACTIONS ──────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {isQualified && (
          <Button asChild className="rounded-none bg-lime-400 font-mono text-xs font-bold uppercase tracking-wider text-black hover:bg-lime-400 shadow-md shadow-lime-400/20 active:scale-[0.98]">
            <Link to={`/portal/contests/${contestSlug}/qualified`}>
              <QrCode className="mr-2 size-4" /> View Campus Pass
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" className="rounded-none border-white/10 bg-zinc-900/60 font-mono text-xs text-zinc-300 hover:border-white/20 hover:text-white active:scale-[0.98]">
          <Link to={`/portal/contests/${contestSlug}`}>Back to Contest</Link>
        </Button>
        <Button asChild variant="ghost" className="rounded-none font-mono text-xs text-zinc-400 hover:text-white active:scale-[0.98]">
          <Link to="/portal/leaderboard">University Leaderboard →</Link>
        </Button>
      </div>
    </div>
  );
}

function RankRow({
  row, cutoff, isMe, showCutLine,
}: {
  row: RankingRow; cutoff: number; isMe: boolean; showCutLine: boolean;
}) {
  const qualified = row.rank <= cutoff;
  return (
    <>
      {showCutLine && (
        <TableRow className="border-y border-lime-400/30 bg-lime-400/10">
          <TableCell colSpan={6} className="py-2.5 text-center font-mono text-[10px] uppercase tracking-widest text-lime-400 font-bold">
            ── Top {cutoff} qualification line ──
          </TableCell>
        </TableRow>
      )}
      <TableRow className={cn("border-b border-white/5 transition-colors hover:bg-white/[0.02]", isMe && "bg-lime-400/10 hover:bg-lime-400/15")}>
        <TableCell className="font-mono text-sm font-black text-white">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            {row.rank <= 3 && <Crown className="size-3.5 text-amber-400" />}
            {row.rank}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-0.5">
            <Link to={`/portal/profile/${row.handle}`} className="text-sm font-semibold text-white transition-colors hover:text-lime-400">
              {row.full_name}
            </Link>
            <Link to={`/portal/profile/${row.handle}`} className="font-mono text-[10px] text-zinc-400 transition-colors hover:text-zinc-200">
              @{row.handle}
            </Link>
          </div>
        </TableCell>
        <TableCell className="hidden font-mono text-xs text-zinc-400 sm:table-cell">
          {row.department}
        </TableCell>
        <TableCell className="text-right font-mono text-sm font-black tabular-nums text-lime-400">
          {row.total_score}
        </TableCell>
        <TableCell className="hidden text-right font-mono text-xs tabular-nums text-zinc-400 sm:table-cell">
          {row.penalty_minutes}m
        </TableCell>
        <TableCell className="text-right">
          <span className={cn(
            "rounded-none border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest font-semibold",
            qualified
              ? "border-lime-400/40 bg-lime-400/10 text-lime-400"
              : "border-white/10 bg-zinc-800/40 text-zinc-400"
          )}>
            {qualified ? "Qualified" : row.status === "in_progress" ? "In progress" : "Ranked"}
          </span>
        </TableCell>
      </TableRow>
    </>
  );
}
