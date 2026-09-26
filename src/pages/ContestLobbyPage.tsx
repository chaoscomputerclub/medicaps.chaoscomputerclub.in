import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  Play,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Cpu,
  Monitor,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContestDetailThunk } from "@/store/slices/contestSlice";
import { ContestLobbySkeleton } from "@/organization/components/skeletons";
import { globalSwrStore } from "@/lib/cache/swrCache";
import {
  formatWhen,
} from "@/features/contest/lifecycle";
import { useCountdown } from "@/hooks/useCountdown";
import { useRealtimeEvents } from "@/lib/realtime";

export function ContestLobbyPage() {
  const { contestSlug = "" } = useParams<{ contestSlug: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(`/contests/${contestSlug}`);
    }
  }, [navigate, contestSlug]);

  const { currentContest: contest, registration, isLoadingDetail } = useAppSelector(
    (state) => state.contest
  );

  const [ack, setAck] = useState(false);

  const refreshDetail = useCallback(() => {
    if (contestSlug) {
      void dispatch(fetchContestDetailThunk({ slug: contestSlug, force: true }));
    }
  }, [contestSlug, dispatch]);

  useEffect(() => {
    if (contestSlug) {
      void dispatch(fetchContestDetailThunk({ slug: contestSlug, force: false }));
    }
  }, [contestSlug, dispatch]);

  // Real-time: auto-refresh when contest goes live so "Start Contest" unlocks without page reload
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
        event.event === "assessment_finished" ||
        event.event === "submission_evaluated"
      ) {
        refreshDetail();
      }
    },
    undefined,
    Boolean(contestSlug)
  );

  // On reload, Redux resets to null while the thunk is in-flight.
  // Hydrate from SWR sessionStorage cache instantly — zero skeleton flash.
  const cachedContest = !contest && contestSlug
    ? (globalSwrStore.get<any>(`contest:detail:${contestSlug}`)?.data ?? null)
    : null;
  const resolvedContest = (contest?.slug === contestSlug ? contest : null) ?? cachedContest;

  const cachedRegistration = !registration && contestSlug
    ? (globalSwrStore.get<any>(`contest:reg_status:${contestSlug}`)?.data ?? null)
    : null;
  const resolvedRegistration = registration ?? cachedRegistration;

  const isDevBypass = Boolean(resolvedRegistration?.is_dev_bypass || contestSlug.startsWith("dev-"));
  const durationMinutes = resolvedContest?.assessment?.duration_minutes || 90;

  const isLive = resolvedContest?.status === "live";
  const isFinished = resolvedContest?.status === "finished";
  const isUpcoming = resolvedContest?.status === "upcoming" || (!isLive && !isFinished);
  const isRegistered = Boolean(resolvedRegistration?.registered || resolvedContest?.registered);

  const onCountdownExpire = useCallback(() => {
    refreshDetail();
  }, [refreshDetail]);

  const countdown = useCountdown(
    isUpcoming ? resolvedContest?.starts_at : resolvedContest?.ends_at,
    onCountdownExpire
  );

  const isInProgress = Boolean(
    resolvedRegistration?.can_resume_assessment ||
    (resolvedRegistration?.assessment_status === "in_progress" && !resolvedRegistration?.assessment_taken)
  );
  const isAssessmentSubmitted = Boolean(
    !isInProgress && (
      resolvedContest?.is_submitted ||
      resolvedRegistration?.status === "submitted" ||
      resolvedRegistration?.assessment_taken ||
      resolvedRegistration?.assessment_status === "submitted" ||
      resolvedRegistration?.assessment_status === "completed"
    )
  );
  const notYetOpen = isUpcoming && !isDevBypass;
  // Show skeleton when: loading detail with no data, OR registration is still resolving
  const isRegistrationLoading = isLoadingDetail && resolvedRegistration === null;

  if ((isLoadingDetail && !resolvedContest) || isRegistrationLoading) {
    return <ContestLobbySkeleton />;
  }

  if (!resolvedContest) {
    return (
      <div className="flex min-h-[100dvh] max-w-2xl mx-auto px-4 sm:px-6 py-10 flex-col justify-center space-y-6">
        <Link
          to="/contests"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-500 hover:text-white transition-colors self-start"
        >
          <ArrowLeft className="size-3.5" /> Back to Contests Hub
        </Link>
        <div className="rounded-lg border border-white/8 bg-black p-6 sm:p-8 space-y-4">
          <h1 className="text-xl font-semibold text-white tracking-tight">Contest Not Found</h1>
          <p className="text-xs font-mono text-zinc-400 leading-relaxed">
            The requested contest tournament could not be found or has not been initialized yet.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/contests">Explore All Contests</Link>
          </Button>
        </div>
      </div>
    );
  }

  const canStart = !isAssessmentSubmitted && (isLive || isDevBypass || isInProgress);

  return (
    <div className="flex min-h-[100dvh] max-w-2xl mx-auto px-4 sm:px-6 py-10 flex-col justify-center space-y-6">
      {/* Back / Close link */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleBack}
        className="text-zinc-400 hover:text-white self-start -ml-3"
      >
        <ArrowLeft className="size-3.5" />
        <span>Back to {resolvedContest.title}</span>
      </Button>

      {/* Submitted State */}
      {isAssessmentSubmitted ? (
        <div className="space-y-6 rounded-lg border border-lime-500/30 bg-black p-6 sm:p-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-lime-400 font-semibold">
                Contest Concluded · Attempt Finalized
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-lime-950/40 border border-lime-500/30 text-lime-400">
                <CheckCircle2 className="size-5 text-lime-400" />
              </div>
              <h1 className="text-xl font-semibold text-white tracking-tight font-sans">
                Contest Solutions Submitted
              </h1>
            </div>
            <p className="text-xs font-mono text-zinc-400 leading-relaxed">
              Your contest submissions have concluded and your scores are safely recorded. Under the fair competition protocol, retakes and further attempts are not permitted.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              asChild
              variant="default"
              size="sm"
            >
              <Link to={`/contests/${contestSlug}/results`}>
                <Trophy className="size-3.5 mr-1.5" />
                <span>View Standings</span>
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
            >
              <Link to={`/contests/${contestSlug}/summary`}>
                <FileText className="size-3.5 mr-1.5" />
                <span>View Summary</span>
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
            >
              <Link to={`/contests/${contestSlug}`}>Contest Overview</Link>
            </Button>
          </div>
        </div>
      ) : (!isRegistered && !isDevBypass) ? (
        /* Not Registered */
        <div className="space-y-6 rounded-lg border border-white/8 bg-black p-6 sm:p-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Contest Registration Required
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
              You must register for this tournament round before accessing the live contest arena.
            </p>
          </div>
          <Button asChild variant="default" size="sm">
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
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-2 text-xs font-sans text-emerald-400">
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
              <span>Registered · Contest arena unlocks at start time</span>
            </div>

            {/* Live Countdown in Waiting Room */}
            <div className="rounded-md border border-white/8 bg-zinc-950 p-4 text-center space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">
                Arena Unlocks In
              </span>
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
            </div>

            <div className="p-4 rounded-md border border-white/8 bg-zinc-950 text-xs space-y-2.5">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Starts at:</span>
                <span className="text-lime-400 font-semibold">{formatWhen(resolvedContest.starts_at)}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>Duration:</span>
                <span className="text-white font-semibold">{durationMinutes} Minutes</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400 border-t border-white/6 pt-2">
                <span>Access:</span>
                <span className="text-zinc-300 font-semibold">Open to All Enrolled Students</span>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
          >
            Back to Contest
          </Button>
        </div>
      ) : (isFinished && !isDevBypass) ? (
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
          >
            Back to Contest
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
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">{resolvedContest.title}</h1>
            <p className="text-xs text-zinc-400 font-mono">
              Review the competition guidelines and regulations before entering.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 divide-x divide-white/8 rounded-md border border-white/8 bg-black">
            {[
              {
                label: "Time Limit",
                value: `${durationMinutes} min`,
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
                  <strong className="text-white">Continuous Timer:</strong> Once launched, the {durationMinutes}-minute countdown runs server-side and auto-submits at 00:00.
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

          {/* Attempt Submitted Alert */}
          {isAssessmentSubmitted ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-md border border-emerald-500/30 bg-emerald-950/20 text-emerald-300 font-mono text-xs">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold uppercase tracking-wider text-emerald-400">
                    Official Attempt Submitted
                  </div>
                  <p className="text-zinc-400 leading-relaxed">
                    You have already completed and submitted your official competition attempt for this contest. Multiple attempts are not permitted.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  asChild
                  variant="default"
                  size="default"
                  className="bg-emerald-500 text-black hover:bg-emerald-400"
                >
                  <Link to={`/contests/${contestSlug}/results`}>
                    <Trophy className="size-3.5 mr-1.5" />
                    <span>View Standings & Results</span>
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="default"
                  onClick={handleBack}
                >
                  Back to Overview
                </Button>
              </div>
            </div>
          ) : isInProgress ? (
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
                  variant="outline"
                  size="default"
                  className="border-amber-400 text-amber-400 hover:bg-amber-400 hover:text-black"
                >
                  <Link to={`/contests/${contestSlug}/problems`} target="_blank" rel="noopener noreferrer">
                    <Play className="size-3.5 fill-current mr-1.5" />
                    <span>Resume Contest</span>
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="default"
                  onClick={handleBack}
                >
                  Back to Overview
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
                  className="mt-0.5 size-4 shrink-0 rounded border-white/20 bg-black text-lime-400 accent-[#CCFF00] focus:ring-1 focus:ring-lime-400 cursor-pointer"
                />
                <span className="text-xs font-mono text-zinc-300 leading-relaxed">
                  I understand that this is my official competition attempt. The {durationMinutes}-minute contest clock begins immediately upon launching the arena.
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  asChild={ack && canStart}
                  disabled={!ack || !canStart}
                  variant="default"
                  size="default"
                >
                  {ack && canStart ? (
                    <Link to={`/contests/${contestSlug}/problems`} target="_blank" rel="noopener noreferrer">
                      <Play className="size-3.5 fill-current mr-1.5" />
                      <span>Start Contest</span>
                    </Link>
                  ) : (
                    <>
                      <Play className="size-3.5 fill-current mr-1.5" />
                      <span>Start Contest</span>
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="default"
                  onClick={handleBack}
                >
                  Not Now
                </Button>
              </div>

              {!canStart && !notYetOpen && (
                <p className="font-mono text-xs text-amber-400">
                  {resolvedRegistration?.eligibility_message ?? "Contest arena is currently closed."}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
