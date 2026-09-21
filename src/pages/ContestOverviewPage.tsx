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
  ShieldAlert,
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
      <div className="max-w-5xl mx-auto px-4 py-20 text-center font-mono text-xs text-zinc-500">
        Contest not found.
      </div>
    );
  }

  const phase = contestPhase(contest, registration ?? null);
  const isInProgress = Boolean(
    registration?.can_resume_assessment ||
    (registration?.assessment_status === "in_progress" && !registration?.assessment_taken)
  );
  const isAssessmentSubmitted = Boolean(
    !isInProgress && (
      phase === "assessment_submitted" ||
      registration?.assessment_taken ||
      registration?.assessment_status === "submitted" ||
      registration?.assessment_status === "completed"
    )
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

  const renderPrimaryAction = () => {
    if (isInProgress) {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            asChild
            size="lg"
            className="rounded-md bg-amber-400 font-mono text-xs font-semibold text-black hover:bg-amber-300"
          >
            <a href={`/assessments/${contestSlug}`} target="_blank" rel="noopener noreferrer">
              <Play className="mr-1.5 size-3.5 fill-black" /> Resume Session
            </a>
          </Button>
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-amber-500/30 bg-black text-amber-300 font-mono text-xs">
            <ShieldAlert size={14} className="text-amber-400 shrink-0" />
            <span>
              Active Attempt · Warning {registration?.anti_cheat_violations || 1} of {registration?.max_violations || 3}
            </span>
          </div>
          {isDevBypass && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetAttempt}
              className="rounded-md border-white/10 font-mono text-xs text-zinc-400 hover:text-white"
            >
              <RotateCcw className="mr-1.5 size-3" /> Reset
            </Button>
          )}
        </div>
      );
    }

    if (isDevBypass) {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            asChild
            className="rounded-md bg-lime-400 font-mono text-xs font-semibold text-black hover:bg-lime-300"
          >
            <Link to={`/portal/contests/${contestSlug}/lobby`}>
              <Play className="mr-1.5 size-3.5 fill-black" /> Enter Assessment Lobby
            </Link>
          </Button>
          {(phase === "final_live" || isDevBypass) && (
            <Button asChild variant="outline" className="rounded-md border-white/12 bg-black font-mono text-xs font-semibold text-white hover:border-white/25">
              <Link to={`/portal/contests/${contestSlug}/arena`}>
                <Zap className="mr-1.5 size-3.5 text-lime-400" /> Enter Final Arena
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetAttempt}
            className="rounded-md border-white/10 font-mono text-xs text-zinc-400 hover:text-white"
          >
            <RotateCcw className="mr-1.5 size-3" /> Reset
          </Button>
        </div>
      );
    }

    if (!isRegistered) {
      return (
        <Button
          onClick={() => setConfirmOpen(true)}
          size="lg"
          className="rounded-md bg-lime-400 font-mono text-xs font-semibold text-black hover:bg-lime-300"
        >
          <Sparkles className="mr-1.5 size-3.5" /> Register for Contest
        </Button>
      );
    }

    if (isAssessmentSubmitted) {
      if (qualified && (phase === "final_live" || phase === "complete")) {
        return (
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="rounded-md bg-lime-400 font-mono text-xs font-semibold text-black hover:bg-lime-300">
              <Link to={`/portal/contests/${contestSlug}/arena`}>
                <Play className="mr-1.5 size-3.5 fill-black" /> Enter Final Arena
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-md border-white/10 bg-black font-mono text-xs text-white hover:border-white/20">
              <Link to={`/portal/contests/${contestSlug}/qualified`}>
                <QrCode className="mr-1.5 size-3.5 text-lime-400" /> Finalist Pass
              </Link>
            </Button>
          </div>
        );
      }
      return (
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" size="lg" className="rounded-md border-lime-400/30 bg-black font-mono text-xs font-semibold text-lime-400 hover:bg-lime-400/10">
            <Link to={`/portal/contests/${contestSlug}/results`}>
              <BadgeCheck className="mr-1.5 size-3.5" /> View Standings
            </Link>
          </Button>
          {qualified && (
            <Button asChild variant="outline" size="lg" className="rounded-md font-mono text-xs border-white/10 bg-black text-white hover:border-white/20">
              <Link to={`/portal/contests/${contestSlug}/qualified`}>
                <QrCode className="mr-1.5 size-3.5 text-lime-400" /> Finalist Pass
              </Link>
            </Button>
          )}
        </div>
      );
    }

    if (phase === "final_live") {
      if (qualified) {
        return (
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="rounded-md bg-lime-400 font-mono text-xs font-semibold text-black hover:bg-lime-300">
              <Link to={`/portal/contests/${contestSlug}/arena`}>
                <Play className="mr-1.5 size-3.5 fill-black" /> Enter Final Arena
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-md font-mono text-xs border-white/10 bg-black text-white">
              <Link to={`/portal/contests/${contestSlug}/qualified`}>
                <QrCode className="mr-1.5 size-3.5 text-lime-400" /> Finalist Pass
              </Link>
            </Button>
          </div>
        );
      }
      return (
        <Button variant="outline" disabled size="lg" className="rounded-md font-mono text-xs border-white/10 bg-black text-zinc-600">
          <Lock className="mr-1.5 size-3.5" /> Top {FINALIST_SEATS} Finalists Only
        </Button>
      );
    }

    if (phase === "registration_open" && !isDevBypass) {
      return (
        <Button
          variant="outline"
          disabled
          size="lg"
          className="rounded-md font-mono text-xs border-white/10 bg-black text-zinc-500 cursor-not-allowed"
        >
          <Lock className="mr-1.5 size-3.5 text-zinc-500" /> Unlocks {formatWhen(opensAt.toISOString())}
        </Button>
      );
    }

    if (phase === "assessment_closed" && !isDevBypass) {
      return (
        <Button
          variant="outline"
          disabled
          size="lg"
          className="rounded-md font-mono text-xs border-white/10 bg-black text-zinc-600 cursor-not-allowed"
        >
          <Lock className="mr-1.5 size-3.5" /> Assessment Window Concluded
        </Button>
      );
    }

    return (
      <Button
        asChild
        size="lg"
        className="rounded-md bg-lime-400 font-mono text-xs font-semibold text-black hover:bg-lime-300"
      >
        <Link to={`/portal/contests/${contestSlug}/lobby`}>
          <Play className="mr-1.5 size-3.5 fill-black" /> Start Assessment
        </Link>
      </Button>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Back navigation */}
      <Link to="/portal/contests" className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-500 hover:text-white transition-colors">
        <ArrowLeft className="size-3.5" /> Back to Contests
      </Link>

      {/* In-Progress Alert */}
      {isInProgress && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border border-amber-500/30 bg-black">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <ShieldAlert className="size-4" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-amber-400">
                  Active Assessment Session
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-black text-amber-300 uppercase">
                  Warning {registration?.anti_cheat_violations || 1} / {registration?.max_violations || 3}
                </span>
              </div>
              <p className="font-mono text-xs text-zinc-400 max-w-2xl">
                Your session is active with strict server synchronization. Resume to complete your submission.
              </p>
            </div>
          </div>
          <Button
            asChild
            size="sm"
            className="shrink-0 rounded-md bg-amber-400 font-mono text-xs font-semibold text-black hover:bg-amber-300"
          >
            <a href={`/assessments/${contestSlug}`} target="_blank" rel="noopener noreferrer">
              <Play className="mr-1.5 size-3.5 fill-black" /> Resume
            </a>
          </Button>
        </div>
      )}

      {/* Hero Header */}
      <header className="grid gap-0 overflow-hidden rounded-lg border border-white/8 bg-black lg:grid-cols-[1fr_300px]">
        {/* Left: Identity */}
        <div className="flex flex-col justify-between gap-6 p-6 sm:p-7">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                {contest.season} · {cadenceLabel(contest)} {contest.edition || ""}
              </span>
              <PhaseBadge phase={phase} />
              {isDevBypass && (
                <span className="rounded px-2 py-0.5 border border-lime-400/30 bg-lime-400/10 font-mono text-[10px] uppercase tracking-wider text-lime-400 font-semibold">
                  Dev Bypass
                </span>
              )}
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                {contest.title}
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed max-w-xl">
                {contest.summary}
              </p>
            </div>

            {/* Meta pills */}
            <div className="flex flex-wrap items-center gap-4 pt-1 font-mono text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-lime-400" />
                {ASSESSMENT_DURATION_MINUTES} min window
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5 text-lime-400" />
                Top {FINALIST_SEATS} qualify
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-lime-400" />
                Campus final
              </span>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div>{renderPrimaryAction()}</div>

            {/* Registration status strip */}
            {isRegistered && (
              <div className="flex items-center justify-between border-t border-white/6 pt-4 text-xs font-mono">
                <div className="flex items-center gap-2 text-zinc-400">
                  <CheckCircle2 className="size-3.5 text-lime-400 shrink-0" />
                  <span>
                    {isAssessmentSubmitted
                      ? "Assessment recorded"
                      : phase === "complete"
                      ? "Contest finished"
                      : "Slot confirmed · single-attempt"}
                  </span>
                </div>
                {registration?.assessment_rank && (
                  <span className="font-semibold tabular-nums text-lime-400">
                    Rank #{registration.assessment_rank} ({registration.assessment_score ?? 0} pts)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Milestone Info */}
        <div className="flex flex-col justify-between border-t border-white/8 bg-black p-6 lg:border-l lg:border-t-0">
          <div className="space-y-4">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Schedule & Location
            </span>
            <dl className="space-y-3.5">
              <div className="flex gap-3">
                <CalendarDays className="mt-0.5 size-3.5 shrink-0 text-zinc-400" />
                <div>
                  <dt className="text-xs text-zinc-500">Assessment opens</dt>
                  <dd className="text-xs font-medium text-white">
                    {formatWhen(opensAt.toISOString())}
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-zinc-400" />
                <div>
                  <dt className="text-xs text-zinc-500">Final venue</dt>
                  <dd className="text-xs font-medium text-white">
                    {formatWhen(contest.starts_at)}
                  </dd>
                  {contest.venue && (
                    <dd className="text-xs text-zinc-400">{contest.venue}</dd>
                  )}
                </div>
              </div>
              {contest.environment && (
                <div className="flex gap-3">
                  <Code2 className="mt-0.5 size-3.5 shrink-0 text-zinc-400" />
                  <div>
                    <dt className="text-xs text-zinc-500">Runtime environment</dt>
                    <dd className="text-xs font-medium text-white">{contest.environment}</dd>
                  </div>
                </div>
              )}
            </dl>
          </div>

          <div className="mt-6 border-t border-white/8 pt-4">
            <div className="flex items-baseline justify-between font-mono text-xs">
              <span className="text-lg font-semibold tabular-nums text-white">
                {contest.registered_count}
              </span>
              <span className="tabular-nums text-zinc-500">
                / {contest.seat_capacity} registered
              </span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded bg-zinc-900">
              <div
                className="h-full bg-lime-400 transition-all rounded"
                style={{ width: `${Math.min(100, ((contest.registered_count || 0) / (contest.seat_capacity || 60)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Rounds Progression */}
      <section className="space-y-3">
        <SectionHeader
          kicker="01 // Progression"
          index="ROUNDS"
          title="Tournament Pipeline"
        />
        <div className="rounded-lg border border-white/8 bg-black p-5">
          <RoundsTimeline contest={contest} phase={phase} />
        </div>
      </section>

      {/* Rules & Problem Set */}
      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-white/8 bg-black p-5 space-y-4">
          <SectionHeader
            kicker="02 // Protocol"
            index={`TOP ${FINALIST_SEATS}`}
            title="Integrity Regulations"
          />
          <ol className="space-y-3 font-mono text-xs">
            {(contest.rules.length
              ? contest.rules
              : [
                  "Round 1 is strictly timed, single-attempt only.",
                  `Top ${FINALIST_SEATS} ranked candidates advance to campus final.`,
                  "Full-screen anti-cheat enforced with tab-switch penalties.",
                  "Offline final requires digital campus pass authentication.",
                ]
            ).map((rule, i) => (
              <li key={rule} className="flex gap-3 text-zinc-400">
                <span className="text-lime-400 font-semibold">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-zinc-300">{rule}</span>
              </li>
            ))}
          </ol>
          {contest.prize_pool && (
            <div className="flex items-center gap-2 border-t border-white/8 pt-3 text-xs font-mono text-white">
              <Gift className="size-3.5 text-lime-400" />
              <span>Pool: {contest.prize_pool}</span>
            </div>
          )}
        </div>

        {/* Problem Set */}
        <div className="rounded-lg border border-white/8 bg-black overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <h2 className="font-mono text-xs font-semibold text-zinc-300 uppercase tracking-wider">Problem Set</h2>
              <span className="font-mono text-xs tabular-nums text-zinc-500">
                {problems.length || contest.problem_count} challenges
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-white/8 hover:bg-transparent">
                  <TableHead className="w-12 font-mono text-[10px] uppercase text-zinc-500">#</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase text-zinc-500">Problem</TableHead>
                  <TableHead className="text-right font-mono text-[10px] uppercase text-zinc-500">Pts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {problems.length === 0 ? (
                  <TableRow className="border-white/4">
                    <TableCell colSpan={3} className="py-10 text-center font-mono text-xs text-zinc-500">
                      <Lock className="mx-auto mb-2 size-4 text-zinc-600" />
                      Problems sealed until assessment opens
                    </TableCell>
                  </TableRow>
                ) : (
                  problems.map((p) => (
                    <TableRow key={p.problem_index} className="border-white/4 hover:bg-zinc-950">
                      <TableCell className="font-mono text-xs font-semibold text-lime-400">{p.problem_index}</TableCell>
                      <TableCell className="text-xs font-medium text-white">{p.title}</TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-zinc-400">{p.points}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {(isAssessmentSubmitted || pastContestsHaveResults(phase)) && (
            <div className="p-4 border-t border-white/8 text-right">
              <Link
                to={`/portal/contests/${contestSlug}/results`}
                className="font-mono text-xs text-lime-400 hover:underline inline-flex items-center gap-1"
              >
                View Full Standings →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Registration Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="border-white/10 bg-black text-white rounded-lg max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-white tracking-tight">
              Register for {contest.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 leading-relaxed font-mono">
              Reserves your workstation slot for Round 1. The assessment opens {formatWhen(opensAt.toISOString())} for 24 hours. Your {ASSESSMENT_DURATION_MINUTES}-minute timer starts the moment you launch.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" className="rounded-md border-white/10 text-zinc-400 hover:text-white" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-md bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs font-semibold" onClick={handleRegister}>
              Confirm Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function pastContestsHaveResults(phase: string) {
  return phase === "complete" || phase === "final_live" || phase === "assessment_submitted";
}
