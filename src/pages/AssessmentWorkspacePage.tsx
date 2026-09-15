/**
 * Chaos Computer Club India — Clean Standalone Assessment Environment
 * Pure distraction-free full-screen testing workspace.
 */

import { useNavigate, useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
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
  ShieldAlert,
  Lock,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { registerForContest } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MonacoEditor } from "@/organization/components/MonacoEditor";
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

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

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
      document.removeEventListener("visibilitychange", onVisibility);
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
  const currentCode = activeProblem
    ? (codeMap[`${activeProblem.id}_${selectedLanguage}`] ??
      activeProblem.starter_codes?.[selectedLanguage] ??
      "")
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
    if (!confirm("Are you sure you want to finalize and submit your assessment session?")) return;
    const action = await dispatch(finishAssessmentThunk(contestSlug));
    if (finishAssessmentThunk.fulfilled.match(action)) {
      toast.success("Assessment completed successfully.");
      if (window.opener) {
        window.close();
      } else {
        navigate(`/portal/contests/${contestSlug}`);
      }
    }
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
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#070707] text-[#999] font-mono text-xs">
        <div className="flex items-center gap-2">
          <Terminal size={16} className="animate-spin text-accent" />
          <span>INITIALIZING ASSESSMENT WORKSPACE...</span>
        </div>
      </div>
    );
  }

  // ── Submitted / Completed gate ───────────────────────────────────────────
  // When the session is already done show a clean completion screen instead of
  // the live editor. This prevents any re-entry path from reaching the workspace.
  if (session && (session.status === "submitted" || session.status === "disqualified")) {
    const isDisqualified = session.status === "disqualified";
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#080808] text-[#e0e0e0] font-sans p-6">
        <div className="max-w-md w-full p-8 rounded-xl bg-[#0e0e0e] border border-[#1e1e1e] text-center space-y-6">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto border ${
              isDisqualified
                ? "bg-red-950/30 border-red-500/30 text-red-400"
                : "bg-emerald-950/30 border-emerald-500/30 text-emerald-400"
            }`}
          >
            {isDisqualified ? <ShieldAlert size={28} /> : <CheckCircle2 size={28} />}
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold font-mono text-white">
              {isDisqualified ? "Assessment Disqualified" : "Assessment Submitted"}
            </h2>
            <p className="text-sm text-[#888] font-mono leading-relaxed">
              {isDisqualified
                ? "Your session was disqualified due to anti-cheat policy violations. Your answers were not recorded."
                : "Your answers have been recorded. Results will be published after the 24-hour entry window closes."}
            </p>
          </div>

          {!isDisqualified && (
            <div className="rounded-lg bg-[#141414] border border-[#1e1e1e] p-4 space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#666]">Score recorded</span>
                <span className="text-emerald-400 font-bold">{session.total_score ?? 0} pts</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#666]">Status</span>
                <span className="text-[#ccc] font-bold uppercase tracking-wider">Submitted</span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => navigate(`/portal/contests/${contestSlug}/results`)}
              className="w-full py-2 px-4 rounded-lg bg-accent text-black font-bold font-mono text-xs hover:bg-accent/90 transition-colors"
            >
              View Round 1 Ranking
            </button>
            <button
              type="button"
              onClick={() => navigate(`/portal/contests/${contestSlug}`)}
              className="w-full py-2 px-4 rounded-lg border border-[#2a2a2a] text-[#aaa] font-mono text-xs hover:bg-[#161616] transition-colors"
            >
              Return to Contest
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error / Registration / Lifecycle Gate
  if (error && !assessment) {
    const isRegistrationErr = error.toLowerCase().includes("registration");
    const isAuthErr = error.toLowerCase().includes("credential") || error.toLowerCase().includes("token") || error.toLowerCase().includes("login");
    const isLifecycleErr = error.toLowerCase().includes("upcoming") || error.toLowerCase().includes("live") || error.toLowerCase().includes("top 30");

    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#070707] text-[#e0e0e0] font-sans p-6">
        <div className="max-w-md w-full p-6 rounded-lg bg-[#0e0e0e] border border-[#222] text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#161616] border border-[#282828] flex items-center justify-center mx-auto text-accent">
            {isLifecycleErr ? <Lock size={24} className="text-amber-400" /> : <ShieldAlert size={24} />}
          </div>
          <h2 className="text-base font-semibold font-mono text-white">
            {isLifecycleErr ? "Screening Assessment Closed" : "Assessment Access Gate"}
          </h2>
          <p className="text-xs text-[#888] font-mono leading-relaxed">
            {error}
          </p>

          <div className="pt-2 flex flex-col gap-2">
            {isLifecycleErr && (
              <a href={`/portal/assessments/${contestSlug}/leaderboard`} className="w-full">
                <Button className="w-full bg-accent text-black font-bold font-mono text-xs hover:bg-accent/90">
                  <Trophy size={14} className="mr-1.5" /> View Screening Standings & Cutoff 🏆
                </Button>
              </a>
            )}
            {isRegistrationErr && !isLifecycleErr && (
              <Button
                onClick={handleDirectRegister}
                disabled={isRegistering}
                className="w-full bg-accent text-black font-bold font-mono text-xs hover:bg-accent/90"
              >
                <Users size={14} className="mr-1.5" />
                {isRegistering ? "Registering..." : "Register Now & Enter Workspace"}
              </Button>
            )}
            {isAuthErr && (
              <a href={`/auth?redirect=/assessments/${contestSlug}`} className="w-full">
                <Button className="w-full bg-accent text-black font-bold font-mono text-xs hover:bg-accent/90">
                  Sign In to Continue
                </Button>
              </a>
            )}
            <Button
              variant="outline"
              onClick={() => {
                if (window.opener) window.close();
                else window.location.href = `/portal/contests/${contestSlug}`;
              }}
              className="w-full font-mono text-xs border-[#333] hover:bg-[#181818]"
            >
              Return to Contest Details
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-[#080808] text-[#e0e0e0] font-sans select-none overflow-hidden">
      {/* ─── Minimal Ultra-Clean Header (44px) ────────────────────── */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-[#1c1c1c] bg-[#0c0c0c] px-3 z-20">
        {/* Left: Problem selector pill tabs */}
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-accent mr-2 hidden sm:inline">
            PROCTORED WORKSPACE
          </span>
          <div className="h-4 w-px bg-[#222] mr-1 hidden sm:inline" />
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
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#202020] text-white border border-[#383838] font-semibold"
                    : "text-[#888] hover:text-[#ddd] hover:bg-[#141414] border border-transparent"
                }`}
              >
                <span>Problem {prob.problem_index}</span>
                <span className="text-[10px] text-[#666] font-normal">({prob.points}p)</span>
                {isFullScore && <CheckCircle2 size={12} className="text-emerald-400" />}
                {isPartial && <span className="size-1.5 rounded-full bg-amber-400" />}
              </button>
            );
          })}
        </div>

        {/* Center: Minimal Countdown Timer */}
        {session && (
          <div
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded font-mono text-xs border ${
              session.remaining_seconds < 600
                ? "border-destructive/40 bg-destructive/10 text-destructive animate-pulse"
                : "border-[#252525] bg-[#121212] text-[#bbb]"
            }`}
          >
            <Clock size={12} />
            <span className="font-bold tracking-wider">{formatTimer(session.remaining_seconds)}</span>
          </div>
        )}

        {/* Right: Controls & Actions */}
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <Select
            value={selectedLanguage}
            onValueChange={(val: any) => dispatch(setSelectedLanguage(val))}
          >
            <SelectTrigger className="h-7 w-[100px] border-[#252525] bg-[#121212] text-xs font-mono text-[#ccc] focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-[#252525] bg-[#121212] text-xs font-mono text-[#ccc]">
              <SelectItem value="python">Python 3</SelectItem>
              <SelectItem value="cpp">C++ 14</SelectItem>
              <SelectItem value="javascript">Node.js</SelectItem>
            </SelectContent>
          </Select>

          {/* Fullscreen Toggle */}
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleFullscreen}
            className="h-7 px-2 text-xs font-mono text-[#888] hover:text-white hover:bg-[#181818] border border-[#222]"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={13} className="mr-1" /> : <Maximize2 size={13} className="mr-1" />}
            <span className="hidden md:inline">{isFullscreen ? "Exit" : "Fullscreen"}</span>
          </Button>

          {/* Run Tests Button */}
          <Button
            size="sm"
            variant="outline"
            disabled={isRunning || isSubmitting}
            onClick={handleRun}
            className="h-7 px-2.5 gap-1 text-xs font-mono border-[#2d2d2d] bg-[#161616] text-[#e0e0e0] hover:bg-[#222] hover:text-white cursor-pointer"
          >
            <Play size={12} className="text-amber-400" />
            <span>{isRunning ? "Testing..." : "Run"}</span>
          </Button>

          {/* Submit Solution Button */}
          <Button
            size="sm"
            disabled={isRunning || isSubmitting}
            onClick={handleSubmit}
            className="h-7 px-2.5 gap-1 text-xs font-mono bg-accent text-black font-bold hover:bg-accent/90 cursor-pointer"
          >
            <Send size={12} />
            <span>{isSubmitting ? "Judging..." : "Submit"}</span>
          </Button>

          {/* Finish Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleFinish}
            className="h-7 px-2 text-[11px] font-mono text-[#777] hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20"
          >
            Finish
          </Button>
        </div>
      </header>

      {/* ─── Main 2-Pane Split View ───────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANE: Clean Problem Statement ─────────────────────── */}
        <div className="w-1/2 border-r border-[#1c1c1c] overflow-y-auto p-6 space-y-6 bg-[#080808]">
          {activeProblem ? (
            <div className="space-y-6">
              {/* Problem Title & Points */}
              <div className="border-b border-[#181818] pb-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-accent font-bold">
                    PROBLEM {activeProblem.problem_index}
                  </span>
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[#161616] text-[#888] border border-[#222]">
                    {activeProblem.difficulty}
                  </span>
                  <span className="text-xs font-mono text-[#888]">
                    {activeProblem.points} Points
                  </span>
                </div>
                <h1 className="text-lg font-bold text-white tracking-tight mt-1.5">
                  {activeProblem.title}
                </h1>
              </div>

              {/* Problem Description */}
              <div className="text-xs font-mono text-[#ccc] leading-relaxed whitespace-pre-line">
                {activeProblem.description}
              </div>

              {/* Input Format */}
              {activeProblem.input_format && (
                <div className="space-y-1.5">
                  <h3 className="font-mono text-xs uppercase font-bold text-[#888] tracking-wider">
                    Input Format
                  </h3>
                  <div className="text-xs font-mono text-[#bbb] bg-[#0e0e0e] border border-[#1b1b1b] p-3 rounded leading-relaxed whitespace-pre-line">
                    {activeProblem.input_format}
                  </div>
                </div>
              )}

              {/* Output Format */}
              {activeProblem.output_format && (
                <div className="space-y-1.5">
                  <h3 className="font-mono text-xs uppercase font-bold text-[#888] tracking-wider">
                    Output Format
                  </h3>
                  <div className="text-xs font-mono text-[#bbb] bg-[#0e0e0e] border border-[#1b1b1b] p-3 rounded leading-relaxed whitespace-pre-line">
                    {activeProblem.output_format}
                  </div>
                </div>
              )}

              {/* Constraints */}
              {activeProblem.constraints && (
                <div className="space-y-1.5">
                  <h3 className="font-mono text-xs uppercase font-bold text-[#888] tracking-wider">
                    Constraints
                  </h3>
                  <pre className="text-xs font-mono text-[#aaa] bg-[#0e0e0e] border border-[#1b1b1b] p-3 rounded overflow-x-auto whitespace-pre-wrap">
                    {activeProblem.constraints}
                  </pre>
                </div>
              )}

              {/* Sample Examples */}
              <div className="space-y-4 pt-2">
                <h3 className="font-mono text-xs uppercase font-bold text-[#888] tracking-wider">
                  Sample Examples
                </h3>
                {activeProblem.sample_testcases?.map((s, idx) => {
                  const inputVal = s.stdin || (s as any).input || "";
                  const outputVal = s.expected_output || (s as any).output || "";

                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded bg-[#0d0d0d] border border-[#1d1d1d] space-y-2.5 text-xs font-mono"
                    >
                      <div className="flex items-center justify-between text-[#888] font-bold">
                        <span>Example {idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(inputVal, idx)}
                          className="flex items-center gap-1 text-[11px] text-[#666] hover:text-white cursor-pointer"
                        >
                          {copiedIndex === idx ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                          <span>{copiedIndex === idx ? "Copied" : "Copy Input"}</span>
                        </button>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[#666] text-[11px]">Input:</div>
                        <pre className="p-2 rounded bg-[#060606] border border-[#181818] text-[#ddd] overflow-x-auto whitespace-pre-wrap font-mono">
                          {inputVal}
                        </pre>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[#666] text-[11px]">Expected Output:</div>
                        <pre className="p-2 rounded bg-[#060606] border border-[#181818] text-[#ddd] overflow-x-auto whitespace-pre-wrap font-mono">
                          {outputVal}
                        </pre>
                      </div>

                      {s.explanation && (
                        <div className="text-[#777] text-[11px] italic pt-0.5">
                          Note: {s.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-[#666] font-mono text-xs">Select a problem from the top bar.</div>
          )}
        </div>

        {/* RIGHT PANE: Monaco Editor & Output Console ──────────────── */}
        <div className="w-1/2 flex flex-col bg-[#0a0a0a]">
          {/* Monaco Editor Container */}
          <div className="flex-1 relative overflow-hidden">
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
            {/* Quick reset starter code pill in editor corner */}
            <button
              type="button"
              onClick={() => {
                if (!activeProblem) return;
                if (confirm("Reset code to default starter template?")) {
                  dispatch(resetStarterCode());
                }
              }}
              className="absolute bottom-3 right-4 flex items-center gap-1 px-2 py-1 rounded bg-[#181818]/90 hover:bg-[#252525] border border-[#2c2c2c] text-[#888] hover:text-[#ccc] text-[10px] font-mono transition-all backdrop-blur cursor-pointer z-10"
              title="Reset to starter code"
            >
              <RotateCcw size={10} /> Reset Starter
            </button>
          </div>

          {/* Interactive Console / Execution Output Panel */}
          <div className="h-56 flex flex-col border-t border-[#1c1c1c] bg-[#0c0c0c]">
            {/* Console Tab Bar */}
            <div className="flex h-8 shrink-0 items-center justify-between border-b border-[#181818] px-3 bg-[#0a0a0a]">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => dispatch(setActiveConsoleTab("testcases"))}
                  className={`px-2.5 py-1 text-xs font-mono rounded cursor-pointer transition-colors ${
                    activeConsoleTab === "testcases"
                      ? "bg-[#1f1f1f] text-white font-semibold"
                      : "text-[#777] hover:text-[#ccc]"
                  }`}
                >
                  Testcases
                </button>
                <button
                  type="button"
                  onClick={() => dispatch(setActiveConsoleTab("output"))}
                  className={`px-2.5 py-1 text-xs font-mono rounded cursor-pointer transition-colors flex items-center gap-1 ${
                    activeConsoleTab === "output"
                      ? "bg-[#1f1f1f] text-white font-semibold"
                      : "text-[#777] hover:text-[#ccc]"
                  }`}
                >
                  <span>Result</span>
                  {runResult && (
                    <span
                      className={`size-1.5 rounded-full ${
                        runResult.verdict === "ACCEPTED" ? "bg-emerald-400" : "bg-destructive"
                      }`}
                    />
                  )}
                  {submitResult && (
                    <span
                      className={`size-1.5 rounded-full ${
                        submitResult.verdict === "ACCEPTED" ? "bg-emerald-400" : "bg-destructive"
                      }`}
                    />
                  )}
                </button>
              </div>

              {activeSubmission && (
                <div className="text-[10px] font-mono text-[#666]">
                  Best Score:{" "}
                  <span className="text-accent font-bold">
                    {activeSubmission.score} / {activeProblem?.points}
                  </span>
                </div>
              )}
            </div>

            {/* Console Body */}
            <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
              {activeConsoleTab === "testcases" ? (
                <div className="space-y-3">
                  <div className="text-[10px] text-[#666] uppercase tracking-wider">
                    Sample Testcases Input
                  </div>
                  {activeProblem?.sample_testcases?.map((st, i) => (
                    <div key={i} className="p-2 rounded bg-[#101010] border border-[#1b1b1b]">
                      <span className="text-[#666] text-[10px]">CASE {i + 1}</span>
                      <pre className="text-[#ccc] mt-0.5 whitespace-pre-wrap">{st.stdin || (st as any).input}</pre>
                    </div>
                  ))}
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] text-[#666] uppercase tracking-wider">
                      Custom Stdin (Optional)
                    </span>
                    <textarea
                      value={customStdin}
                      onChange={(e) => dispatch(setCustomStdin(e.target.value))}
                      placeholder="Enter custom input to test arbitrary inputs..."
                      className="w-full h-14 p-2 rounded bg-[#070707] border border-[#222] text-[#ccc] font-mono text-xs resize-none focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  {isRunning || isSubmitting ? (
                    <div className="flex items-center gap-2 text-accent py-6 justify-center">
                      <Terminal size={14} className="animate-spin" />
                      <span>{isRunning ? "Executing tests in sandbox..." : "Judging solution..."}</span>
                    </div>
                  ) : submitResult ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2.5 rounded bg-[#101010] border border-[#202020]">
                        <div className="flex items-center gap-2">
                          {submitResult.verdict === "ACCEPTED" ? (
                            <CheckCircle2 size={16} className="text-emerald-400" />
                          ) : (
                            <XCircle size={16} className="text-destructive" />
                          )}
                          <span className="font-bold text-white uppercase">{submitResult.verdict}</span>
                        </div>
                        <div className="text-[11px] text-[#888]">
                          Passed: <strong className="text-white">{submitResult.passed_testcases} / {submitResult.total_testcases}</strong> · Score: <strong className="text-accent">{submitResult.score} pts</strong>
                        </div>
                      </div>

                      {submitResult.testcase_results?.map((tc: any, i: number) => (
                        <div key={i} className="p-2 rounded bg-[#0e0e0e] border border-[#1a1a1a] text-[11px] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[#777]">{tc.name || `Testcase ${i + 1}`}</span>
                            <span className={tc.passed ? "text-emerald-400 font-bold" : "text-destructive font-bold"}>
                              {tc.verdict}
                            </span>
                          </div>
                          {tc.stderr && (
                            <pre className="p-1 rounded bg-[#140000] text-red-400 overflow-x-auto text-[10px]">
                              {tc.stderr}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : runResult ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2.5 rounded bg-[#101010] border border-[#202020]">
                        <div className="flex items-center gap-2">
                          {runResult.verdict === "ACCEPTED" ? (
                            <CheckCircle2 size={16} className="text-emerald-400" />
                          ) : (
                            <AlertCircle size={16} className="text-amber-400" />
                          )}
                          <span className="font-bold text-white uppercase">{runResult.verdict}</span>
                        </div>
                        <div className="text-[11px] text-[#888]">
                          Passed: <strong className="text-white">{runResult.passed_testcases} / {runResult.total_testcases}</strong>
                        </div>
                      </div>

                      {runResult.testcase_results?.map((tc: any, i: number) => (
                        <div key={i} className="p-2 rounded bg-[#0e0e0e] border border-[#1a1a1a] text-[11px] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[#777]">{tc.name || `Case ${i + 1}`}</span>
                            <span className={tc.passed ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                              {tc.verdict}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div>
                              <span className="text-[#555]">Your Output:</span>
                              <pre className="p-1 rounded bg-[#060606] text-[#ccc] overflow-x-auto">{tc.stdout || "(no output)"}</pre>
                            </div>
                            <div>
                              <span className="text-[#555]">Expected:</span>
                              <pre className="p-1 rounded bg-[#060606] text-[#ccc] overflow-x-auto">{tc.expected_output}</pre>
                            </div>
                          </div>
                          {tc.stderr && (
                            <pre className="p-1 rounded bg-[#140000] text-red-400 overflow-x-auto text-[10px]">
                              {tc.stderr}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[#555] py-4 text-center">
                      Click "Run" to test your code against sample cases, or "Submit" to grade all test cases.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Anti-cheat telemetry warning dialog */}
      {antiCheatWarningOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full p-5 rounded-lg bg-[#141414] border border-amber-500/40 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <ShieldAlert size={20} />
            </div>
            <h3 className="text-sm font-bold font-mono text-white">Proctored Session Warning</h3>
            <p className="text-xs text-[#aaa] font-mono leading-relaxed">
              {antiCheatWarningMessage || "Tab switch or window blur detected. All environment focus events are logged."}
            </p>
            <Button
              onClick={() => dispatch(dismissAntiCheatWarning())}
              className="w-full bg-amber-400 text-black hover:bg-amber-300 font-mono text-xs"
            >
              Acknowledge & Continue
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
