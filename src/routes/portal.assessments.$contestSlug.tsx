import { AssessmentStudioSkeleton } from "@/organization/components/skeletons";
/**
 * Chaos Computer Club India — Phase 1 Online Screening Assessment Studio
 * Powered by Interleet Code Execution Engine
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  Flame,
  Play,
  RotateCcw,
  Send,
  ShieldAlert,
  Terminal,
  Users,
  XCircle,
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

export const Route = createFileRoute("/portal/assessments/$contestSlug")({
  head: () => ({
    meta: [
      { title: "Online Assessment Studio — CCC Medi-Caps" },
      {
        name: "description",
        content: "Proctored Phase 1 online screening assessment and code execution workspace.",
      },
    ],
  }),
  pendingComponent: AssessmentStudioSkeleton,
  component: AssessmentStudio,
});

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function AssessmentStudio() {
  const { contestSlug } = Route.useParams();
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

  // 3. Anti-Cheat Monitoring (blur & tab switches)
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

  const activeProblem = problems[activeProblemIndex];
  const currentCode = activeProblem
    ? (codeMap[`${activeProblem.id}_${selectedLanguage}`] ??
      activeProblem.starter_codes?.[selectedLanguage] ??
      "")
    : "";

  const activeSubmission = activeProblem ? submissionsMap[activeProblem.id] : null;

  async function handleRun() {
    if (!activeProblem) return;
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
    await dispatch(
      submitCodeThunk({
        contestSlug,
        problemId: activeProblem.id,
        language: selectedLanguage,
        code: currentCode,
      }),
    );
  }

  async function handleFinish() {
    if (confirm("Are you sure you want to finalize and submit your assessment?")) {
      await dispatch(finishAssessmentThunk(contestSlug));
      void navigate({ to: "/portal/contests", search: { status: "all" } });
    }
  }

  if (isLoading && !assessment) {
    return <AssessmentStudioSkeleton />;
  }

  if (error) {
    const isRegErr = error.toLowerCase().includes("registration required");
    const isAuthErr =
      !isRegErr &&
      (error.toLowerCase().includes("authenticated") ||
        error.toLowerCase().includes("credential") ||
        error.toLowerCase().includes("token") ||
        error.toLowerCase().includes("unauthorized") ||
        error.toLowerCase().includes("session"));

    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#070707] text-[#eee] font-mono p-6 text-center">
        {isRegErr ? (
          <Terminal size={48} className="text-accent" />
        ) : (
          <ShieldAlert size={44} className="text-destructive" />
        )}
        <h2 className="text-lg font-bold text-white">
          {isRegErr
            ? "Contest Registration Required"
            : isAuthErr
              ? "Candidate Authentication Required"
              : "Assessment Round Unavailable"}
        </h2>
        <p className="text-sm text-[#888] max-w-md">
          {isRegErr
            ? "You must reserve your workstation seat and register for this offline contest before entering the Phase 1 online screening round."
            : isAuthErr
              ? "Sign in with your Medi-Caps account to enter the proctored assessment."
              : error}
        </p>
        <div className="flex items-center gap-3 mt-2 flex-wrap justify-center">
          {isRegErr && (
            <Button
              type="button"
              onClick={async () => {
                try {
                  const res = await registerForContest(contestSlug);
                  toast.success(res.message || "Registration confirmed! Unlocking assessment studio...");
                  dispatch(fetchAssessmentThunk(contestSlug));
                } catch (err: any) {
                  toast.error(err?.message || "Failed to register. Please sign in first.");
                }
              }}
              className="bg-accent text-accent-foreground font-mono text-xs hover:bg-accent/90 cursor-pointer shadow-[0_0_15px_rgba(200,255,54,0.3)]"
            >
              <Users size={14} className="mr-1.5" /> Register Now & Enter Studio →
            </Button>
          )}
          {isAuthErr && (
            <a href={`/auth?redirect=/portal/assessments/${contestSlug}`}>
              <Button className="bg-accent text-accent-foreground font-mono text-xs hover:bg-accent/90 cursor-pointer">
                Sign In to Start Assessment
              </Button>
            </a>
          )}
          <Link to="/portal/contests/$contestSlug" params={{ contestSlug }}>
            <Button
              variant="outline"
              className="font-mono text-xs border-[#333] hover:bg-[#181818] cursor-pointer"
            >
              Return to Contest Details
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#080808] text-[#e0e0e0] font-sans select-none">
      {/* ─── Top Studio Navbar ────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#1c1c1c] bg-[#0c0c0c] px-4">
        <div className="flex items-center gap-4">
          <Link
            to="/portal/contests"
            className="flex items-center gap-1 font-mono text-xs text-[#888] hover:text-[#fff] transition-colors"
          >
            <ArrowLeft size={14} /> Contests
          </Link>
          <div className="h-4 w-px bg-[#222]" />
          <div className="flex items-center gap-2">
            <span className="font-mono text-[0.625rem] tracking-wider uppercase text-accent font-bold">
              PHASE 1 SCREENING
            </span>
            <span className="text-sm font-semibold text-[#f0f0f0] hidden md:inline">
              {assessment?.title ?? "Online Assessment"}
            </span>
          </div>
        </div>

        {/* Problem selector tabs */}
        <div className="flex items-center gap-1">
          {problems.map((prob, idx) => {
            const sub = submissionsMap[prob.id];
            const isFullScore = sub && sub.score === prob.points;
            const isPartial = sub && sub.score > 0 && !isFullScore;
            return (
              <button
                key={prob.id}
                type="button"
                onClick={() => dispatch(setActiveProblemIndex(idx))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-all ${
                  activeProblemIndex === idx
                    ? "bg-[#222] text-[#fff] border border-[#333]"
                    : "text-[#888] hover:text-[#ccc] hover:bg-[#151515]"
                }`}
              >
                <span>Problem {prob.problem_index}</span>
                {isFullScore && <CheckCircle2 size={12} className="text-emerald-400" />}
                {isPartial && <span className="size-1.5 rounded-full bg-amber-400" />}
              </button>
            );
          })}
        </div>

        {/* Right action metrics */}
        <div className="flex items-center gap-3">
          {session && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-xs border ${
                session.remaining_seconds < 600
                  ? "border-destructive/40 bg-destructive/10 text-destructive animate-pulse"
                  : "border-[#222] bg-[#141414] text-[#aaa]"
              }`}
            >
              <Clock size={13} />
              <span>{formatTimer(session.remaining_seconds)}</span>
            </div>
          )}

          <Button
            size="sm"
            variant="ghost"
            disabled={isRunning || isSubmitting}
            onClick={handleRun}
            className="h-8 gap-1.5 text-xs font-mono text-[#ccc] hover:bg-[#1a1a1a] hover:text-[#fff]"
          >
            <Play size={13} className="text-amber-400" />
            <span>{isRunning ? "Testing…" : "Run Tests"}</span>
          </Button>

          <Button
            size="sm"
            disabled={isRunning || isSubmitting}
            onClick={handleSubmit}
            className="h-8 gap-1.5 text-xs font-mono bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Send size={13} />
            <span>{isSubmitting ? "Judging…" : "Submit"}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleFinish}
            className="h-8 text-xs font-mono border-[#333] hover:bg-[#202020] text-[#999] hover:text-[#fff]"
          >
            Finish
          </Button>
        </div>
      </header>

      {/* ─── Main Assessment Body (Split Pane) ────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Problem Details & Constraints */}
        <div className="w-1/2 border-r border-[#1c1c1c] overflow-y-auto p-6 space-y-6 bg-[#090909]">
          {activeProblem ? (
            <>
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-subtle-foreground uppercase">
                    Problem {activeProblem.problem_index} · {activeProblem.points} PTS
                  </span>
                  <span
                    className={`font-mono text-[0.625rem] px-2 py-0.5 rounded uppercase font-semibold ${
                      activeProblem.difficulty === "EASY"
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                        : activeProblem.difficulty === "MEDIUM"
                          ? "bg-amber-950 text-amber-400 border border-amber-800/40"
                          : "bg-rose-950 text-rose-400 border border-rose-800/40"
                    }`}
                  >
                    {activeProblem.difficulty}
                  </span>
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#f5f5f5]">
                  {activeProblem.title}
                </h1>
                {activeSubmission && (
                  <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#161616] border border-[#262626] font-mono text-xs">
                    <span className="text-[#777]">Best Score:</span>
                    <strong className="text-accent">
                      {activeSubmission.score} / {activeProblem.points} pts
                    </strong>
                    <span className="text-[#555]">({activeSubmission.verdict})</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-4 text-sm text-[#ccc] leading-relaxed">
                <p>{activeProblem.description}</p>
              </div>

              {/* Input & Output Format */}
              {activeProblem.input_format && (
                <div className="space-y-2">
                  <h3 className="font-mono text-xs text-subtle-foreground uppercase tracking-wider">
                    Input Format
                  </h3>
                  <div className="p-3 rounded bg-[#111] border border-[#1f1f1f] text-xs font-mono text-[#aaa]">
                    {activeProblem.input_format}
                  </div>
                </div>
              )}

              {activeProblem.output_format && (
                <div className="space-y-2">
                  <h3 className="font-mono text-xs text-subtle-foreground uppercase tracking-wider">
                    Output Format
                  </h3>
                  <div className="p-3 rounded bg-[#111] border border-[#1f1f1f] text-xs font-mono text-[#aaa]">
                    {activeProblem.output_format}
                  </div>
                </div>
              )}

              {/* Constraints */}
              {activeProblem.constraints && (
                <div className="space-y-2">
                  <h3 className="font-mono text-xs text-subtle-foreground uppercase tracking-wider">
                    Constraints
                  </h3>
                  <div className="p-3 rounded bg-[#111] border border-[#1f1f1f] text-xs font-mono text-[#aaa]">
                    {activeProblem.constraints}
                  </div>
                </div>
              )}

              {/* Sample Testcases */}
              <div className="space-y-4">
                <h3 className="font-mono text-xs text-subtle-foreground uppercase tracking-wider">
                  Sample Examples
                </h3>
                {activeProblem.sample_testcases?.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded bg-[#101010] border border-[#1d1d1d] space-y-2 text-xs font-mono"
                  >
                    <div className="text-[#888] font-bold">Example {idx + 1}</div>
                    <div className="space-y-1">
                      <div className="text-[#666]">Input:</div>
                      <pre className="p-2 rounded bg-[#070707] text-[#ddd] overflow-x-auto whitespace-pre-wrap">
                        {s.stdin || (s as any).input}
                      </pre>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[#666]">Expected Output:</div>
                      <pre className="p-2 rounded bg-[#070707] text-[#ddd] overflow-x-auto whitespace-pre-wrap">
                        {s.expected_output || (s as any).output}
                      </pre>
                    </div>
                    {s.explanation && (
                      <div className="text-[#777] text-[0.6875rem] italic">
                        Explanation: {s.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-[#666] font-mono text-sm">Select a problem above.</div>
          )}
        </div>

        {/* Right Pane: Monaco Code Editor + Output Console */}
        <div className="w-1/2 flex flex-col bg-[#0b0b0b]">
          {/* Editor Header Tools */}
          <div className="flex h-10 items-center justify-between border-b border-[#1c1c1c] bg-[#111] px-4">
            <div className="flex items-center gap-2">
              <Code2 size={14} className="text-accent" />
              <Select
                value={selectedLanguage}
                onValueChange={(val: any) => dispatch(setSelectedLanguage(val))}
              >
                <SelectTrigger className="h-7 w-32 border-0 bg-transparent text-xs font-mono focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-[#252525] text-xs font-mono">
                  <SelectItem value="python">Python 3.12</SelectItem>
                  <SelectItem value="cpp">C++20 (GCC)</SelectItem>
                  <SelectItem value="javascript">Node.js 20</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => dispatch(resetStarterCode())}
              className="h-6 text-[0.6875rem] font-mono text-[#777] hover:text-[#fff] gap-1"
            >
              <RotateCcw size={11} /> Reset starter
            </Button>
          </div>

          {/* Monaco Editor Canvas */}
          <div className="flex-1 min-h-[350px] relative">
            <MonacoEditor
              language={selectedLanguage}
              value={currentCode}
              onChange={(val) => {
                if (activeProblem) {
                  dispatch(
                    setCode({
                      problemId: activeProblem.id,
                      language: selectedLanguage,
                      code: val,
                    }),
                  );
                }
              }}
            />
          </div>

          {/* Bottom Console Tabs */}
          <div className="h-64 border-t border-[#1c1c1c] flex flex-col bg-[#0d0d0d]">
            <div className="flex items-center gap-1 border-b border-[#1a1a1a] px-3 bg-[#111]">
              <button
                type="button"
                onClick={() => dispatch(setActiveConsoleTab("testcases"))}
                className={`px-3 py-2 text-xs font-mono transition-colors ${
                  activeConsoleTab === "testcases"
                    ? "border-b-2 border-accent text-[#fff] font-bold"
                    : "text-[#777] hover:text-[#ccc]"
                }`}
              >
                Sample Tests
              </button>
              <button
                type="button"
                onClick={() => dispatch(setActiveConsoleTab("output"))}
                className={`px-3 py-2 text-xs font-mono flex items-center gap-1.5 transition-colors ${
                  activeConsoleTab === "output"
                    ? "border-b-2 border-accent text-[#fff] font-bold"
                    : "text-[#777] hover:text-[#ccc]"
                }`}
              >
                <span>Console Output</span>
                {(runResult || submitResult) && (
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
              {activeConsoleTab === "testcases" ? (
                <div className="space-y-3">
                  <div className="text-[0.6875rem] text-[#666] uppercase tracking-wider">
                    Default Sample Testcases
                  </div>
                  {activeProblem?.sample_testcases?.map((st, i) => (
                    <div key={i} className="p-2.5 rounded bg-[#141414] border border-[#202020]">
                      <span className="text-subtle-foreground text-[0.625rem]">CASE {i + 1}</span>
                      <pre className="text-[#ccc] mt-1 whitespace-pre-wrap">{st.stdin || (st as any).input}</pre>
                    </div>
                  ))}
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[0.6875rem] text-[#666] uppercase tracking-wider">
                      Custom Stdin (Optional)
                    </span>
                    <textarea
                      value={customStdin}
                      onChange={(e) => dispatch(setCustomStdin(e.target.value))}
                      placeholder="Paste arbitrary input here to test your algorithm…"
                      className="w-full h-16 p-2 rounded bg-[#090909] border border-[#222] text-[#ccc] font-mono text-xs resize-none focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              ) : (
                /* Output Console */
                <div>
                  {isRunning || isSubmitting ? (
                    <div className="flex items-center gap-2 text-accent">
                      <Terminal size={14} className="animate-spin" />
                      <span>
                        {isRunning
                          ? "Executing sample tests in sandbox…"
                          : "Evaluating solution against test suites…"}
                      </span>
                    </div>
                  ) : submitResult ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded bg-[#141414] border border-[#222]">
                        <div className="flex items-center gap-2">
                          {submitResult.verdict === "ACCEPTED" ? (
                            <CheckCircle2 size={16} className="text-emerald-400" />
                          ) : (
                            <XCircle size={16} className="text-rose-400" />
                          )}
                          <strong
                            className={
                              submitResult.verdict === "ACCEPTED"
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }
                          >
                            {submitResult.verdict}
                          </strong>
                        </div>
                        <div className="text-[#888] space-x-3 text-[0.6875rem]">
                          <span>
                            SCORE: <strong className="text-accent">{submitResult.score} pts</strong>
                          </span>
                          <span>
                            PASSED: {submitResult.passed_testcases}/{submitResult.total_testcases}
                          </span>
                          <span>RUNTIME: {submitResult.runtime_ms}ms</span>
                        </div>
                      </div>

                      {/* Testcase Breakdown */}
                      <div className="space-y-1.5">
                        {submitResult.testcase_results?.map((tr: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded bg-[#0d0d0d] border border-[#1b1b1b] text-xs"
                          >
                            <span className="text-[#888]">{tr.name ?? `Case ${idx + 1}`}</span>
                            <span
                              className={`text-[0.6875rem] font-bold ${
                                tr.passed ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {tr.verdict} ({tr.wall_time_ms}ms)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : runResult ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded bg-[#141414] border border-[#222]">
                        <div className="flex items-center gap-2">
                          {runResult.verdict === "ACCEPTED" ? (
                            <CheckCircle2 size={16} className="text-emerald-400" />
                          ) : (
                            <XCircle size={16} className="text-rose-400" />
                          )}
                          <strong
                            className={
                              runResult.verdict === "ACCEPTED"
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }
                          >
                            {runResult.verdict}
                          </strong>
                        </div>
                        <div className="text-[#888] space-x-3 text-[0.6875rem]">
                          <span>
                            PASSED: {runResult.passed_testcases}/{runResult.total_testcases}
                          </span>
                          <span>TIME: {runResult.time?.toFixed(3)}s</span>
                        </div>
                      </div>

                      {runResult.stderr && (
                        <div className="p-3 rounded bg-rose-950/20 border border-rose-900/30 text-rose-300">
                          <div className="text-[0.625rem] font-bold uppercase">Standard Error</div>
                          <pre className="mt-1 text-xs">{runResult.stderr}</pre>
                        </div>
                      )}

                      {runResult.testcase_results?.map((tr: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded bg-[#141414] border border-[#1e1e1e] space-y-1 text-xs"
                        >
                          <div className="flex justify-between items-center text-[0.6875rem]">
                            <span className="text-[#888]">{tr.name}</span>
                            <span
                              className={
                                tr.passed ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"
                              }
                            >
                              {tr.verdict}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-1 text-[0.6875rem]">
                            <div>
                              <span className="text-[#666]">Your Output:</span>
                              <pre className="p-1 rounded bg-[#090909] text-[#ccc]">
                                {tr.stdout || "(empty)"}
                              </pre>
                            </div>
                            <div>
                              <span className="text-[#666]">Expected:</span>
                              <pre className="p-1 rounded bg-[#090909] text-[#ccc]">
                                {tr.expected_output}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[#666] flex flex-col items-center justify-center h-full gap-1 pt-6">
                      <Terminal size={18} />
                      <span>Press "Run Tests" to test code against sample cases.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Anti-Cheat Warning Modal ─────────────────────────────────── */}
      {antiCheatWarningOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full p-6 rounded-lg bg-[#141414] border border-destructive/50 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle size={24} />
              <h3 className="font-bold text-base text-[#f5f5f5]">Anti-Cheat Proctored Warning</h3>
            </div>
            <p className="text-xs text-[#bbb] leading-relaxed">{antiCheatWarningMessage}</p>
            <div className="p-3 rounded bg-[#0a0a0a] border border-[#222] text-[0.6875rem] font-mono text-[#888]">
              Switching tabs, opening developer tools, or losing window focus is logged by the CCC
              telemetry daemon. Exceeding limits will disqualify your screening session.
            </div>
            <Button
              className="w-full bg-destructive text-white hover:bg-destructive/90 text-xs font-mono"
              onClick={() => dispatch(dismissAntiCheatWarning())}
            >
              I Understand · Return to Test
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
