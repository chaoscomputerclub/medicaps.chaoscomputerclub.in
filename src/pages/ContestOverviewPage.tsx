import { Link, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContestDetailThunk, registerContestThunk } from "@/store/slices/contestSlice";
import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Code2,
  Gift,
  Lock,
  MapPin,
  Play,
  QrCode,
  RotateCcw,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { contestApi } from "@/features/contest/api";
import { invalidateSwrCache } from "@/lib/cache/swrCache";
import { useRealtimeEvents } from "@/lib/realtime";
import { PhaseBadge, RoundsTimeline } from "@/features/contest/components";
import { AssessmentConfirmModal } from "@/organization/components/AssessmentConfirmModal";
import { ContestDetailSkeleton } from "@/organization/components/skeletons";
import { SectionHeader } from "@/organization/components/ui";
import {
  ASSESSMENT_DURATION_MINUTES,
  FINALIST_SEATS,
  assessmentClosesAt,
  assessmentOpensAt,
  cadenceLabel,
  contestPhase,
  formatWhen,
} from "@/features/contest/lifecycle";

export function ContestOverviewPage() {
  const { contestSlug = "" } = useParams<{ contestSlug: string }>();
  const dispatch = useAppDispatch();
  const { currentContest: contest, registration, problems, isLoadingDetail } = useAppSelector(
    (state) => state.contest
  );

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [assessmentConfirmOpen, setAssessmentConfirmOpen] = useState(false);

  const refreshDetail = useCallback((force = false) => {
    if (!contestSlug) return;
    if (force) {
      invalidateSwrCache("contests:*");
      invalidateSwrCache(`contest:*:${contestSlug}*`);
    }
    dispatch(fetchContestDetailThunk({ slug: contestSlug, force }));
  }, [contestSlug, dispatch]);

  // Initial load
  useEffect(() => {
    refreshDetail(false);
  }, [refreshDetail]);

  // Real-time synchronization
  useRealtimeEvents(contestSlug, (event) => {
    if (
      event.event === "contest_status_changed" ||
      event.event === "top30_qualified" ||
      event.event === "pass_checked_in"
    ) {
      refreshDetail(true);
    }
  });

  useEffect(() => {
    if (!contestSlug) return;

    const handleSync = () => {
      refreshDetail(true);
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "ccc:assessment_updated" || e.key === "ccc_member" || e.key?.includes(contestSlug)) {
        refreshDetail(true);
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
  }, [contestSlug, refreshDetail]);

  if (isLoadingDetail && !contest) return <ContestDetailSkeleton />;
  if (!contest) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center font-mono text-xs text-zinc-400">
        Contest not found.
      </div>
    );
  }

  const phase = contestPhase(contest, registration ?? null);
  const isAssessmentSubmitted = Boolean(
    phase === "assessment_submitted" ||
    registration?.assessment_taken ||
    registration?.assessment_status === "submitted"
  );
  const isRegistered = Boolean(registration?.registered || contest.registered);
  const opensAt = assessmentOpensAt(contest);
  const qualified = Boolean(registration?.is_top_30_qualified || registration?.can_enter_live_contest);
  const isDevBypass = Boolean(registration?.is_dev_bypass || contestSlug.startsWith("dev-"));

  const handleResetAttempt = async () => {
    try {
      const res = await contestApi.resetDevSession(contestSlug);
      toast.success(res.message || "Session reset.");
      refreshDetail(true);
    } catch (err: any) {
      toast.error(err.message || "Reset failed");
    }
  };

  const handleRegister = async () => {
    const res = await dispatch(registerContestThunk(contestSlug));
    if (registerContestThunk.fulfilled.match(res)) {
      toast.success("Registered for Round 1.");
      setConfirmOpen(false);
      refreshDetail(true);
    } else {
      toast.error(String(res.payload || "Registration failed"));
    }
  };

  // Determine the single primary action for this phase
  const renderPrimaryAction = () => {
    // Dev bypass reset
    if (isDevBypass) {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => setAssessmentConfirmOpen(true)}
            className="rounded-none bg-lime-400 font-mono text-xs font-black uppercase tracking-wider text-black hover:bg-lime-300 shadow-md shadow-lime-400/20"
          >
            <Play className="mr-1.5 size-4 fill-black" /> Take Assessment
          </Button>
          {(phase === "final_live" || isDevBypass) && (
            <Button asChild className="rounded-none bg-cyan-500 font-mono text-xs font-black uppercase tracking-wider text-white hover:bg-cyan-600 shadow-md shadow-cyan-500/20">
              <Link to={`/portal/contests/${contestSlug}/arena`}>
                <Zap className="mr-1.5 size-4 fill-black" /> Enter Final Arena
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetAttempt}
            className="rounded-none border-white/10 font-mono text-xs text-zinc-400 hover:text-white"
          >
            <RotateCcw className="mr-1.5 size-3.5" /> Reset
          </Button>
        </div>
      );
    }

    // Not registered
    if (!isRegistered) {
      return (
        <Button
          onClick={() => setConfirmOpen(true)}
          size="lg"
          className="rounded-none bg-lime-400 font-mono text-xs font-black uppercase tracking-wider text-black hover:bg-lime-300 shadow-lg shadow-lime-400/20"
        >
          <Sparkles className="mr-1.5 size-4" /> Register for Contest
        </Button>
      );
    }

    // Registered, assessment submitted
    if (isAssessmentSubmitted) {
      if (qualified && (phase === "final_live" || phase === "complete")) {
        return (
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="rounded-none bg-cyan-500 font-mono text-xs font-black uppercase tracking-wider text-white hover:bg-cyan-600 shadow-md shadow-cyan-500/20">
              <Link to={`/portal/contests/${contestSlug}/arena`}>
                <Play className="mr-1.5 size-4 fill-black" /> Enter Live Final
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-none border-white/10 font-mono text-xs uppercase text-white hover:bg-zinc-800">
              <Link to={`/portal/contests/${contestSlug}/qualified`}>
                <QrCode className="mr-1.5 size-4 text-lime-400" /> Campus Pass
              </Link>
            </Button>
          </div>
        );
      }
      return (
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" size="lg" className="rounded-none border-emerald-500/40 bg-emerald-950/20 font-mono text-xs font-bold uppercase text-emerald-400 hover:bg-emerald-950/40">
            <Link to={`/portal/contests/${contestSlug}/results`}>
              <BadgeCheck className="mr-1.5 size-4" /> Submitted · View Standings
            </Link>
          </Button>
          {qualified && (
            <Button asChild variant="outline" size="lg" className="rounded-none font-mono text-xs uppercase border-white/10">
              <Link to={`/portal/contests/${contestSlug}/qualified`}>
                <QrCode className="mr-1.5 size-4 text-lime-400" /> Campus Pass
              </Link>
            </Button>
          )}
        </div>
      );
    }

    // Registered, not yet submitted
    if (phase === "final_live") {
      if (qualified) {
        return (
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="rounded-none bg-cyan-500 font-mono text-xs font-black uppercase text-white hover:bg-cyan-600 shadow-md shadow-cyan-500/20">
              <Link to={`/portal/contests/${contestSlug}/arena`}>
                <Play className="mr-1.5 size-4 fill-black" /> Enter Live Final
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-none font-mono text-xs uppercase border-white/10">
              <Link to={`/portal/contests/${contestSlug}/qualified`}>
                <QrCode className="mr-1.5 size-4 text-lime-400" /> Campus Pass
              </Link>
            </Button>
          </div>
        );
      }
      return (
        <Button variant="outline" disabled size="lg" className="rounded-none font-mono text-xs uppercase border-white/10">
          <Lock className="mr-1.5 size-4" /> Top {FINALIST_SEATS} Only
        </Button>
      );
    }

    // Assessment is not yet open (Strict 24h window)
    if (phase === "registration_open" && !isDevBypass) {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            disabled
            size="lg"
            className="rounded-none font-mono text-xs uppercase border-amber-500/30 bg-amber-950/20 text-amber-400 cursor-not-allowed"
          >
            <Lock className="mr-1.5 size-4 text-amber-400" /> Assessment Unlocks {formatWhen(opensAt.toISOString())}
          </Button>
        </div>
      );
    }

    // Assessment entry window has concluded (2h prior to physical final)
    if (phase === "assessment_closed" && !isDevBypass) {
      return (
        <Button
          variant="outline"
          disabled
          size="lg"
          className="rounded-none font-mono text-xs uppercase border-white/10 text-zinc-500 cursor-not-allowed"
        >
          <Lock className="mr-1.5 size-4" /> Assessment Closed (Verification In Progress)
        </Button>
      );
    }

    // Assessment is genuinely open or dev sandbox contest
    return (
      <Button
        onClick={() => setAssessmentConfirmOpen(true)}
        size="lg"
        className="rounded-none bg-lime-400 font-mono text-xs font-black uppercase tracking-wider text-black hover:bg-lime-300 shadow-lg shadow-lime-400/20"
      >
        <Play className="mr-1.5 size-4 fill-black" /> Take Assessment
      </Button>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back */}
      <Link to="/portal/contests" className="inline-flex items-center gap-2 font-mono text-xs text-zinc-400 hover:text-white transition-colors">
        <ArrowLeft className="size-3.5" /> Back to contests
      </Link>

      {/* ─── HERO HEADER ──────────────────────────────────── */}
      <header className="grid gap-0 overflow-hidden rounded-none border border-white/10 bg-zinc-900/60 backdrop-blur-md shadow-xl lg:grid-cols-[1fr_280px]">
        {/* Left: Identity */}
        <div className="flex flex-col justify-between gap-8 p-7">
          {/* Phase + cadence chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-lime-400">
              (01 // Contest Briefing)
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              INDEX 1.0 · {contest.season}
            </span>
            <PhaseBadge phase={phase} />
            <span className="rounded-none border border-white/10 bg-zinc-800/60 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
              {cadenceLabel(contest)} {contest.edition || ""}
            </span>
            {isDevBypass && (
              <span className="rounded-none border border-emerald-500/40 bg-emerald-950/20 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                ⚡ Dev Bypass
              </span>
            )}
          </div>

          {/* Title */}
          <div className="space-y-3">
            <div className="flex items-start gap-4">
              <div className="hidden size-12 shrink-0 items-center justify-center rounded-none border border-white/10 bg-zinc-950/60 text-lime-400 sm:flex shadow-inner">
                <Trophy className="size-5" />
              </div>
              <div>
                <h1 className="text-3xl font-black leading-tight text-white md:text-4xl uppercase font-mono">
                  {contest.title}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
                  {contest.summary}
                </p>
              </div>
            </div>
          </div>

          {/* Meta pills */}
          <div className="flex flex-wrap items-center gap-5 text-xs text-zinc-400 font-mono">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-lime-400" />
              {ASSESSMENT_DURATION_MINUTES} min assessment
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5 text-lime-400" />
              Top {FINALIST_SEATS} advance
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5 text-lime-400" />
              Campus final
            </span>
          </div>

          {/* Primary Action */}
          <div className="flex flex-col gap-3">
            {renderPrimaryAction()}

            {/* Ghost secondary: view results always visible when submitted */}
            {(isAssessmentSubmitted || pastContestsHaveResults(phase)) && (
              <Link
                to={`/portal/contests/${contestSlug}/results`}
                className="w-fit font-mono text-xs text-zinc-400 underline-offset-4 hover:text-white hover:underline"
              >
                View full rankings →
              </Link>
            )}
          </div>

          {/* Registration status strip */}
          {isRegistered && (
            <div className="flex items-center gap-3 border-t border-white/10 pt-5">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">
                  {isAssessmentSubmitted
                    ? "Your answers are safely recorded"
                    : phase === "complete"
                      ? "Contest completed"
                      : "Your place is reserved"}
                </p>
                {!isAssessmentSubmitted && (
                  <p className="text-xs text-zinc-400">
                    Timer starts the moment you enter — it cannot be paused.
                  </p>
                )}
              </div>
              {registration?.assessment_rank && (
                <span className="ml-auto shrink-0 rounded-none border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 font-mono text-xs font-bold tabular-nums text-lime-400">
                  Rank #{registration.assessment_rank} · {registration.assessment_score ?? 0} pts
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Next milestone sidebar */}
        <div className="flex flex-col justify-between border-t border-white/10 bg-zinc-950/60 p-6 lg:border-l lg:border-t-0">
          <div className="space-y-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
              Next milestone
            </p>
            <dl className="space-y-4">
              <div className="flex gap-3">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-lime-400" />
                <div>
                  <dt className="text-xs text-zinc-400">Round 1 opens</dt>
                  <dd className="mt-0.5 text-xs font-semibold text-white">
                    {formatWhen(opensAt.toISOString())}
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-lime-400" />
                <div>
                  <dt className="text-xs text-zinc-400">Offline final</dt>
                  <dd className="mt-0.5 text-xs font-semibold text-white">
                    {formatWhen(contest.starts_at)}
                  </dd>
                  {contest.venue && (
                    <dd className="text-xs text-zinc-400">{contest.venue}</dd>
                  )}
                </div>
              </div>
              {contest.environment && (
                <div className="flex gap-3">
                  <Code2 className="mt-0.5 size-4 shrink-0 text-lime-400" />
                  <div>
                    <dt className="text-xs text-zinc-400">Environment</dt>
                    <dd className="mt-0.5 text-xs font-semibold text-white">{contest.environment}</dd>
                  </div>
                </div>
              )}
            </dl>
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            <div className="flex items-baseline justify-between font-mono">
              <span className="text-2xl font-black tabular-nums text-white">
                {contest.registered_count}
              </span>
              <span className="text-xs tabular-nums text-zinc-400">
                / {contest.seat_capacity} registered
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-none bg-zinc-800">
              <div
                className="h-full bg-lime-400 transition-all rounded-none"
                style={{ width: `${Math.min(100, ((contest.registered_count || 0) / (contest.seat_capacity || 60)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ─── ROUNDS TIMELINE ──────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          kicker="01 // Progression Timeline"
          index="ROUNDS 1 & 2"
          title="Your Path to the Final"
        />
        <div className="rounded-none border border-white/10 bg-zinc-900/60 p-6 backdrop-blur-md shadow-xl">
          <RoundsTimeline contest={contest} phase={phase} />
        </div>
      </section>

      {/* ─── RULES & PROBLEM SET ──────────────────────────── */}
      <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-none border border-white/10 bg-zinc-900/60 p-6 space-y-4 backdrop-blur-md shadow-xl">
          <SectionHeader
            kicker="02 // Tournament Rules"
            index={`TOP ${FINALIST_SEATS}`}
            title="Contest Regulations"
          />
          <ol className="space-y-3">
            {(contest.rules.length
              ? contest.rules
              : [
                  "Round 1 is individual and fully timed.",
                  `Top ${FINALIST_SEATS} scores advance to the campus final.`,
                  "Keep the assessment open — closing does not stop your timer.",
                  "Offline final uses campus workstations with QR pass entry.",
                ]
            ).map((rule, i) => (
              <li key={rule} className="flex gap-3 text-xs leading-relaxed text-zinc-300">
                <span className="font-mono font-bold text-lime-400">{String(i + 1).padStart(2, "0")}</span>
                {rule}
              </li>
            ))}
          </ol>
          {contest.prize_pool && (
            <div className="flex items-center gap-2 border-t border-white/10 pt-4 text-xs font-semibold text-white">
              <Gift className="size-4 text-lime-400" />
              {contest.prize_pool}
            </div>
          )}
        </div>

        {/* ─── PROBLEM SET ────────────────────────────────── */}
        <div className="rounded-none border border-white/10 bg-zinc-900/60 overflow-hidden backdrop-blur-md shadow-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-400">Problem Set</h2>
            <span className="font-mono text-xs tabular-nums text-zinc-400">
              {problems.length || contest.problem_count} problems
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent bg-zinc-950/40">
                <TableHead className="w-12 font-mono text-[10px] uppercase tracking-widest text-zinc-400">#</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">Problem</TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest text-zinc-400">Pts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {problems.length === 0 ? (
                <TableRow className="border-white/5">
                  <TableCell colSpan={3} className="py-10 text-center font-mono text-xs text-zinc-400">
                    <Lock className="mx-auto mb-2 size-4 text-zinc-500" />
                    Sealed until Round 1 opens
                  </TableCell>
                </TableRow>
              ) : (
                problems.map((p) => (
                  <TableRow key={p.problem_index} className="border-white/5 hover:bg-zinc-800/40">
                    <TableCell className="font-mono text-xs font-bold text-lime-400">{p.problem_index}</TableCell>
                    <TableCell className="text-sm font-medium text-white">{p.title}</TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold tabular-nums text-white">{p.points}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Registration dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="border-white/10 bg-zinc-900 text-white rounded-none">
          <DialogHeader>
            <DialogTitle className="text-white">Register for {contest.title}?</DialogTitle>
            <DialogDescription className="text-zinc-400">
              This reserves your Round 1 slot. The assessment opens {formatWhen(opensAt.toISOString())} and stays open for 24 hours.
              Your {ASSESSMENT_DURATION_MINUTES}-minute timer starts the moment you enter and cannot be paused.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-none border-white/10" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-none font-mono text-xs font-bold bg-lime-400 hover:bg-lime-300 text-black font-bold" onClick={handleRegister}>
              Confirm Registration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssessmentConfirmModal
        open={assessmentConfirmOpen}
        onOpenChange={setAssessmentConfirmOpen}
        contestSlug={contestSlug}
        contestTitle={contest.title}
        durationMinutes={ASSESSMENT_DURATION_MINUTES}
      />
    </div>
  );
}

function pastContestsHaveResults(phase: string) {
  return phase === "complete" || phase === "final_live" || phase === "assessment_submitted";
}
