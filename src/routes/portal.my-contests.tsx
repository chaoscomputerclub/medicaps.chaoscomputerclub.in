import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  Award,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MapPin,
  MinusCircle,
  Play,
  Radio,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { contestSystemQueries } from "@/organization/data/contest-queries";
import { SectionHeader } from "@/organization/components/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const query = contestSystemQueries.history();

export const Route = createFileRoute("/portal/my-contests")({
  loader: ({ context }) => context.queryClient.ensureQueryData(query),
  head: () => ({
    meta: [
      { title: "My Contests — CCC Medi-Caps" },
      {
        name: "description",
        content: "Your verified contest registrations, online screening attempts, and qualification history.",
      },
      { property: "og:title", content: "My Contests — CCC Medi-Caps" },
      {
        property: "og:description",
        content: "A personal competition record across CCC Medi-Caps two-round contests.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyContestsPage,
});

function MyContestsPage() {
  const { data } = useSuspenseQuery(query);
  const [filter, setFilter] = useState<"all" | "registered" | "live" | "completed">("all");

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
    <div className="page-wrap">
      {/* Header with quick stats */}
      <header className="page-header">
        <div>
          <p className="kicker">Personal competition record</p>
          <h1>My contests.</h1>
          <p>
            Track your registered qualifiers, live screening windows, and verified campus final results
            in one synchronized ledger.
          </p>
        </div>

        <div className="flex gap-3 sm:gap-6 items-center flex-wrap">
          <div className="hub-stat">
            <strong>{data.length}</strong>
            <span>TOTAL ENTERED</span>
          </div>
          <div className="hub-stat">
            <strong>{registeredCount}</strong>
            <span>ACTIVE STANDBY</span>
          </div>
          <div className="hub-stat">
            <strong>{qualifiedCount}</strong>
            <span>TOP 30 QUALIFIED</span>
          </div>
        </div>
      </header>

      {/* Segmented Filter Controls using shadcn Tabs */}
      <Tabs value={filter} onValueChange={(val: any) => setFilter(val)} className="mb-6">
        <TabsList className="bg-[var(--surface-2)] border border-[var(--line)] p-1 rounded-[1px] h-auto flex-wrap">
          <TabsTrigger value="all" className="font-mono text-xs uppercase font-bold data-[state=active]:bg-[var(--accent)] data-[state=active]:text-black text-[var(--muted)]">
            All ({data.length})
          </TabsTrigger>
          <TabsTrigger value="registered" className="font-mono text-xs uppercase font-bold data-[state=active]:bg-[var(--accent)] data-[state=active]:text-black text-[var(--muted)]">
            Registered ({registeredCount})
          </TabsTrigger>
          <TabsTrigger value="live" className="font-mono text-xs uppercase font-bold data-[state=active]:bg-[var(--accent)] data-[state=active]:text-black text-[var(--muted)]">
            Live Screening ({liveCount})
          </TabsTrigger>
          <TabsTrigger value="completed" className="font-mono text-xs uppercase font-bold data-[state=active]:bg-[var(--accent)] data-[state=active]:text-black text-[var(--muted)]">
            Completed ({completedCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Main Participation List */}
      <section className="panel p-0 overflow-hidden border border-[var(--line-strong)]">
        <div className="p-4 sm:p-6 border-b border-[var(--line)] bg-[var(--surface-2)] flex items-center justify-between">
          <SectionHeader
            kicker="Contest Ledger"
            title={`Showing ${filteredContests.length} ${filter === "all" ? "participations" : filter + " contests"}`}
          />
          <Button variant="outline" size="sm" asChild className="font-mono text-xs text-white">
            <Link to="/portal/contests">
              Browse All Contests
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>

        {filteredContests.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <Trophy className="w-10 h-10 text-[var(--muted)] mx-auto mb-3 opacity-60" />
            <h3 className="font-mono text-base font-bold text-white uppercase tracking-wider">
              No contests found in this view
            </h3>
            <p className="text-sm text-[var(--muted)] max-w-md mx-auto mt-1 mb-6">
              {filter === "registered"
                ? "You haven’t registered for upcoming contests yet. Explore the contest calendar and claim your workstation seat."
                : "Enter two-round campus contests to build your verified competitive record."}
            </p>
            <Button asChild className="bg-[var(--accent)] text-black hover:brightness-110 hover:text-black font-bold text-xs font-mono uppercase tracking-wider">
              <Link to="/portal/contests">Explore Active Contests</Link>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {filteredContests.map((c) => {
              const isUpcoming = c.status === "upcoming" || c.outcome === "registered";
              const isLive = c.status === "live" || c.outcome === "live";
              const isQualified = c.outcome === "qualified";
              const isPending = c.outcome === "pending";

              return (
                <article
                  key={c.contest_slug}
                  className="p-5 sm:p-6 hover:bg-[var(--surface-2)] transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                >
                  {/* Left: Status Icon & Details */}
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 mt-1">
                      {isQualified ? (
                        <div className="w-10 h-10 rounded-[1px] bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                          <CheckCircle2 size={20} />
                        </div>
                      ) : isLive ? (
                        <div className="w-10 h-10 rounded-[1px] bg-amber-950/80 border border-amber-500/50 flex items-center justify-center text-amber-400">
                          <Radio size={20} className="animate-pulse" />
                        </div>
                      ) : isUpcoming ? (
                        <div className="w-10 h-10 rounded-[1px] bg-yellow-950/40 border border-yellow-500/40 flex items-center justify-center text-yellow-400">
                          <Clock3 size={20} />
                        </div>
                      ) : isPending ? (
                        <div className="w-10 h-10 rounded-[1px] bg-blue-950/50 border border-blue-500/40 flex items-center justify-center text-blue-400">
                          <Clock3 size={20} />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-[1px] bg-[var(--surface-3)] border border-[var(--line)] flex items-center justify-center text-[var(--muted)]">
                          <MinusCircle size={20} />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="mono-tag">{c.season}</span>
                        {isQualified && (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-emerald-400 bg-emerald-950/80 px-2 py-0.5 border border-emerald-500/40">
                            <ShieldCheck size={11} />
                            Top 30 Qualified
                          </span>
                        )}
                        {isUpcoming && (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-yellow-400 bg-yellow-950/50 px-2 py-0.5 border border-yellow-500/40">
                            Registered · Seat Confirmed
                          </span>
                        )}
                        {isLive && (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-amber-300 bg-amber-950/60 px-2 py-0.5 border border-amber-500/50">
                            <i className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-ping" />
                            Screening Active
                          </span>
                        )}
                      </div>

                      <h2 className="text-base sm:text-lg font-bold text-white hover:text-[var(--accent)] transition-colors">
                        <Link to="/portal/contests/$contestSlug" params={{ contestSlug: c.contest_slug }}>
                          {c.contest_title}
                        </Link>
                      </h2>

                      <div className="flex items-center gap-4 text-xs text-[var(--muted)] flex-wrap">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays size={13} />
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
                            <MapPin size={13} />
                            {c.venue}
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1.5">
                          <Users size={13} />
                          {c.participants} competitors
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Score Metrics & Action Buttons */}
                  <div className="flex items-center gap-4 sm:gap-6 justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-[var(--line)]">
                    <dl className="flex items-center gap-4 sm:gap-6 text-right">
                      {c.rank !== null ? (
                        <div>
                          <dt className="font-mono text-[10px] text-[var(--muted)] uppercase">Rank</dt>
                          <dd className="font-mono text-sm sm:text-base font-extrabold text-white">
                            #{c.rank}
                          </dd>
                        </div>
                      ) : isUpcoming ? (
                        <div>
                          <dt className="font-mono text-[10px] text-[var(--muted)] uppercase">Status</dt>
                          <dd className="font-mono text-xs font-bold text-[var(--accent)]">
                            Standby
                          </dd>
                        </div>
                      ) : null}

                      {c.score !== null ? (
                        <div>
                          <dt className="font-mono text-[10px] text-[var(--muted)] uppercase">Score</dt>
                          <dd className="font-mono text-sm sm:text-base font-extrabold text-[var(--accent)]">
                            {c.score}/100
                          </dd>
                        </div>
                      ) : isUpcoming ? (
                        <div>
                          <dt className="font-mono text-[10px] text-[var(--muted)] uppercase">Workstation</dt>
                          <dd className="font-mono text-xs font-semibold text-white">
                            Allocated
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    <div className="flex items-center gap-2 shrink-0">
                      {isLive ? (
                        <Button
                          asChild
                          className="bg-[var(--accent)] text-black hover:brightness-110 hover:text-black font-mono text-xs font-bold uppercase tracking-wider"
                        >
                          <Link
                            to="/portal/contests/$contestSlug/assessment"
                            params={{ contestSlug: c.contest_slug }}
                            search={{ state: "live" }}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Play className="w-3.5 h-3.5 mr-1" />
                            Assessment
                          </Link>
                        </Button>
                      ) : isUpcoming ? (
                        <Button
                          variant="outline"
                          asChild
                          className="border-[var(--line)] text-white hover:border-[var(--accent)] font-mono text-xs font-semibold uppercase"
                        >
                          <Link
                            to="/portal/contests/$contestSlug"
                            params={{ contestSlug: c.contest_slug }}
                            search={{ state: "default" }}
                          >
                            View Brief
                            <ArrowRight className="w-3.5 h-3.5 ml-1" />
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          asChild
                          className="border-[var(--line)] text-white hover:border-[var(--accent)] font-mono text-xs font-semibold uppercase"
                        >
                          <Link
                            to="/portal/contests/$contestSlug/results"
                            params={{ contestSlug: c.contest_slug }}
                            search={{
                              state: isQualified ? "qualified" : isPending ? "pending" : "not-qualified",
                              query: "",
                              filter: "all",
                              sort: "rank",
                            }}
                          >
                            Scoreboard
                            <ArrowRight className="w-3.5 h-3.5 ml-1" />
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
