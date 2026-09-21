import { Link, useParams, useSearchParams } from "react-router-dom";
import { contestApi } from "@/features/contest/api";
import { useSwrData } from "@/lib/cache/swrCache";
import { ArrowLeft, Crown, Lock, QrCode, Search, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { RankingRow, AssessmentRanking } from "@/features/contest/types";
import { ContestResultsSkeleton } from "@/organization/components/skeletons";
import { PageHeader, SectionHeader } from "@/organization/components/ui";

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
    const q = (query || "").toLowerCase();
    const matchesQuery =
      !q ||
      (row.handle || "").toLowerCase().includes(q) ||
      (row.full_name || "").toLowerCase().includes(q);
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
        <div
          className={cn(
            "relative overflow-hidden rounded-lg border bg-black transition-colors p-6",
            isQualified ? "border-lime-400/40" : "border-white/8"
          )}
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <div
                className={cn(
                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-md border text-center font-mono",
                  isQualified
                    ? "border-lime-400/40 bg-lime-400/10 text-lime-400"
                    : "border-white/10 bg-zinc-950 text-white"
                )}
              >
                <div>
                  <div className="text-xl font-semibold tabular-nums leading-none">
                    #{myRow.rank}
                  </div>
                  <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">Rank</div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider",
                      isQualified
                        ? "border border-emerald-500/30 bg-emerald-950/40 text-emerald-400"
                        : "border border-amber-500/30 bg-black text-amber-400"
                    )}
                  >
                    {isQualified ? "Qualified for Final" : "Below Cutoff"}
                  </span>
                </div>
                <p className="text-lg font-semibold text-white font-mono tabular-nums">
                  {myRow.total_score} <span className="font-sans text-xs font-normal text-zinc-500">points</span>
                </p>
                <p className="text-xs text-zinc-400 font-mono">
                  {myRow.full_name} · {myRow.department} · {myRow.penalty_minutes}m penalty
                </p>
              </div>
            </div>

            {/* CTA */}
            {isQualified ? (
              <Button asChild className="rounded-md bg-transparent text-white border border-white/20 hover:bg-lime-400 hover:text-black hover:border-lime-400 font-mono text-xs font-semibold shrink-0 transition-colors [&_svg]:transition-colors">
                <Link to={`/contests/${contestSlug}/qualified`}>
                  <QrCode className="mr-1.5 size-3.5" /> View Campus Pass
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" className="rounded-md bg-transparent text-white border border-white/20 hover:bg-lime-400 hover:text-black hover:border-lime-400 font-mono text-xs font-semibold shrink-0 transition-colors [&_svg]:transition-colors">
                <Link to="/leaderboard">University Leaderboard →</Link>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <PageHeader
          kicker="01 // Standings"
          index={`CUTOFF #${ranking.cutoff}`}
          badge={
            <span className="inline-flex items-center gap-1.5 rounded border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-lime-400">
              Round 1 · Online Screening
            </span>
          }
          title={contest ? `${contest.title} Standings` : "Assessment Rankings"}
          description={`Ranked by total score, then penalty time. Cut-off set at rank #${ranking.cutoff}.`}
        />
      )}

      {/* Sealed Notice */}
      {!ranking.released && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-black p-4 font-mono">
          <Lock className="mt-0.5 size-4 shrink-0 text-amber-400" />
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-white uppercase tracking-wider">
              Ranking Sealed
            </p>
            <p className="text-xs text-zinc-400">
              {ranking.message ?? "Standings are hidden while the testing window is active."}
            </p>
            {ranking.releases_at && (
              <p className="text-xs text-lime-400 pt-1">
                Publishes: {new Date(ranking.releases_at).toLocaleString("en-IN")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Filters + Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          {FILTERS.map((key) => (
            <button
              key={key}
              onClick={() => setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set("filter", key); return p; })}
              className={cn(
                "rounded-md px-3 py-1 font-mono text-xs uppercase tracking-wider transition-colors",
                filter === key
                  ? "bg-lime-400 text-black font-semibold"
                  : "border border-white/8 bg-black text-zinc-400 hover:text-white"
              )}
            >
              {key}
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
          <Input
            value={query}
            onChange={(e) => setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set("query", e.target.value); return p; })}
            placeholder="Search cadet..."
            className="rounded-md border-white/10 bg-black pl-8 font-mono text-xs text-white placeholder:text-zinc-600 focus-visible:border-lime-400"
          />
        </div>

        <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500 font-mono">
          <span><span className="tabular-nums font-semibold text-white">{ranking.total_participants}</span> participants</span>
          <span>·</span>
          <span><span className="tabular-nums font-semibold text-white">{ranking.cutoff}</span> seats</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-white/8 bg-black">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-white/8 hover:bg-transparent">
              <TableHead className="w-16 font-mono text-[10px] uppercase text-zinc-500">Rank</TableHead>
              <TableHead className="font-mono text-[10px] uppercase text-zinc-500">Cadet</TableHead>
              <TableHead className="hidden font-mono text-[10px] uppercase text-zinc-500 sm:table-cell">Dept</TableHead>
              <TableHead className="text-right font-mono text-[10px] uppercase text-zinc-500">Score</TableHead>
              <TableHead className="hidden text-right font-mono text-[10px] uppercase text-zinc-500 sm:table-cell">Penalty</TableHead>
              <TableHead className="text-right font-mono text-[10px] uppercase text-zinc-500">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="border-b border-white/6">
                <TableCell colSpan={6} className="py-12 text-center font-mono text-xs text-zinc-600">
                  No submissions match this filter.
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

      {/* Bottom Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        {isQualified && (
          <Button asChild className="rounded-md bg-transparent text-white border border-white/20 hover:bg-lime-400 hover:text-black hover:border-lime-400 font-mono text-xs font-semibold transition-colors [&_svg]:transition-colors">
            <Link to={`/contests/${contestSlug}/qualified`}>
              <QrCode className="mr-1.5 size-3.5" /> View Campus Pass
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" className="rounded-md bg-transparent text-white border border-white/20 hover:bg-lime-400 hover:text-black hover:border-lime-400 font-mono text-xs font-semibold transition-colors [&_svg]:transition-colors">
          <Link to={`/contests/${contestSlug}`}>Contest Details</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-md bg-transparent text-white border border-white/20 hover:bg-lime-400 hover:text-black hover:border-lime-400 font-mono text-xs font-semibold transition-colors [&_svg]:transition-colors">
          <Link to="/leaderboard">University Leaderboard →</Link>
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
        <TableRow className="border-y border-lime-400/20 bg-lime-400/5 hover:bg-lime-400/5">
          <TableCell colSpan={6} className="py-2 text-center font-mono text-[10px] uppercase tracking-wider text-lime-400 font-semibold">
            ── Top {cutoff} Final Qualification Boundary ──
          </TableCell>
        </TableRow>
      )}
      <TableRow className={cn("border-b border-white/6 hover:bg-zinc-950 transition-colors", isMe && "bg-lime-400/10 hover:bg-lime-400/15")}>
        <TableCell className="font-mono text-xs font-semibold text-white">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            {row.rank <= 3 && <Crown className="size-3 text-lime-400" />}
            {row.rank}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex flex-col">
            <Link to={`/profile/${row.handle}`} className="text-xs font-semibold text-white hover:text-lime-400 transition-colors">
              {row.full_name}
            </Link>
            <span className="font-mono text-[10px] text-zinc-500">
              @{row.handle}
            </span>
          </div>
        </TableCell>
        <TableCell className="hidden font-mono text-xs text-zinc-400 sm:table-cell">
          {row.department}
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
            qualified
              ? "border border-lime-400/30 bg-lime-400/10 text-lime-400"
              : "border border-white/8 bg-black text-zinc-500"
          )}>
            {qualified ? "Qualified" : row.status === "in_progress" ? "In Progress" : "Ranked"}
          </span>
        </TableCell>
      </TableRow>
    </>
  );
}
