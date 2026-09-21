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
import { SectionHeader, PageHeader } from "@/organization/components/ui";
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
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header with quick stats */}
      <PageHeader
        kicker="04 // Participation Record"
        index="DOSSIER"
        title="My Contests"
        description="All entered, active, and completed competitive programming tournaments."
        action={
          <div className="flex gap-4 sm:gap-6 items-center flex-wrap">
            <div className="flex flex-col border-l border-lime-400 pl-3">
              <strong className="font-mono tabular-nums text-xl font-semibold text-white">{data.length}</strong>
              <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider">Total</span>
            </div>
            <div className="flex flex-col border-l border-white/20 pl-3">
              <strong className="font-mono tabular-nums text-xl font-semibold text-white">{registeredCount}</strong>
              <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider">Upcoming</span>
            </div>
            <div className="flex flex-col border-l border-lime-400/40 pl-3">
              <strong className="font-mono tabular-nums text-xl font-semibold text-lime-400">{qualifiedCount}</strong>
              <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider">Ranked</span>
            </div>
          </div>
        }
      />

      {/* Segmented Filter Controls */}
      <Tabs value={filter} onValueChange={(val: any) => setFilter(val)} className="my-4">
        <TabsList className="h-auto flex-wrap gap-1 rounded-md border border-white/8 bg-black p-1">
          <TabsTrigger value="all" className="rounded font-mono text-xs uppercase text-zinc-400 data-[state=active]:bg-lime-400 data-[state=active]:text-black transition-colors">
            All (<span className="tabular-nums">{data.length}</span>)
          </TabsTrigger>
          <TabsTrigger value="registered" className="rounded font-mono text-xs uppercase text-zinc-400 data-[state=active]:bg-lime-400 data-[state=active]:text-black transition-colors">
            Registered (<span className="tabular-nums">{registeredCount}</span>)
          </TabsTrigger>
          <TabsTrigger value="live" className="rounded font-mono text-xs uppercase text-zinc-400 data-[state=active]:bg-lime-400 data-[state=active]:text-black transition-colors">
            Live (<span className="tabular-nums">{liveCount}</span>)
          </TabsTrigger>
          <TabsTrigger value="completed" className="rounded font-mono text-xs uppercase text-zinc-400 data-[state=active]:bg-lime-400 data-[state=active]:text-black transition-colors">
            Completed (<span className="tabular-nums">{completedCount}</span>)
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Main Participation List */}
      <section className="overflow-hidden rounded-lg border border-white/8 bg-black">
        <div className="flex items-center justify-between border-b border-white/8 p-4 sm:p-5">
          <SectionHeader
            kicker="Contest History"
            title={`${filteredContests.length} ${filter === "all" ? "entries" : filter + " contests"}`}
          />
          <Button variant="outline" size="sm" asChild className="rounded-md font-mono text-xs text-zinc-300 border-white/10 bg-black hover:bg-lime-400 hover:text-black hover:border-lime-400">
            <Link to="/contests">
              <span>Browse Contests</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </div>

        {filteredContests.length === 0 ? (
          <div className="py-16 px-6 text-center font-mono">
            <Trophy className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-white">
              No contests found in this view
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-5 leading-relaxed">
              {filter === "registered"
                ? "You have not registered for any upcoming tournament rounds yet."
                : "Participate in campus contests to establish your university ranking."}
            </p>
            <Button asChild className="rounded-md bg-transparent text-white border border-white/20 hover:bg-lime-400 hover:text-black hover:border-lime-400 text-xs font-mono font-semibold transition-colors [&_svg]:transition-colors">
              <Link to="/contests">Explore Contests</Link>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-white/6">
            {filteredContests.map((c) => {
              const isUpcoming = c.status === "upcoming" || c.outcome === "registered";
              const isLive = c.status === "live" || c.outcome === "live";
              const isQualified = c.outcome === "qualified";
              const isPending = c.outcome === "pending";

              return (
                <article
                  key={c.contest_slug}
                  className="flex flex-col justify-between gap-4 p-5 transition-colors hover:bg-zinc-950 lg:flex-row lg:items-center"
                >
                  {/* Left: Details */}
                  <div className="flex items-start gap-3.5">
                    <div className="shrink-0 mt-0.5">
                      {isQualified ? (
                        <div className="size-9 rounded-md bg-lime-400/10 border border-lime-400/30 flex items-center justify-center text-lime-400">
                          <CheckCircle2 size={18} />
                        </div>
                      ) : isLive ? (
                        <div className="size-9 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                          <Radio size={18} className="animate-pulse" />
                        </div>
                      ) : isUpcoming ? (
                        <div className="size-9 rounded-md bg-zinc-950 border border-white/10 flex items-center justify-center text-zinc-400">
                          <Clock3 size={18} />
                        </div>
                      ) : isPending ? (
                        <div className="size-9 rounded-md bg-zinc-950 border border-white/10 flex items-center justify-center text-zinc-400">
                          <Clock3 size={18} />
                        </div>
                      ) : (
                        <div className="size-9 rounded-md bg-zinc-950 border border-white/8 flex items-center justify-center text-zinc-600">
                          <MinusCircle size={18} />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-950 text-zinc-400 border border-white/8">
                          {c.season}
                        </span>
                        {isQualified && (
                          <span className="inline-flex items-center gap-1 font-mono text-[9px] font-semibold uppercase text-lime-400 bg-lime-400/10 px-1.5 py-0.5 rounded border border-lime-400/30">
                            <ShieldCheck size={10} />
                            Ranked
                          </span>
                        )}
                        {isUpcoming && (
                          <span className="inline-flex items-center gap-1 font-sans text-[9px] font-semibold uppercase text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
                            <CheckCircle2 size={10} className="text-emerald-400" />
                            Registered
                          </span>
                        )}
                        {isLive && (
                          <span className="inline-flex items-center gap-1 font-mono text-[9px] font-semibold uppercase text-lime-400 bg-lime-400/10 px-1.5 py-0.5 rounded border border-lime-400/30">
                            <span className="size-1.5 rounded-full bg-lime-400 animate-pulse" />
                            Contest Live
                          </span>
                        )}
                      </div>

                      <h2 className="text-sm font-semibold text-white hover:text-lime-400 transition-colors">
                        <Link to={`/contests/${c.contest_slug}`}>
                          {c.contest_title}
                        </Link>
                      </h2>

                      <div className="flex items-center gap-4 text-xs text-zinc-500 flex-wrap font-mono">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays size={12} className="text-zinc-600" />
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
                            <MapPin size={12} className="text-zinc-600" />
                            {c.venue}
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1.5">
                          <Users size={12} className="text-zinc-600" />
                          <span className="tabular-nums text-zinc-400">{c.participants}</span> participants
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Scores & Actions */}
                  <div className="flex items-center gap-4 sm:gap-6 justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-white/6">
                    <dl className="flex items-center gap-4 sm:gap-6 text-right font-mono">
                      {c.rank !== null ? (
                        <div>
                          <dt className="text-[9px] text-zinc-500 uppercase">Rank</dt>
                          <dd className="text-sm font-semibold text-white tabular-nums">
                            #{c.rank}
                          </dd>
                        </div>
                      ) : isUpcoming ? (
                        <div>
                          <dt className="text-[9px] text-zinc-500 uppercase">Status</dt>
                          <dd className="text-xs font-semibold text-lime-400">
                            Standby
                          </dd>
                        </div>
                      ) : null}

                      {c.score !== null ? (
                        <div>
                          <dt className="text-[9px] text-zinc-500 uppercase">Score</dt>
                          <dd className="text-sm font-semibold text-lime-400 tabular-nums">
                            {c.score}/100
                          </dd>
                        </div>
                      ) : isUpcoming ? (
                        <div>
                          <dt className="text-[9px] text-zinc-500 uppercase">Workstation</dt>
                          <dd className="text-xs font-semibold text-white">
                            Reserved
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    <div className="flex items-center gap-2 shrink-0">
                      {isLive && !c.assessment_submitted && c.score === null ? (
                        <Button
                          asChild
                          size="sm"
                          className="rounded-md bg-transparent text-white border border-white/20 hover:bg-lime-400 hover:text-black hover:border-lime-400 font-mono text-xs font-semibold transition-colors [&_svg]:transition-colors"
                        >
                          <Link to={`/contests/${c.contest_slug}/lobby`}>
                            <Play className="w-3 h-3 fill-current" />
                            <span>Assessment</span>
                          </Link>
                        </Button>
                      ) : isUpcoming && !c.assessment_submitted ? (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="rounded-md border-white/10 bg-black text-zinc-300 hover:bg-lime-400 hover:text-black hover:border-lime-400 font-mono text-xs"
                        >
                          <Link to={`/contests/${c.contest_slug}`}>
                            <span>Details</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="rounded-md border-white/10 bg-black text-zinc-300 hover:bg-lime-400 hover:text-black hover:border-lime-400 font-mono text-xs"
                        >
                          <Link to={`/contests/${c.contest_slug}/results`}>
                            <span>Standings</span>
                            <ArrowRight className="w-3 h-3" />
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
