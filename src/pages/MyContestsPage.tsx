import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  MinusCircle,
  Play,
  Radio,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { contestSystemService } from "@/organization/data/contest-system";
import { SectionHeader } from "@/organization/components/ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MyContestsSkeleton } from "@/organization/components/skeletons";
import { useSwrData } from "@/lib/cache/swrCache";

export function MyContestsPage() {
  const { data: rawData, loading } = useSwrData(
    "system:contests:history",
    () => contestSystemService.getHistory(),
    { ttl: 2 * 60 * 1000 }
  );
  const data = rawData || [];
  const [filter, setFilter] = useState<"all" | "registered" | "live" | "completed">("all");

  if (loading && !rawData) {
    return <MyContestsSkeleton />;
  }

  const qualifiedCount = data.filter((x) => x.outcome === "qualified").length;
  const registeredCount = data.filter((x) => x.status === "upcoming" || x.outcome === "registered").length;
  const liveCount = data.filter((x) => x.status === "live" || x.outcome === "live").length;
  const completedCount = data.filter((x) => x.status === "finished" || x.outcome === "qualified" || x.outcome === "not_qualified").length;

  const filteredContests = data.filter((item) => {
    if (filter === "registered") return item.status === "upcoming" || item.outcome === "registered";
    if (filter === "live") return item.status === "live" || item.outcome === "live";
    if (filter === "completed") return item.status === "finished" || item.outcome === "qualified" || item.outcome === "not_qualified";
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      {/* Header with quick stats */}
      <header className="flex flex-col justify-between gap-5 border-b border-white/10 pb-6 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-orange-400 font-bold mb-1">Your competition record</p>
          <h1 className="text-3xl sm:text-4xl font-mono font-black text-white uppercase tracking-tight">My contests</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Everything you entered, qualified for, or completed — in one place.
          </p>
        </div>

        <div className="flex gap-4 sm:gap-6 items-center flex-wrap">
          <div className="flex flex-col border-l-2 border-orange-500 pl-3">
            <strong className="font-mono tabular-nums text-2xl font-bold text-white">{data.length}</strong>
            <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider">TOTAL ENTERED</span>
          </div>
          <div className="flex flex-col border-l-2 border-amber-500 pl-3">
            <strong className="font-mono tabular-nums text-2xl font-bold text-white">{registeredCount}</strong>
            <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider">ACTIVE STANDBY</span>
          </div>
          <div className="flex flex-col border-l-2 border-emerald-500 pl-3">
            <strong className="font-mono tabular-nums text-2xl font-bold text-white">{qualifiedCount}</strong>
            <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider">TOP 30 QUALIFIED</span>
          </div>
        </div>
      </header>

      {/* Segmented Filter Controls using shadcn Tabs */}
      <Tabs value={filter} onValueChange={(val: any) => setFilter(val)} className="my-6">
        <TabsList className="h-auto flex-wrap gap-1 rounded-xl border border-white/10 bg-zinc-900/60 p-1.5 backdrop-blur-md">
          <TabsTrigger value="all" className="rounded-lg font-mono text-xs uppercase font-bold text-zinc-400 data-[state=active]:bg-orange-500 data-[state=active]:text-black data-[state=active]:shadow-md transition-all">
            All (<span className="tabular-nums">{data.length}</span>)
          </TabsTrigger>
          <TabsTrigger value="registered" className="rounded-lg font-mono text-xs uppercase font-bold text-zinc-400 data-[state=active]:bg-orange-500 data-[state=active]:text-black data-[state=active]:shadow-md transition-all">
            Registered (<span className="tabular-nums">{registeredCount}</span>)
          </TabsTrigger>
          <TabsTrigger value="live" className="rounded-lg font-mono text-xs uppercase font-bold text-zinc-400 data-[state=active]:bg-orange-500 data-[state=active]:text-black data-[state=active]:shadow-md transition-all">
            Live Screening (<span className="tabular-nums">{liveCount}</span>)
          </TabsTrigger>
          <TabsTrigger value="completed" className="rounded-lg font-mono text-xs uppercase font-bold text-zinc-400 data-[state=active]:bg-orange-500 data-[state=active]:text-black data-[state=active]:shadow-md transition-all">
            Completed (<span className="tabular-nums">{completedCount}</span>)
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Main Participation List */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50 backdrop-blur-md shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 bg-zinc-950/40 p-4 sm:p-6">
          <SectionHeader
            kicker="Contest Ledger"
            title={`Showing ${filteredContests.length} ${filter === "all" ? "participations" : filter + " contests"}`}
          />
          <Button variant="outline" size="sm" asChild className="rounded-xl font-mono text-xs text-zinc-300 border-white/10 bg-zinc-900/60 hover:border-white/20 hover:text-white active:scale-[0.98]">
            <Link to="/portal/contests">
              Browse All Contests
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>

        {filteredContests.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <Trophy className="w-10 h-10 text-zinc-600 mx-auto mb-3 opacity-60" />
            <h3 className="font-mono text-base font-bold text-white uppercase tracking-wider">
              No contests found in this view
            </h3>
            <p className="text-sm text-zinc-400 max-w-md mx-auto mt-1 mb-6">
              {filter === "registered"
                ? "You haven't registered for upcoming contests yet. Explore the contest calendar and claim your workstation seat."
                : "Enter two-round campus contests to build your verified competitive record."}
            </p>
            <Button asChild className="rounded-xl bg-orange-500 text-black hover:bg-orange-400 font-bold text-xs font-mono uppercase tracking-wider shadow-lg shadow-orange-500/20 active:scale-[0.98]">
              <Link to="/portal/contests">Explore Active Contests</Link>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredContests.map((c) => {
              const isUpcoming = c.status === "upcoming" || c.outcome === "registered";
              const isLive = c.status === "live" || c.outcome === "live";
              const isQualified = c.outcome === "qualified";
              const isPending = c.outcome === "pending";

              return (
                <article
                  key={c.contest_slug}
                  className="flex flex-col justify-between gap-5 p-5 transition-colors hover:bg-white/[0.02] sm:p-6 lg:flex-row lg:items-center"
                >
                  {/* Left: Status Icon & Details */}
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 mt-1">
                      {isQualified ? (
                        <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-sm">
                          <CheckCircle2 size={20} />
                        </div>
                      ) : isLive ? (
                        <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-sm">
                          <Radio size={20} className="animate-pulse" />
                        </div>
                      ) : isUpcoming ? (
                        <div className="w-10 h-10 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-sm">
                          <Clock3 size={20} />
                        </div>
                      ) : isPending ? (
                        <div className="w-10 h-10 rounded-xl bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-sm">
                          <Clock3 size={20} />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-zinc-800/60 border border-white/10 flex items-center justify-center text-zinc-400 shadow-sm">
                          <MinusCircle size={20} />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-300 border border-white/10">{c.season}</span>
                        {isQualified && (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/40">
                            <ShieldCheck size={11} />
                            Top 30 Qualified
                          </span>
                        )}
                        {isUpcoming && (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-500/40">
                            Registered · Seat Confirmed
                          </span>
                        )}
                        {isLive && (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-500/50">
                            <i className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-ping" />
                            Screening Active
                          </span>
                        )}
                      </div>

                      <h2 className="text-base sm:text-lg font-bold text-white hover:text-orange-400 transition-colors">
                        <Link to={`/portal/contests/${c.contest_slug}`}>
                          {c.contest_title}
                        </Link>
                      </h2>

                      <div className="flex items-center gap-4 text-xs text-zinc-400 flex-wrap font-mono">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays size={13} className="text-zinc-500" />
                          {c.starts_at
                            ? new Date(c.starts_at).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "Asia/Kolkata",
                              }) + " IST"
                            : new Date(c.participated_at).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                        </span>

                        {c.venue && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin size={13} className="text-zinc-500" />
                            {c.venue}
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1.5">
                          <Users size={13} className="text-zinc-500" />
                          <span className="tabular-nums text-white font-bold">{c.participants}</span> competitors
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Score Metrics & Action Buttons */}
                  <div className="flex items-center gap-4 sm:gap-6 justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-white/10">
                    <dl className="flex items-center gap-4 sm:gap-6 text-right font-mono">
                      {c.rank !== null ? (
                        <div>
                          <dt className="text-[10px] text-zinc-400 uppercase">Rank</dt>
                          <dd className="text-sm sm:text-base font-extrabold text-white tabular-nums">
                            #{c.rank}
                          </dd>
                        </div>
                      ) : isUpcoming ? (
                        <div>
                          <dt className="text-[10px] text-zinc-400 uppercase">Status</dt>
                          <dd className="text-xs font-bold text-orange-400">
                            Standby
                          </dd>
                        </div>
                      ) : null}

                      {c.score !== null ? (
                        <div>
                          <dt className="text-[10px] text-zinc-400 uppercase">Score</dt>
                          <dd className="text-sm sm:text-base font-extrabold text-orange-400 tabular-nums">
                            {c.score}/100
                          </dd>
                        </div>
                      ) : isUpcoming ? (
                        <div>
                          <dt className="text-[10px] text-zinc-400 uppercase">Workstation</dt>
                          <dd className="text-xs font-semibold text-white">
                            Allocated
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    <div className="flex items-center gap-2 shrink-0">
                      {isLive && !c.assessment_submitted && c.score === null ? (
                        <Button
                          asChild
                          className="rounded-xl bg-orange-500 text-black hover:bg-orange-400 font-mono text-xs font-bold uppercase tracking-wider shadow-lg shadow-orange-500/20 active:scale-[0.98]"
                        >
                          <Link to={`/assessments/${c.contest_slug}`}>
                            <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                            Assessment
                          </Link>
                        </Button>
                      ) : isUpcoming && !c.assessment_submitted ? (
                        <Button
                          variant="outline"
                          asChild
                          className="rounded-xl border-white/10 bg-zinc-900/60 text-zinc-300 hover:border-white/20 hover:text-white font-mono text-xs font-semibold uppercase active:scale-[0.98]"
                        >
                          <Link to={`/portal/contests/${c.contest_slug}`}>
                            View Brief
                            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          asChild
                          className="rounded-xl border-white/10 bg-zinc-900/60 text-zinc-300 hover:border-white/20 hover:text-white font-mono text-xs font-semibold uppercase active:scale-[0.98]"
                        >
                          <Link to={`/portal/contests/${c.contest_slug}/results`}>
                            Scoreboard
                            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
