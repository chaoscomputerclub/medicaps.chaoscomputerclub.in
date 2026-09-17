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
  TrendingUp,
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
    <div className="grid grid-cols-4 gap-1.5">
      {[{ val: days, label: "Days" }, { val: hours, label: "Hrs" }, { val: minutes, label: "Min" }, { val: seconds, label: "Sec", accent: accentSec }].map(({ val, label, accent }) => (
        <div key={label} className="flex flex-col items-center justify-center border border-[var(--line)] bg-[var(--surface-2)] py-2">
          <span className={`text-xl font-black leading-none ${accent ? "text-[var(--accent)]" : "text-foreground"}`}>
            {String(val).padStart(2, "0")}
          </span>
          <span className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-[var(--muted)]">{label}</span>
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
  const [assessmentConfirmOpen, setAssessmentConfirmOpen] = useState(false);
  const [confirmContestSlug, setConfirmContestSlug] = useState("");
  const [confirmContestTitle, setConfirmContestTitle] = useState("");

  useEffect(() => {
    dispatch(fetchContestsThunk());
    getUniversityLeaderboardData().then((res) => setLeaders(res || []));
    if (member) {
      setIsLoadingParticipations(true);
      contestApi.participated()
        .then((res: ParticipationRecord[]) => setMyParticipations(res || []))
        .catch(() => {})
        .finally(() => setIsLoadingParticipations(false));
    }
  }, [dispatch, member]);

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

  const isContestAssessmentSubmitted = (contest: ContestSummary | null) => {
    if (!contest) return false;
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
    const hasTaken = Boolean(
      record?.assessment_submitted ||
      (record as any)?.assessment_taken ||
      (record as any)?.assessment_status === "submitted" ||
      (record as any)?.assessment_status === "completed" ||
      (record?.score !== null && record?.score !== undefined) ||
      ["submitted", "qualified", "pending", "not_qualified"].includes(record?.outcome || "")
    );
    const isTop30 = record?.outcome === "qualified" || (record?.rank !== null && (record?.rank ?? 99) <= 30);
    return {
      contest, contestStart, assessOpen, assessClose,
      isOpen: now >= assessOpen && now <= assessClose,
      isUpcoming: now < assessOpen,
      isClosed: now > assessClose,
      hasTaken, isTop30,
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
      toast.success("Registered! Phase 1 screening unlocks 24h before the contest.");
      dispatch(fetchContestsThunk());
      contestApi.participated().then((res: ParticipationRecord[]) => setMyParticipations(res || []));
    } catch (err: any) {
      toast.error(err || "Registration failed");
    } finally {
      setRegisteringSlug(null);
    }
  };

  if (isLoading && contests.length === 0) return <ContestsHubSkeleton />;

  return (
    <div className="page-wrap space-y-10">

      {/* ─── HERO HEADER ─────────────────────────────── */}
      <header className="relative overflow-hidden border border-[var(--line)] bg-[var(--surface)] px-6 py-10 md:px-10">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[var(--accent)]/8 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-[var(--accent)]/5 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--accent)]">
                <Flame className="size-3" /> CCC ARENA · SEASON 2026
              </span>
              <span className="hidden border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--muted)] sm:inline-block">
                Air-Gapped Finals Enabled
              </span>
            </div>
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-foreground md:text-5xl">
                Weekly Contests
              </h1>
              <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
                Weekly algorithmic battles for Medi-Caps cadets. Top 30 online screening qualifiers earn a QR pass to the physical air-gapped lab final.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-[var(--line)] border border-[var(--line)] bg-[var(--surface-2)] lg:min-w-[320px]">
            {[
              { label: "Upcoming", value: upcomingContests.length },
              { label: "Past", value: pastContests.length },
              { label: "Participants", value: contests.reduce((a, c) => a + (c.registered_count || 0), 0) },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center justify-center p-4">
                <span className="text-2xl font-black text-foreground">{value}</span>
                <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ─── UPCOMING CONTESTS ───────────────────────── */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Upcoming Weekly Contest</h2>
        </div>

        {upcomingContests.length === 0 ? (
          <div className="flex flex-col items-center gap-4 border border-[var(--line)] bg-[var(--surface)] py-16 text-center">
            <div className="flex size-14 items-center justify-center border border-[var(--line)] bg-[var(--surface-2)]">
              <Calendar className="size-6 text-[var(--muted)]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">No Contests Scheduled</h3>
              <p className="max-w-xs text-xs text-[var(--muted)]">New contests are announced ahead of each round. Practice past problem sets in the meantime.</p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="rounded-none text-xs"><Link to="/portal/problems">Problem Archive</Link></Button>
              <Button asChild variant="ghost" size="sm" className="rounded-none text-xs"><Link to="/portal/leaderboard">Leaderboard</Link></Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-1">

            {/* ── WEEKLY FEATURED CARD ── */}
            {upcomingWeekly && (
              <div className="group relative overflow-hidden border border-[var(--line)] bg-[var(--surface)] transition-all duration-300 hover:border-[var(--accent)]/50">
                <div className="h-0.5 w-full bg-gradient-to-r from-[var(--accent)] via-[var(--accent)]/60 to-transparent" />
                <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 translate-x-8 -translate-y-8 rounded-full bg-[var(--accent)]/6 blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <div className="flex flex-col gap-6 p-6 md:p-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                        WEEKLY CONTEST
                      </span>
                      <span className="text-xs font-semibold text-[var(--muted)]">#{upcomingWeekly.edition ?? "--"}</span>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                      <Users className="size-3.5" />{upcomingWeekly.registered_count} registered
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-bold leading-tight text-foreground transition-colors group-hover:text-[var(--accent)]">{upcomingWeekly.title}</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
                      {upcomingWeekly.summary || "Sunday algorithmic showdown. 4 challenges covering graph traversal, greedy heuristics, and dynamic programming."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-6 text-xs text-[var(--muted)]">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Calendar className="size-4 text-[var(--accent)]" />
                      {new Date(upcomingWeekly.starts_at).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> 2 Hours assessment</span>
                    <span className="flex items-center gap-1.5"><Code2 className="size-3.5" /> {upcomingWeekly.problem_count || 4} Problems</span>
                    <span className="flex items-center gap-1.5"><TrendingUp className="size-3.5" /> Rating Rated</span>
                  </div>
                  <div className="max-w-md">
                    <CountdownDisplay days={weeklyCountdown.days} hours={weeklyCountdown.hours} minutes={weeklyCountdown.minutes} seconds={weeklyCountdown.seconds} accentSec />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    {isWeeklySubmitted ? (
                      <>
                        <div className="flex items-center gap-2 border border-emerald-500/40 bg-emerald-950/30 px-3.5 py-2 text-xs font-bold text-emerald-400">
                          <CheckCircle2 className="size-4 text-emerald-400" />
                          <span>Assessment Completed {assessmentInfo?.score !== undefined && assessmentInfo?.score !== null ? `(${assessmentInfo.score} Pts)` : "· Submitted"}</span>
                        </div>
                        <Button asChild variant="outline" className="rounded-none border-emerald-500/40 bg-emerald-950/20 text-xs font-bold text-emerald-400 hover:bg-emerald-950/40 px-6 py-2.5">
                          <Link to={`/portal/contests/${upcomingWeekly.slug}`}><CheckCircle2 className="mr-1.5 size-4" /> View Status & Results</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm" className="rounded-none text-xs"><Link to={`/portal/contests/${upcomingWeekly.slug}`}>Contest Details</Link></Button>
                      </>
                    ) : isWeeklyRegistered ? (
                      <>
                        <Button onClick={() => { setConfirmContestSlug(upcomingWeekly.slug); setConfirmContestTitle(upcomingWeekly.title); setAssessmentConfirmOpen(true); }}
                          className="rounded-none bg-[var(--accent)] text-xs font-bold uppercase tracking-wider text-black hover:bg-[var(--accent)]/90 px-8 py-2.5">
                          <Play className="mr-1.5 size-4 fill-black" /> Enter Screening Assessment
                        </Button>
                        <Button asChild variant="outline" size="sm" className="rounded-none text-xs"><Link to={`/portal/contests/${upcomingWeekly.slug}`}>Contest Details</Link></Button>
                      </>
                    ) : (
                      <>
                        <Button onClick={() => handleRegister(upcomingWeekly.slug)} disabled={registeringSlug === upcomingWeekly.slug}
                          className="rounded-none bg-[var(--accent)] text-xs font-bold uppercase tracking-wider text-black hover:bg-[var(--accent)]/90 px-8 py-2.5">
                          {registeringSlug === upcomingWeekly.slug ? "Registering..." : "Register for Weekly Contest"}
                        </Button>
                        <Button asChild variant="outline" size="sm" className="rounded-none text-xs"><Link to={`/portal/contests/${upcomingWeekly.slug}`}>Contest Details</Link></Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── OTHER UPCOMING ── */}
            {otherUpcomingContests.map((contest) => {
              const isSubmitted = isContestAssessmentSubmitted(contest);
              const isReg = Boolean(contest.registered || myParticipations.some((p) => p.contest_slug === contest.slug));
              return (
                <div key={contest.slug} className="group relative overflow-hidden border border-[var(--line)] bg-[var(--surface)] transition-all duration-300 hover:border-[var(--accent)]/40">
                  <div className="h-0.5 w-full bg-gradient-to-r from-[var(--accent)]/50 to-transparent" />
                  <div className="flex flex-col gap-4 p-6">
                    <div className="flex items-center justify-between">
                      <span className="border border-[var(--line)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">{contest.cadence}</span>
                      <span className="flex items-center gap-1 text-xs text-[var(--muted)]"><Users className="size-3.5" /> {contest.registered_count}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground transition-colors group-hover:text-[var(--accent)]">{contest.title}</h3>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {new Date(contest.starts_at).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSubmitted ? (
                        <Button asChild variant="outline" className="flex-1 rounded-none border-emerald-500/40 text-emerald-400 text-xs font-bold">
                          <Link to={`/portal/contests/${contest.slug}`}><CheckCircle2 className="mr-1.5 size-3.5" /> Submitted</Link>
                        </Button>
                      ) : isReg ? (
                        <Button onClick={() => { setConfirmContestSlug(contest.slug); setConfirmContestTitle(contest.title); setAssessmentConfirmOpen(true); }}
                          className="flex-1 rounded-none bg-[var(--accent)] text-xs font-bold uppercase text-black">
                          <Play className="mr-1.5 size-4 fill-black" /> Take Assessment
                        </Button>
                      ) : (
                        <Button onClick={() => handleRegister(contest.slug)} disabled={registeringSlug === contest.slug}
                          className="flex-1 rounded-none text-xs font-bold uppercase">
                          {registeringSlug === contest.slug ? "Registering..." : "Register Now"}
                        </Button>
                      )}
                      <Button asChild variant="outline" size="sm" className="rounded-none text-xs"><Link to={`/portal/contests/${contest.slug}`}>Details</Link></Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── PHASE 1 SCREENING BANNER ────────────────── */}
      {assessmentInfo && (
        <section className="relative overflow-hidden border border-[var(--accent)]/25 bg-[var(--surface)]">
          <div className="h-0.5 w-full bg-[var(--accent)]" />
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--accent)]/6 blur-3xl" />
          <div className="relative grid gap-0 lg:grid-cols-[1fr_360px]">
            {/* Info side */}
            <div className="flex flex-col justify-center gap-5 p-6 lg:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${
                  assessmentInfo.hasTaken
                    ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-400"
                    : "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]"
                }`}>
                  {assessmentInfo.hasTaken ? <CheckCircle2 className="size-3 text-emerald-400" /> : <Zap className="size-3" />}
                  {assessmentInfo.hasTaken ? "Phase 1 · Screening Completed" : "Phase 1 · Online Screening"}
                </span>
                <span className="text-[11px] text-[var(--muted)]">
                  {assessmentInfo.hasTaken ? "Attempt locked & securely recorded" : "Strict 24h window · Closes 2h before contest for pass generation"}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">
                  {assessmentInfo.hasTaken ? "Screening Complete — Session Locked"
                    : assessmentInfo.isOpen ? "🔴 Assessment Window is LIVE Now"
                    : assessmentInfo.isUpcoming ? "Screening Unlocks 24h Before Contest"
                    : "Online Screening Layer"}
                </h3>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--muted)]">
                  {assessmentInfo.hasTaken
                    ? "Your screening session has been finalized. Scores and anti-cheat telemetry are securely processed by CodeBox. Top 30 qualifiers receive digital QR passes to the air-gapped lab final."
                    : "Registered cadets solve algorithmic problems in a 120-min proctored session. The Top 30 verified scores earn a QR pass to the physical air-gapped lab final."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Duration", value: assessmentInfo.hasTaken ? "120 Min (Done)" : "120 Min" },
                  { label: "Qualifiers", value: "Top 30", hi: true },
                  { label: "Proctoring", value: assessmentInfo.hasTaken ? "Verified" : "Automated" },
                  { label: "Lab Entry", value: assessmentInfo.isTop30 ? "QR Pass Ready" : "Pending Results", hi: assessmentInfo.isTop30 },
                ].map(({ label, value, hi }) => (
                  <div key={label} className="border border-[var(--line)] bg-[var(--surface-2)] p-3">
                    <span className="block text-[9px] font-semibold uppercase tracking-widest text-[var(--muted)]">{label}</span>
                    <strong className={`text-sm font-bold ${hi ? "text-[var(--accent)]" : "text-foreground"}`}>{value}</strong>
                  </div>
                ))}
              </div>
            </div>
            {/* Action side */}
            <div className="flex flex-col justify-center gap-4 border-t border-[var(--line)] bg-[var(--surface-2)] p-6 lg:border-l lg:border-t-0 lg:p-8">
              {assessmentInfo.hasTaken ? (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                      <span className="text-xs text-[var(--muted)]">Your Screening Score</span>
                      <span className="text-2xl font-black text-[var(--accent)]">{assessmentInfo.score ?? 0} Pts</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--muted)]">Status</span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                        <CheckCircle2 className="size-3.5" /> Submitted & Finalized
                      </span>
                    </div>
                    {assessmentInfo.rank ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--muted)]">Provisional Rank</span>
                        <span className="text-sm font-bold text-foreground">#{assessmentInfo.rank}</span>
                      </div>
                    ) : null}
                    {assessmentInfo.isTop30 && (
                      <div className="flex items-center gap-2 font-bold text-emerald-400 text-sm">
                        <CheckCircle2 className="size-4" /> Qualified for Lab Final
                      </div>
                    )}
                  </div>
                  <Button asChild className="w-full rounded-none text-xs font-bold uppercase bg-[var(--accent)] text-black hover:bg-[var(--accent)]/90">
                    <Link to={`/portal/contests/${assessmentInfo.contest.slug}${assessmentInfo.isTop30 ? "/qualified" : ""}`}>
                      {assessmentInfo.isTop30 ? <><QrCode className="mr-1.5 size-4" /> View Campus QR Pass</> : "View Contest Details & Results"}
                    </Link>
                  </Button>
                </>
              ) : registeredUpcomingContest || isWeeklyRegistered ? (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400">Registration Active</span>
                    <span className="ml-auto text-xs text-[var(--accent)] font-bold">120 MIN</span>
                  </div>
                  <Button onClick={() => { setConfirmContestSlug(assessmentInfo.contest.slug); setConfirmContestTitle(assessmentInfo.contest.title); setAssessmentConfirmOpen(true); }}
                    className="w-full rounded-none bg-[var(--accent)] text-xs font-bold uppercase text-black hover:bg-[var(--accent)]/90">
                    <Play className="mr-1.5 size-4 fill-black" /> Take Assessment Now
                  </Button>
                  <p className="text-center text-[10px] text-[var(--muted)]">Full-screen Monaco IDE · Anti-cheat active</p>
                </>
              ) : assessmentInfo.isOpen ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-red-400 animate-pulse">
                      <AlertCircle className="size-4" /> Window Closes In
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {String(assessmentRemainingTimer.hours).padStart(2, "0")}:{String(assessmentRemainingTimer.minutes).padStart(2, "0")}:{String(assessmentRemainingTimer.seconds).padStart(2, "0")}
                    </span>
                  </div>
                  <Button asChild className="w-full rounded-none bg-[var(--accent)] text-xs font-bold uppercase text-black">
                    <Link to={`/assessments/${assessmentInfo.contest.slug}`}><Play className="mr-1.5 size-4 fill-black" /> Take Assessment</Link>
                  </Button>
                </>
              ) : assessmentInfo.isUpcoming ? (
                <>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Unlocks In</span>
                    <div className="text-3xl font-extrabold text-[var(--accent)]">
                      {assessmentUnlockTimer.days > 0 ? `${assessmentUnlockTimer.days}d ` : ""}
                      {String(assessmentUnlockTimer.hours).padStart(2, "0")}:{String(assessmentUnlockTimer.minutes).padStart(2, "0")}:{String(assessmentUnlockTimer.seconds).padStart(2, "0")}
                    </div>
                    <p className="text-[11px] text-[var(--muted)]">Opens: {assessmentInfo.openDateFormatted}</p>
                  </div>
                  <Button onClick={() => handleRegister(assessmentInfo.contest.slug)} disabled={registeringSlug === assessmentInfo.contest.slug}
                    className="w-full rounded-none text-xs font-bold uppercase tracking-wider">
                    <Sparkles className="mr-1.5 size-3.5" /> Register to Unlock
                  </Button>
                </>
              ) : (
                <div className="space-y-3 text-center">
                  <p className="text-xs text-[var(--muted)]">Register for an upcoming contest to enter the screening pipeline.</p>
                  <Button onClick={() => handleRegister(assessmentInfo.contest.slug)} disabled={registeringSlug === assessmentInfo.contest.slug}
                    className="w-full rounded-none text-xs font-bold uppercase">
                    {registeringSlug === assessmentInfo.contest.slug ? "Registering..." : "Register for Screening"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ─── PAST CONTESTS + SIDEBAR ─────────────────── */}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">

        {/* Left: Tabbed list */}
        <div className="space-y-5">
          {/* Tab header */}
          <div className="flex items-center justify-between border-b border-[var(--line)]">
            <div className="flex">
              {[
                { key: "past", label: "Past Contests", count: pastContests.length },
                { key: "my-contests", label: "My History", count: myParticipations.length },
              ].map(({ key, label, count }) => (
                <button key={key} onClick={() => setSearchParams({ tab: key })}
                  className={`-mb-px flex items-center gap-2 border-b-2 px-5 pb-3 pt-1 text-xs font-bold uppercase tracking-wider transition-colors ${
                    activeTab === key ? "border-[var(--accent)] text-foreground" : "border-transparent text-[var(--muted)] hover:text-foreground"
                  }`}>
                  {label}
                  <span className={`rounded-sm px-1.5 py-0.5 text-[10px] ${activeTab === key ? "bg-[var(--accent)] text-black" : "bg-[var(--surface-3)] text-[var(--muted)]"}`}>
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
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
                <Input placeholder="Search by title or edition number..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-none border-[var(--line)] bg-[var(--surface)] pl-9 text-xs placeholder:text-[var(--muted)]" />
              </div>
              <div className="overflow-hidden border border-[var(--line)] bg-[var(--surface)] divide-y divide-[var(--line)]">
                {isLoading && pastContests.length === 0 ? (
                  [1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between gap-4 p-5">
                      <div className="flex-1 space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-5 w-3/4" /><Skeleton className="h-3 w-40" /></div>
                      <div className="flex gap-2"><Skeleton className="h-8 w-24" /><Skeleton className="h-8 w-20" /></div>
                    </div>
                  ))
                ) : filteredPastContests.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-center">
                    <Trophy className="size-6 text-[var(--muted)]" />
                    <p className="text-sm font-bold text-foreground">No contests found</p>
                    <p className="text-xs text-[var(--muted)]">Try adjusting your search query.</p>
                  </div>
                ) : (
                  filteredPastContests.map((contest) => (
                    <article key={contest.slug}
                      className="group flex flex-col gap-4 p-5 transition-colors hover:bg-[var(--surface-2)] sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--accent)]">
                            WEEKLY
                          </span>
                          <span className="text-xs text-[var(--muted)]">#{contest.edition ?? "--"}</span>
                          <span className="text-[var(--muted)]">·</span>
                          <span className="text-xs text-[var(--muted)]">
                            {new Date(contest.starts_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                        <h3 className="truncate font-bold text-foreground transition-colors group-hover:text-[var(--accent)]">
                          <Link to={`/portal/contests/${contest.slug}`}>{contest.title}</Link>
                        </h3>
                        <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
                          <span className="flex items-center gap-1"><Clock className="size-3" /> 2 Hrs</span>
                          <span className="flex items-center gap-1"><Users className="size-3" /> {contest.registered_count}</span>
                          <span className="flex items-center gap-1"><Code2 className="size-3" /> 4 Problems</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button asChild size="sm" variant="outline" className="rounded-none text-xs"><Link to={`/portal/contests/${contest.slug}`}>Overview</Link></Button>
                        <Button asChild size="sm" variant="outline" className="rounded-none text-xs"><Link to={`/portal/contests/${contest.slug}/final-results`}>Scoreboard</Link></Button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          )}

          {/* MY CONTESTS TAB */}
          {activeTab === "my-contests" && (
            <div className="overflow-hidden border border-[var(--line)] bg-[var(--surface)] divide-y divide-[var(--line)]">
              {isLoadingParticipations ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between gap-4 p-5">
                    <div className="flex-1 space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-5 w-2/3" /><Skeleton className="h-3 w-32" /></div>
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))
              ) : myParticipations.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <Trophy className="size-8 text-[var(--muted)]" />
                  <h4 className="font-bold text-foreground">No contest history yet</h4>
                  <p className="max-w-xs text-xs text-[var(--muted)]">Register for an upcoming contest and earn your place on the university leaderboard.</p>
                  {upcomingContests.length > 0 && (
                    <Button onClick={() => handleRegister(upcomingContests[0].slug)} disabled={registeringSlug === upcomingContests[0].slug}
                      className="mt-2 rounded-none text-xs font-bold uppercase">
                      {registeringSlug === upcomingContests[0].slug ? "Registering..." : `Register for ${upcomingContests[0].title}`}
                    </Button>
                  )}
                </div>
              ) : (
                myParticipations.map((record) => (
                  <article key={record.contest_slug}
                    className="flex flex-col gap-4 p-5 transition-colors hover:bg-[var(--surface-2)] sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                          record.outcome === "qualified" ? "border-emerald-500/40 text-emerald-400"
                            : record.status === "upcoming" ? "border-[var(--accent)]/40 text-[var(--accent)]"
                            : "border-[var(--line)] text-[var(--muted)]"
                        }`}>{record.outcome === "qualified" ? "Top 30 ✓" : (record.outcome || record.status)}</span>
                        <span className="text-xs text-[var(--muted)]">
                          {new Date(record.participated_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                      <h3 className="truncate font-bold text-foreground">{record.contest_title}</h3>
                      <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
                        {record.score !== null && <span>Score: <strong className="text-foreground">{record.score}</strong></span>}
                        {record.rank !== null && <span>Rank: <strong className="text-[var(--accent)]">#{record.rank}</strong> / {record.participants || 60}</span>}
                        <span className="font-bold text-emerald-400">+38 Rating</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {record.outcome === "qualified" ? (
                        <Button asChild size="sm" className="rounded-none text-xs font-bold">
                          <Link to={`/portal/contests/${record.contest_slug}/qualified`}><QrCode className="mr-1.5 size-3.5" /> Campus Pass</Link>
                        </Button>
                      ) : (
                        <Button asChild size="sm" variant="outline" className="rounded-none text-xs">
                          <Link to={`/portal/contests/${record.contest_slug}`}>Details</Link>
                        </Button>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <aside className="space-y-5">
          {/* Top Rankers */}
          <div className="overflow-hidden border border-[var(--line)] bg-[var(--surface)]">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <div className="flex items-center gap-2">
                <Trophy className="size-4 text-[var(--accent)]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Top Rankers</h3>
              </div>
              <Link to="/portal/leaderboard" className="flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)] hover:underline">
                Full <ExternalLink className="size-3" />
              </Link>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {leaders.length === 0 ? (
                <p className="py-6 text-center text-xs text-[var(--muted)]">No ranked cadets yet.</p>
              ) : leaders.slice(0, 7).map((leader, index) => {
                const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null;
                return (
                  <div key={leader.handle} className={`flex items-center justify-between px-4 py-3 transition-colors hover:bg-[var(--surface-2)] ${index === 0 ? "bg-[var(--accent)]/5" : ""}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-5 text-center text-xs">{medal || <span className="text-[var(--muted)]">{index + 1}</span>}</div>
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-3)] text-[10px] font-bold text-foreground">
                        {leader.handle.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-foreground">{leader.handle}</p>
                        <p className="truncate text-[10px] text-[var(--muted)]">{leader.department} · {leader.tier}</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-black text-[var(--accent)]">{leader.rating}</span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-[var(--line)] bg-[var(--surface-2)] p-3 text-center">
              <Link to="/portal/leaderboard" className="flex items-center justify-center gap-1.5 text-xs font-bold text-foreground transition-colors hover:text-[var(--accent)]">
                University Rankings <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>

          {/* Lab Protocol */}
          <div className="border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-[var(--accent)]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Lab Arena Protocol</h3>
            </div>
            <div className="space-y-3">
              {[
                { n: "01", title: "Air-Gapped Network", desc: "Lab workstations disconnected from the public web." },
                { n: "02", title: "Campus QR Pass", desc: "Single-use entry pass required at the final venue." },
                { n: "03", title: "Faculty Proctors", desc: "In-person supervision by Dr. Litoriya & CCC Core." },
                { n: "04", title: "Strict Fair Play", desc: "No external hardware, devices, or unauthorized tabs." },
              ].map(({ n, title, desc }) => (
                <div key={n} className="flex gap-3">
                  <span className="mt-0.5 text-xs font-bold text-[var(--accent)]">{n}</span>
                  <div>
                    <strong className="block text-xs text-foreground">{title}</strong>
                    <span className="text-[11px] text-[var(--muted)]">{desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <AssessmentConfirmModal
        open={assessmentConfirmOpen}
        onOpenChange={setAssessmentConfirmOpen}
        contestSlug={confirmContestSlug}
        contestTitle={confirmContestTitle}
      />
    </div>
  );
}
