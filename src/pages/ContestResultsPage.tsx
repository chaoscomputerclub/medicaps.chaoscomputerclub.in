import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { contestApi } from "@/features/contest/api";
import { useSwrData } from "@/lib/cache/swrCache";

import { ArrowLeft, Crown, Lock, Search, Timer, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  const myRow = myHandle ? ranking.rows.find((row) => row.handle === myHandle) : undefined;

  if ((rankLoading || contestLoading) && !rankingData && !contest) {
    return <ContestResultsSkeleton />;
  }

  return (
    <div className="page-wrap max-w-6xl space-y-6">
      <Link to={`/portal/contests/${contestSlug}`}>
        <ArrowLeft />
        Back to contest
      </Link>

      <header className="space-y-2">
        <p className="kicker">Round 1 · Online assessment</p>
        <h1 className="text-3xl font-bold normal-case text-foreground">
          {contest?.title ?? "Assessment ranking"}
        </h1>
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          Ranked by total score, then by penalty time. The line after rank {ranking.cutoff} is the
          qualification cut for the offline campus final.
        </p>
      </header>

      {!ranking.released && (
        <Card className="rounded-lg border-border bg-card/80 backdrop-blur-xl">
          <CardHeader>
             <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Lock className="size-4 text-[var(--accent)]" />
              Ranking sealed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[var(--muted)]">
            <p>
              {ranking.message ??
                "Round 1 ranking stays sealed while the 24-hour entry window is open, so no candidate can pace themselves against live rivals."}
            </p>
            <p className="font-mono text-xs uppercase">
              {ranking.releases_at
                ? `Publishes ${new Date(ranking.releases_at).toLocaleString()}`
                : "Publishes when the entry window closes"}
            </p>
             <Button asChild variant="outline" className="rounded-md text-xs">
              <Link to={`/portal/contests/${contestSlug}`}>
                Back to contest
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}


      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={<Users className="size-4" />} label="Participants" value={String(ranking.total_participants)} />
        <StatCard icon={<Trophy className="size-4" />} label="Finalist seats" value={String(ranking.cutoff || FINALIST_SEATS)} />
        <StatCard
          icon={<Timer className="size-4" />}
          label="Your result"
          value={
            myRow
              ? `#${myRow.rank} · ${myRow.total_score} pts`
              : registration?.assessment_taken
                ? "Being verified"
                : "Not attempted"
          }
        />
      </div>

      {myRow && (
         <Card className="rounded-lg border-primary/50 bg-card/80 backdrop-blur-xl">
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div>
               <CardTitle className="text-sm font-bold text-foreground">
                Your standing
              </CardTitle>
              <p className="font-mono text-xs text-[var(--muted)]">
                {myRow.full_name} · {myRow.department} · {myRow.batch}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "rounded-none font-mono text-[10px] uppercase tracking-widest",
                myRow.rank <= ranking.cutoff
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-amber-500/40 text-amber-300",
              )}
            >
              {myRow.rank <= ranking.cutoff ? "Qualified for the final" : "Below the cut"}
            </Badge>
          </CardHeader>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={filter}
          onValueChange={(value) =>
            setSearchParams((prev) => {
              const p = new URLSearchParams(prev);
              p.set("filter", value);
              return p;
            })
          }
        >
           <TabsList className="h-auto rounded-lg border border-border bg-card/80 p-1 backdrop-blur-xl">
            {FILTERS.map((key) => (
              <TabsTrigger
                key={key}
                value={key}
                 className="rounded-md text-xs font-bold capitalize data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {key}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            value={query}
            onChange={(event) =>
              setSearchParams((prev) => {
                const p = new URLSearchParams(prev);
                p.set("query", event.target.value);
                return p;
              })
            }
            placeholder="Search handle or name"
             className="rounded-lg border-border bg-card/80 pl-9 text-xs backdrop-blur-xl"
          />
        </div>
      </div>

       <div className="overflow-hidden rounded-lg border border-border bg-card/80 backdrop-blur-xl">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--line)]">
              <TableHead className="w-16 font-mono text-[10px] uppercase tracking-widest">Rank</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest">Cadet</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest">Department</TableHead>
              <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest">Score</TableHead>
              <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest">Penalty</TableHead>
              <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="border-[var(--line)]">
                <TableCell colSpan={6} className="py-12 text-center text-xs text-[var(--muted)]">
                  No ranked submissions match this view yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <RankRow
                  key={`${row.handle}-${row.rank}`}
                  row={row}
                  cutoff={ranking.cutoff}
                  isMe={row.handle === myHandle}
                  showCutLine={
                    filter === "all" && row.rank === ranking.cutoff + 1 && index > 0
                  }
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline" className="rounded-none font-mono text-xs uppercase">
          <Link to={`/portal/contests/${contestSlug}/qualified`}>
            Qualification & campus pass
          </Link>
        </Button>
        <Button asChild variant="ghost" className="rounded-none font-mono text-xs uppercase">
          <Link to="/portal/leaderboard">Chapter leaderboard</Link>
        </Button>
      </div>
    </div>
  );
}

function RankRow({
  row,
  cutoff,
  isMe,
  showCutLine,
}: {
  row: RankingRow;
  cutoff: number;
  isMe: boolean;
  showCutLine: boolean;
}) {
  return (
    <>
      {showCutLine && (
        <TableRow className="border-[var(--accent)]/50 bg-[var(--surface-2)]">
          <TableCell colSpan={6} className="py-2 text-center font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">
            Top {cutoff} qualification cut-off
          </TableCell>
        </TableRow>
      )}
      <TableRow
        className={cn(
          "border-[var(--line)]",
          isMe && "bg-[var(--accent)]/10",
        )}
      >
        <TableCell className="font-mono text-xs font-bold text-white">
          <span className="inline-flex items-center gap-1">
            {row.rank <= 3 && <Crown className="size-3 text-[var(--accent)]" />}
            {row.rank}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">{row.full_name}</span>
            <span className="font-mono text-[10px] text-[var(--muted)]">@{row.handle}</span>
          </div>
        </TableCell>
        <TableCell className="font-mono text-xs text-[var(--muted)]">
          {row.department} · {row.batch}
        </TableCell>
        <TableCell className="text-right font-mono text-xs font-bold text-[var(--accent)]">
          {row.total_score}
        </TableCell>
        <TableCell className="text-right font-mono text-xs text-[var(--muted)]">
          {row.penalty_minutes}m
        </TableCell>
        <TableCell className="text-right">
          <Badge
            variant="outline"
            className={cn(
              "rounded-none font-mono text-[10px] uppercase",
              row.rank <= cutoff ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--muted)]",
            )}
          >
            {row.rank <= cutoff ? "Qualified" : row.status === "in_progress" ? "In progress" : "Ranked"}
          </Badge>
        </TableCell>
      </TableRow>
    </>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="rounded-none border-[var(--line)] bg-[var(--surface-1)]">
      <CardContent className="flex items-center gap-3 py-5">
        <span className="text-[var(--accent)]">{icon}</span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">{label}</p>
          <strong className="font-mono text-lg text-white">{value}</strong>
        </div>
      </CardContent>
    </Card>
  );
}
