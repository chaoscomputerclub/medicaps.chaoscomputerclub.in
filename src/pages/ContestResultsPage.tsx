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
    <div className="page-wrap max-w-5xl space-y-8">
      {/* Back */}
      <Link to={`/portal/contests/${contestSlug}`} className="back-link">
        <ArrowLeft /> {contest?.title ?? "Back to contest"}
      </Link>

      {/* ─── YOUR STANDING HERO ───────────────────────────── */}
      {myRow ? (
        <div className={cn(
          "relative overflow-hidden border bg-[var(--surface)]",
          isQualified ? "border-[var(--accent)]/40" : "border-[var(--line)]"
        )}>
          {isQualified && (
            <div className="h-0.5 w-full bg-[var(--accent)]" />
          )}
          <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              {/* Rank number */}
              <div className={cn(
                "flex h-16 w-16 shrink-0 items-center justify-center border text-center font-mono",
                isQualified ? "border-[var(--accent)]/40 bg-[var(--accent)]/10" : "border-[var(--line)] bg-[var(--surface-2)]"
              )}>
                <div>
                  <div className={cn("text-2xl font-black leading-none", isQualified ? "text-[var(--accent)]" : "text-foreground")}>
                    #{myRow.rank}
                  </div>
                  <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-[var(--muted)]">rank</div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "border px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest",
                    isQualified ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]" : "border-amber-500/40 bg-amber-950/20 text-amber-400"
                  )}>
                    {isQualified ? "✓ Qualified for Final" : "Below the cut"}
                  </span>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {myRow.total_score} <span className="text-sm font-normal text-[var(--muted)]">points</span>
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {myRow.full_name} · {myRow.department} · Penalty {myRow.penalty_minutes}m
                </p>
              </div>
            </div>

            {/* CTA based on result */}
            {isQualified ? (
              <Button asChild className="rounded-none bg-[var(--accent)] font-mono text-xs font-black uppercase text-black hover:bg-[var(--accent)]/90 shrink-0">
                <Link to={`/portal/contests/${contestSlug}/qualified`}>
                  <QrCode className="mr-1.5 size-4" /> View Campus Pass
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" className="rounded-none border-[var(--line)] font-mono text-xs shrink-0">
                <Link to="/portal/leaderboard">University Leaderboard →</Link>
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* Header for non-participants */
        <header className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--muted)]">
            Round 1 · Online Assessment
          </p>
          <h1 className="text-2xl font-black text-foreground">
            {contest?.title ?? "Assessment Ranking"}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Ranked by score, then by penalty time. Cut-off at rank {ranking.cutoff}.
          </p>
        </header>
      )}

      {/* ─── RANKING SEALED NOTICE ───────────────────────── */}
      {!ranking.released && (
        <div className="flex items-start gap-4 border border-[var(--line)] bg-[var(--surface)] p-5">
          <Lock className="mt-0.5 size-5 shrink-0 text-[var(--accent)]" />
          <div className="space-y-1">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
              Ranking Sealed
            </p>
            <p className="text-sm text-[var(--muted)]">
              {ranking.message ?? "Results stay hidden while the assessment window is open — no candidate can pace against live rivals."}
            </p>
            {ranking.releases_at && (
              <p className="font-mono text-xs text-[var(--accent)]">
                Publishes {new Date(ranking.releases_at).toLocaleString("en-IN")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── FILTERS + SEARCH ────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Pill filters */}
        <div className="flex items-center gap-1">
          {FILTERS.map((key) => (
            <button
              key={key}
              onClick={() => setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set("filter", key); return p; })}
              className={cn(
                "rounded-none px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors",
                filter === key
                  ? "bg-[var(--accent)] text-black font-bold"
                  : "border border-[var(--line)] text-[var(--muted)] hover:text-foreground"
              )}
            >
              {key}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            value={query}
            onChange={(e) => setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set("query", e.target.value); return p; })}
            placeholder="Search name or handle..."
            className="rounded-none border-[var(--line)] bg-[var(--surface)] pl-9 font-mono text-xs placeholder:text-[var(--muted)]"
          />
        </div>

        {/* Stats inline */}
        <div className="ml-auto flex items-center gap-4 text-xs text-[var(--muted)]">
          <span className="flex items-center gap-1.5">
            <Trophy className="size-3.5 text-[var(--accent)]" />
            {ranking.total_participants} participants
          </span>
          <span className="text-[var(--line)]">·</span>
          <span>{ranking.cutoff} finalist seats</span>
        </div>
      </div>

      {/* ─── RANKINGS TABLE ──────────────────────────────── */}
      <div className="overflow-hidden border border-[var(--line)] bg-[var(--surface)]">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--line)] hover:bg-transparent">
              <TableHead className="w-14 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Rank</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Cadet</TableHead>
              <TableHead className="hidden font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] sm:table-cell">Dept</TableHead>
              <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Score</TableHead>
              <TableHead className="hidden text-right font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] sm:table-cell">Penalty</TableHead>
              <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="border-[var(--line)]">
                <TableCell colSpan={6} className="py-12 text-center font-mono text-xs text-[var(--muted)]">
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
          <Button asChild className="rounded-none bg-[var(--accent)] font-mono text-xs font-black uppercase text-black hover:bg-[var(--accent)]/90">
            <Link to={`/portal/contests/${contestSlug}/qualified`}>
              <QrCode className="mr-1.5 size-4" /> View Campus Pass
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" className="rounded-none font-mono text-xs">
          <Link to={`/portal/contests/${contestSlug}`}>Back to Contest</Link>
        </Button>
        <Button asChild variant="ghost" className="rounded-none font-mono text-xs">
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
        <TableRow className="border-[var(--accent)]/30 bg-[var(--surface-2)]">
          <TableCell colSpan={6} className="py-2 text-center font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">
            ── Top {cutoff} qualification line ──
          </TableCell>
        </TableRow>
      )}
      <TableRow className={cn("border-[var(--line)] transition-colors", isMe && "bg-[var(--accent)]/8")}>
        <TableCell className="font-mono text-sm font-black text-foreground">
          <span className="inline-flex items-center gap-1.5">
            {row.rank <= 3 && <Crown className="size-3.5 text-[var(--accent)]" />}
            {row.rank}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-0.5">
            <Link to={`/portal/profile/${row.handle}`} className="text-sm font-semibold text-foreground transition-colors hover:text-[var(--accent)]">
              {row.full_name}
            </Link>
            <Link to={`/portal/profile/${row.handle}`} className="font-mono text-[10px] text-[var(--muted)] transition-colors hover:text-foreground">
              @{row.handle}
            </Link>
          </div>
        </TableCell>
        <TableCell className="hidden font-mono text-xs text-[var(--muted)] sm:table-cell">
          {row.department}
        </TableCell>
        <TableCell className="text-right font-mono text-sm font-black text-[var(--accent)]">
          {row.total_score}
        </TableCell>
        <TableCell className="hidden text-right font-mono text-xs text-[var(--muted)] sm:table-cell">
          {row.penalty_minutes}m
        </TableCell>
        <TableCell className="text-right">
          <span className={cn(
            "border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest",
            qualified
              ? "border-[var(--accent)]/40 text-[var(--accent)]"
              : "border-[var(--line)] text-[var(--muted)]"
          )}>
            {qualified ? "Qualified" : row.status === "in_progress" ? "In progress" : "Ranked"}
          </span>
        </TableCell>
      </TableRow>
    </>
  );
}
