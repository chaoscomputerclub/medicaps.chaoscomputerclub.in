import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueries, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowUpRight, CalendarRange, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { contestQueries } from "@/features/contest/queries";
import { ContestCard, Countdown, PhaseBadge } from "@/features/contest/components";
import {
  FINALIST_SEATS,
  assessmentOpensAt,
  cadenceLabel,
  contestPhase,
  formatWhen,
} from "@/features/contest/lifecycle";
import type { ContestSummary } from "@/features/contest/types";

const TABS = ["all", "weekly", "biweekly", "upcoming", "past"] as const;
type TabKey = (typeof TABS)[number];

export const Route = createFileRoute("/portal/contests/")({
  validateSearch: (search: Record<string, unknown>): { filter?: TabKey; state?: string } => ({
    filter: TABS.includes(String(search["filter"]) as TabKey) ? (String(search["filter"]) as TabKey) : "all",
    state: search["state"] ? String(search["state"]) : "default",
  }),
  head: () => ({
    meta: [
      { title: "Contests — Weekly, Biweekly & Campus Finals | CCC Medi-Caps" },
      {
        name: "description",
        content:
          "Enter the weekly and biweekly online assessment, finish inside the Top 30, and earn a QR pass to the offline campus final.",
      },
      { property: "og:title", content: "Contests — CCC Medi-Caps" },
      {
        property: "og:description",
        content: "Two rounds: a timed online assessment, then an on-campus final for the Top 30.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(contestQueries.list()),
  component: ContestHub,
});

function ContestHub() {
  const { data: contests } = useSuspenseQuery(contestQueries.list());
  const { filter = "all" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const registrations = useQueries({
    queries: contests.map((contest) => contestQueries.registration(contest.slug)),
  });
  const phaseFor = (contest: ContestSummary, index: number) =>
    contestPhase(contest, registrations[index]?.data ?? null);

  const upcoming = contests.filter((c) => c.status !== "finished");
  const past = contests.filter((c) => c.status === "finished");
  const featured =
    upcoming.slice().sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0] ?? null;

  const visible = contests.filter((contest) => {
    if (filter === "all") return true;
    if (filter === "weekly") return contest.cadence === "weekly";
    if (filter === "biweekly") return contest.cadence === "biweekly";
    if (filter === "upcoming") return contest.status !== "finished";
    return contest.status === "finished";
  });

  return (
    <div className="page-wrap space-y-8">
      <header className="page-header">
        <div>
          <p className="kicker">Online qualifier → campus final</p>
          <h1>Contests</h1>
          <p>
            Every edition runs in two rounds. Round 1 is a timed online assessment that opens 24 hours
            before contest day. The Top {FINALIST_SEATS} verified scores receive a QR pass for the
            offline final.
          </p>
        </div>
        <div className="hub-stat">
          <strong>{FINALIST_SEATS}</strong>
          <span>FINALIST SEATS</span>
        </div>
      </header>

      {featured && (
        <Card className="rounded-none border-[var(--accent)]/50 bg-[var(--surface-1)]">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <PhaseBadge phase={phaseFor(featured, contests.indexOf(featured))} />
              <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase tracking-widest">
                Next up
              </Badge>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
                {cadenceLabel(featured)}
                {featured.edition ? ` ${featured.edition}` : ""}
              </span>
            </div>
            <CardTitle className="text-2xl font-black uppercase tracking-tight text-white">
              {featured.title}
            </CardTitle>
            <p className="max-w-2xl text-sm leading-relaxed text-[var(--muted)]">{featured.summary}</p>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex flex-wrap gap-8">
              <Countdown target={assessmentOpensAt(featured)} label="Round 1 opens in" />
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
                  Offline final
                </span>
                <span className="font-mono text-sm text-white">{formatWhen(featured.starts_at)}</span>
                <span className="font-mono text-xs text-[var(--muted)]">{featured.venue}</span>
              </div>
            </div>
            <Button asChild className="rounded-none font-mono text-xs font-bold uppercase tracking-wider">
              <Link
                to="/portal/contests/$contestSlug"
                params={{ contestSlug: featured.slug }}
                search={{ state: "default" }}
              >
                Open contest
                <ArrowUpRight className="ml-2 size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs value={filter} onValueChange={(value) => void navigate({ search: { filter: value as TabKey } })}>
        <TabsList className="h-auto flex-wrap rounded-none border border-[var(--line)] bg-[var(--surface-2)] p-1">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="rounded-none font-mono text-xs font-bold uppercase data-[state=active]:bg-[var(--accent)] data-[state=active]:text-black"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filter === "past" ? (
        <PastTable contests={past} />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {visible.length === 0 ? (
            <Card className="rounded-none border-dashed border-[var(--line)] bg-transparent lg:col-span-2">
              <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                <CalendarRange className="size-6 text-[var(--muted)]" />
                <strong className="text-sm text-white">No contests in this view</strong>
                <p className="max-w-sm text-xs text-[var(--muted)]">
                  New weekly and biweekly editions are published here as soon as the chapter announces them.
                </p>
              </CardContent>
            </Card>
          ) : (
            visible.map((contest) => (
              <ContestCard
                key={contest.slug}
                contest={contest}
                phase={phaseFor(contest, contests.indexOf(contest))}
                featured={contest.slug === featured?.slug}
              />
            ))
          )}
        </section>
      )}

      <Separator className="bg-[var(--line)]" />

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { title: "Round 1 · Online", body: "2-hour timed coding assessment. The window is open for 24 hours before contest day." },
          { title: "Cut · Top 30", body: "Ranking by score, then by penalty time. Verified results only." },
          { title: "Round 2 · Offline", body: "Proctored campus final. Entry with the QR pass issued to finalists." },
        ].map((item) => (
          <Card key={item.title} className="rounded-none border-[var(--line)] bg-[var(--surface-1)]">
            <CardHeader className="gap-2">
              <Trophy className="size-4 text-[var(--accent)]" />
              <CardTitle className="text-sm font-bold uppercase tracking-wide text-white">
                {item.title}
              </CardTitle>
              <p className="text-xs leading-relaxed text-[var(--muted)]">{item.body}</p>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  );
}

function PastTable({ contests }: { contests: ContestSummary[] }) {
  if (contests.length === 0) {
    return (
      <Card className="rounded-none border-dashed border-[var(--line)] bg-transparent">
        <CardContent className="py-14 text-center text-xs text-[var(--muted)]">
          No completed editions yet.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="border border-[var(--line)] bg-[var(--surface-1)]">
      <Table>
        <TableHeader>
          <TableRow className="border-[var(--line)]">
            <TableHead className="font-mono text-[10px] uppercase tracking-widest">Contest</TableHead>
            <TableHead className="font-mono text-[10px] uppercase tracking-widest">Format</TableHead>
            <TableHead className="font-mono text-[10px] uppercase tracking-widest">Final held</TableHead>
            <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest">
              Participants
            </TableHead>
            <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest">Ranking</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contests.map((contest) => (
            <TableRow key={contest.slug} className="border-[var(--line)]">
              <TableCell className="font-semibold text-white">{contest.title}</TableCell>
              <TableCell className="font-mono text-xs text-[var(--muted)]">{cadenceLabel(contest)}</TableCell>
              <TableCell className="font-mono text-xs text-[var(--muted)]">{formatWhen(contest.starts_at)}</TableCell>
              <TableCell className="text-right font-mono text-xs text-white">{contest.registered_count}</TableCell>
              <TableCell className="text-right">
                <Button asChild variant="ghost" size="sm" className="rounded-none font-mono text-xs uppercase">
                  <Link
                    to="/portal/contests/$contestSlug/results"
                    params={{ contestSlug: contest.slug }}
                    search={{ state: "default", query: "", filter: "all", sort: "rank" }}
                  >
                    View
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
