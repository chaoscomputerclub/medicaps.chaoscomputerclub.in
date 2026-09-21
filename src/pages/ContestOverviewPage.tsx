import { Link, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContestDetailThunk, registerContestThunk } from "@/store/slices/contestSlice";
import { useEffect, useState, useCallback, useMemo } from "react";
import { globalSwrStore, invalidateSwrCache } from "@/lib/cache/swrCache";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Code2,
  Lock,
  Play,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  ShieldCheck,
  Flame,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { useRealtimeEvents } from "@/lib/realtime";
import { ContestDetailSkeleton } from "@/organization/components/skeletons";

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

  useRealtimeEvents(contestSlug, (event) => {
    if (event.event === "contest_status_changed") {
      refreshDetail(true);
    }
  });

  // Hydrate from SWR sessionStorage cache on reload — no skeleton flash
  const cachedContest = !rawContest && contestSlug
    ? (globalSwrStore.get<any>(`contest:detail:${contestSlug}`)?.data ?? null)
    : null;
  const contest = rawContest ?? cachedContest;

  const cachedRegistration = !rawRegistration && contestSlug
    ? (globalSwrStore.get<any>(`contest:reg_status:${contestSlug}`)?.data ?? null)
    : null;
  const registration = rawRegistration ?? cachedRegistration;

  const isRegistered = Boolean(registration?.registered || contest?.registered);
  const isLive = contest?.status === "live";
  const isFinished = contest?.status === "finished";
  const isUpcoming = contest?.status === "upcoming" || !contest?.status;
  const isDevBypass = Boolean(registration?.is_dev_bypass || contestSlug.startsWith("dev-"));

  const countdown = useCountdown(isLive ? contest?.ends_at : contest?.starts_at);

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
                90 Minutes
              </span>
              <span className="flex items-center gap-1.5">
                <Code2 className="size-3.5 text-lime-400" />
                {contest.problem_count || problems.length || 4} Problems
              </span>
              <span className="flex items-center gap-1.5 text-zinc-300">
                <Users className="size-3.5 text-lime-400" />
                {contest.registered_count} Registered
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
            {isLive ? (
              <Button
                asChild
                size="lg"
                className="rounded-md bg-transparent text-white border border-white/20 font-semibold text-xs hover:bg-lime-400 hover:text-black hover:border-lime-400 shadow-none active:scale-[0.98] cursor-pointer transition-colors [&_svg]:transition-colors"
              >
                <a
                  href={`/contests/${contestSlug}/lobby`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Play className="mr-1.5 size-4 fill-current" /> Enter Contest Arena
                </a>
              </Button>
            ) : isFinished ? (
              <Button
                asChild
                size="lg"
                className="rounded-md bg-transparent text-white border border-white/20 font-semibold text-xs hover:bg-lime-400 hover:text-black hover:border-lime-400 active:scale-[0.98] cursor-pointer transition-colors [&_svg]:transition-colors"
              >
                <Link to={`/contests/${contestSlug}/results`}>
                  <Trophy className="mr-1.5 size-4" /> View Final Standings
                </Link>
              </Button>
            ) : isRegistered ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-emerald-500/30 bg-emerald-950/40 text-emerald-400 font-sans text-xs font-semibold">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  <span>You are Registered · Contest Opens at Start Time</span>
                </div>
                <span className="text-xs text-zinc-400 font-sans">
                  Arena unlocks automatically at start time
                </span>
                {isDevBypass && (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="rounded-md border-lime-400/30 bg-black text-lime-400 hover:bg-lime-400/10 text-xs font-mono cursor-pointer"
                  >
                    <a
                      href={`/contests/${contestSlug}/lobby`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Play className="mr-1.5 size-3.5 fill-current" /> Enter Arena (Dev Mode)
                    </a>
                  </Button>
                )}
              </div>
            ) : (
              <Button
                onClick={handleRegister}
                disabled={isRegistering}
                size="lg"
                className="rounded-md bg-transparent text-white border border-white/20 font-semibold text-xs hover:bg-lime-400 hover:text-black hover:border-lime-400 active:scale-[0.98] cursor-pointer transition-colors [&_svg]:transition-colors"
              >
                <Sparkles className="mr-1.5 size-4" />
                {isRegistering ? "Registering..." : "Register for Contest"}
              </Button>
            )}
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

        {/* Right Column: Problem Set Table */}
        <div className="lg:col-span-7 rounded-lg border border-white/8 bg-black p-6 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <h2 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
                Problem Set
              </h2>
              <span className="text-[11px] font-mono text-zinc-500">
                {problems.length || contest.problem_count || 4} Challenges
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
                {isUpcoming && !isDevBypass ? (
                  [1, 2, 3, 4].map((idx) => (
                    <TableRow key={idx} className="border-white/4">
                      <TableCell className="font-mono text-xs font-bold text-zinc-500">
                        {String.fromCharCode(64 + idx)}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-zinc-500 flex items-center gap-2 py-3.5">
                        <Lock className="size-3 text-zinc-600" />
                        <span>Problem {String.fromCharCode(64 + idx)} (Sealed until contest starts)</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-500 tabular-nums">
                        {idx * 100} pts
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-zinc-600">
                        Locked
                      </TableCell>
                    </TableRow>
                  ))
                ) : problems.length === 0 ? (
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
                          <Link to={`/contests/${contestSlug}/arena`}>
                            Solve →
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="pt-3 border-t border-white/8 flex items-center justify-end text-xs font-mono text-zinc-500">
            <Link
              to={`/contests/${contestSlug}/results`}
              className="text-lime-400 hover:underline flex items-center gap-1"
            >
              View Standings →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
