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

  // Real-time synchronization: polling + window focus + visibility change + cross-tab storage + custom events
  // Instant real-time push: updates contest details on status changes or qualifications
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
      <div className="page-wrap">
        <div className="py-20 text-center font-mono text-xs text-[var(--muted)]">Contest not found.</div>
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
  const closesAt = assessmentClosesAt(contest);
  const now = Date.now();
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
            className="rounded-none bg-[var(--accent)] font-mono text-xs font-black uppercase tracking-wider text-black hover:bg-[var(--accent)]/90"
          >
            <Play className="mr-1.5 size-4 fill-black" /> Take Assessment
          </Button>
          {(phase === "final_live" || isDevBypass) && (
            <Button asChild className="rounded-none bg-[var(--cyan)] font-mono text-xs font-black uppercase tracking-wider text-black hover:bg-[var(--cyan)]/90">
              <Link to={`/portal/contests/${contestSlug}/arena`}>
                <Zap className="mr-1.5 size-4 fill-black" /> Enter Final Arena
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetAttempt}
            className="rounded-none border-[var(--line)] font-mono text-xs text-[var(--muted)] hover:text-foreground"
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
          className="rounded-none bg-[var(--accent)] font-mono text-xs font-black uppercase tracking-wider text-black hover:bg-[var(--accent)]/90"
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
            <Button asChild size="lg" className="rounded-none bg-[var(--cyan)] font-mono text-xs font-black uppercase tracking-wider text-black hover:bg-[var(--cyan)]/90">
              <Link to={`/portal/contests/${contestSlug}/arena`}>
                <Play className="mr-1.5 size-4 fill-black" /> Enter Live Final
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-none border-[var(--line)] font-mono text-xs uppercase text-foreground hover:bg-[var(--surface-2)]">
              <Link to={`/portal/contests/${contestSlug}/qualified`}>
                <QrCode className="mr-1.5 size-4" /> Campus Pass
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
            <Button asChild variant="outline" size="lg" className="rounded-none font-mono text-xs uppercase">
              <Link to={`/portal/contests/${contestSlug}/qualified`}>
                <QrCode className="mr-1.5 size-4 text-[var(--accent)]" /> Campus Pass
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
            <Button asChild size="lg" className="rounded-none bg-[var(--cyan)] font-mono text-xs font-black uppercase text-black">
              <Link to={`/portal/contests/${contestSlug}/arena`}>
                <Play className="mr-1.5 size-4 fill-black" /> Enter Live Final
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-none font-mono text-xs uppercase">
              <Link to={`/portal/contests/${contestSlug}/qualified`}>
                <QrCode className="mr-1.5 size-4 text-[var(--accent)]" /> Campus Pass
              </Link>
            </Button>
          </div>
        );
      }
      return (
        <Button variant="outline" disabled size="lg" className="rounded-none font-mono text-xs uppercase">
          <Lock className="mr-1.5 size-4" /> Top {FINALIST_SEATS} Only
        </Button>
      );
    }

    // Assessment is open or registered-waiting
    return (
      <Button
        onClick={() => setAssessmentConfirmOpen(true)}
        size="lg"
        className="rounded-none bg-[var(--accent)] font-mono text-xs font-black uppercase tracking-wider text-black hover:bg-[var(--accent)]/90"
      >
        <Play className="mr-1.5 size-4 fill-black" /> Take Assessment
      </Button>
    );
  };

  return (
    <div className="page-wrap max-w-5xl space-y-8">
      {/* Back */}
      <Link to="/portal/contests" className="back-link">
        <ArrowLeft /> Back to contests
      </Link>

      {/* ─── HERO HEADER ──────────────────────────────────── */}
      <header className="grid gap-0 overflow-hidden border border-[var(--line)] bg-[var(--surface)] lg:grid-cols-[1fr_280px]">
        {/* Left: Identity */}
        <div className="flex flex-col justify-between gap-8 p-7">
          {/* Phase + cadence chips */}
          <div className="flex flex-wrap items-center gap-2">
            <PhaseBadge phase={phase} />
            <span className="border border-[var(--line)] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
              {cadenceLabel(contest)} {contest.edition || ""}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
              {contest.season}
            </span>
            {isDevBypass && (
              <span className="border border-emerald-500/40 bg-emerald-950/20 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                ⚡ Dev Bypass
              </span>
            )}
          </div>

          {/* Title */}
          <div className="space-y-3">
            <div className="flex items-start gap-4">
              <div className="hidden size-12 shrink-0 items-center justify-center border border-[var(--line)] bg-[var(--surface-2)] sm:flex">
                <Trophy className="size-5 text-[var(--accent)]" />
              </div>
              <div>
                <h1 className="text-3xl font-black leading-tight text-foreground md:text-4xl">
                  {contest.title}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
                  {contest.summary}
                </p>
              </div>
            </div>
          </div>

          {/* Meta pills */}
          <div className="flex flex-wrap items-center gap-5 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-[var(--accent)]" />
              {ASSESSMENT_DURATION_MINUTES} min assessment
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5 text-[var(--accent)]" />
              Top {FINALIST_SEATS} advance
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5 text-[var(--accent)]" />
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
                className="w-fit font-mono text-xs text-[var(--muted)] underline-offset-4 hover:text-foreground hover:underline"
              >
                View full rankings →
              </Link>
            )}
          </div>

          {/* Registration status strip */}
          {isRegistered && (
            <div className="flex items-center gap-3 border-t border-[var(--line)] pt-5">
              <CheckCircle2 className="size-4 shrink-0 text-[var(--accent)]" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  {isAssessmentSubmitted
                    ? "Your answers are safely recorded"
                    : phase === "complete"
                      ? "Contest completed"
                      : "Your place is reserved"}
                </p>
                {!isAssessmentSubmitted && (
                  <p className="text-xs text-[var(--muted)]">
                    Timer starts the moment you enter — it cannot be paused.
                  </p>
                )}
              </div>
              {registration?.assessment_rank && (
                <span className="ml-auto shrink-0 border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2.5 py-0.5 font-mono text-xs font-bold text-[var(--accent)]">
                  Rank #{registration.assessment_rank} · {registration.assessment_score ?? 0} pts
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Next milestone sidebar */}
        <div className="flex flex-col justify-between border-t border-[var(--line)] bg-[var(--surface-2)] p-6 lg:border-l lg:border-t-0">
          <div className="space-y-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
              Next milestone
            </p>
            <dl className="space-y-4">
              <div className="flex gap-3">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                <div>
                  <dt className="text-xs text-[var(--muted)]">Round 1 opens</dt>
                  <dd className="mt-0.5 text-xs font-semibold text-foreground">
                    {formatWhen(opensAt.toISOString())}
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                <div>
                  <dt className="text-xs text-[var(--muted)]">Offline final</dt>
                  <dd className="mt-0.5 text-xs font-semibold text-foreground">
                    {formatWhen(contest.starts_at)}
                  </dd>
                  {contest.venue && (
                    <dd className="text-xs text-[var(--muted)]">{contest.venue}</dd>
                  )}
                </div>
              </div>
              {contest.environment && (
                <div className="flex gap-3">
                  <Code2 className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Environment</dt>
                    <dd className="mt-0.5 text-xs font-semibold text-foreground">{contest.environment}</dd>
                  </div>
                </div>
              )}
            </dl>
          </div>

          <div className="mt-6 border-t border-[var(--line)] pt-5">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-2xl font-black text-foreground">
                {contest.registered_count}
              </span>
              <span className="font-mono text-xs text-[var(--muted)]">
                / {contest.seat_capacity} registered
              </span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden bg-[var(--line)]">
              <div
                className="h-full bg-[var(--accent)] transition-all"
                style={{ width: `${Math.min(100, ((contest.registered_count || 0) / (contest.seat_capacity || 60)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ─── ROUNDS TIMELINE ──────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
          Your path to the final
        </h2>
        <div className="border border-[var(--line)] bg-[var(--surface)] p-6">
          <RoundsTimeline contest={contest} phase={phase} />
        </div>
      </section>

      {/* ─── RULES ────────────────────────────────────────── */}
      <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="border border-[var(--line)] bg-[var(--surface)] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Contest Rules</h2>
            <span className="border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2.5 py-0.5 font-mono text-xs font-black text-[var(--accent)]">
              Top {FINALIST_SEATS}
            </span>
          </div>
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
              <li key={rule} className="flex gap-3 text-xs leading-relaxed text-[var(--muted)]">
                <span className="font-mono font-bold text-[var(--accent)]">{String(i + 1).padStart(2, "0")}</span>
                {rule}
              </li>
            ))}
          </ol>
          {contest.prize_pool && (
            <div className="flex items-center gap-2 border-t border-[var(--line)] pt-4 text-xs font-semibold text-foreground">
              <Gift className="size-4 text-[var(--accent)]" />
              {contest.prize_pool}
            </div>
          )}
        </div>

        {/* ─── PROBLEM SET ────────────────────────────────── */}
        <div className="border border-[var(--line)] bg-[var(--surface)] space-y-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
            <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Problem Set</h2>
            <span className="font-mono text-xs text-[var(--muted)]">
              {problems.length || contest.problem_count} problems
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--line)] hover:bg-transparent">
                <TableHead className="w-10 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">#</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Problem</TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Pts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {problems.length === 0 ? (
                <TableRow className="border-[var(--line)]">
                  <TableCell colSpan={3} className="py-10 text-center font-mono text-xs text-[var(--muted)]">
                    <Lock className="mx-auto mb-2 size-4" />
                    Sealed until Round 1 opens
                  </TableCell>
                </TableRow>
              ) : (
                problems.map((p) => (
                  <TableRow key={p.problem_index} className="border-[var(--line)]">
                    <TableCell className="font-mono text-xs font-bold text-[var(--accent)]">{p.problem_index}</TableCell>
                    <TableCell className="text-sm font-medium text-foreground">{p.title}</TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-foreground">{p.points}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Registration dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="border-[var(--line)] bg-[var(--surface)]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Register for {contest.title}?</DialogTitle>
            <DialogDescription className="text-[var(--muted)]">
              This reserves your Round 1 slot. The assessment opens {formatWhen(opensAt.toISOString())} and stays open for 24 hours.
              Your {ASSESSMENT_DURATION_MINUTES}-minute timer starts the moment you enter and cannot be paused.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-none font-mono text-xs font-bold" onClick={handleRegister}>
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
