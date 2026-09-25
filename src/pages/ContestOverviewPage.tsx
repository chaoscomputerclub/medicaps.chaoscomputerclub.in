import { Link, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContestDetailThunk, registerContestThunk, unregisterContestThunk } from "@/store/slices/contestSlice";
import { useEffect, useState, useCallback } from "react";
import { globalSwrStore, invalidateSwrCache } from "@/lib/cache/swrCache";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  Flame,
  Gauge,
  Loader2,
  Lock,
  Play,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { useRealtimeEvents } from "@/lib/realtime";
import { ContestDetailSkeleton } from "@/organization/components/skeletons";
import { slugifyProblem } from "@/lib/utils";
import { useCountdown } from "@/hooks/useCountdown";

/** Compute human-readable duration from two ISO datetime strings. */
function contestDuration(startsAt: string, endsAt: string): string {
  try {
    const diffMs = new Date(endsAt).getTime() - new Date(startsAt).getTime();
    if (isNaN(diffMs) || diffMs <= 0) return "—";
    const totalMinutes = Math.round(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours === 0) return `${mins} Min`;
    if (mins === 0) return `${hours} Hr${hours > 1 ? "s" : ""}`;
    return `${hours} Hr${hours > 1 ? "s" : ""} ${mins} Min`;
  } catch {
    return "—";
  }
}

export function ContestOverviewPage() {
  const { contestSlug = "" } = useParams<{ contestSlug: string }>();
  const dispatch = useAppDispatch();
  const { currentContest: rawContest, registration: rawRegistration, problems, isLoadingDetail } = useAppSelector(
    (state) => state.contest
  );
  const [isRegistering, setIsRegistering] = useState(false);

  const refreshDetail = useCallback((force = false) => {
    if (!contestSlug) return;
    if (force) {
      invalidateSwrCache("contests:*");
      invalidateSwrCache(`contest:*:${contestSlug}*`);
    }
    dispatch(fetchContestDetailThunk({ slug: contestSlug, force }));
  }, [contestSlug, dispatch]);

  useEffect(() => {
    refreshDetail(false);
  }, [refreshDetail]);

  // Hydrate from SWR sessionStorage cache on reload — no skeleton flash
  const cachedContest = !rawContest && contestSlug
    ? (globalSwrStore.get<any>(`contest:detail:${contestSlug}`)?.data ?? null)
    : null;
  const contest = rawContest ?? cachedContest;

  const cachedRegistration = !rawRegistration && contestSlug
    ? (globalSwrStore.get<any>(`contest:reg_status:${contestSlug}`)?.data ?? null)
    : null;
  const registration = rawRegistration ?? cachedRegistration;

  const isRegistered = registration !== null && registration !== undefined
    ? Boolean(registration.registered)
    : Boolean(contest?.registered);
  const isLive = contest?.status === "live";
  const isFinished = contest?.status === "finished";
  const isUpcoming = contest?.status === "upcoming" || !contest?.status;

  const onCountdownExpire = useCallback(() => {
    refreshDetail(true);
  }, [refreshDetail]);

  const countdown = useCountdown(
    isLive ? contest?.ends_at : contest?.starts_at,
    onCountdownExpire
  );
  const isWaitingRoom = isUpcoming && countdown.totalSeconds <= 300 && countdown.totalSeconds > 0;

  // Real-time status update: only stream when contest is actively live or within 5m waiting lobby
  useRealtimeEvents(
    contestSlug,
    (event) => {
      if (event.event === "contest_status_changed") {
        refreshDetail(true);
      }
    },
    undefined,
    Boolean(contestSlug && (isLive || isWaitingRoom))
  );

  const handleRegister = async () => {
    try {
      setIsRegistering(true);
      const res = await dispatch(registerContestThunk(contestSlug));
      if (registerContestThunk.fulfilled.match(res)) {
        toast.success("Successfully registered for the contest!");
        refreshDetail(true);
      } else {
        toast.error(String(res.payload || "Registration failed"));
      }
    } catch (e: any) {
      toast.error(e.message || "Registration failed");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleUnregister = async () => {
    try {
      setIsRegistering(true);
      const res = await dispatch(unregisterContestThunk(contestSlug));
      if (unregisterContestThunk.fulfilled.match(res)) {
        toast.success("Successfully unregistered from the contest.");
        refreshDetail(true);
      } else {
        toast.error(String(res.payload || "Failed to unregister"));
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to unregister");
    } finally {
      setIsRegistering(false);
    }
  };

  if (isLoadingDetail && !contest) return <ContestDetailSkeleton />;
  if (!contest) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center font-mono text-xs text-zinc-500">
        Contest not found.
      </div>
    );
  }

  const startDateFormatted = new Date(contest.starts_at).toLocaleString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  // Derive duration dynamically from API timestamps — never hardcoded
  const durationLabel = contestDuration(contest.starts_at, contest.ends_at);

  // Use real problem_count from API; fall back to problems array length
  const problemCount = contest.problem_count || problems.length || 4;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Back Navigation */}
      <div>
        <Link
          to="/contests"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Back to Contests Hub
        </Link>
      </div>

      {/* ── HERO BANNER ── */}
      <div className="rounded-lg border border-white/8 bg-black p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-lime-400 flex items-center gap-1">
                <Flame className="size-3 text-lime-400" /> Rated Contest
              </span>
              <span className="font-mono text-xs text-zinc-500">
                Edition #{contest.edition ?? 1}
              </span>
              {isLive && (
                <span className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-red-400 animate-pulse" /> LIVE NOW
                </span>
              )}
              {isFinished && (
                <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  CONCLUDED
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {contest.title}
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {contest.summary || "Official Medi-Caps University algorithmic programming tournament. Solve challenges under strict timing constraints to increase your university rating."}
            </p>

            {/* Quick Meta Row */}
            <div className="flex flex-wrap items-center gap-5 pt-1 text-xs font-mono text-zinc-400">
              <span className="flex items-center gap-1.5 text-zinc-300">
                <Calendar className="size-3.5 text-lime-400" />
                {startDateFormatted}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-lime-400" />
                {durationLabel}
              </span>
              <span className="flex items-center gap-1.5">
                <Code2 className="size-3.5 text-lime-400" />
                {problemCount} Problem{problemCount !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1.5 text-zinc-300">
                <Users className="size-3.5 text-lime-400" />
                <span className="tabular-nums">{contest.registered_count.toLocaleString()}</span>&nbsp;Cadet{contest.registered_count === 1 ? "" : "s"} Registered
              </span>
            </div>
          </div>

          {/* Right Side: Countdown Card */}
          <div className="rounded-lg border border-white/8 bg-black p-4 md:min-w-[260px] text-center space-y-3 shrink-0">
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 block">
              {isLive ? "Contest Closes In" : isFinished ? "Contest Status" : "Contest Starts In"}
            </span>

            {isFinished ? (
              <div className="py-2 font-mono text-sm font-bold text-zinc-400">
                CONCLUDED
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { val: countdown.days, label: "Days" },
                  { val: countdown.hours, label: "Hrs" },
                  { val: countdown.minutes, label: "Min" },
                  { val: countdown.seconds, label: "Sec" },
                ].map(({ val, label }) => (
                  <div key={label} className="flex flex-col items-center bg-white/5 p-2 rounded">
                    <span className="font-mono text-xl font-bold tabular-nums text-white">
                      {String(val).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] font-mono uppercase text-zinc-500">{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── PRIMARY ACTION STRIP ── */}
        <div className="pt-4 border-t border-white/8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <AnimatePresence mode="wait" initial={false}>
              {isLive ? (
                <motion.div
                  key="live-action"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Button
                    asChild
                    size="lg"
                    className="rounded-md bg-transparent text-white border border-white/20 font-semibold text-xs hover:bg-lime-400 hover:text-black hover:border-lime-400 shadow-none active:scale-[0.98] cursor-pointer transition-colors [&_svg]:transition-colors"
                  >
                    <Link to={`/contests/${contestSlug}/lobby`}>
                      <Play className="size-4 fill-current" />
                      <span>Enter Contest Arena</span>
                    </Link>
                  </Button>
                </motion.div>
              ) : isFinished ? (
                <motion.div
                  key="finished-action"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Button
                    asChild
                    size="lg"
                    className="rounded-md bg-transparent text-white border border-white/20 font-semibold text-xs hover:bg-lime-400 hover:text-black hover:border-lime-400 active:scale-[0.98] cursor-pointer transition-colors [&_svg]:transition-colors"
                  >
                    <Link to={`/contests/${contestSlug}/results`}>
                      <Trophy className="size-4" />
                      <span>View Final Standings</span>
                    </Link>
                  </Button>
                </motion.div>
              ) : isRegistered ? (
                <motion.div
                  key="registered-actions"
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-wrap items-center gap-3"
                >
                  <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-emerald-500/30 bg-emerald-950/40 text-emerald-400 font-sans text-xs font-semibold">
                    <CheckCircle2 className="size-4 text-emerald-400" />
                    <span>Registered · Arena unlocks at start time</span>
                  </div>
                  <Button
                    asChild
                    size="lg"
                    className="rounded-md bg-transparent text-lime-400 border border-lime-400/40 font-semibold text-xs hover:bg-lime-400 hover:text-black hover:border-lime-400 active:scale-[0.98] cursor-pointer transition-colors [&_svg]:transition-colors"
                  >
                    <Link to={`/contests/${contestSlug}/lobby`}>
                      <Clock className="size-4" />
                      <span>Enter Waiting Room</span>
                    </Link>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleUnregister}
                    disabled={isRegistering}
                    className="rounded-md border-red-500/40 bg-red-950/20 text-red-400 hover:bg-red-950/50 hover:text-red-300 hover:border-red-500 focus-visible:ring-red-500 text-xs font-sans font-semibold cursor-pointer transition-colors"
                  >
                    {isRegistering ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Unregistering...</span>
                      </span>
                    ) : (
                      <span>Unregister</span>
                    )}
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="unregistered-action"
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Button
                    onClick={handleRegister}
                    disabled={isRegistering}
                    size="lg"
                    className="rounded-md bg-transparent text-white border border-white/20 font-semibold text-xs hover:bg-lime-400 hover:text-black hover:border-lime-400 active:scale-[0.98] cursor-pointer transition-colors [&_svg]:transition-colors"
                  >
                    {isRegistering ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="size-4 animate-spin" />
                        <span>Registering...</span>
                      </span>
                    ) : (
                      <>
                        <Sparkles className="size-4" />
                        <span>Register for Contest</span>
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-zinc-500">
            <span className="flex items-center gap-1">
              <ShieldCheck className="size-3.5 text-lime-400" /> Open to all students
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <TrendingUp className="size-3.5 text-lime-400" /> Elo Rated
            </span>
          </div>
        </div>
      </div>

      {/* ── CONTEST DETAILS & PROBLEM SET ── */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Rules & Regulations */}
        <div className="lg:col-span-5 rounded-lg border border-white/8 bg-black p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/8 pb-3">
            <h2 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
              Contest Rules
            </h2>
            <span className="text-[11px] font-mono text-zinc-500">Standard CP</span>
          </div>

          <ol className="space-y-3.5 font-mono text-xs leading-relaxed text-zinc-400">
            <li className="flex gap-3">
              <span className="text-lime-400 font-bold shrink-0">01</span>
              <span>
                <strong className="text-white">Scoring:</strong> Each problem has an assigned point value. Solved problems grant full score upon passing all testcases.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-lime-400 font-bold shrink-0">02</span>
              <span>
                <strong className="text-white">Penalty:</strong> A 10-minute penalty is added for each incorrect submission, applicable only if the problem is eventually solved.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-lime-400 font-bold shrink-0">03</span>
              <span>
                <strong className="text-white">Standings:</strong> Participants are ranked primarily by total score, and secondarily by lowest total penalty time.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-lime-400 font-bold shrink-0">04</span>
              <span>
                <strong className="text-white">Rating Impact:</strong> This is an officially rated contest. Performance directly adjusts your Elo rating and rank on the University Leaderboard.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-lime-400 font-bold shrink-0">05</span>
              <span>
                <strong className="text-white">Integrity:</strong> All code submitted must be written solely by you. External assistance or code sharing will result in disqualification.
              </span>
            </li>
          </ol>
        </div>

        {/* Right Column: Arena Specifications (when upcoming) or Problem Set Table (when live/finished) */}
        <div className="lg:col-span-7 rounded-lg border border-white/8 bg-black p-6 space-y-4 flex flex-col justify-between">
          {isUpcoming ? (
            /* Upcoming: Authentic Arena Specifications & Technical Readiness */
            <div className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/8 pb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
                      Arena Specifications
                    </h2>
                    <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                      <Lock className="size-3 text-amber-400" /> Vault Sealed
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500">
                    {problemCount} Challenge{problemCount !== 1 ? "s" : ""} Scheduled
                  </span>
                </div>

                {/* Vault Gating Banner */}
                <div className="rounded-md border border-white/10 bg-zinc-950/80 p-3.5 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="size-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs font-mono">
                      <div className="text-zinc-200 font-semibold">
                        Cryptographic Challenge Vault
                      </div>
                      <p className="text-zinc-400 leading-relaxed text-[11px]">
                        Problem statements, constraints, and judge test suites are cryptographically sealed in the backend engine. All challenges unlock simultaneously across all workstations at contest launch.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Technical Bento Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Languages & Compilers */}
                  <div className="rounded-md border border-white/8 bg-zinc-950/50 p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
                      <Terminal className="size-3.5 text-lime-400" />
                      <span className="font-semibold uppercase tracking-wider text-[11px]">Compilers</span>
                    </div>
                    <p className="text-[11px] font-mono text-zinc-400 leading-relaxed">
                      GCC 14 (C++23) · Clang 18 · Python 3.12 · OpenJDK 21 LTS
                    </p>
                  </div>

                  {/* Sandbox Execution */}
                  <div className="rounded-md border border-white/8 bg-zinc-950/50 p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
                      <Cpu className="size-3.5 text-lime-400" />
                      <span className="font-semibold uppercase tracking-wider text-[11px]">Sandbox Limits</span>
                    </div>
                    <p className="text-[11px] font-mono text-zinc-400 leading-relaxed">
                      2.0s / 256 MB (C++) · 4.0s / 512 MB (Python) · Isolated micro-containers
                    </p>
                  </div>

                  {/* Evaluation Precision */}
                  <div className="rounded-md border border-white/8 bg-zinc-950/50 p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
                      <Gauge className="size-3.5 text-lime-400" />
                      <span className="font-semibold uppercase tracking-wider text-[11px]">Judge System</span>
                    </div>
                    <p className="text-[11px] font-mono text-zinc-400 leading-relaxed">
                      Sub-millisecond precision · Trimmed token match · +10m penalty per WA
                    </p>
                  </div>

                  {/* Prize & Rating */}
                  <div className="rounded-md border border-white/8 bg-zinc-950/50 p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
                      <Trophy className="size-3.5 text-lime-400" />
                      <span className="font-semibold uppercase tracking-wider text-[11px]">Prizes & Rating</span>
                    </div>
                    <p className="text-[11px] font-mono text-zinc-400 leading-relaxed">
                      {contest.prize_pool || "Official Elo Rating + Merit Badges"}
                    </p>
                  </div>
                </div>

                {/* Chief Proctors (if available) */}
                {contest.chief_proctors && contest.chief_proctors.length > 0 && (
                  <div className="rounded-md border border-white/6 bg-white/[0.02] px-3 py-2 text-[11px] font-mono text-zinc-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-zinc-500 uppercase text-[10px] font-semibold">Proctoring Desk:</span>
                    <span>{contest.chief_proctors.join(" · ")}</span>
                  </div>
                )}
              </div>

              {/* Lobby Quick Navigation Strip */}
              <AnimatePresence>
                {isRegistered && (
                  <motion.div
                    key="spec-waiting-room"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 border-t border-white/8 flex items-center justify-between text-xs font-mono">
                      <span className="text-zinc-500">
                        Waiting room open with synced clock
                      </span>
                      <Button
                        asChild
                        size="sm"
                        className="h-8 rounded-md bg-transparent text-lime-400 border border-lime-400/30 font-mono text-xs font-semibold hover:bg-lime-400 hover:text-black hover:border-lime-400 transition-colors cursor-pointer"
                      >
                        <Link to={`/contests/${contestSlug}/lobby`}>
                          <span>Enter Waiting Room</span>
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            /* Live / Concluded: Problem Set Table with Solve Links */
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/8 pb-3">
                <h2 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
                  Problem Set
                </h2>
                <span className="text-[11px] font-mono text-zinc-500">
                  {problemCount} Challenge{problemCount !== 1 ? "s" : ""}
                </span>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="border-white/8 hover:bg-transparent">
                    <TableHead className="w-12 font-mono text-[10px] uppercase text-zinc-500">#</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase text-zinc-500">Title</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase text-zinc-500">Score</TableHead>
                    <TableHead className="text-right font-mono text-[10px] uppercase text-zinc-500">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {problems.length === 0 ? (
                    <TableRow className="border-white/4">
                      <TableCell colSpan={4} className="py-10 text-center font-mono text-xs text-zinc-500">
                        Problems will appear here once contest opens.
                      </TableCell>
                    </TableRow>
                  ) : (
                    problems.map((p) => (
                      <TableRow key={p.problem_index} className="border-white/4 hover:bg-white/5">
                        <TableCell className="font-mono text-xs font-bold text-lime-400">
                          {p.problem_index}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-white">
                          {p.title}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-zinc-400 tabular-nums">
                          {p.points} pts
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-[11px] font-mono border-white/10 text-zinc-300 hover:bg-lime-400 hover:text-black hover:border-lime-400"
                          >
                            <Link to={`/contests/${contestSlug}/problems/${slugifyProblem(p.title, p.problem_index)}`}>
                              Solve →
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* View Standings — only available once contest is live or finished */}
              <div className="pt-3 border-t border-white/8 flex items-center justify-end text-xs font-mono text-zinc-500">
                <Link
                  to={`/contests/${contestSlug}/results`}
                  className="text-lime-400 hover:underline flex items-center gap-1"
                >
                  View Standings →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
