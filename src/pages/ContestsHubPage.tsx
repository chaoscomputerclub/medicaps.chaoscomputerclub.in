import { useState, useEffect, useMemo } from "react";
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
  ChevronRight,
  Lock,
  Play,
  Award,
  Zap,
  QrCode,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContestsThunk, registerContestThunk } from "@/store/slices/contestSlice";
import { contestApi } from "@/features/contest/api";
import type { ContestSummary, ParticipationRecord } from "@/features/contest/types";
import { getUniversityLeaderboardData } from "@/organization/data/portal.functions";
import type { LeaderboardEntry } from "@/organization/data/types";
import { AssessmentConfirmModal } from "@/organization/components/AssessmentConfirmModal";
import { ContestsHubSkeleton, Skeleton } from "@/organization/components/skeletons";
import { toast } from "sonner";

// High-precision ticking countdown hook
function useCountdown(targetIsoDate: string | null | undefined) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
    totalSeconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, totalSeconds: 0 });

  useEffect(() => {
    if (!targetIsoDate) return;

    const calc = () => {
      const target = new Date(targetIsoDate).getTime();
      const now = Date.now();
      const diff = Math.max(0, target - now);
      const totalSeconds = Math.floor(diff / 1000);

      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setTimeLeft({
        days,
        hours,
        minutes,
        seconds,
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

export function ContestsHubPage() {
  const dispatch = useAppDispatch();
  const { contests, isLoading } = useAppSelector((state) => state.contest);
  const member = useAppSelector((state) => state.auth.member);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "past"; // "past" | "my-contests"
  const [searchQuery, setSearchQuery] = useState("");
  const [cadenceFilter, setCadenceFilter] = useState<"all" | "weekly" | "biweekly">("all");
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [myParticipations, setMyParticipations] = useState<ParticipationRecord[]>([]);
  const [isLoadingParticipations, setIsLoadingParticipations] = useState(false);
  const [registeringSlug, setRegisteringSlug] = useState<string | null>(null);
  const [assessmentConfirmOpen, setAssessmentConfirmOpen] = useState(false);
  const [confirmContestSlug, setConfirmContestSlug] = useState("");
  const [confirmContestTitle, setConfirmContestTitle] = useState("");

  useEffect(() => {
    dispatch(fetchContestsThunk());
    getUniversityLeaderboardData().then((res) => setLeaders(res || []));

    if (member) {
      setIsLoadingParticipations(true);
      contestApi
        .participated()
        .then((res: ParticipationRecord[]) => setMyParticipations(res || []))
        .catch(() => {})
        .finally(() => setIsLoadingParticipations(false));
    }
  }, [dispatch, member]);

  // Separate upcoming and past contests
  const upcomingContests = useMemo(() => {
    return contests
      .filter((c) => c.status !== "finished")
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [contests]);

  const pastContests = useMemo(() => {
    return contests
      .filter((c) => c.status === "finished")
      .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
  }, [contests]);

  // Upcoming Weekly Contest (Hero Card 1)
  const upcomingWeekly = useMemo(() => {
    return upcomingContests.find((c) => c.cadence === "weekly") || null;
  }, [upcomingContests]);

  // Upcoming Biweekly Contest (Hero Card 2)
  const upcomingBiweekly = useMemo(() => {
    return upcomingContests.find((c) => c.cadence === "biweekly") || null;
  }, [upcomingContests]);

  // Other upcoming contests
  const otherUpcomingContests = useMemo(() => {
    return upcomingContests.filter((c) => c !== upcomingWeekly && c !== upcomingBiweekly);
  }, [upcomingContests, upcomingWeekly, upcomingBiweekly]);

  // Timers for the hero cards
  const weeklyCountdown = useCountdown(upcomingWeekly?.starts_at);
  const biweeklyCountdown = useCountdown(upcomingBiweekly?.starts_at);

  const isWeeklyRegistered = useMemo(() => {
    if (!upcomingWeekly) return false;
    return Boolean(upcomingWeekly.registered || myParticipations.some((p) => p.contest_slug === upcomingWeekly.slug));
  }, [upcomingWeekly, myParticipations]);

  const isBiweeklyRegistered = useMemo(() => {
    if (!upcomingBiweekly) return false;
    return Boolean(upcomingBiweekly.registered || myParticipations.some((p) => p.contest_slug === upcomingBiweekly.slug));
  }, [upcomingBiweekly, myParticipations]);

  // Check if user is registered for either upcoming contest or has an active assessment
  const registeredUpcomingContest = useMemo(() => {
    return upcomingContests.find((c) => c.registered || myParticipations.some((p) => p.contest_slug === c.slug));
  }, [upcomingContests, myParticipations]);

  // The active/next assessment for the user
  const assessmentInfo = useMemo(() => {
    const contest = registeredUpcomingContest || upcomingWeekly || upcomingBiweekly || upcomingContests[0];
    if (!contest) return null;

    const contestStart = new Date(contest.starts_at).getTime();
    const assessOpen = contestStart - 24 * 3600 * 1000;
    const now = Date.now();

    const isOpen = now >= assessOpen && now <= contestStart;
    const isUpcoming = now < assessOpen;
    const isClosed = now > contestStart;

    // Check if user has taken assessment
    const record = myParticipations.find((p) => p.contest_slug === contest.slug);
    const hasTaken = record?.score !== null && record?.score !== undefined;
    const isTop30 = record?.outcome === "qualified" || (record?.rank !== null && (record?.rank ?? 99) <= 30);

    return {
      contest,
      contestStart,
      assessOpen,
      isOpen,
      isUpcoming,
      isClosed,
      hasTaken,
      score: record?.score,
      rank: record?.rank,
      isTop30,
      openDateFormatted: new Date(assessOpen).toLocaleString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  }, [registeredUpcomingContest, upcomingWeekly, upcomingBiweekly, upcomingContests, myParticipations]);

  const assessmentUnlockTimer = useCountdown(
    assessmentInfo && assessmentInfo.isUpcoming ? new Date(assessmentInfo.assessOpen).toISOString() : null
  );

  const assessmentRemainingTimer = useCountdown(
    assessmentInfo && assessmentInfo.isOpen ? new Date(assessmentInfo.contestStart).toISOString() : null
  );

  // Filtered past contests for the list
  const filteredPastContests = useMemo(() => {
    return pastContests.filter((c) => {
      const matchesQuery =
        searchQuery === "" ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(c.edition ?? "").includes(searchQuery);

      const matchesCadence = cadenceFilter === "all" || c.cadence === cadenceFilter;

      return matchesQuery && matchesCadence;
    });
  }, [pastContests, searchQuery, cadenceFilter]);

  const handleRegister = async (slug: string) => {
    if (!member) {
      toast.error("Please login to register for contests.");
      return;
    }
    try {
      setRegisteringSlug(slug);
      await dispatch(registerContestThunk(slug)).unwrap();
      toast.success("Successfully registered! Phase 1 online screening will unlock 24h prior to the contest.");
      dispatch(fetchContestsThunk());
      contestApi.participated().then((res: ParticipationRecord[]) => setMyParticipations(res || []));
    } catch (err: any) {
      toast.error(err || "Failed to register for contest");
    } finally {
      setRegisteringSlug(null);
    }
  };

  if (isLoading && contests.length === 0) {
    return <ContestsHubSkeleton />;
  }

  return (
    <div className="page-wrap space-y-8">
      {/* ─── Top Header Lockup ────────────────────────────────────── */}
      <header className="page-header">
        <div>
          <p className="kicker">CCC COMPETITIVE ARENA · LEETCODE ARCHITECTURE</p>
          <h1>Contest Hub.</h1>
          <p>
            Biweekly and Weekly algorithmic challenges for Medi-Caps cadets. Top 30 qualifiers from the 24-hour online
            screening advance to the physical air-gapped lab final.
          </p>
        </div>

        <div className="ranking-meta">
          <span>ARENA PROTOCOL</span>
          <strong>SEASON 2026</strong>
          <small>Air-Gapped Finals Enabled</small>
        </div>
      </header>

      {/* ─── Section 1: LeetCode-Style Upcoming Contests ───────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-wider text-foreground">
            <Sparkles className="size-4 text-primary" /> Upcoming Contests
          </h2>
          <span className="font-mono text-xs text-muted-foreground">Real-time Registration & Clocks</span>
        </div>

        {upcomingContests.length === 0 ? (
          <div className="relative overflow-hidden border border-border bg-card p-8 text-center space-y-4 shadow-sm">
            <div className="mx-auto flex size-12 items-center justify-center rounded-none bg-primary/10 border border-primary/30">
              <Calendar className="size-6 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground font-mono uppercase tracking-tight">
                No Scheduled Contests Currently
              </h3>
              <p className="max-w-md mx-auto text-xs text-muted-foreground">
                Official contests are announced ahead of the live screening rounds. Practice past problem sets or check standings in the university leaderboard.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <Button asChild variant="outline" className="rounded-none font-mono text-xs">
                <Link to="/portal/problems">Explore Problem Archive</Link>
              </Button>
              <Button asChild variant="ghost" className="rounded-none font-mono text-xs">
                <Link to="/portal/leaderboard">View Leaderboard</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Card 1: Weekly Contest if present */}
            {upcomingWeekly && (
              <div className="group relative flex flex-col justify-between overflow-hidden rounded-none border border-border bg-card p-6 shadow-md transition-all hover:border-primary/50 hover:shadow-primary/5">
                <div className="absolute right-0 top-0 h-28 w-28 -translate-y-8 translate-x-8 rounded-full bg-primary/5 blur-2xl group-hover:bg-primary/10 transition-colors" />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="rounded-none border-primary/40 bg-primary/10 font-mono text-[11px] font-bold text-primary">
                        WEEKLY
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">#{upcomingWeekly.edition ?? "--"}</span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="size-3.5" /> {upcomingWeekly.registered_count} Registered
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                      {upcomingWeekly.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {upcomingWeekly.summary || "Sunday morning algorithmic showdown for Medi-Caps cadets."}
                    </p>
                  </div>

                  {/* Timing & Clock */}
                  <div className="rounded-none border border-border/80 bg-background/60 p-4">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2 text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="size-3.5 text-primary" /> Starts At
                      </span>
                      <span className="font-mono font-medium text-foreground">
                        {new Date(upcomingWeekly.starts_at).toLocaleString("en-IN", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="pt-3">
                      <div className="flex items-baseline justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          Contest Countdown
                        </span>
                        <span className="font-mono text-[11px] text-primary">Live Ticking</span>
                      </div>

                      <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                        <div className="rounded-none border border-border bg-card/90 py-1.5">
                          <div className="font-mono text-lg font-black text-foreground">
                            {String(weeklyCountdown.days).padStart(2, "0")}
                          </div>
                          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Days</div>
                        </div>
                        <div className="rounded-none border border-border bg-card/90 py-1.5">
                          <div className="font-mono text-lg font-black text-foreground">
                            {String(weeklyCountdown.hours).padStart(2, "0")}
                          </div>
                          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Hours</div>
                        </div>
                        <div className="rounded-none border border-border bg-card/90 py-1.5">
                          <div className="font-mono text-lg font-black text-foreground">
                            {String(weeklyCountdown.minutes).padStart(2, "0")}
                          </div>
                          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Mins</div>
                        </div>
                        <div className="rounded-none border border-border bg-card/90 py-1.5">
                          <div className="font-mono text-lg font-black text-primary">
                            {String(weeklyCountdown.seconds).padStart(2, "0")}
                          </div>
                          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Secs</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="size-3.5" /> 2 Hours</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Code2 className="size-3.5" /> {upcomingWeekly.problem_count || 4} Problems</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Award className="size-3.5" /> Rating Change</span>
                  </div>
                </div>

                {/* Registration CTA */}
                <div className="mt-6 flex items-center gap-3">
                  {isWeeklyRegistered ? (
                    <div className="flex w-full items-center gap-2">
                      <Button
                        onClick={() => {
                          setConfirmContestSlug(upcomingWeekly.slug);
                          setConfirmContestTitle(upcomingWeekly.title);
                          setAssessmentConfirmOpen(true);
                        }}
                        className="flex-1 rounded-none bg-[var(--accent)] font-mono text-xs font-bold uppercase tracking-wider text-black hover:bg-[var(--accent)]/90"
                      >
                        <Play className="mr-1.5 size-4 fill-black" /> TAKE ASSESSMENT
                      </Button>
                      <Button asChild variant="outline" className="rounded-none font-mono text-xs">
                        <Link to={`/portal/contests/${upcomingWeekly.slug}`}>DETAILS</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex w-full items-center gap-2">
                      <Button
                        onClick={() => handleRegister(upcomingWeekly.slug)}
                        disabled={registeringSlug === upcomingWeekly.slug}
                        className="flex-1 rounded-none font-mono text-xs font-bold uppercase tracking-wider"
                      >
                        {registeringSlug === upcomingWeekly.slug ? "REGISTERING..." : "REGISTER NOW"}
                      </Button>
                      <Button asChild variant="outline" className="rounded-none font-mono text-xs">
                        <Link to={`/portal/contests/${upcomingWeekly.slug}`}>DETAILS</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Card 2: Biweekly Contest if present */}
            {upcomingBiweekly && (
              <div className="group relative flex flex-col justify-between overflow-hidden rounded-none border border-border bg-card p-6 shadow-md transition-all hover:border-cyan-500/50 hover:shadow-cyan-500/5">
                <div className="absolute right-0 top-0 h-28 w-28 -translate-y-8 translate-x-8 rounded-full bg-cyan-500/5 blur-2xl group-hover:bg-cyan-500/10 transition-colors" />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="rounded-none border-cyan-500/40 bg-cyan-500/10 font-mono text-[11px] font-bold text-cyan-400">
                        BIWEEKLY
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">#{upcomingBiweekly.edition ?? "--"}</span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="size-3.5" /> {upcomingBiweekly.registered_count} Registered
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-foreground transition-colors group-hover:text-cyan-400">
                      {upcomingBiweekly.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {upcomingBiweekly.summary || "Saturday night algorithmic clash. Air-gapped campus final for Top 30."}
                    </p>
                  </div>

                  {/* Timing & Clock */}
                  <div className="rounded-none border border-border/80 bg-background/60 p-4">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2 text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="size-3.5 text-cyan-400" /> Starts At
                      </span>
                      <span className="font-mono font-medium text-foreground">
                        {new Date(upcomingBiweekly.starts_at).toLocaleString("en-IN", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="pt-3">
                      <div className="flex items-baseline justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          Contest Countdown
                        </span>
                        <span className="font-mono text-[11px] text-cyan-400">Live Ticking</span>
                      </div>

                      <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                        <div className="rounded-none border border-border bg-card/90 py-1.5">
                          <div className="font-mono text-lg font-black text-foreground">
                            {String(biweeklyCountdown.days).padStart(2, "0")}
                          </div>
                          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Days</div>
                        </div>
                        <div className="rounded-none border border-border bg-card/90 py-1.5">
                          <div className="font-mono text-lg font-black text-foreground">
                            {String(biweeklyCountdown.hours).padStart(2, "0")}
                          </div>
                          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Hours</div>
                        </div>
                        <div className="rounded-none border border-border bg-card/90 py-1.5">
                          <div className="font-mono text-lg font-black text-foreground">
                            {String(biweeklyCountdown.minutes).padStart(2, "0")}
                          </div>
                          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Mins</div>
                        </div>
                        <div className="rounded-none border border-border bg-card/90 py-1.5">
                          <div className="font-mono text-lg font-black text-cyan-400">
                            {String(biweeklyCountdown.seconds).padStart(2, "0")}
                          </div>
                          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Secs</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="size-3.5" /> 2 Hours</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Code2 className="size-3.5" /> {upcomingBiweekly.problem_count || 4} Problems</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Award className="size-3.5" /> Rating Change</span>
                  </div>
                </div>

                {/* Registration CTA */}
                <div className="mt-6 flex items-center gap-3">
                  {isBiweeklyRegistered ? (
                    <div className="flex w-full items-center gap-2">
                      <Button
                        onClick={() => {
                          setConfirmContestSlug(upcomingBiweekly.slug);
                          setConfirmContestTitle(upcomingBiweekly.title);
                          setAssessmentConfirmOpen(true);
                        }}
                        className="flex-1 rounded-none bg-cyan-400 font-mono text-xs font-bold uppercase tracking-wider text-black hover:bg-cyan-300"
                      >
                        <Play className="mr-1.5 size-4 fill-black" /> TAKE ASSESSMENT
                      </Button>
                      <Button asChild variant="outline" className="rounded-none font-mono text-xs">
                        <Link to={`/portal/contests/${upcomingBiweekly.slug}`}>DETAILS</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex w-full items-center gap-2">
                      <Button
                        onClick={() => handleRegister(upcomingBiweekly.slug)}
                        disabled={registeringSlug === upcomingBiweekly.slug}
                        className="flex-1 rounded-none bg-cyan-500 font-mono text-xs font-bold uppercase tracking-wider text-black hover:bg-cyan-400"
                      >
                        {registeringSlug === upcomingBiweekly.slug ? "REGISTERING..." : "REGISTER NOW"}
                      </Button>
                      <Button asChild variant="outline" className="rounded-none font-mono text-xs">
                        <Link to={`/portal/contests/${upcomingBiweekly.slug}`}>DETAILS</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Other upcoming contests */}
            {otherUpcomingContests.map((contest) => (
              <div
                key={contest.slug}
                className="group relative flex flex-col justify-between overflow-hidden rounded-none border border-border bg-card p-6 shadow-md transition-all hover:border-primary/50"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="rounded-none font-mono text-[11px] font-bold uppercase">
                      {contest.cadence}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="size-3.5" /> {contest.registered_count} Registered
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                      {contest.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {contest.summary}
                    </p>
                  </div>

                  <div className="rounded-none border border-border/80 bg-background/60 p-4 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="size-3.5 text-primary" /> Starts At
                    </span>
                    <span className="font-mono font-medium text-foreground">
                      {new Date(contest.starts_at).toLocaleString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <Button
                    onClick={() => handleRegister(contest.slug)}
                    disabled={registeringSlug === contest.slug || contest.registered}
                    className="flex-1 rounded-none font-mono text-xs font-bold uppercase"
                  >
                    {contest.registered ? "REGISTERED" : "REGISTER NOW"}
                  </Button>
                  <Button asChild variant="outline" className="rounded-none font-mono text-xs">
                    <Link to={`/portal/contests/${contest.slug}`}>DETAILS</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Section 2: Dedicated Online Assessment Screening Layer ───── */}
      <section className="relative overflow-hidden rounded-none border-2 border-primary/40 bg-card p-6 shadow-xl">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-none bg-primary/20 px-2.5 py-0.5 font-mono text-[11px] font-bold text-primary">
                <Zap className="size-3.5" /> PHASE 1 ONLINE SCREENING LAYER
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                Strict 24-Hour Window Prior to Contest
              </span>
            </div>

            <div>
              <h3 className="text-xl font-bold text-foreground">
                {assessmentInfo?.hasTaken
                  ? "Screening Assessment Attempt Completed"
                  : assessmentInfo?.isOpen
                    ? "Phase 1 Online Screening Assessment is LIVE"
                    : assessmentInfo?.isUpcoming
                      ? "Screening Assessment Unlocks 24h Before Contest"
                      : "Campus Online Screening Layer"}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                All registered cadets take an online 2-hour proctored assessment in our browser sandbox.
                The <strong>Top 30 verified scorers</strong> advance to the physical on-premise air-gapped lab final and receive an authorized Campus QR Pass.
              </p>
            </div>

            {/* Screening details chip grid */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 font-mono text-[11px]">
              <div className="border border-border/80 bg-background/50 p-2">
                <span className="text-muted-foreground block text-[9px] uppercase">Duration</span>
                <strong className="text-foreground">120 Minutes</strong>
              </div>
              <div className="border border-border/80 bg-background/50 p-2">
                <span className="text-muted-foreground block text-[9px] uppercase">Qualification</span>
                <strong className="text-primary">Top 30 Cadets</strong>
              </div>
              <div className="border border-border/80 bg-background/50 p-2">
                <span className="text-muted-foreground block text-[9px] uppercase">Proctoring</span>
                <strong className="text-foreground">Automated Telemetry</strong>
              </div>
              <div className="border border-border/80 bg-background/50 p-2">
                <span className="text-muted-foreground block text-[9px] uppercase">Pass Required</span>
                <strong className="text-primary">Air-Gapped Lab QR</strong>
              </div>
            </div>
          </div>

          {/* Dynamic Assessment Action Box */}
          <div className="flex flex-col items-start gap-4 rounded-none border border-border bg-background/80 p-5 lg:min-w-[340px] lg:items-end">
            {!assessmentInfo ? (
              <div className="w-full space-y-3 text-center">
                <p className="text-xs text-muted-foreground">
                  No active screening window currently open.
                </p>
                <Button asChild variant="outline" className="w-full rounded-none font-mono text-xs">
                  <Link to="/portal/problems">Explore Practice Problems</Link>
                </Button>
              </div>
            ) : assessmentInfo.hasTaken ? (
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="font-mono text-xs text-muted-foreground">Your Score</span>
                  <span className="font-mono text-lg font-black text-primary">{assessmentInfo.score ?? 0} pts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">Standing</span>
                  <span className="font-mono text-sm font-bold text-foreground">
                    {assessmentInfo.rank ? `Rank #${assessmentInfo.rank}` : "Score Recorded"}
                  </span>
                </div>
                {assessmentInfo.isTop30 ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                      <CheckCircle2 className="size-4" /> QUALIFIED FOR LAB FINAL
                    </div>
                    <Button asChild className="w-full rounded-none font-mono text-xs font-bold">
                      <Link to={`/portal/contests/${assessmentInfo.contest.slug}/qualified`}>
                        <QrCode className="mr-1.5 size-4" /> VIEW CAMPUS PASS
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <Button asChild variant="outline" className="w-full rounded-none font-mono text-xs">
                    <Link to={`/portal/contests/${assessmentInfo.contest.slug}`}>
                      VIEW FINAL RESULTS
                    </Link>
                  </Button>
                )}
              </div>
            ) : registeredUpcomingContest || isWeeklyRegistered || isBiweeklyRegistered ? (
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-emerald-400">
                    <CheckCircle2 className="size-4" /> REGISTRATION ACTIVE
                  </span>
                  <span className="font-mono text-xs text-primary font-bold">120 MIN ATTEMPT</span>
                </div>
                <Button
                  onClick={() => {
                    setConfirmContestSlug(assessmentInfo.contest.slug);
                    setConfirmContestTitle(assessmentInfo.contest.title);
                    setAssessmentConfirmOpen(true);
                  }}
                  className="w-full rounded-none bg-[var(--accent)] font-mono text-xs font-black uppercase text-black hover:bg-[var(--accent)]/90 shadow-md"
                >
                  <Play className="mr-1.5 size-4 fill-black" /> TAKE ASSESSMENT NOW
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Full-screen distraction-free IDE with live testcase execution.
                </p>
              </div>
            ) : assessmentInfo.isOpen ? (
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-red-400 animate-pulse">
                    <AlertCircle className="size-4" /> WINDOW CLOSES IN
                  </span>
                  <span className="font-mono text-sm font-bold text-foreground">
                    {String(assessmentRemainingTimer.hours).padStart(2, "0")}:
                    {String(assessmentRemainingTimer.minutes).padStart(2, "0")}:
                    {String(assessmentRemainingTimer.seconds).padStart(2, "0")}
                  </span>
                </div>
                <Button asChild className="w-full rounded-none bg-primary font-mono text-xs font-black uppercase text-black hover:bg-primary/90">
                  <Link to={`/assessments/${assessmentInfo.contest.slug}`}>
                    <Play className="mr-1.5 size-4 fill-black" /> TAKE ASSESSMENT
                  </Link>
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Full-screen anti-cheat & Monaco editor active upon entry.
                </p>
              </div>
            ) : assessmentInfo.isUpcoming ? (
              <div className="w-full space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Unlocks In
                    </span>
                    <span className="font-mono text-xs text-primary font-bold">
                      {String(assessmentUnlockTimer.days > 0 ? `${assessmentUnlockTimer.days}d ` : "")}
                      {String(assessmentUnlockTimer.hours).padStart(2, "0")}:
                      {String(assessmentUnlockTimer.minutes).padStart(2, "0")}:
                      {String(assessmentUnlockTimer.seconds).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    Opens: {assessmentInfo.openDateFormatted}
                  </p>
                </div>
                <Button
                  onClick={() => handleRegister(assessmentInfo.contest.slug)}
                  disabled={registeringSlug === assessmentInfo.contest.slug}
                  className="w-full rounded-none font-mono text-xs font-bold uppercase tracking-wider"
                >
                  <Sparkles className="mr-1.5 size-3.5" /> REGISTER TO UNLOCK
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Register now to immediately unlock Phase 1 assessment.
                </p>
              </div>
            ) : (
              <div className="w-full space-y-3 text-center">
                <p className="text-xs text-muted-foreground">
                  Register for an upcoming contest to enter the screening pipeline.
                </p>
                <Button
                  onClick={() => handleRegister(assessmentInfo.contest.slug)}
                  disabled={registeringSlug === assessmentInfo.contest.slug}
                  className="w-full rounded-none font-mono text-xs font-bold uppercase tracking-wider"
                >
                  {registeringSlug === assessmentInfo.contest.slug ? "REGISTERING..." : "REGISTER FOR SCREENING"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── Section 3: Main Split Grid (LeetCode 70% / 30%) ─────────── */}
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Left Column (70%): Past Contests & My Contests Tabs */}
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
            {/* Tab Switcher */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchParams({ tab: "past" })}
                className={`rounded-none px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                  activeTab === "past"
                    ? "border-b-2 border-primary bg-secondary/80 text-foreground"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`}
              >
                Past Contests ({pastContests.length})
              </button>
              <button
                onClick={() => setSearchParams({ tab: "my-contests" })}
                className={`rounded-none px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                  activeTab === "my-contests"
                    ? "border-b-2 border-primary bg-secondary/80 text-foreground"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`}
              >
                My Contests ({myParticipations.length})
              </button>
            </div>

            {/* Filter Pills for Past Contests */}
            {activeTab === "past" && (
              <div className="flex items-center gap-1.5">
                {(["all", "weekly", "biweekly"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setCadenceFilter(mode)}
                    className={`rounded-none px-2.5 py-1 font-mono text-[11px] uppercase transition-colors ${
                      cadenceFilter === mode
                        ? "bg-primary text-black font-bold"
                        : "border border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* TAB 1: Past Contests */}
          {activeTab === "past" && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search contest by title, edition number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-none border-border bg-card pl-9 font-mono text-xs text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {/* Past Contests List */}
              <div className="divide-y divide-border border border-border bg-card">
                {isLoading && pastContests.length === 0 ? (
                  <div className="divide-y divide-border">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-5 flex flex-col sm:flex-row justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-3 w-8" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                          <Skeleton className="h-5 w-3/4" />
                          <div className="flex items-center gap-4 pt-1">
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Skeleton className="h-8 w-28" />
                          <Skeleton className="h-8 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredPastContests.length === 0 ? (
                  <div className="p-12 text-center space-y-2">
                    <Trophy className="mx-auto size-6 text-muted-foreground" />
                    <h4 className="text-sm font-bold text-foreground">No Contests Found</h4>
                    <p className="text-xs text-muted-foreground">Try adjusting your search query or filters.</p>
                  </div>
                ) : (
                  filteredPastContests.map((contest) => (
                    <article
                      key={contest.slug}
                      className="group flex flex-col gap-4 p-5 transition-colors hover:bg-secondary/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`rounded-none font-mono text-[10px] uppercase ${
                              contest.cadence === "weekly"
                                ? "border-primary/40 text-primary"
                                : "border-cyan-500/40 text-cyan-400"
                            }`}
                          >
                            {contest.cadence}
                          </Badge>
                          <span className="font-mono text-xs text-muted-foreground">#{contest.edition ?? "--"}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {new Date(contest.starts_at).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>

                        <h3 className="truncate text-base font-bold text-foreground group-hover:text-primary transition-colors">
                          <Link to={`/portal/contests/${contest.slug}`}>{contest.title}</Link>
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="size-3" /> 2 Hours</span>
                          <span className="flex items-center gap-1"><Users className="size-3" /> {contest.registered_count} Cadets</span>
                          <span className="flex items-center gap-1"><Code2 className="size-3" /> 4 Problems</span>
                        </div>
                      </div>

                      {/* Action Links */}
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button asChild size="sm" variant="outline" className="rounded-none font-mono text-xs">
                          <Link to={`/portal/contests/${contest.slug}`}>
                            Virtual Contest
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline" className="rounded-none font-mono text-xs">
                          <Link to={`/portal/contests/${contest.slug}/final-results`}>
                            Scoreboard
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost" className="rounded-none font-mono text-xs">
                          <Link to="/portal/problems">
                            Editorials <ChevronRight className="ml-1 size-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: My Contests */}
          {activeTab === "my-contests" && (
            <div className="space-y-4">
              <div className="divide-y divide-border border border-border bg-card">
                {isLoadingParticipations ? (
                  <div className="divide-y divide-border">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-5 flex flex-col lg:flex-row justify-between gap-4 lg:items-center">
                        <div className="flex items-start gap-4">
                          <Skeleton className="w-10 h-10 rounded-none shrink-0" />
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Skeleton className="h-4 w-16" />
                              <Skeleton className="h-4 w-28" />
                            </div>
                            <Skeleton className="h-5 w-56" />
                            <div className="flex items-center gap-4 pt-1">
                              <Skeleton className="h-3 w-24" />
                              <Skeleton className="h-3 w-20" />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-5 w-16" />
                          <Skeleton className="h-8 w-28" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : myParticipations.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <Trophy className="mx-auto size-8 text-muted-foreground" />
                    <h4 className="text-base font-bold text-foreground">No Participations Recorded Yet</h4>
                    <p className="max-w-md mx-auto text-xs text-muted-foreground">
                      You haven't attended any contests or screening rounds yet. Register for an upcoming contest to earn your place on the university leaderboard!
                    </p>
                    {upcomingContests.length > 0 ? (
                      <Button
                        onClick={() => handleRegister(upcomingContests[0].slug)}
                        disabled={registeringSlug === upcomingContests[0].slug}
                        className="rounded-none font-mono text-xs font-bold uppercase"
                      >
                        {registeringSlug === upcomingContests[0].slug ? "REGISTERING..." : `Register For ${upcomingContests[0].title}`}
                      </Button>
                    ) : (
                      <Button asChild variant="outline" className="rounded-none font-mono text-xs font-bold uppercase">
                        <Link to="/portal/problems">Explore Problem Archive</Link>
                      </Button>
                    )}
                  </div>
                ) : (
                  myParticipations.map((record) => (
                    <article
                      key={record.contest_slug}
                      className="flex flex-col gap-4 p-5 transition-colors hover:bg-secondary/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`rounded-none font-mono text-[10px] uppercase ${
                              record.outcome === "qualified"
                                ? "border-emerald-500/40 text-emerald-400"
                                : record.status === "upcoming"
                                  ? "border-primary/40 text-primary"
                                  : "border-border text-muted-foreground"
                            }`}
                          >
                            {record.outcome === "qualified" ? "TOP 30 QUALIFIED" : record.outcome}
                          </Badge>
                          <span className="font-mono text-xs text-muted-foreground">
                            {new Date(record.participated_at).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>

                        <h3 className="truncate text-base font-bold text-foreground">
                          {record.contest_title}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
                          {record.score !== null && (
                            <span>Score: <strong className="text-foreground">{record.score}</strong></span>
                          )}
                          {record.rank !== null && (
                            <span>Rank: <strong className="text-primary">#{record.rank}</strong> / {record.participants || 60}</span>
                          )}
                          <span className="text-emerald-400 font-bold">+38 Rating</span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {record.outcome === "qualified" ? (
                          <Button asChild size="sm" className="rounded-none font-mono text-xs font-bold">
                            <Link to={`/portal/contests/${record.contest_slug}/qualified`}>
                              <QrCode className="mr-1.5 size-3.5" /> Campus Pass
                            </Link>
                          </Button>
                        ) : (
                          <Button asChild size="sm" variant="outline" className="rounded-none font-mono text-xs">
                            <Link to={`/portal/contests/${record.contest_slug}`}>
                              Contest Details
                            </Link>
                          </Button>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (30%): Top Rankers Leaderboard & Proctored Rules */}
        <aside className="space-y-6">
          {/* Top Rankers Leaderboard Widget */}
          <div className="overflow-hidden rounded-none border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <Trophy className="size-4 text-primary" />
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                  Top Rankers Podium
                </h3>
              </div>
              <Link
                to="/portal/leaderboard"
                className="font-mono text-[11px] text-primary hover:underline flex items-center gap-1"
              >
                Full Standings <ExternalLink className="size-3" />
              </Link>
            </div>

            <div className="divide-y divide-border">
              {leaders.length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-muted-foreground">
                  No ranked cadets recorded yet.
                </div>
              ) : (
                leaders.slice(0, 7).map((leader, index) => {
                  const isTop3 = index < 3;
                  const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null;

                  return (
                    <div
                      key={leader.handle}
                      className={`flex items-center justify-between p-3.5 transition-colors hover:bg-secondary/40 ${
                        index === 0 ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex w-6 items-center justify-center font-mono text-xs font-bold">
                          {medal || <span className="text-muted-foreground">{index + 1}</span>}
                        </div>

                        <div className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary font-mono text-[11px] font-bold text-foreground">
                          {leader.handle.slice(0, 2).toUpperCase()}
                        </div>

                        <div className="min-w-0 truncate">
                          <p className="truncate text-xs font-bold text-foreground">
                            {leader.handle}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {leader.department} · {leader.tier}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="font-mono text-xs font-black text-primary">
                          {leader.rating}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-border p-3 text-center bg-secondary/20">
              <Link
                to="/portal/leaderboard"
                className="font-mono text-xs font-bold text-foreground hover:text-primary transition-colors flex items-center justify-center gap-1.5"
              >
                View Medi-Caps University Ranking <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>

          {/* Air-Gapped Campus Final Integrity Box */}
          <div className="rounded-none border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                Lab Arena Protocol
              </h3>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex gap-2.5">
                <span className="text-primary font-bold">01</span>
                <div>
                  <strong className="text-foreground block">Air-Gapped Network</strong>
                  <span className="text-muted-foreground text-[11px]">Lab workstations disconnected from public web.</span>
                </div>
              </div>
              <div className="flex gap-2.5">
                <span className="text-primary font-bold">02</span>
                <div>
                  <strong className="text-foreground block">Campus QR Attendance</strong>
                  <span className="text-muted-foreground text-[11px]">Single-use pass required at entrance door.</span>
                </div>
              </div>
              <div className="flex gap-2.5">
                <span className="text-primary font-bold">03</span>
                <div>
                  <strong className="text-foreground block">Faculty Proctors</strong>
                  <span className="text-muted-foreground text-[11px]">In-person supervision by Dr. Litoriya & CCC Core.</span>
                </div>
              </div>
              <div className="flex gap-2.5">
                <span className="text-primary font-bold">04</span>
                <div>
                  <strong className="text-foreground block">Strict Fair Play</strong>
                  <span className="text-muted-foreground text-[11px]">No external hardware, devices, or unauthorized tabs.</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Strict Assessment Confirmation Modal */}
      <AssessmentConfirmModal
        open={assessmentConfirmOpen}
        onOpenChange={setAssessmentConfirmOpen}
        contestSlug={confirmContestSlug}
        contestTitle={confirmContestTitle}
      />
    </div>
  );
}
