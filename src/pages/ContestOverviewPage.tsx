import { Link, useNavigate, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContestDetailThunk, registerContestThunk, unregisterContestThunk } from "@/store/slices/contestSlice";
import { useEffect, useState, useCallback } from "react";
import { globalSwrStore, invalidateSwrCache } from "@/lib/cache/swrCache";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  Code2,
  FileText,
  Flame,
  Flag,
  Loader2,
  Lock,
  Megaphone,
  Play,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
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
  const navigate = useNavigate();
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
  const isSubmitted = Boolean(
    contest?.is_submitted ||
    registration?.status === "submitted" ||
    registration?.assessment_taken ||
    registration?.assessment_status === "submitted" ||
    registration?.assessment_status === "completed"
  );

  const onCountdownExpire = useCallback(() => {
    refreshDetail(true);
  }, [refreshDetail]);

  const countdown = useCountdown(
    isLive ? contest?.ends_at : contest?.starts_at,
    onCountdownExpire
  );
  const isWaitingRoom = isUpcoming && countdown.totalSeconds <= 300 && countdown.totalSeconds > 0;

  // Real-time status update: always stream — must receive upcoming→live→finished transitions instantly
  useRealtimeEvents(
    contestSlug,
    (event) => {
      if (event.event === "contest_deleted") {
        navigate("/contests", { replace: true });
        return;
      }
      if (
        event.event === "contest_status_changed" ||
        event.event === "contest_updated" ||
        event.event === "top30_qualified" ||
        event.event === "contest_created" ||
        event.event === "assessment_finished" ||
        event.event === "submission_evaluated"
      ) {
        refreshDetail(true);
      }
    },
    undefined,
    Boolean(contestSlug)
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
              {isSubmitted ? (
                <motion.div
                  key="submitted-action"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-wrap items-center gap-3"
                >
                  <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-lime-500/30 bg-lime-950/40 text-lime-400 font-sans text-xs font-semibold">
                    <CheckCircle2 className="size-4 text-lime-400" />
                    <span>Attempt Submitted · Retakes Not Permitted</span>
                  </div>
                  <Button
                    asChild
                    variant="default"
                    size="hero"
                  >
                    <Link to={`/contests/${contestSlug}/results`}>
                      <Trophy className="size-4 mr-1.5" />
                      <span>View Standings</span>
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="hero"
                  >
                    <Link to={`/contests/${contestSlug}/summary`}>
                      <FileText className="size-4 mr-1.5" />
                      <span>View Summary</span>
                    </Link>
                  </Button>
                </motion.div>
              ) : isLive ? (
                <motion.div
                  key="live-action"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Button
                    asChild
                    variant="default"
                    size="hero"
                  >
                    <Link to={`/contests/${contestSlug}/lobby`}>
                      <Play className="size-4 fill-current mr-1.5" />
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
                    variant="default"
                    size="hero"
                  >
                    <Link to={`/contests/${contestSlug}/results`}>
                      <Trophy className="size-4 mr-1.5" />
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
                    variant="outline"
                    size="hero"
                  >
                    <Link to={`/contests/${contestSlug}/lobby`}>
                      <Clock className="size-4 mr-1.5" />
                      <span>Enter Waiting Room</span>
                    </Link>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleUnregister}
                    disabled={isRegistering}
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
                    variant="default"
                    size="hero"
                  >
                    {isRegistering ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="size-4 animate-spin mr-1.5" />
                        <span>Registering...</span>
                      </span>
                    ) : (
                      <>
                        <Sparkles className="size-4 mr-1.5" />
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

      {/* ── OFFICIAL ANNOUNCEMENTS BANNER ── */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-4 flex items-start gap-3.5">
        <div className="size-8 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5 text-amber-400">
          <Megaphone className="size-4" />
        </div>
        <div className="space-y-1 text-sm font-sans flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">📢 Official Announcements</span>
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 uppercase tracking-wide">
              Mandatory Notice
            </span>
          </div>
          <p className="text-zinc-400 leading-relaxed text-xs">
            Users must register prior to start to participate. The waiting lobby unlocks before contest launch with synchronized server time. All challenges unlock simultaneously across all workstations. We hope you enjoy this contest!
          </p>
        </div>
      </div>

      {/* ── LIVE / FINISHED PROBLEM SET TABLE ── */}
      {!isUpcoming && (
        <div className="rounded-lg border border-white/8 bg-black p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/8 pb-3">
            <div className="flex items-center gap-2">
              <Code2 className="size-4 text-lime-400" />
              <h2 className="text-sm font-semibold text-white tracking-wide uppercase font-sans">
                Problem Set
              </h2>
            </div>
            <span className="text-xs font-sans text-zinc-500">
              {problemCount} Challenge{problemCount !== 1 ? "s" : ""}
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-white/8 hover:bg-transparent">
                <TableHead className="w-12 font-sans text-[10px] uppercase text-zinc-500">#</TableHead>
                <TableHead className="font-sans text-[10px] uppercase text-zinc-500">Title</TableHead>
                <TableHead className="font-sans text-[10px] uppercase text-zinc-500">Score</TableHead>
                <TableHead className="text-right font-sans text-[10px] uppercase text-zinc-500">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {problems.length === 0 ? (
                <TableRow className="border-white/4">
                  <TableCell colSpan={4} className="py-10 text-center font-sans text-xs text-zinc-500">
                    Problems will appear here once contest opens.
                  </TableCell>
                </TableRow>
              ) : (
                problems.map((p) => (
                  <TableRow key={p.problem_index} className="border-white/4 hover:bg-white/5">
                    <TableCell className="font-sans text-xs font-bold text-lime-400">
                      {p.problem_index}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-white">
                      {p.title}
                    </TableCell>
                    <TableCell className="font-sans text-xs text-zinc-400 tabular-nums">
                      {p.points} pts
                    </TableCell>
                    <TableCell className="text-right">
                      {isSubmitted ? (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="border-white/10 text-zinc-400 hover:text-white"
                        >
                          <Link to={`/contests/${contestSlug}/summary`}>
                            Review →
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                        >
                          <Link
                            to={`/contests/${contestSlug}/problems/${slugifyProblem(p.title, p.problem_index)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Solve →
                          </Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* View Standings */}
          <div className="pt-3 border-t border-white/8 flex items-center justify-end text-xs font-sans text-zinc-500">
            <Link
              to={`/contests/${contestSlug}/results`}
              className="text-lime-400 hover:underline flex items-center gap-1 font-semibold"
            >
              View Standings →
            </Link>
          </div>
        </div>
      )}

      {/* ── CONTEST REGULATIONS, VIOLATIONS & INTEGRITY ── */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Important Notes & Prohibited Actions */}
        <div className="lg:col-span-7 space-y-6">
          {/* 📌 Important Notes */}
          <div className="rounded-lg border border-white/8 bg-black p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">📌</span>
                <h2 className="text-sm font-semibold text-white tracking-wide uppercase font-sans">
                  Important Notes & Contest Rules
                </h2>
              </div>
              <span className="text-xs font-sans text-zinc-500">Fairness Protocol</span>
            </div>

            <ol className="space-y-4 font-sans text-xs leading-relaxed text-zinc-400">
              <li className="flex gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-lime-400/10 text-lime-400 font-bold text-[11px]">
                  1
                </span>
                <div>
                  <strong className="text-white block pb-0.5">Contest Format & Fair Competition</strong>
                  <span>
                    To provide a better contest and ensure fairness, our tournament guidelines follow rigorous collegiate competitive programming standards. All participants compete under identical clock synchronization and automated judge verification.
                  </span>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-lime-400/10 text-lime-400 font-bold text-[11px]">
                  2
                </span>
                <div>
                  <strong className="text-white block pb-0.5">5-Minute Wrong Submission Penalty</strong>
                  <span>
                    A penalty time of 5 minutes will be applied for each incorrect submission. Penalty time is added to your total ranking time only for problems that are eventually solved during the active contest window.
                  </span>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-lime-400/10 text-lime-400 font-bold text-[11px]">
                  3
                </span>
                <div>
                  <strong className="text-white block pb-0.5">Hidden Test Cases During Contest</strong>
                  <span>
                    To ensure the fairness of the contest and prevent test case hardcoding or output guessing, the judge system will hide evaluation test cases during the active contest. When users submit incorrect submissions, the judge will display the verdict failure without disclosing hidden test case contents.
                  </span>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-lime-400/10 text-lime-400 font-bold text-[11px]">
                  4
                </span>
                <div>
                  <strong className="text-white block pb-0.5">Sequential Test Group Execution</strong>
                  <span>
                    Test cases will be executed in sequential groups within isolated micro-containers. Submissions must satisfy time limits and memory constraints across all sub-task batches.
                  </span>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-lime-400/10 text-lime-400 font-bold text-[11px]">
                  5
                </span>
                <div>
                  <strong className="text-white block pb-0.5">Rating Adjustment Timeline</strong>
                  <span>
                    The final Elo rating and university rank updates for this contest will be calculated and finalized within 24 to 48 hours following the conclusion of the contest and automated plagiarism screening.
                  </span>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-lime-400/10 text-lime-400 font-bold text-[11px]">
                  6
                </span>
                <div>
                  <strong className="text-white block pb-0.5">Provisional Rating for New Participants</strong>
                  <span>
                    New users’ first five contests operate under a provisional rating system to accurately establish competitive standing; beginning from their sixth contest, rating adjustments fully reflect on the global university leaderboard.
                  </span>
                </div>
              </li>
            </ol>
          </div>

          {/* 🚨 Contest Violations & Prohibited Actions */}
          <div className="rounded-lg border border-red-500/20 bg-zinc-950/70 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-red-400" />
                <h2 className="text-sm font-semibold text-white tracking-wide uppercase font-sans">
                  Contest Violations & Prohibited Actions
                </h2>
              </div>
              <span className="rounded bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-400 uppercase tracking-wide">
                Strict Zero-Tolerance
              </span>
            </div>

            <p className="text-xs font-sans text-zinc-300">
              The actions below are strictly deemed contest violations:
            </p>

            <ul className="space-y-3 font-sans text-xs leading-relaxed text-zinc-400">
              <li className="flex items-start gap-2.5">
                <Ban className="size-3.5 text-red-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Multi-Account Submissions:</strong> One user submitting with multiple accounts during a contest is strictly forbidden. Multiple accounts belonging to the same user will be disqualified.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Ban className="size-3.5 text-red-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Cross-Account Code Sharing:</strong> Multiple accounts submitting identical or structurally similar (AST-isomorphic) code for the same problem.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Ban className="size-3.5 text-red-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Platform Disturbances:</strong> Creating unwanted disturbances, network attacks, or automated tooling that interrupts other users' participation.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Ban className="size-3.5 text-red-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Public Discussion Leakage:</strong> Disclosing contest-related problem details, hints, starter solutions, or test cases in public chat channels or discussion boards before the contest concludes.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Bot className="size-3.5 text-red-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Generative AI & External Assistance:</strong> The use of code generation tools (e.g. ChatGPT, Claude, GitHub Copilot) or any external assistance for solving problems is strictly prohibited. This includes, but is not limited to, inputting problem statements, test cases, or starter code into external assistance tools.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: Zero-Tolerance Penalties, Fair Play Whistleblowing & Waiting Lobby */}
        <div className="lg:col-span-5 space-y-6">
          {/* ⚖️ Enforcement & Penalties */}
          <div className="rounded-lg border border-white/8 bg-black p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/8 pb-3">
              <Scale className="size-4 text-lime-400" />
              <h2 className="text-sm font-semibold text-white tracking-wide uppercase font-sans">
                Zero-Tolerance Violation Penalties
              </h2>
            </div>

            <p className="text-xs font-sans text-zinc-300 leading-relaxed">
              Chaos Computer Club heavily emphasizes the justice and fairness of our contests. We maintain absolutely <strong className="text-red-400 font-semibold">ZERO TOLERANCE</strong> for violation behaviors (such as plagiarism, cheating, or surrogate participation).
            </p>

            <div className="space-y-3 pt-1">
              <div className="rounded-md border border-white/8 bg-zinc-950 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 uppercase">
                    First Violation
                  </span>
                  <span className="text-xs font-semibold text-white">Temporary Ban & Reset</span>
                </div>
                <p className="text-[11px] font-sans text-zinc-400 leading-relaxed">
                  Contest score resets to zero, complete disqualification from the tournament edition, and a contest and discuss ban for 1 month.
                </p>
              </div>

              <div className="rounded-md border border-red-500/20 bg-red-950/20 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-400 uppercase">
                    Second Violation
                  </span>
                  <span className="text-xs font-semibold text-white">Permanent Deactivation</span>
                </div>
                <p className="text-[11px] font-sans text-zinc-400 leading-relaxed">
                  Contest score resets to zero, permanent account deactivation without appeal, and formal referral to the University Academic Disciplinary Committee.
                </p>
              </div>
            </div>
          </div>

          {/* 🛡️ Community Whistleblowing & Fair Play */}
          <div className="rounded-lg border border-white/8 bg-black p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/8 pb-3">
              <Flag className="size-4 text-lime-400" />
              <h2 className="text-sm font-semibold text-white tracking-wide uppercase font-sans">
                Community Fair Play & Reporting
              </h2>
            </div>

            <p className="text-xs font-sans text-zinc-400 leading-relaxed">
              We encourage all participants to contribute to maintaining the justice and fairness of our contests. Cadets who discover coordinated cheating, AI leakage, or identical submissions can file violation reports to proctors.
            </p>

            <div className="rounded-md border border-lime-400/20 bg-lime-400/[0.03] p-3 text-xs font-sans text-zinc-300 space-y-1">
              <span className="font-semibold text-lime-400 block">Verified Reporting Recognition:</span>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Participants who submit verified violation reports that successfully uncover cheating rings will receive official recognition on the CCC Academic Honor Roll.
              </p>
            </div>
          </div>

          {/* 🔒 Waiting Room / Arena Gate Status (when upcoming) */}
          {isUpcoming && (
            <div className="rounded-lg border border-white/8 bg-zinc-950/80 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/8 pb-3">
                <div className="flex items-center gap-2">
                  <Lock className="size-4 text-lime-400" />
                  <h3 className="text-sm font-semibold text-white font-sans">
                    Challenge Vault Status
                  </h3>
                </div>
                <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                  Locked Until Start
                </span>
              </div>

              <p className="text-xs font-sans text-zinc-400 leading-relaxed">
                All {problemCount} challenge statements and evaluation suites unlock simultaneously across all workstations at launch time.
              </p>

              {isRegistered ? (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between text-xs font-sans text-zinc-400">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="size-3.5" />
                      <span>Registration Confirmed</span>
                    </span>
                    <span className="text-[11px] text-zinc-500">Synced Clock Active</span>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    size="default"
                    className="w-full"
                  >
                    <Link to={`/contests/${contestSlug}/lobby`}>
                      <span>Enter Waiting Room</span>
                      <ArrowRight className="size-3.5 ml-1" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="pt-1">
                  <Button
                    onClick={handleRegister}
                    disabled={isRegistering}
                    variant="default"
                    size="default"
                    className="w-full"
                  >
                    {isRegistering ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Registering...</span>
                      </span>
                    ) : (
                      <>
                        <Sparkles className="size-3.5 mr-1.5" />
                        <span>Register to Participate</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
