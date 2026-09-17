import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, CheckCircle2, Clock, Lock, Play, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ASSESSMENT_DURATION_MINUTES,
  ASSESSMENT_WINDOW_HOURS,
  FINALIST_SEATS,
  assessmentClosesAt,
  assessmentOpensAt,
  contestPhase,
  formatWhen,
} from "@/features/contest/lifecycle";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContestDetailThunk } from "@/store/slices/contestSlice";
import { invalidateSwrCache } from "@/lib/cache/swrCache";
import { ContestLobbySkeleton } from "@/organization/components/skeletons";
import { useRealtimeEvents } from "@/lib/realtime";

export function ContestLobbyPage() {
  const { contestSlug = "" } = useParams<{ contestSlug: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [ack, setAck] = useState(false);

  const { currentContest: contest, registration, isLoadingDetail } = useAppSelector(
    (state) => state.contest
  );

  const refreshLobby = useCallback((force = false) => {
    if (!contestSlug) return;
    if (force) {
      invalidateSwrCache("contests:*");
      invalidateSwrCache(`contest:*:${contestSlug}*`);
    }
    dispatch(fetchContestDetailThunk({ slug: contestSlug, force }));
  }, [contestSlug, dispatch]);

  useEffect(() => {
    refreshLobby(false);
  }, [refreshLobby]);

  // Instant real-time push: updates lobby state on contest status changes
  useRealtimeEvents(contestSlug, (event) => {
    if (event.event === "contest_status_changed" || event.event === "top30_qualified") {
      refreshLobby(true);
    }
  });

  useEffect(() => {
    if (!contestSlug) return;

    const handleSync = () => {
      refreshLobby(true);
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "ccc:assessment_updated" || e.key === "ccc_member" || e.key?.includes(contestSlug)) {
        refreshLobby(true);
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
  }, [contestSlug, refreshLobby]);

  if (isLoadingDetail && !contest) return <ContestLobbySkeleton />;

  if (!contest) {
    return (
      <div className="page-wrap space-y-4">
        <Link to="/portal/contests" className="back-link">
          <ArrowLeft /> Back to contests
        </Link>
        <p className="text-sm text-[var(--muted)]">Contest not found.</p>
      </div>
    );
  }

  const phase = contestPhase(contest, registration ?? null);
  const isAssessmentSubmitted = Boolean(
    phase === "assessment_submitted" ||
    registration?.assessment_taken ||
    registration?.assessment_status === "submitted"
  );
  const opensAt = assessmentOpensAt(contest);
  const closesAt = assessmentClosesAt(contest);
  const isDevBypass = Boolean(registration?.is_dev_bypass || contestSlug.startsWith("dev-"));
  const notYetOpen = phase === "registration_open" && !isDevBypass;
  const canStart =
    !isAssessmentSubmitted &&
    (Boolean(registration?.can_take_assessment) || phase === "assessment_open" || isDevBypass);

  return (
    <div className="page-wrap flex min-h-[calc(100vh-120px)] max-w-2xl flex-col justify-center space-y-10 py-12">
      {/* Back */}
      <Link to={`/portal/contests/${contestSlug}`} className="back-link self-start">
        <ArrowLeft /> {contest.title}
      </Link>

      {/* ─── SUBMITTED STATE ──────────────────────────────── */}
      {isAssessmentSubmitted ? (
        <div className="space-y-8">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-6 text-emerald-400" />
              <h1 className="text-2xl font-black text-foreground">Assessment Submitted</h1>
            </div>
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              Your attempt is locked and recorded. Results are published once the screening window closes.
              Reattempts are not permitted under the single-attempt protocol.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              className="rounded-none bg-[var(--accent)] font-mono text-xs font-black uppercase text-black hover:bg-[var(--accent)]/90"
            >
              <Link to={`/portal/contests/${contestSlug}/results`}>View Standings</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-none font-mono text-xs">
              <Link to={`/portal/contests/${contestSlug}`}>Back to Contest</Link>
            </Button>
          </div>
        </div>
      ) : !registration?.registered ? (
        /* ─── NOT REGISTERED ─────────────────────────────── */
        <div className="space-y-6">
          <div className="space-y-2">
            <Lock className="size-6 text-[var(--muted)]" />
            <h1 className="text-2xl font-black text-foreground">Not Registered</h1>
            <p className="text-sm text-[var(--muted)]">
              Register for this contest first, then return here when the assessment window opens.
            </p>
          </div>
          <Button asChild className="rounded-none font-mono text-xs font-black uppercase">
            <Link to={`/portal/contests/${contestSlug}`}>Register for Contest</Link>
          </Button>
        </div>
      ) : (
        /* ─── READY TO ATTEMPT ───────────────────────────── */
        <div className="space-y-10">
          {/* Title */}
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--accent)]">
              Round 1 · Online Assessment
            </p>
            <h1 className="text-3xl font-black leading-tight text-foreground">{contest.title}</h1>
          </div>

          {/* The one warning that matters */}
          <div className="space-y-4 border-l-2 border-[var(--accent)] pl-5">
            <p className="text-sm font-semibold text-foreground">
              The {ASSESSMENT_DURATION_MINUTES}-minute clock cannot be paused.
            </p>
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              Once you press Start, the server clock runs continuously. Closing the tab, refreshing,
              or losing connection does not stop it. When the timer reaches zero, your work is
              submitted automatically. There is no second attempt.
            </p>
          </div>

          {/* Key facts — inline, not cards */}
          <div className="grid grid-cols-3 divide-x divide-[var(--line)] border border-[var(--line)] bg-[var(--surface-2)]">
            {[
              {
                label: "Window",
                value: `${ASSESSMENT_WINDOW_HOURS}h entry`,
                sub: `${formatWhen(opensAt.toISOString())}`,
              },
              { label: "Attempt", value: "One only", sub: "No pause, no restart" },
              { label: "Advance", value: `Top ${FINALIST_SEATS}`, sub: "Score then time" },
            ].map(({ label, value, sub }) => (
              <div key={label} className="flex flex-col gap-1 p-4">
                <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted)]">
                  {label}
                </span>
                <span className="text-sm font-bold text-foreground">{value}</span>
                <span className="font-mono text-[10px] text-[var(--muted)]">{sub}</span>
              </div>
            ))}
          </div>

          {/* Dev bypass notice */}
          {isDevBypass && (
            <div className="border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 font-mono text-xs text-emerald-400">
              ⚡ <strong>Dev Bypass Active</strong> — timing restrictions are lifted. You can start immediately.
            </div>
          )}

          {/* Waiting state */}
          {notYetOpen && (
            <div className="flex items-center gap-3 border border-[var(--line)] bg-[var(--surface-2)] px-5 py-4">
              <Clock className="size-4 shrink-0 text-[var(--muted)]" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Opens {formatWhen(opensAt.toISOString())}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  Come back when the window opens to start your attempt.
                </p>
              </div>
            </div>
          )}

          {/* Acknowledgment + Start */}
          <div className="space-y-5">
            <label className="flex cursor-pointer items-start gap-3">
              <div
                role="checkbox"
                aria-checked={ack}
                tabIndex={0}
                onClick={() => setAck((v) => !v)}
                onKeyDown={(e) => e.key === " " && setAck((v) => !v)}
                className={`mt-0.5 flex size-4 shrink-0 cursor-pointer items-center justify-center border transition-colors focus:outline-none ${
                  ack
                    ? "border-[var(--accent)] bg-[var(--accent)]"
                    : "border-[var(--line)] bg-transparent hover:border-[var(--accent)]/60"
                }`}
              >
                {ack && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-[var(--muted)]">
                I understand this is my only attempt, the {ASSESSMENT_DURATION_MINUTES}-minute clock
                starts immediately and cannot be paused, and my work is submitted automatically when
                time runs out.
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={!ack || !canStart}
                onClick={() => navigate(`/assessments/${contestSlug}`)}
                size="lg"
                className="rounded-none bg-[var(--accent)] font-mono text-xs font-black uppercase tracking-wider text-black hover:bg-[var(--accent)]/90 disabled:opacity-40"
              >
                <Play className="mr-1.5 size-4 fill-black" /> Start Assessment
              </Button>
              <Button asChild variant="ghost" className="rounded-none font-mono text-xs">
                <Link to={`/portal/contests/${contestSlug}`}>Not now</Link>
              </Button>
            </div>

            {!canStart && !notYetOpen && (
              <p className="font-mono text-xs text-amber-300">
                {registration?.eligibility_message ?? "Assessment is not accepting attempts right now."}
              </p>
            )}
          </div>

          {/* Security footer */}
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <Shield className="size-3.5 shrink-0" />
            Full-screen anti-cheat · Monaco editor · Server-side timer · Auto-submit on timeout
          </div>
        </div>
      )}
    </div>
  );
}
