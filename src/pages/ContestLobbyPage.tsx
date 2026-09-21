import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Lock,
  Play,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Cpu,
  Monitor,
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
      <div className="max-w-2xl mx-auto px-4 py-20 text-center font-mono text-xs text-zinc-500">
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
      registration?.assessment_status === "submitted"
    )
  );
  const opensAt = assessmentOpensAt(contest);
  const isDevBypass = Boolean(registration?.is_dev_bypass || contestSlug.startsWith("dev-"));
  const notYetOpen = phase === "registration_open" && !isDevBypass;
  const canStart =
    !isAssessmentSubmitted &&
    (Boolean(registration?.can_take_assessment) || isInProgress || phase === "assessment_open" || isDevBypass);

  return (
    <div className="flex min-h-[calc(100vh-140px)] max-w-2xl mx-auto px-4 sm:px-6 py-10 flex-col justify-center space-y-6">
      {/* Back button */}
      <Link
        to={`/contests/${contestSlug}`}
        className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-500 hover:text-white transition-colors self-start"
      >
        <ArrowLeft className="size-3.5" /> Back to {contest.title}
      </Link>

      {/* Submitted State */}
      {isAssessmentSubmitted ? (
        <div className="space-y-6 rounded-lg border border-white/8 bg-black p-6 sm:p-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Round 1 · Assessment Concluded
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-lime-400/10 border border-lime-400/20 text-lime-400">
                <CheckCircle2 className="size-5" />
              </div>
              <h1 className="text-xl font-semibold text-white tracking-tight">
                Assessment Submitted
              </h1>
            </div>
            <p className="text-xs font-mono text-zinc-400 leading-relaxed">
              Your test session has concluded and your scores are safely recorded. Standings will update automatically as evaluations finish.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              asChild
              className="rounded-md bg-transparent text-lime-400 border border-lime-400 font-mono text-xs font-semibold hover:bg-lime-400 hover:text-black transition-colors"
            >
              <Link to={`/contests/${contestSlug}/results`}>View Live Standings</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-md font-mono text-xs border-white/10 bg-black text-zinc-300 hover:text-white">
              <Link to={`/contests/${contestSlug}`}>Contest Overview</Link>
            </Button>
          </div>
        </div>
      ) : !registration?.registered ? (
        /* Not Registered */
        <div className="space-y-6 rounded-lg border border-white/8 bg-black p-6 sm:p-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Round 1 · Slot Required
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-zinc-900 border border-white/10 text-zinc-400">
                <Lock className="size-5" />
              </div>
              <h1 className="text-xl font-semibold text-white tracking-tight">
                Registration Required
              </h1>
            </div>
            <p className="text-xs font-mono text-zinc-400 leading-relaxed">
              You must register for this tournament round before accessing the proctored assessment terminal.
            </p>
          </div>
          <Button asChild className="rounded-md font-mono text-xs font-semibold bg-transparent text-lime-400 border border-lime-400 hover:bg-lime-400 hover:text-black transition-colors">
            <Link to={`/contests/${contestSlug}`}>Register Slot</Link>
          </Button>
        </div>
      ) : notYetOpen ? (
        /* Locked Waiting Room */
        <div className="space-y-6 rounded-lg border border-white/8 bg-black p-6 sm:p-8 font-mono">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">
                Contest · Scheduled
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-zinc-900 border border-white/10 text-zinc-400">
                <Clock className="size-5" />
              </div>
              <h1 className="text-xl font-semibold text-white tracking-tight">
                Contest Arena Waiting Room
              </h1>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Registration confirmed. The live contest arena unlocks when the competition begins:
            </p>
            <div className="p-4 rounded-md border border-white/8 bg-zinc-950 text-xs space-y-2.5">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Starts at:</span>
                <span className="text-lime-400 font-semibold">{formatWhen(contest.starts_at)}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>Duration:</span>
                <span className="text-white font-semibold">{ASSESSMENT_DURATION_MINUTES} Minutes</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400 border-t border-white/6 pt-2">
                <span>Access:</span>
                <span className="text-zinc-300 font-semibold">Open to All Enrolled Students</span>
              </div>
            </div>
          </div>
          <Button asChild variant="outline" className="rounded-md text-xs border-white/10 bg-black text-zinc-300 hover:text-white">
            <Link to={`/contests/${contestSlug}`}>Back to Contest</Link>
          </Button>
        </div>
      ) : (phase === "assessment_closed" && !isDevBypass) ? (
        /* Closed */
        <div className="space-y-6 rounded-lg border border-white/8 bg-black p-6 sm:p-8 font-mono">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-red-400">
                Contest Concluded
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-400">
                <Lock className="size-5" />
              </div>
              <h1 className="text-xl font-semibold text-white tracking-tight">
                Contest Concluded
              </h1>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              The contest session has concluded. Final scoring and Elo rating calculations are underway.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-md text-xs border-white/10 bg-black text-zinc-300 hover:text-white">
            <Link to={`/contests/${contestSlug}`}>Back to Contest</Link>
          </Button>
        </div>
      ) : (
        /* Ready to Attempt / Assessment Lobby */
        <div className="space-y-6 rounded-lg border border-white/8 bg-black p-6 sm:p-8">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Live Contest Arena Lobby
              </span>
              {isDevBypass && (
                <span className="px-1.5 py-0.5 rounded border border-lime-400/30 bg-lime-400/10 font-mono text-[9px] uppercase tracking-wider text-lime-400 font-semibold">
                  Dev Bypass
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">{contest.title}</h1>
            <p className="text-xs text-zinc-400 font-mono">
              Review the competition guidelines and regulations before entering.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 divide-x divide-white/8 rounded-md border border-white/8 bg-black">
            {[
              {
                label: "Time Limit",
                value: `${ASSESSMENT_DURATION_MINUTES} min`,
                sub: "Continuous timer",
              },
              { label: "Attempt", value: "Single", sub: "Cannot pause or reset" },
              { label: "Rating Impact", value: "Elo Rated", sub: "Campus leaderboard" },
            ].map(({ label, value, sub }) => (
              <div key={label} className="flex flex-col gap-0.5 p-3.5">
                <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
                  {label}
                </span>
                <span className="text-xs font-semibold text-white font-mono">{value}</span>
                <span className="font-mono text-[10px] text-zinc-500">{sub}</span>
              </div>
            ))}
          </div>

          {/* Regulations Card */}
          <div className="space-y-3 rounded-md border border-white/8 bg-zinc-950 p-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-white/6 pb-2.5">
              <span className="text-[11px] font-semibold text-white flex items-center gap-2">
                <Shield className="size-3.5 text-lime-400" />
                Tournament Guidelines
              </span>
            </div>

            <ul className="space-y-2.5 text-zinc-400">
              <li className="flex items-start gap-2.5">
                <span className="text-lime-400 font-semibold shrink-0">01.</span>
                <span>
                  <strong className="text-white">Continuous Timer:</strong> Once launched, the {ASSESSMENT_DURATION_MINUTES}-minute countdown runs server-side and auto-submits at 00:00.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-lime-400 font-semibold shrink-0">02.</span>
                <span>
                  <strong className="text-white">Supported Languages:</strong> Python, C++, Java, and JavaScript are supported in the workspace.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-lime-400 font-semibold shrink-0">03.</span>
                <span>
                  <strong className="text-white">Automated Judging:</strong> Submissions are tested against hidden test cases with 2.0s time limit and 256MB memory cap.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-lime-400 font-semibold shrink-0">04.</span>
                <span>
                  <strong className="text-white">Leaderboard & Rating:</strong> Official Elo ratings update on the university leaderboard after the contest concludes.
                </span>
              </li>
            </ul>
          </div>

          {/* In-Progress Session Alert */}
          {isInProgress ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-md border border-amber-500/30 bg-black text-amber-300 font-mono text-xs">
                <ShieldAlert className="size-4 shrink-0 text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold uppercase tracking-wider text-amber-400">
                    Active Attempt In Progress
                  </div>
                  <p className="text-zinc-400 leading-relaxed">
                    You have an ongoing attempt. Resume immediately to avoid losing time.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="rounded-md bg-transparent text-amber-400 border border-amber-400 font-mono text-xs font-semibold hover:bg-amber-400 hover:text-black transition-colors"
                >
                  <a href={`/assessments/${contestSlug}`} target="_blank" rel="noopener noreferrer">
                    <Play className="mr-1.5 size-3.5 fill-current" /> Resume Assessment
                  </a>
                </Button>
                <Button asChild variant="ghost" className="rounded-md font-mono text-xs text-zinc-400 hover:text-white">
                  <Link to={`/contests/${contestSlug}`}>Back to Overview</Link>
                </Button>
              </div>
            </div>
          ) : (
            /* Acknowledgment + Launch */
            <div className="space-y-4 pt-1">
              <label className="flex cursor-pointer items-start gap-3 select-none">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 rounded border-white/20 bg-black text-lime-400 accent-[#CCFF00] focus:ring-1 focus:ring-lime-400"
                />
                <span className="text-xs font-mono text-zinc-300 leading-relaxed">
                  I understand that this is my single continuous attempt. The {ASSESSMENT_DURATION_MINUTES}-minute clock begins immediately and auto-submits on completion.
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  asChild
                  disabled={!ack || !canStart}
                  size="lg"
                  className="rounded-md bg-transparent text-lime-400 border border-lime-400 font-mono text-xs font-semibold hover:bg-lime-400 hover:text-black disabled:opacity-30 transition-colors"
                >
                  <a
                    href={(!ack || !canStart) ? undefined : `/assessments/${contestSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (!ack || !canStart) e.preventDefault();
                    }}
                  >
                    <Play className="mr-1.5 size-3.5 fill-current" /> Launch Workspace
                  </a>
                </Button>
                <Button asChild variant="ghost" className="rounded-md font-mono text-xs text-zinc-500 hover:text-white">
                  <Link to={`/contests/${contestSlug}`}>Not Now</Link>
                </Button>
              </div>

              {!canStart && !notYetOpen && (
                <p className="font-mono text-xs text-amber-400">
                  {registration?.eligibility_message ?? "Assessment is currently closed."}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
