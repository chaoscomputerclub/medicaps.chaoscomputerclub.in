import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Lock,
  Play,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContestDetailThunk } from "@/store/slices/contestSlice";
import { ContestLobbySkeleton } from "@/organization/components/skeletons";
import {
  ASSESSMENT_DURATION_MINUTES,
  ASSESSMENT_WINDOW_HOURS,
  FINALIST_SEATS,
  assessmentClosesAt,
  assessmentOpensAt,
  contestPhase,
  formatWhen,
} from "@/features/contest/lifecycle";

export function ContestLobbyPage() {
  const { contestSlug = "" } = useParams<{ contestSlug: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { currentContest: contest, registration, isLoadingDetail } = useAppSelector(
    (state) => state.contest
  );

  const [ack, setAck] = useState(false);

  useEffect(() => {
    if (contestSlug) {
      dispatch(fetchContestDetailThunk({ slug: contestSlug, force: false }));
    }
  }, [contestSlug, dispatch]);

  if (isLoadingDetail && !contest) {
    return <ContestLobbySkeleton />;
  }

  if (!contest) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center font-mono text-xs text-zinc-400">
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
  const opensAt = assessmentOpensAt(contest);
  const isDevBypass = Boolean(registration?.is_dev_bypass || contestSlug.startsWith("dev-"));
  const notYetOpen = phase === "registration_open" && !isDevBypass;
  const canStart =
    !isAssessmentSubmitted &&
    (Boolean(registration?.can_take_assessment) || phase === "assessment_open" || isDevBypass);

  return (
    <div className="flex min-h-[calc(100vh-120px)] max-w-2xl mx-auto px-4 sm:px-6 py-12 flex-col justify-center space-y-10">
      {/* Back */}
      <Link to={`/portal/contests/${contestSlug}`} className="inline-flex items-center gap-2 font-mono text-xs text-zinc-400 hover:text-white transition-colors self-start">
        <ArrowLeft className="size-3.5" /> {contest.title}
      </Link>

      {/* ─── SUBMITTED STATE ──────────────────────────────── */}
      {isAssessmentSubmitted ? (
        <div className="space-y-8 rounded-2xl border border-white/10 bg-zinc-900/60 p-8 backdrop-blur-md shadow-xl">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-6 text-emerald-400" />
              <h1 className="text-2xl font-black text-white">Assessment Submitted</h1>
            </div>
            <p className="text-sm leading-relaxed text-zinc-400">
              Your attempt is locked and recorded. Results are published once the screening window closes.
              Reattempts are not permitted under the single-attempt protocol.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              className="rounded-xl bg-orange-500 font-mono text-xs font-black uppercase text-white hover:bg-orange-600 shadow-md shadow-orange-500/20"
            >
              <Link to={`/portal/contests/${contestSlug}/results`}>View Standings</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl font-mono text-xs border-white/10">
              <Link to={`/portal/contests/${contestSlug}`}>Back to Contest</Link>
            </Button>
          </div>
        </div>
      ) : !registration?.registered ? (
        /* ─── NOT REGISTERED ─────────────────────────────── */
        <div className="space-y-6 rounded-2xl border border-white/10 bg-zinc-900/60 p-8 backdrop-blur-md shadow-xl">
          <div className="space-y-2">
            <Lock className="size-6 text-zinc-500" />
            <h1 className="text-2xl font-black text-white">Not Registered</h1>
            <p className="text-sm text-zinc-400">
              Register for this contest first, then return here when the assessment window opens.
            </p>
          </div>
          <Button asChild className="rounded-xl font-mono text-xs font-black uppercase bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20">
            <Link to={`/portal/contests/${contestSlug}`}>Register for Contest</Link>
          </Button>
        </div>
      ) : (
        /* ─── READY TO ATTEMPT ───────────────────────────── */
        <div className="space-y-10 rounded-2xl border border-white/10 bg-zinc-900/60 p-8 backdrop-blur-md shadow-xl">
          {/* Title */}
          <div className="space-y-2">
            <span className="inline-block rounded-md border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-widest text-orange-400">
              Round 1 · Online Assessment
            </span>
            <h1 className="text-3xl font-black leading-tight text-white">{contest.title}</h1>
          </div>

          {/* Warning */}
          <div className="space-y-4 border-l-2 border-orange-500 pl-5">
            <p className="text-sm font-semibold text-white">
              The {ASSESSMENT_DURATION_MINUTES}-minute clock cannot be paused.
            </p>
            <p className="text-sm leading-relaxed text-zinc-400">
              Once you press Start, the server clock runs continuously. Closing the tab, refreshing,
              or losing connection does not stop it. When the timer reaches zero, your work is
              submitted automatically. There is no second attempt.
            </p>
          </div>

          {/* Key facts */}
          <div className="grid grid-cols-3 divide-x divide-white/10 rounded-xl border border-white/10 bg-zinc-950/60">
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
                <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-400">
                  {label}
                </span>
                <span className="text-sm font-bold text-white">{value}</span>
                <span className="font-mono text-[10px] text-zinc-500">{sub}</span>
              </div>
            ))}
          </div>

          {/* Dev bypass notice */}
          {isDevBypass && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 font-mono text-xs text-emerald-400">
              ⚡ <strong>Dev Bypass Active</strong> — timing restrictions are lifted. You can start immediately.
            </div>
          )}

          {/* Waiting state */}
          {notYetOpen && (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-950/60 px-5 py-4">
              <Clock className="size-4 shrink-0 text-zinc-400" />
              <div>
                <p className="text-sm font-semibold text-white">
                  Opens {formatWhen(opensAt.toISOString())}
                </p>
                <p className="text-xs text-zinc-400">
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
                className={`mt-0.5 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors focus:outline-none ${
                  ack
                    ? "border-orange-500 bg-orange-500 text-white"
                    : "border-white/20 bg-transparent hover:border-orange-500/60"
                }`}
              >
                {ack && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-zinc-300">
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
                className="rounded-xl bg-orange-500 font-mono text-xs font-black uppercase tracking-wider text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20 disabled:opacity-40"
              >
                <Play className="mr-1.5 size-4 fill-white" /> Start Assessment
              </Button>
              <Button asChild variant="ghost" className="rounded-xl font-mono text-xs text-zinc-400 hover:text-white">
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
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
            <Shield className="size-3.5 shrink-0 text-orange-500" />
            Full-screen anti-cheat · Monaco editor · Server-side timer · Auto-submit on timeout
          </div>
        </div>
      )}
    </div>
  );
}
