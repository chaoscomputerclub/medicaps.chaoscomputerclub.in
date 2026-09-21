import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Trophy,
  Calendar,
  Clock,
  Users,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Search,
  ExternalLink,
  Code2,
  Sparkles,
  Play,
  Flame,
  TrendingUp,
  QrCode,
  ShieldAlert,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContestsThunk, registerContestThunk } from "@/store/slices/contestSlice";
import { contestApi } from "@/features/contest/api";
import { invalidateSwrCache } from "@/lib/cache/swrCache";
import type { ContestSummary, ParticipationRecord } from "@/features/contest/types";
import { getUniversityLeaderboardData } from "@/organization/data/portal.functions";
import type { LeaderboardEntry } from "@/organization/data/types";
import { ContestsHubSkeleton, Skeleton } from "@/organization/components/skeletons";
import { PageHeader, SectionHeader } from "@/organization/components/ui";
import { useRealtimeEvents } from "@/lib/realtime";
import { toast } from "sonner";

function useCountdown(targetIsoDate: string | null | undefined) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number; hours: number; minutes: number; seconds: number;
    isExpired: boolean; totalSeconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, totalSeconds: 0 });

  useEffect(() => {
    if (!targetIsoDate) return;
    const calc = () => {
      const target = new Date(targetIsoDate).getTime();
      const now = Date.now();
      const diff = Math.max(0, target - now);
      const totalSeconds = Math.floor(diff / 1000);
      setTimeLeft({
        days: Math.floor(totalSeconds / 86400),
        hours: Math.floor((totalSeconds % 86400) / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
        isExpired: totalSeconds <= 0,
        totalSeconds,
      });
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [targetIsoDate]);

  return timeLeft;
}

function CountdownDisplay({ days, hours, minutes, seconds, accentSec = false }: {
  days: number; hours: number; minutes: number; seconds: number; accentSec?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {[{ val: days, label: "Days" }, { val: hours, label: "Hrs" }, { val: minutes, label: "Min" }, { val: seconds, label: "Sec", accent: accentSec }].map(({ val, label, accent }) => (
        <div key={label} className="flex flex-col items-center justify-center rounded-md border border-white/8 bg-black p-3">
          <span className={`font-mono text-2xl font-bold tabular-nums leading-none tracking-tight ${accent ? "text-lime-400" : "text-white"}`}>
            {String(val).padStart(2, "0")}
          </span>
          <span className="mt-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-zinc-500">{label}</span>
        </div>
      ))}
    </div>
  );
}

export function ContestsHubPage() {
  const dispatch = useAppDispatch();
  const { contests, isLoading } = useAppSelector((state) => state.contest);
  const member = useAppSelector((state) => state.auth.member);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "past";
  const [searchQuery, setSearchQuery] = useState("");
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [myParticipations, setMyParticipations] = useState<ParticipationRecord[]>([]);
  const [isLoadingParticipations, setIsLoadingParticipations] = useState(false);
  const [registeringSlug, setRegisteringSlug] = useState<string | null>(null);

  const refreshHubData = useCallback((force = false) => {
    if (force) {
      invalidateSwrCache("contests:*");
      invalidateSwrCache("contest:*");
      invalidateSwrCache("passes:*");
    }
    dispatch(fetchContestsThunk(force));
    getUniversityLeaderboardData().then((res) => setLeaders(res || []));
    if (member) {
      contestApi.participated(force)
        .then((res: ParticipationRecord[]) => setMyParticipations(res || []))
        .catch(() => {});
    }
  }, [dispatch, member]);

  // Initial load with skeleton indicators
  useEffect(() => {
    dispatch(fetchContestsThunk(false));
    getUniversityLeaderboardData().then((res) => setLeaders(res || []));
    if (member) {
      setIsLoadingParticipations(true);
      contestApi.participated(true)
        .then((res: ParticipationRecord[]) => setMyParticipations(res || []))
        .catch(() => {})
        .finally(() => setIsLoadingParticipations(false));
    }
  }, [dispatch, member]);

  // Instant global push: updates list when any contest changes status or qualifiers are published
  useRealtimeEvents(null, (event) => {
    if (
      event.event === "contest_status_changed" ||
      event.event === "top30_qualified" ||
      event.event === "pass_checked_in"
    ) {
      refreshHubData(true);
    }
  });

  useEffect(() => {
    const handleSync = () => {
      refreshHubData(true);
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "ccc:assessment_updated" || e.key === "ccc_member" || e.key?.startsWith("contests")) {
        refreshHubData(true);
      }
    };

    window.addEventListener("focus", handleSync);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("assessment:status_changed" as any, handleSync);

    return () => {
      window.removeEventListener("focus", handleSync);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("assessment:status_changed" as any, handleSync);
    };
  }, [refreshHubData]);

  const upcomingContests = useMemo(() =>
    contests.filter((c) => c.status !== "finished").sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [contests]
  );
  const pastContests = useMemo(() =>
    contests.filter((c) => c.status === "finished").sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()),
    [contests]
  );
  const upcomingWeekly = useMemo(() => upcomingContests[0] || null, [upcomingContests]);
  const otherUpcomingContests = useMemo(() =>
    upcomingContests.slice(1),
    [upcomingContests]
  );

  const weeklyCountdown = useCountdown(upcomingWeekly?.starts_at);

  const isContestAssessmentInProgress = (contest: ContestSummary | null | undefined): boolean => {
    if (!contest) return false;
    const record = myParticipations.find((p) => p.contest_slug === contest.slug);
    if (!record) return false;
    return Boolean(
      (record as any).assessment_status === "in_progress" ||
      (record as any).can_resume_assessment
    );
  };

  const isContestAssessmentSubmitted = (contest: ContestSummary | null) => {
    if (!contest) return false;
    if (isContestAssessmentInProgress(contest)) return false;
    const record = myParticipations.find((p) => p.contest_slug === contest.slug);
    if (!record) return false;
    return Boolean(
      record.assessment_submitted ||
      (record as any).assessment_taken ||
      (record as any).assessment_status === "submitted" ||
      (record as any).assessment_status === "completed" ||
      (record.score !== null && record.score !== undefined) ||
      ["submitted", "qualified", "pending", "not_qualified"].includes(record.outcome || "")
    );
  };

  const isWeeklyRegistered = useMemo(() =>
    Boolean(upcomingWeekly && (upcomingWeekly.registered || myParticipations.some((p) => p.contest_slug === upcomingWeekly.slug))),
    [upcomingWeekly, myParticipations]
  );
  const isWeeklySubmitted = useMemo(() => isContestAssessmentSubmitted(upcomingWeekly), [upcomingWeekly, myParticipations]);

  const registeredUpcomingContest = useMemo(() =>
    upcomingContests.find((c) => c.registered || myParticipations.some((p) => p.contest_slug === c.slug)),
    [upcomingContests, myParticipations]
  );

  const assessmentInfo = useMemo(() => {
    const contest = registeredUpcomingContest || upcomingWeekly || upcomingContests[0];
    if (!contest) return null;
    const contestStart = new Date(contest.starts_at).getTime();
    const assessClose = contestStart - 2 * 3600 * 1000;
    const assessOpen = contestStart - 24 * 3600 * 1000;
    const now = Date.now();
    const record = myParticipations.find((p) => p.contest_slug === contest.slug);
    const isInProgress = Boolean(
      (record as any)?.assessment_status === "in_progress" ||
      (record as any)?.can_resume_assessment
    );
    const hasTaken = !isInProgress && Boolean(
      record?.assessment_submitted ||
      (record as any)?.assessment_taken ||
      (record as any)?.assessment_status === "submitted" ||
      (record as any)?.assessment_status === "completed" ||
      (record?.score !== null && record?.score !== undefined) ||
      ["submitted", "qualified", "pending", "not_qualified"].includes(record?.outcome || "")
    );
    const isTop30 = record?.outcome === "qualified" || (record?.rank !== null && (record?.rank ?? 99) <= 30);
    const isRegistered = Boolean(
      contest.registered ||
      myParticipations.some((p) => p.contest_slug === contest.slug)
    );
    return {
      contest, contestStart, assessOpen, assessClose,
      isOpen: (now >= assessOpen && now <= assessClose) || isInProgress,
      isUpcoming: now < assessOpen && !isInProgress,
      isClosed: now > assessClose && !isInProgress,
      hasTaken, isInProgress, isTop30, isRegistered,
      antiCheatViolations: (record as any)?.anti_cheat_violations || 1,
      maxViolations: (record as any)?.max_violations || 3,
      score: record?.score, rank: record?.rank,
      openDateFormatted: new Date(assessOpen).toLocaleString("en-IN", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      closeDateFormatted: new Date(assessClose).toLocaleString("en-IN", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    };
  }, [registeredUpcomingContest, upcomingWeekly, upcomingContests, myParticipations]);

  const assessmentUnlockTimer = useCountdown(
    assessmentInfo?.isUpcoming ? new Date(assessmentInfo.assessOpen).toISOString() : null
  );
  const assessmentRemainingTimer = useCountdown(
    assessmentInfo?.isOpen ? new Date(assessmentInfo.assessClose).toISOString() : null
  );

  const filteredPastContests = useMemo(() =>
    pastContests.filter((c) => {
      const matchesQuery = searchQuery === "" ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(c.edition ?? "").includes(searchQuery);
      return matchesQuery;
    }),
    [pastContests, searchQuery]
  );

  const handleRegister = async (slug: string) => {
    if (!member) { toast.error("Please login to register."); return; }
    try {
      setRegisteringSlug(slug);
      await dispatch(registerContestThunk(slug)).unwrap();
      toast.success("Successfully registered for the contest!");
      refreshHubData(true);
    } catch (err: any) {
      toast.error(err || "Registration failed");
    } finally {
      setRegisteringSlug(null);
    }
  };

  if (isLoading && contests.length === 0) return <ContestsHubSkeleton />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">

      {/* ─── HERO HEADER ─────────────────────────────── */}
      <PageHeader
        kicker="Tournaments"
        index="Contests Hub"
        badge={
          <span className="inline-flex items-center gap-1.5 rounded border border-lime-400/25 bg-lime-400/8 px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-lime-400">
            <Flame className="size-3 text-lime-400" /> Rated Campus Tournaments
          </span>
        }
        title="Contests Hub"
        description="Competitive programming rounds for Medi-Caps cadets. Compete, solve algorithmic problems, and climb the university leaderboard."
        action={
          <div className="grid grid-cols-3 divide-x divide-white/8 rounded-lg border border-white/8 bg-black lg:min-w-[320px]">
            {[
              { label: "Upcoming", value: upcomingContests.length },
              { label: "Past", value: pastContests.length },
              { label: "Cadets", value: contests.reduce((a, c) => a + (c.registered_count || 0), 0) },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center justify-center p-3">
                <span className="font-mono text-xl font-bold tabular-nums text-white">{value}</span>
                <span className="mt-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-zinc-500">{label}</span>
              </div>
            ))}
          </div>
        }
      />

      {/* ─── UPCOMING CONTESTS ───────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          kicker="Active Rounds"
          index="Next Tournament"
          title="Upcoming Contest"
        />

        {upcomingContests.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-white/8 bg-black py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-md border border-white/8 bg-black">
              <Calendar className="size-5 text-zinc-500" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">No Contests Scheduled</h3>
              <p className="max-w-xs text-xs text-zinc-500">Upcoming tournaments will appear here. Practice problem sets in the archive in the meantime.</p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="text-xs"><Link to="/portal/problems">Problem Archive</Link></Button>
              <Button asChild variant="ghost" size="sm" className="text-xs"><Link to="/portal/leaderboard">Leaderboard</Link></Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-1">

            {/* ── WEEKLY FEATURED CARD ── */}
            {upcomingWeekly && (
              <div className="group relative overflow-hidden rounded-lg border border-white/8 bg-black p-6 transition-colors hover:border-white/20">
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-lime-400/25 bg-lime-400/8 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-lime-400">
                        WEEKLY CONTEST
                      </span>
                      <span className="font-mono text-xs text-zinc-500">#{upcomingWeekly.edition ?? "--"}</span>
                    </div>
                    <span className="flex items-center gap-1.5 font-mono text-xs tabular-nums text-zinc-500">
                      <Users className="size-3.5" />{upcomingWeekly.registered_count} registered
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white transition-colors group-hover:text-lime-400 font-sans">{upcomingWeekly.title}</h3>
                    <p className="mt-1 max-w-2xl text-xs text-zinc-400 leading-normal">
                      {upcomingWeekly.summary || "Algorithmic tournament for Medi-Caps cadets. 4 challenges covering algorithms and data structures."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-5 text-xs text-zinc-400 font-mono">
                    <span className="flex items-center gap-1.5 text-zinc-300">
                      <Calendar className="size-3.5 text-lime-400" />
                      {new Date(upcomingWeekly.starts_at).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="flex items-center gap-1.5"><Clock className="size-3" /> 90 Mins</span>
                    <span className="flex items-center gap-1.5"><Code2 className="size-3" /> {upcomingWeekly.problem_count || 4} Problems</span>
                    <span className="flex items-center gap-1.5 text-lime-400"><TrendingUp className="size-3" /> Rating Rated</span>
                  </div>
                  <div className="max-w-md">
                    <CountdownDisplay days={weeklyCountdown.days} hours={weeklyCountdown.hours} minutes={weeklyCountdown.minutes} seconds={weeklyCountdown.seconds} accentSec />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    {upcomingWeekly.status === "live" ? (
                      <>
                        <Button asChild className="text-xs font-mono font-semibold uppercase tracking-wider bg-lime-400 text-black hover:bg-lime-300 px-6 py-2 rounded-md shadow-lg shadow-lime-400/20">
                          <Link to={`/portal/contests/${upcomingWeekly.slug}/arena`}>
                            <Play className="mr-1.5 size-4 fill-black" /> Enter Contest Arena
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm" className="text-xs">
                          <Link to={`/portal/contests/${upcomingWeekly.slug}`}>Contest Details</Link>
                        </Button>
                      </>
                    ) : isWeeklyRegistered ? (
                      <>
                        <div className="flex items-center gap-2 rounded-md border border-lime-400/30 bg-lime-400/8 px-3.5 py-2 text-xs font-mono text-lime-400">
                          <CheckCircle2 className="size-4 text-lime-400" />
                          <span>Registered · Contest Opens at Start Time</span>
                        </div>
                        <Button asChild variant="outline" size="sm" className="text-xs font-mono border-white/8">
                          <Link to={`/portal/contests/${upcomingWeekly.slug}`}>Contest Details</Link>
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          onClick={() => handleRegister(upcomingWeekly.slug)}
                          disabled={registeringSlug === upcomingWeekly.slug}
                          className="text-xs font-mono font-semibold uppercase tracking-wider bg-lime-400 text-black hover:bg-lime-300 px-6 py-2 rounded-md cursor-pointer"
                        >
                          {registeringSlug === upcomingWeekly.slug ? "Registering..." : "Register for Contest"}
                        </Button>
                        <Button asChild variant="outline" size="sm" className="text-xs">
                          <Link to={`/portal/contests/${upcomingWeekly.slug}`}>Contest Details</Link>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── OTHER UPCOMING ── */}
            {otherUpcomingContests.map((contest) => {
              const isReg = Boolean(contest.registered || myParticipations.some((p) => p.contest_slug === contest.slug));
              const isLive = contest.status === "live";
              return (
                <div key={contest.slug} className="group relative overflow-hidden rounded-lg border border-white/8 bg-black p-5 transition-colors hover:border-white/20">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="rounded border border-white/10 bg-black px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-zinc-400">{contest.cadence}</span>
                      <span className="flex items-center gap-1 font-mono text-xs tabular-nums text-zinc-500"><Users className="size-3.5" /> {contest.registered_count}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white transition-colors group-hover:text-lime-400 font-sans">{contest.title}</h3>
                      <p className="mt-1 font-mono text-xs text-zinc-500">
                        {new Date(contest.starts_at).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      {isLive ? (
                        <Button asChild className="flex-1 bg-lime-400 text-xs font-mono font-semibold uppercase text-black hover:bg-lime-300">
                          <Link to={`/portal/contests/${contest.slug}/arena`}>
                            <Play className="mr-1.5 size-4 fill-black" /> Enter Arena
                          </Link>
                        </Button>
                      ) : isReg ? (
                        <Button asChild variant="outline" className="flex-1 text-xs text-lime-400 border-lime-400/30">
                          <Link to={`/portal/contests/${contest.slug}`}><CheckCircle2 className="mr-1.5 size-3.5" /> Registered</Link>
                        </Button>
                      ) : (
                        <Button onClick={() => handleRegister(contest.slug)} disabled={registeringSlug === contest.slug}
                          className="flex-1 text-xs font-mono font-semibold uppercase bg-lime-400 text-black hover:bg-lime-300 cursor-pointer">
                          {registeringSlug === contest.slug ? "Registering..." : "Register Now"}
                        </Button>
                      )}
                      <Button asChild variant="outline" size="sm" className="text-xs"><Link to={`/portal/contests/${contest.slug}`}>Details</Link></Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── PAST CONTESTS + SIDEBAR ─────────────────── */}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">

        {/* Left: Tabbed list */}
        <div className="space-y-5">
          {/* Tab header */}
          <div className="flex items-center justify-between border-b border-white/8">
            <div className="flex">
              {[
                { key: "past", label: "Past Contests", count: pastContests.length },
                { key: "my-contests", label: "My History", count: myParticipations.length },
              ].map(({ key, label, count }) => (
                <button key={key} onClick={() => setSearchParams({ tab: key })}
                  className={`-mb-px flex items-center gap-2 border-b-2 px-5 pb-3 pt-1 text-xs font-mono font-semibold uppercase tracking-wider transition-colors ${
                    activeTab === key ? "border-lime-400 text-white" : "border-transparent text-zinc-500 hover:text-white"
                  }`}>
                  {label}
                  <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${activeTab === key ? "bg-lime-400 text-black font-bold" : "bg-black text-zinc-500 border border-white/10"}`}>
                    {count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* PAST CONTESTS TAB */}
          {activeTab === "past" && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                <Input placeholder="Search by title or edition number..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-md border-white/10 bg-black pl-9 text-xs text-white placeholder:text-zinc-600" />
              </div>
              <div className="overflow-hidden rounded-lg border border-white/8 bg-black divide-y divide-white/6">
                {isLoading && pastContests.length === 0 ? (
                  [1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between gap-4 p-5">
                      <div className="flex-1 space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-5 w-3/4" /><Skeleton className="h-3 w-40" /></div>
                      <div className="flex gap-2"><Skeleton className="h-8 w-24" /><Skeleton className="h-8 w-20" /></div>
                    </div>
                  ))
                ) : filteredPastContests.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-center">
                    <Trophy className="size-6 text-zinc-600" />
                    <p className="text-sm font-semibold text-white font-sans">No contests found</p>
                    <p className="text-xs text-zinc-500">Try adjusting your search query.</p>
                  </div>
                ) : (
                  filteredPastContests.map((contest) => (
                    <article key={contest.slug}
                      className="group flex flex-col gap-4 p-4 transition-colors hover:bg-zinc-950 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded border border-lime-400/25 bg-lime-400/8 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-lime-400">
                            WEEKLY
                          </span>
                          <span className="font-mono text-xs text-zinc-500">#{contest.edition ?? "--"}</span>
                          <span className="text-zinc-700">·</span>
                          <span className="font-mono text-xs text-zinc-500">
                            {new Date(contest.starts_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                        <h3 className="truncate font-semibold text-white transition-colors group-hover:text-lime-400 font-sans">
                          <Link to={`/portal/contests/${contest.slug}`}>{contest.title}</Link>
                        </h3>
                        <div className="flex items-center gap-4 font-mono text-xs text-zinc-500">
                          <span className="flex items-center gap-1"><Clock className="size-3" /> 2 Hrs</span>
                          <span className="flex items-center gap-1"><Users className="size-3" /> {contest.registered_count}</span>
                          <span className="flex items-center gap-1"><Code2 className="size-3" /> 4 Problems</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button asChild size="sm" variant="outline" className="text-xs"><Link to={`/portal/contests/${contest.slug}`}>Overview</Link></Button>
                        <Button asChild size="sm" variant="outline" className="text-xs"><Link to={`/portal/contests/${contest.slug}/final-results`}>Scoreboard</Link></Button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          )}

          {/* MY CONTESTS TAB */}
          {activeTab === "my-contests" && (
            <div className="overflow-hidden rounded-lg border border-white/8 bg-black divide-y divide-white/6">
              {isLoadingParticipations ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between gap-4 p-5">
                    <div className="flex-1 space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-5 w-2/3" /><Skeleton className="h-3 w-32" /></div>
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))
              ) : myParticipations.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <Trophy className="size-8 text-zinc-600" />
                  <h4 className="font-semibold text-white font-sans">No contest history yet</h4>
                  <p className="max-w-xs text-xs text-zinc-500">Register for an upcoming contest to build your competitive programming ledger.</p>
                  {upcomingContests.length > 0 && (
                    <Button onClick={() => handleRegister(upcomingContests[0].slug)} disabled={registeringSlug === upcomingContests[0].slug}
                      className="mt-2 text-xs font-mono font-semibold uppercase bg-lime-400 text-black hover:bg-lime-300">
                      {registeringSlug === upcomingContests[0].slug ? "Registering..." : `Register for ${upcomingContests[0].title}`}
                    </Button>
                  )}
                </div>
              ) : (
                myParticipations.map((record) => (
                  <article key={record.contest_slug} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-zinc-950 transition-colors">
                    <div className="space-y-1 min-w-0">
                      <h4 className="font-semibold text-white font-sans truncate">{record.contest_title || record.contest_slug}</h4>
                      <div className="flex items-center gap-3 font-mono text-xs text-zinc-500">
                        <span>Rank #{record.rank || "--"}</span>
                        <span>·</span>
                        <span>{record.score || 0} Points</span>
                        <span>·</span>
                        <span className="text-lime-400">{record.rating_change ? (record.rating_change > 0 ? `+${record.rating_change}` : record.rating_change) : "--"} Elo</span>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline" className="text-xs shrink-0">
                      <Link to={`/portal/contests/${record.contest_slug}`}>View Summary</Link>
                    </Button>
                  </article>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <aside className="space-y-5">
          {/* Top Rankers */}
          <div className="overflow-hidden rounded-lg border border-white/8 bg-black">
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
              <div className="flex items-center gap-2">
                <Trophy className="size-4 text-lime-400" />
                <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-white">Top Rankers</h3>
              </div>
              <Link to="/portal/leaderboard" className="flex items-center gap-1 font-mono text-[11px] font-semibold text-lime-400 hover:underline">
                Full <ExternalLink className="size-3" />
              </Link>
            </div>
            <div className="divide-y divide-white/6">
              {leaders.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500">No ranked cadets yet.</p>
              ) : leaders.slice(0, 7).map((leader, index) => {
                const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null;
                return (
                  <div key={leader.handle} className={`flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-zinc-950 ${index === 0 ? "bg-lime-400/5" : ""}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-5 text-center font-mono text-xs">{medal || <span className="text-zinc-600">{index + 1}</span>}</div>
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black font-mono text-[9px] font-bold text-lime-400">
                        {leader.handle.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">{leader.handle}</p>
                        <p className="truncate font-mono text-[10px] text-zinc-500">{leader.department} · {leader.tier}</p>
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-lime-400">{leader.rating}</span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-white/8 bg-black p-3 text-center">
              <Link to="/portal/leaderboard" className="flex items-center justify-center gap-1.5 text-xs font-medium text-white transition-colors hover:text-lime-400 font-mono">
                University Standings <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>

          {/* Tournament Protocol */}
          <div className="rounded-lg border border-white/8 bg-black p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-lime-400" />
              <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-white">Arena Protocol</h3>
            </div>
            <div className="space-y-2.5">
              {[
                { n: "01", title: "Automated Evaluation", desc: "Testcase verification via sovereign CodeBox sandbox." },
                { n: "02", title: "Integrity Telemetry", desc: "Tab blur and switch event monitoring during assessment." },
                { n: "03", title: "Single Session Lock", desc: "Concurrent logins during active rounds are rejected." },
                { n: "04", title: "Elo Rating Impact", desc: "Official scores calculated and published immediately." },
              ].map(({ n, title, desc }) => (
                <div key={n} className="flex gap-2.5">
                  <span className="font-mono text-xs font-bold text-lime-400 shrink-0">{n}</span>
                  <div>
                    <strong className="block text-xs text-white font-sans">{title}</strong>
                    <span className="text-[11px] text-zinc-500 leading-normal">{desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
