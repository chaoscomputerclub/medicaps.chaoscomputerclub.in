/**
 * Chaos Computer Club India — Clean Standalone Assessment Environment
 * Pure distraction-free full-screen testing workspace.
 * Redesigned to Strix AI Paradigm (Pure Pitch Black × Electric Lime)
 */

import { useNavigate, useParams, Link } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import {
  CheckCircle2,
  Clock,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Send,
  Terminal,
  Users,
  Copy,
  Check,
  AlertCircle,
  XCircle,
  X,
  ShieldAlert,
  Lock,
  Trophy,
  FileText,
  Code2,
} from "lucide-react";
import { toast } from "sonner";
import { registerForContest, getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { resolveAvatarUrl, formatFullName } from "@/lib/utils";
import { fetchCurrentUserThunk } from "@/store/slices/authSlice";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogPopup,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogPortal,
  AlertDialogBackdrop,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/animate-ui/primitives/base/alert-dialog";
const MonacoEditor = lazy(() => import("@/organization/components/MonacoEditor"));
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAssessmentThunk,
  runCodeThunk,
  submitCodeThunk,
  reportTelemetryThunk,
  finishAssessmentThunk,
  setActiveProblemIndex,
  setSelectedLanguage,
  setCode,
  resetStarterCode,
  setCustomStdin,
  setActiveConsoleTab,
  decrementTimer,
  dismissAntiCheatWarning,
} from "@/store/slices/assessmentSlice";
import { AssessmentStudioSkeleton } from "@/organization/components/skeletons";

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function AssessmentWorkspacePage() {
  const { contestSlug = "" } = useParams<{ contestSlug: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const {
    assessment,
    session,
    problems,
    activeProblemIndex,
    selectedLanguage,
    codeMap,
    customStdin,
    activeConsoleTab,
    isRunning,
    isSubmitting,
    runResult,
    submitResult,
    submissionsMap,
    antiCheatWarningOpen,
    antiCheatWarningMessage,
    isLoading,
    error,
  } = useAppSelector((state) => state.assessment);
  const member = useAppSelector((state) => state.auth.member);

  useEffect(() => {
    if (!member && getToken()) {
      dispatch(fetchCurrentUserThunk());
    }
  }, [member, dispatch]);

  const resolvedAvatar = resolveAvatarUrl(member?.avatar_url);
  const displayName = formatFullName(member?.full_name) || member?.handle || member?.email?.split("@")[0] || "Competitor";
  const userInitial = member?.full_name?.trim()
    ? member.full_name.trim().charAt(0).toUpperCase()
    : member?.handle?.trim()
    ? member.handle.trim().charAt(0).toUpperCase()
    : member?.email?.trim()
    ? member.email.trim().charAt(0).toUpperCase()
    : "U";

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // 1. Initial Load
  useEffect(() => {
    dispatch(fetchAssessmentThunk(contestSlug));
  }, [contestSlug, dispatch]);

  // 2. Countdown Timer
  useEffect(() => {
    if (!session || session.status !== "in_progress") return;
    const interval = setInterval(() => {
      dispatch(decrementTimer());
    }, 1000);
    return () => clearInterval(interval);
  }, [session?.status, dispatch]);

  // 3. Fullscreen state tracking
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // 4. Anti-Cheat Monitoring (blur & tab switches)
  useEffect(() => {
    if (!session || session.status !== "in_progress") return;

    function onBlur() {
      dispatch(reportTelemetryThunk({ contestSlug, eventType: "window_blur" }));
    }
    function onVisibility() {
      if (document.hidden) {
        dispatch(reportTelemetryThunk({ contestSlug, eventType: "tab_switch" }));
      }
    }

    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("visibilitychange", onVisibility);
    };
  }, [contestSlug, session?.status, dispatch]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  const activeProblem = problems[activeProblemIndex];
  const currentProblemKey = activeProblem ? `${activeProblem.id}_${selectedLanguage}` : "";
  const codeInMap = currentProblemKey ? codeMap[currentProblemKey] : "";
  const isCodeInMapLegacy =
    codeInMap &&
    (codeInMap.includes("def main():") ||
      codeInMap.includes("sys.stdin.read()") ||
      codeInMap.includes("TODO: Calculate valid mirror pairs") ||
      (selectedLanguage === "python" && !codeInMap.includes("class Solution")));
  const currentCode = activeProblem
    ? (!isCodeInMapLegacy && codeInMap
        ? codeInMap
        : activeProblem.starter_codes?.[selectedLanguage] ?? "")
    : "";

  const activeSubmission = activeProblem ? submissionsMap[activeProblem.id] : null;

  async function handleRun() {
    if (!activeProblem) return;
    dispatch(setActiveConsoleTab("output"));
    await dispatch(
      runCodeThunk({
        contestSlug,
        problemId: activeProblem.id,
        language: selectedLanguage,
        code: currentCode,
        customStdin: activeConsoleTab === "testcases" ? "" : customStdin || "",
      }),
    );
  }

  async function handleSubmit() {
    if (!activeProblem) return;
    dispatch(setActiveConsoleTab("output"));
    const action = await dispatch(
      submitCodeThunk({
        contestSlug,
        problemId: activeProblem.id,
        language: selectedLanguage,
        code: currentCode,
      }),
    );
    if (submitCodeThunk.fulfilled.match(action)) {
      const p = action.payload;
      if (p.verdict === "ACCEPTED") {
        toast.success(`Accepted! Problem ${activeProblem.problem_index} passed all test cases.`);
      } else {
        toast.error(`Verdict: ${p.verdict} (${p.passed_testcases}/${p.total_testcases} passed)`);
      }
    }
  }

  async function handleFinish() {
    setShowFinishModal(false);
    const action = await dispatch(finishAssessmentThunk(contestSlug));
    if (finishAssessmentThunk.fulfilled.match(action)) {
      try {
        localStorage.setItem("ccc:assessment_updated", String(Date.now()));
        window.dispatchEvent(new CustomEvent("assessment:status_changed", { detail: { contestSlug } }));
      } catch {}
      toast.success("Assessment completed successfully.");
      if (window.opener) {
        window.close();
      } else {
        navigate(`/contests/${contestSlug}`);
      }
    }
  }

  function handleExitWindow() {
    setShowExitModal(false);
    if (window.opener) {
      window.close();
    } else {
      navigate(`/contests/${contestSlug}`);
    }
  }

  function handleResetStarter() {
    setShowResetModal(false);
    dispatch(resetStarterCode());
    toast.success("Starter code restored to default template.");
  }

  async function handleDirectRegister() {
    try {
      setIsRegistering(true);
      await registerForContest(contestSlug);
      toast.success("Registered for contest. Unlocking assessment...");
      dispatch(fetchAssessmentThunk(contestSlug));
    } catch (err: any) {
      toast.error(err.message || "Failed to register for contest.");
    } finally {
      setIsRegistering(false);
    }
  }

  function handleCopy(text: string, idx: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  }

  // Loading skeleton
  if (isLoading && !assessment) {
    return <AssessmentStudioSkeleton />;
  }

  // ── Submitted / Completed Gate ───────────────────────────────────────────
  if (session && (session.status === "submitted" || session.status === "disqualified")) {
    const isDisqualified = session.status === "disqualified";
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-black text-white font-sans p-6">
        <div className="max-w-md w-full p-8 rounded-lg bg-black border border-white/8 text-center space-y-6">
          <div
            className={`size-14 rounded-md flex items-center justify-center mx-auto border ${
              isDisqualified
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-lime-400/10 border-lime-400/30 text-lime-400"
            }`}
          >
            {isDisqualified ? <ShieldAlert size={26} /> : <CheckCircle2 size={26} />}
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight text-white">
              {isDisqualified ? "Assessment Disqualified" : "Assessment Submitted"}
            </h2>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed">
              {isDisqualified
                ? "Your session was disqualified due to anti-cheat policy violations."
                : "Your answers have been recorded. Results will update automatically."}
            </p>
          </div>

          {!isDisqualified && (
            <div className="rounded-md bg-zinc-950 border border-white/8 p-4 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Score recorded</span>
                <span className="text-lime-400 font-semibold tabular-nums">{session.total_score ?? 0} pts</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Status</span>
                <span className="text-white font-semibold uppercase tracking-wider">Submitted</span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                if (window.opener) {
                  window.close();
                } else {
                  navigate(`/contests/${contestSlug}`);
                }
              }}
              className="w-full py-2 px-4 rounded-md bg-transparent text-white border border-white/20 font-semibold font-mono text-xs hover:bg-lime-400 hover:text-black hover:border-lime-400 transition-colors cursor-pointer [&_svg]:transition-colors"
            >
              Close Workspace
            </button>
            <button
              type="button"
              onClick={() => navigate(`/contests/${contestSlug}/results`)}
              className="w-full py-2 px-4 rounded-md bg-black border border-white/10 text-white font-semibold font-mono text-xs hover:bg-zinc-950 transition-colors cursor-pointer"
            >
              View Standings
            </button>
            <button
              type="button"
              onClick={() => navigate(`/contests/${contestSlug}`)}
              className="w-full py-2 px-4 rounded-md border border-white/6 text-zinc-500 font-mono text-xs hover:text-white transition-colors cursor-pointer"
            >
              Return to Contest Details
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Waiting Room Gate ───────────────────────────────────────────────────
  if (assessment && !session) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-black text-white font-sans p-6">
        <div className="max-w-md w-full p-8 rounded-lg bg-black border border-white/8 text-center space-y-6">
          <div className="size-14 rounded-md bg-zinc-950 border border-white/10 flex items-center justify-center mx-auto text-lime-400">
            <Clock size={28} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight text-white">
              Assessment Opens Soon
            </h2>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed">
              You are registered. The assessment workspace unseals automatically at the contest start time.
            </p>
          </div>
          <div className="p-4 rounded-md border border-white/8 bg-zinc-950">
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 block">
              Time Remaining Until Unseal
            </span>
            <div className="font-mono text-2xl font-bold text-lime-400 mt-1 tabular-nums">
              {formatTimer(assessment.opens_in_seconds || 0)}
            </div>
          </div>
          <Button
            onClick={() => {
              if (window.opener) window.close();
              else navigate(`/contests/${contestSlug}`);
            }}
            variant="outline"
            size="default"
            className="w-full"
          >
            Close & Return
          </Button>
        </div>
      </div>
    );
  }

  // ── Error / Gate Screen ─────────────────────────────────────────────────
  if (error && !assessment) {
    const isRegistrationErr = error.toLowerCase().includes("registration");
    const isAuthErr = error.toLowerCase().includes("credential") || error.toLowerCase().includes("token") || error.toLowerCase().includes("login");
    const isLifecycleErr = error.toLowerCase().includes("upcoming") || error.toLowerCase().includes("live") || error.toLowerCase().includes("top 30");

    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-black text-white font-sans p-6">
        <div className="max-w-md w-full p-6 rounded-lg bg-black border border-white/8 text-center space-y-4">
          <div className="size-12 rounded-md bg-zinc-950 border border-white/10 flex items-center justify-center mx-auto">
            {isLifecycleErr ? <Lock size={22} className="text-amber-400" /> : <ShieldAlert size={22} className="text-red-400" />}
          </div>
          <h2 className="text-base font-semibold font-mono text-white">
            {isLifecycleErr ? "Contest Arena Closed" : "Contest Access Gate"}
          </h2>
          <p className="text-xs text-zinc-400 font-mono leading-relaxed">
            {error}
          </p>

          <div className="pt-2 flex flex-col gap-2">
            {isLifecycleErr && (
              <Button asChild variant="outline" size="default" className="w-full">
                <Link to={`/contests/${contestSlug}/results`}>
                  <Trophy size={14} className="mr-1.5" />
                  <span>View Standings</span>
                </Link>
              </Button>
            )}
            {isRegistrationErr && !isLifecycleErr && (
              <Button
                onClick={handleDirectRegister}
                disabled={isRegistering}
                variant="outline"
                size="default"
                className="w-full"
              >
                <Users size={14} className="mr-1.5" />
                <span>{isRegistering ? "Registering..." : "Register Now & Enter"}</span>
              </Button>
            )}
            {isAuthErr && (
              <Button asChild variant="outline" size="default" className="w-full">
                <Link to={`/auth?redirect=/assessments/${contestSlug}`}>
                  Sign In to Continue
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="default"
              onClick={() => {
                if (window.opener) window.close();
                else window.location.href = `/contests/${contestSlug}`;
              }}
              className="w-full"
            >
              Return to Contest Details
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Workspace ─────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-screen flex-col bg-black text-white font-sans select-none overflow-hidden">
      {/* Top Header (44px) */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-white/8 bg-black px-3 z-20">
        {/* Left: Problem selector pills */}
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase font-semibold tracking-wider text-lime-400 mr-2 hidden sm:inline">
            {assessment?.title ? assessment.title.slice(0, 24) : "CCC Assessment"}
          </span>
          <div className="h-3 w-px bg-white/10 mr-1 hidden sm:inline" />
          {problems.map((prob, idx) => {
            const sub = submissionsMap[prob.id];
            const isFullScore = sub && sub.score === prob.points;
            const isPartial = sub && sub.score > 0 && !isFullScore;
            const isSelected = activeProblemIndex === idx;

            return (
              <button
                key={prob.id}
                type="button"
                onClick={() => dispatch(setActiveProblemIndex(idx))}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-zinc-900 text-white border border-lime-400/40 font-semibold"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-950 border border-transparent"
                }`}
              >
                <span>Problem {prob.problem_index}</span>
                <span className="text-[10px] text-zinc-500 tabular-nums">({prob.points}p)</span>
                {isFullScore && <CheckCircle2 size={12} className="text-lime-400" />}
                {isPartial && <span className="size-1.5 rounded-full bg-amber-400" />}
              </button>
            );
          })}
        </div>

        {/* Center: Countdown Timer & Anti-Cheat Warnings */}
        <div className="flex items-center gap-2">
          {session && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded font-mono text-xs border ${
                session.remaining_seconds < 600
                  ? "border-red-500/40 bg-red-950/20 text-red-400 animate-pulse"
                  : "border-white/10 bg-zinc-950 text-zinc-200"
              }`}
            >
              <Clock size={12} className="text-lime-400" />
              <span className="font-semibold tabular-nums">{formatTimer(session.remaining_seconds)}</span>
            </div>
          )}

          {session && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded font-mono text-xs border ${
                (session.anti_cheat_violations || 0) > 0
                  ? "border-amber-500/40 bg-black text-amber-300 font-semibold"
                  : "border-white/8 bg-zinc-950 text-zinc-500"
              }`}
            >
              <ShieldAlert size={12} className={(session.anti_cheat_violations || 0) > 0 ? "text-amber-400" : "text-zinc-600"} />
              <span className="tabular-nums">
                Warning {session.anti_cheat_violations || 0} / {assessment?.max_violations || 3}
              </span>
            </div>
          )}
        </div>

        {/* Right: Controls & Actions */}
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <Select
            value={selectedLanguage}
            onValueChange={(val: any) => dispatch(setSelectedLanguage(val))}
          >
            <SelectTrigger className="h-7 w-[105px] border-white/10 bg-black text-xs font-mono text-zinc-300 focus:ring-0 rounded-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-black text-xs font-mono text-zinc-300 rounded-md">
              <SelectItem value="python">Python 3</SelectItem>
              <SelectItem value="cpp">C++ 14</SelectItem>
              <SelectItem value="c">C (GCC)</SelectItem>
              <SelectItem value="java">Java 21</SelectItem>
              <SelectItem value="javascript">JavaScript</SelectItem>
              <SelectItem value="typescript">TypeScript</SelectItem>
            </SelectContent>
          </Select>

          {/* Fullscreen Toggle */}
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={13} className="mr-1" /> : <Maximize2 size={13} className="mr-1" />}
            <span className="hidden md:inline">{isFullscreen ? "Exit" : "Full"}</span>
          </Button>

          {/* Run Code */}
          <Button
            size="sm"
            variant="outline"
            disabled={isRunning || isSubmitting}
            onClick={handleRun}
          >
            <Play size={12} className="text-lime-400 fill-lime-400 mr-1" />
            <span>{isRunning ? "Testing..." : "Run"}</span>
          </Button>

          {/* Submit Solution */}
          <Button
            size="sm"
            variant="default"
            disabled={isRunning || isSubmitting}
            onClick={handleSubmit}
          >
            <Send size={12} className="mr-1" />
            <span>{isSubmitting ? "Judging..." : "Submit"}</span>
          </Button>

          {/* Exit Window */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowExitModal(true)}
          >
            <X size={12} className="mr-1" />
            <span className="hidden sm:inline">Exit</span>
          </Button>

          {/* Finish Button */}
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setShowFinishModal(true)}
          >
            Finish
          </Button>

          {/* User Profile Logo / Avatar */}
          <Link
            to="/profile"
            className="flex items-center gap-1.5 pl-1 hover:opacity-90 transition-opacity cursor-pointer shrink-0"
            title={displayName ? `Profile (${displayName})` : "View Profile"}
          >
            <Avatar className="size-7 rounded-full border border-white/15 bg-black shrink-0">
              {resolvedAvatar ? (
                <AvatarImage
                  src={resolvedAvatar}
                  alt={displayName}
                  className="size-full rounded-full object-cover"
                />
              ) : null}
              <AvatarFallback className="size-full rounded-full bg-lime-400 text-black font-mono font-bold text-xs flex items-center justify-center">
                {userInitial}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </header>

      {/* Main 2-Pane Split View */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANE: Problem Statement */}
        <div className="w-1/2 border-r border-white/8 overflow-y-auto p-6 space-y-6 bg-black" data-problem-panel>
          {activeProblem ? (
            <div className="space-y-6">
              {/* Problem Title & Points */}
              <div className="border-b border-white/8 pb-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase font-semibold tracking-wider text-lime-400">
                    Problem {activeProblem.problem_index}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-950 text-zinc-400 border border-white/8 uppercase">
                    {activeProblem.difficulty}
                  </span>
                  <span className="text-xs font-mono text-zinc-500 tabular-nums">
                    {activeProblem.points} Pts
                  </span>
                </div>
                <h1 className="text-lg font-semibold tracking-tight text-white">
                  {activeProblem.title}
                </h1>
              </div>

              {/* Description */}
              <div className="text-xs font-sans text-zinc-300 leading-relaxed whitespace-pre-line">
                {activeProblem.description}
              </div>

              {/* Input Format */}
              {activeProblem.input_format && (
                <div className="space-y-1.5">
                  <h3 className="font-mono text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                    Input Format
                  </h3>
                  <div className="text-[13px] font-mono text-zinc-300 bg-zinc-950 border border-white/8 p-3 rounded-md leading-relaxed whitespace-pre-line">
                    {activeProblem.input_format}
                  </div>
                </div>
              )}

              {/* Output Format */}
              {activeProblem.output_format && (
                <div className="space-y-1.5">
                  <h3 className="font-mono text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                    Output Format
                  </h3>
                  <div className="text-[13px] font-mono text-zinc-300 bg-zinc-950 border border-white/8 p-3 rounded-md leading-relaxed whitespace-pre-line">
                    {activeProblem.output_format}
                  </div>
                </div>
              )}

              {/* Constraints */}
              {activeProblem.constraints && (
                <div className="space-y-1.5">
                  <h3 className="font-mono text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                    Constraints
                  </h3>
                  <pre className="text-[13px] font-mono text-amber-300 bg-zinc-950 border border-white/8 p-3 rounded-md overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {activeProblem.constraints}
                  </pre>
                </div>
              )}

              {/* Sample Examples */}
              <div className="space-y-3 pt-2">
                <h3 className="font-mono text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                  Sample Testcases
                </h3>
                {activeProblem.sample_testcases?.map((s, idx) => {
                  const inputVal = s.stdin || (s as any).input || "";
                  const outputVal = s.expected_output || (s as any).output || "";

                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-md bg-zinc-950 border border-white/8 space-y-2.5 text-xs font-mono"
                    >
                      <div className="flex items-center justify-between text-zinc-400 font-semibold">
                        <span>Case {idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(inputVal, idx)}
                          className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-white cursor-pointer font-mono"
                        >
                          {copiedIndex === idx ? <Check size={11} className="text-lime-400" /> : <Copy size={11} />}
                          <span>{copiedIndex === idx ? "Copied" : "Copy Input"}</span>
                        </button>
                      </div>

                      <div className="space-y-1">
                        <div className="text-zinc-500 text-[10px]">Input</div>
                        <pre className="p-2.5 rounded bg-black border border-white/6 text-[13px] text-zinc-200 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                          {inputVal}
                        </pre>
                      </div>

                      <div className="space-y-1">
                        <div className="text-zinc-500 text-[10px]">Expected Output</div>
                        <pre className="p-2.5 rounded bg-black border border-white/6 text-[13px] text-lime-400 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                          {outputVal}
                        </pre>
                      </div>

                      {s.explanation && (
                        <div className="text-zinc-500 text-[11px] italic pt-0.5 font-mono">
                          {s.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-zinc-500 font-mono text-xs">Select a problem from the top bar.</div>
          )}
        </div>

        {/* RIGHT PANE: Monaco Editor & Console */}
        <div className="w-1/2 flex flex-col bg-black">
          {/* Editor Container */}
          <div className="flex-1 relative overflow-hidden bg-black">
            <Suspense
              fallback={
                <div className="h-full w-full flex items-center justify-center text-xs font-mono text-zinc-500 animate-pulse">
                  Initializing terminal code editor…
                </div>
              }
            >
              <MonacoEditor
                value={currentCode}
                language={selectedLanguage}
                onChange={(code) => {
                  if (!activeProblem) return;
                  dispatch(
                    setCode({
                      problemId: activeProblem.id,
                      language: selectedLanguage,
                      code,
                    }),
                  );
                }}
              />
            </Suspense>
            <button
              type="button"
              onClick={() => {
                if (!activeProblem) return;
                setShowResetModal(true);
              }}
              className="absolute bottom-3 right-4 flex items-center gap-1 px-2 py-1 rounded bg-black border border-white/10 text-zinc-400 hover:text-white text-[10px] font-mono transition-colors z-10 cursor-pointer"
            >
              <RotateCcw size={10} /> Reset Starter
            </button>
          </div>

          {/* Output / Execution Drawer */}
          <div className="h-56 flex flex-col border-t border-white/8 bg-black">
            {/* Tab Bar */}
            <div className="flex h-8 shrink-0 items-center justify-between border-b border-white/8 px-3 bg-black">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => dispatch(setActiveConsoleTab("testcases"))}
                  className={`px-2 py-0.5 text-xs font-mono rounded cursor-pointer transition-colors ${
                    activeConsoleTab === "testcases"
                      ? "bg-zinc-900 text-white font-semibold"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Testcases
                </button>
                <button
                  type="button"
                  onClick={() => dispatch(setActiveConsoleTab("output"))}
                  className={`px-2 py-0.5 text-xs font-mono rounded cursor-pointer transition-colors flex items-center gap-1.5 ${
                    activeConsoleTab === "output"
                      ? "bg-zinc-900 text-white font-semibold"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <span>Result</span>
                  {runResult && (
                    <span
                      className={`size-1.5 rounded-full ${
                        runResult.verdict === "ACCEPTED" ? "bg-emerald-400" : "bg-red-400"
                      }`}
                    />
                  )}
                  {submitResult && (
                    <span
                      className={`size-1.5 rounded-full ${
                        submitResult.verdict === "ACCEPTED" ? "bg-emerald-400" : "bg-red-400"
                      }`}
                    />
                  )}
                </button>
              </div>

              {activeSubmission && (
                <div className="text-[10px] font-mono text-zinc-500">
                  Best Score:{" "}
                  <span className="text-lime-400 font-semibold tabular-nums">
                    {activeSubmission.score} / {activeProblem?.points}
                  </span>
                </div>
              )}
            </div>

            {/* Console Output Body */}
            <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
              {activeConsoleTab === "testcases" ? (
                <div className="space-y-3">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    Sample Testcases Input
                  </div>
                  {activeProblem?.sample_testcases?.map((st, i) => (
                    <div key={i} className="p-2 rounded bg-zinc-950 border border-white/8">
                      <span className="text-zinc-500 text-[10px]">CASE {i + 1}</span>
                      <pre className="text-zinc-300 mt-0.5 whitespace-pre-wrap">{st.stdin || (st as any).input}</pre>
                    </div>
                  ))}
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                      Custom Stdin (Optional)
                    </span>
                    <textarea
                      value={customStdin}
                      onChange={(e) => dispatch(setCustomStdin(e.target.value))}
                      placeholder="Enter custom input to test arbitrary test cases..."
                      className="w-full h-14 p-2 rounded bg-black border border-white/10 text-zinc-300 font-mono text-xs resize-none focus:outline-none focus:border-lime-400"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  {isRunning || isSubmitting ? (
                    <div className="flex items-center gap-2 text-lime-400 py-6 justify-center">
                      <Terminal size={14} className="animate-spin" />
                      <span>{isRunning ? "Compiling and testing sandbox..." : "Judging solution..."}</span>
                    </div>
                  ) : submitResult ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2.5 rounded bg-zinc-950 border border-white/8">
                        <div className="flex items-center gap-2">
                          {submitResult.verdict === "ACCEPTED" ? (
                            <CheckCircle2 size={16} className="text-emerald-400" />
                          ) : (
                            <XCircle size={16} className="text-red-400" />
                          )}
                          <span className={`font-semibold uppercase ${submitResult.verdict === "ACCEPTED" ? "text-emerald-400" : "text-white"}`}>{submitResult.verdict}</span>
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          Passed: <strong className="text-white">{submitResult.passed_testcases} / {submitResult.total_testcases}</strong> · Score: <strong className="text-emerald-400">{submitResult.score} pts</strong>
                        </div>
                      </div>

                      {submitResult.testcase_results?.map((tc: any, i: number) => (
                        <div key={i} className="p-2 rounded bg-black border border-white/6 text-[11px] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-500">{tc.name || `Case ${i + 1}`}</span>
                            <span className={tc.passed ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                              {tc.verdict}
                            </span>
                          </div>
                          {tc.stderr && (
                            <pre className="p-1 rounded bg-black text-red-400 overflow-x-auto text-[10px]">
                              {tc.stderr}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : runResult ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2.5 rounded bg-zinc-950 border border-white/8">
                        <div className="flex items-center gap-2">
                          {runResult.verdict === "ACCEPTED" ? (
                            <CheckCircle2 size={16} className="text-emerald-400" />
                          ) : (
                            <AlertCircle size={16} className="text-amber-400" />
                          )}
                          <span className={`font-semibold uppercase ${runResult.verdict === "ACCEPTED" ? "text-emerald-400" : "text-white"}`}>{runResult.verdict}</span>
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          Passed: <strong className="text-white">{runResult.passed_testcases} / {runResult.total_testcases}</strong>
                        </div>
                      </div>

                      {runResult.testcase_results?.map((tc: any, i: number) => (
                        <div key={i} className="p-2 rounded bg-black border border-white/6 text-[11px] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-500">{tc.name || `Case ${i + 1}`}</span>
                            <span className={tc.passed ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                              {tc.verdict}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div>
                              <span className="text-zinc-600">Your Output:</span>
                              <pre className="p-1 rounded bg-black text-zinc-300 overflow-x-auto">{tc.stdout || "(no output)"}</pre>
                            </div>
                            <div>
                              <span className="text-zinc-600">Expected:</span>
                              <pre className="p-1 rounded bg-black text-zinc-300 overflow-x-auto">{tc.expected_output}</pre>
                            </div>
                          </div>
                          {tc.stderr && (
                            <pre className="p-1 rounded bg-black text-red-400 overflow-x-auto text-[10px]">
                              {tc.stderr}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-zinc-600 py-6 text-center">
                      Click "Run" to test sample cases, or "Submit" for full verification.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Anti-cheat Telemetry Warning Dialog using official shadcn Dialog */}
      <Dialog
        open={antiCheatWarningOpen}
        onOpenChange={(open) => {
          if (!open) dispatch(dismissAntiCheatWarning());
        }}
      >
        <DialogContent className="max-w-md rounded-lg bg-zinc-950 border border-amber-500/40 text-center p-6 space-y-4 shadow-2xl">
          <DialogHeader className="flex flex-col items-center space-y-3 text-center sm:text-center">
            <div className="size-11 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <ShieldAlert size={22} />
            </div>
            <DialogTitle className="text-sm font-semibold font-mono text-white uppercase tracking-wider text-center">
              Proctored Session Warning
            </DialogTitle>
            <div className="inline-block px-2 py-0.5 rounded border border-amber-500/30 bg-black text-amber-300 font-mono text-xs tabular-nums">
              Warning {session?.anti_cheat_violations || 1} of {assessment?.max_violations || 3}
            </div>
            <DialogDescription className="text-xs text-zinc-400 font-mono leading-relaxed px-2 text-center">
              {antiCheatWarningMessage || "Tab switch, disconnect, or window blur detected. All environment focus events are proctored."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button
              onClick={() => dispatch(dismissAntiCheatWarning())}
              size="default"
              className="w-full bg-amber-400 text-black hover:bg-amber-300"
            >
              Acknowledge & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 1. Finalize Assessment Session Dialog */}
      <AlertDialog open={showFinishModal} onOpenChange={setShowFinishModal}>
        <AlertDialogPortal>
          <AlertDialogBackdrop className="fixed inset-0 z-50 bg-black/80" />
          <AlertDialogPopup from="top" className="border border-white/10 bg-zinc-950 text-white p-6 max-w-md rounded-lg shadow-2xl">
            <AlertDialogHeader className="space-y-2 text-left">
              <AlertDialogTitle className="text-base font-semibold text-white">
                Finalize & Submit Assessment?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-zinc-400 font-mono leading-relaxed">
                Are you sure you want to finalize and submit your assessment session? All your code submissions will be graded and your attempt will be permanently locked.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4 flex justify-end gap-2">
              <AlertDialogCancel
                onClick={() => setShowFinishModal(false)}
                className="bg-transparent border border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white px-4 py-2 text-xs font-mono rounded-md cursor-pointer"
              >
                Continue Working
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleFinish}
                className="bg-lime-400 hover:bg-lime-300 text-black font-semibold px-4 py-2 text-xs font-mono rounded-md cursor-pointer"
              >
                Yes, Finalize Session
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogPopup>
        </AlertDialogPortal>
      </AlertDialog>

      {/* 2. Exit Assessment Workspace Dialog */}
      <AlertDialog open={showExitModal} onOpenChange={setShowExitModal}>
        <AlertDialogPortal>
          <AlertDialogBackdrop className="fixed inset-0 z-50 bg-black/80" />
          <AlertDialogPopup from="top" className="border border-white/10 bg-zinc-950 text-white p-6 max-w-md rounded-lg shadow-2xl">
            <AlertDialogHeader className="space-y-2 text-left">
              <AlertDialogTitle className="text-base font-semibold text-white">
                Exit Assessment Workspace?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-zinc-400 font-mono leading-relaxed">
                Your code and progress are automatically saved on this device. You can resume this contest session before the assessment window closes. Close assessment window now?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4 flex justify-end gap-2">
              <AlertDialogCancel
                onClick={() => setShowExitModal(false)}
                className="bg-transparent border border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white px-4 py-2 text-xs font-mono rounded-md cursor-pointer"
              >
                Stay in Assessment
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleExitWindow}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold px-4 py-2 text-xs font-mono rounded-md cursor-pointer"
              >
                Yes, Exit
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogPopup>
        </AlertDialogPortal>
      </AlertDialog>

      {/* 3. Reset Starter Code Dialog */}
      <AlertDialog open={showResetModal} onOpenChange={setShowResetModal}>
        <AlertDialogPortal>
          <AlertDialogBackdrop className="fixed inset-0 z-50 bg-black/80" />
          <AlertDialogPopup from="top" className="border border-white/10 bg-zinc-950 text-white p-6 max-w-md rounded-lg shadow-2xl">
            <AlertDialogHeader className="space-y-2 text-left">
              <AlertDialogTitle className="text-base font-semibold text-white">
                Reset to Default Starter Code?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-zinc-400 font-mono leading-relaxed">
                This will discard your current unsaved edits for this problem and restore the initial starter code template. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4 flex justify-end gap-2">
              <AlertDialogCancel
                onClick={() => setShowResetModal(false)}
                className="bg-transparent border border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white px-4 py-2 text-xs font-mono rounded-md cursor-pointer"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleResetStarter}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 text-xs font-mono rounded-md cursor-pointer"
              >
                Reset Code
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogPopup>
        </AlertDialogPortal>
      </AlertDialog>
    </div>
  );
}
