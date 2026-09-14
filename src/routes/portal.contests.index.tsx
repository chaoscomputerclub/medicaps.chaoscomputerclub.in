import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueries, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarRange, Clock3, Code2, Crown, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { contestQueries } from "@/features/contest/queries";
import { Countdown, PhaseBadge, useTick } from "@/features/contest/components";
import { FINALIST_SEATS, assessmentOpensAt, assessmentClosesAt, cadenceLabel, contestPhase, formatWhen } from "@/features/contest/lifecycle";
import type { ContestSummary } from "@/features/contest/types";
import { portalQueries } from "@/organization/data/queries";
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
  const now = useTick();
  const registrations = useQueries({ queries: contests.map(c => contestQueries.registration(c.slug)) });
  const { data: leaders = [] } = useQuery(portalQueries.leaderboard());
  const phaseFor = (c: ContestSummary) => contestPhase(c, registrations[contests.indexOf(c)]?.data ?? null, now);
  const featured = contests.filter(c => c.status !== "finished").sort((a,b) => +new Date(a.starts_at) - +new Date(b.starts_at))[0];
  const visible = contests.filter(c => filter === "all" || (filter === "past" ? c.status === "finished" : filter === "upcoming" ? c.status !== "finished" : c.cadence === filter));
  const phase = featured ? phaseFor(featured) : null;
  return <div className="page-wrap space-y-8">
    <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div className="space-y-2"><p className="kicker">Compete. Qualify. Meet on campus.</p><h1 className="text-4xl font-bold normal-case text-foreground">Contest hub</h1><p className="max-w-lg text-sm text-muted-foreground">Weekly and biweekly challenges with one simple path to the campus final.</p></div>
      <div className="flex w-fit items-center gap-1 rounded-lg border border-border bg-card/80 p-1 backdrop-blur-xl">
        <Button size="sm" className="rounded-md">Contests</Button>
        <Button asChild size="sm" variant="ghost" className="rounded-md text-muted-foreground"><Link to="/portal/leaderboard">Ranking</Link></Button>
        <Button asChild size="sm" variant="ghost" className="rounded-md text-muted-foreground"><Link to="/portal/my-contests">My contests</Link></Button>
      </div>
    </header>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-7">
      {featured && <section className="group relative overflow-hidden rounded-lg border border-primary/30 bg-card/90 shadow-xl backdrop-blur-xl">
        <div className="absolute inset-y-0 right-0 hidden w-52 place-items-center border-l border-border bg-secondary/50 md:grid" aria-hidden="true"><div className="grid size-32 place-items-center rounded-lg border border-primary/20 bg-primary/5"><Code2 className="size-16 text-primary/70" /></div></div>
        <div className="space-y-5 p-6 md:max-w-[calc(100%-13rem)] md:p-8">
          <div className="flex flex-wrap items-center gap-3"><PhaseBadge phase={phaseFor(featured)} /><span className="text-xs font-medium text-muted-foreground">{cadenceLabel(featured)} {featured.edition ?? ""}</span></div>
          <div><h2 className="text-3xl font-bold normal-case text-foreground">{featured.title}</h2><p className="mt-2 max-w-xl text-sm text-muted-foreground">{phase === "assessment_submitted" ? "Your assessment is in. Results unlock when the entry window closes." : "Take the 2-hour online assessment. The Top 30 move to the campus final."}</p></div>
          <div className="flex flex-wrap items-end gap-8">
            {phase === "registration_open" ? <Countdown target={assessmentOpensAt(featured)} label="Round 1 opens in" /> : phase === "assessment_open" ? <Countdown target={assessmentClosesAt(featured)} label="Round 1 closes in" /> : <div><p className="text-xs text-muted-foreground">Campus final</p><span className="font-mono text-sm">{formatWhen(featured.starts_at)}</span></div>}
            <div><p className="text-xs text-muted-foreground">Registered</p><strong className="font-mono text-xl text-foreground">{featured.registered_count}</strong></div>
          </div>
          <Button asChild className="rounded-md"><Link to="/portal/contests/$contestSlug" params={{contestSlug: featured.slug}} search={{state:"default"}}>View contest <ArrowRight /></Link></Button>
        </div>
      </section>}
      <section className="space-y-5">
      <Tabs value={filter} onValueChange={value => void navigate({search:{filter:value as TabKey}})}>
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border border-border bg-card/70 p-1 backdrop-blur-xl">
          {TABS.map(tab => <TabsTrigger key={tab} value={tab} className="shrink-0 rounded-md px-4 py-2 capitalize text-muted-foreground data-[state=active]:bg-secondary data-[state=active]:text-foreground">{tab === "all" ? "All contests" : tab}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card/80 backdrop-blur-xl">
        {visible.length === 0 ? <div className="space-y-2 p-12 text-center"><CalendarRange className="mx-auto size-6 text-muted-foreground"/><h3>No contests here yet</h3><p className="text-sm">New contests will appear when announced.</p></div> : visible.map(c => <article key={c.slug} className="flex flex-col justify-between gap-4 p-5 transition-colors hover:bg-secondary/70 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-4"><div className="grid size-11 shrink-0 place-items-center rounded-md border border-border bg-secondary text-primary"><Code2 className="size-5" /></div><div className="min-w-0 space-y-1"><h3 className="truncate text-sm font-semibold text-foreground">{c.title}</h3><p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{formatWhen(assessmentOpensAt(c).toISOString())}</span><span>2 hours</span><span>{c.registered_count} registered</span></p></div></div>
          <div className="flex shrink-0 items-center gap-3"><PhaseBadge phase={phaseFor(c)}/><Button asChild size="icon" variant="ghost" className="rounded-md" title="Open contest"><Link to="/portal/contests/$contestSlug" params={{contestSlug:c.slug}} search={{state:"default"}} aria-label={`Open ${c.title}`}><ArrowRight /></Link></Button></div>
        </article>)}
      </div>
      </section>
      </div>
      <aside className="space-y-5">
        <section className="overflow-hidden rounded-lg border border-border bg-card/80 backdrop-blur-xl"><div className="flex items-center justify-between border-b border-border p-5"><h2 className="flex items-center gap-2 text-base font-semibold normal-case"><Crown className="size-4 text-primary"/>Top contestants</h2><Button asChild size="icon" variant="ghost" className="rounded-md"><Link to="/portal/leaderboard" aria-label="Open leaderboard"><ArrowRight /></Link></Button></div><div className="divide-y divide-border">{leaders.slice(0,5).map((leader,index)=><div key={leader.handle} className="flex items-center gap-3 px-5 py-3"><span className="w-5 font-mono text-xs text-primary">{String(index+1).padStart(2,"0")}</span><div className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-bold text-foreground">{leader.handle.slice(0,2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{leader.handle}</p><p className="text-[11px] text-muted-foreground">{leader.department}</p></div><strong className="font-mono text-xs">{leader.rating}</strong></div>)}</div></section>
        <section className="rounded-lg border border-border bg-card/60 p-5 backdrop-blur-xl"><h2 className="text-base font-semibold normal-case">How it works</h2><div className="mt-5 space-y-5">{[{icon:Clock3,title:"Round 1 online",text:"One 2-hour attempt."},{icon:Users,title:`Top ${FINALIST_SEATS} qualify`,text:"Results unlock after the window."},{icon:Trophy,title:"Campus final",text:"Enter with your QR pass."}].map((step,index)=><div key={step.title} className="flex gap-3"><div className="grid size-8 shrink-0 place-items-center rounded-md border border-primary/25 bg-primary/5 text-primary"><step.icon className="size-4"/></div><div><p className="text-sm font-medium text-foreground">{index+1}. {step.title}</p><p className="text-xs text-muted-foreground">{step.text}</p></div></div>)}</div></section>
      </aside>
    </div>
  </div>;
}
