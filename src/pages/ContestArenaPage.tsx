/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * Dedicated Air-Gapped Live Contest Arena (Round 2 Final)
 * Redesigned to Strix AI Paradigm (Pure Pitch Black × Electric Lime)
 */

import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Maximize2,
  Minimize2,
  Play,
  QrCode,
  RotateCcw,
  Send,
  ShieldCheck,
  Terminal,
  Trophy,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
  fetchContestArenaThunk,
  runArenaCodeThunk,
  submitArenaCodeThunk,
  clearArenaResults,
} from "@/store/slices/contestSlice";
import { AssessmentStudioSkeleton } from "@/organization/components/skeletons";
import { useRealtimeEvents } from "@/lib/realtime";

function formatTimer(totalSeconds: number): string {
  if (totalSeconds <= 0) return "00:00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ContestArenaPage() {
  const { contestSlug = "" } = useParams<{ contestSlug: string }>();
  const [searchParams] = useSearchParams();
  const problemParam = searchParams.get("problem");
  const dispatch = useAppDispatch();

  const { arenaData, runResult, submitResult, isRunningCode, isSubmittingCode, isLoadingArena } =
    useAppSelector((state) => state.contest);

  useEffect(() => {
    if (contestSlug) {
      dispatch(fetchContestArenaThunk(contestSlug));
    }
    return () => {
      dispatch(clearArenaResults());
    };
  }, [contestSlug, dispatch]);

  const problems = arenaData?.problems || [];
  const initialIndex = problemParam
    ? Math.max(0, problems.findIndex((p) => p.problem_index.toUpperCase() === problemParam.toUpperCase()))
    : 0;

  const [activeIndex, setActiveIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [selectedLanguage, setSelectedLanguage] = useState<"python" | "cpp" | "javascript">("python");
  const [codeMap, setCodeMap] = useState<Record<string, string>>({});
  const [customStdin, setCustomStdin] = useState("");
  const [activeConsoleTab, setActiveConsoleTab] = useState<"testcases" | "output">("testcases");
  const [activeTestcaseIndex, setActiveTestcaseIndex] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [solvedProblemIds, setSolvedProblemIds] = useState<Set<string>>(new Set());

  const navigate = useNavigate();
  const contestOverRedirectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync remaining contest clock
  const [remainingSeconds, setRemainingSeconds] = useState<number>(7200);
  const [isContestOver, setIsContestOver] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  useEffect(() => {
    if (arenaData?.ends_at) {
      const endMs = new Date(arenaData.ends_at).getTime();
      const diff = Math.floor((endMs - Date.now()) / 1000);
      setRemainingSeconds(diff > 0 ? diff : 0);
    }
  }, [arenaData?.ends_at]);

  // Real-time arena clock push
  useRealtimeEvents(contestSlug, (event) => {
    if (event.event === "arena_timer_reset" && event.data?.remaining_seconds !== undefined) {
      setRemainingSeconds(event.data.remaining_seconds);
      toast.info("Contest clock synchronized by Chief Proctor.");
    } else if (event.event === "contest_status_changed" && event.data?.status === "finished") {
      setRemainingSeconds(0);
      toast.warning("Contest concluded by Chief Proctor.");
    }
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Contest over: lock arena and auto-redirect to final results
  useEffect(() => {
    if (remainingSeconds > 0 || isContestOver) return;
    setIsContestOver(true);
    let count = 5;
    const tick = setInterval(() => {
      count -= 1;
      setRedirectCountdown(count);
      if (count <= 0) {
        clearInterval(tick);
        navigate(`/contests/${contestSlug}/final-results`);
      }
    }, 1000);
    contestOverRedirectRef.current = tick;
    return () => clearInterval(tick);
  }, [remainingSeconds, isContestOver, contestSlug, navigate]);

  const activeProblem = problems[activeIndex] || problems[0];
  const problemKey = `${activeProblem?.id || "p"}_${selectedLanguage}`;

  const currentCode =
    codeMap[problemKey] ??
    activeProblem?.starter_codes?.[selectedLanguage] ??
    (selectedLanguage === "python"
      ? "# Write your solution here\nimport sys\n\ndef main():\n    pass\n\nif __name__ == '__main__':\n    main()\n"
      : selectedLanguage === "cpp"
        ? "#include <iostream>\nusing namespace std;\n\nint main() {\n    return 0;\n}\n"
        : "const fs = require('fs');\n// Write your solution here\n");

  const handleCodeChange = (newCode: string) => {
    setCodeMap((prev) => ({ ...prev, [problemKey]: newCode }));
  };

  const handleResetStarter = () => {
    const defaultStarter =
      activeProblem?.starter_codes?.[selectedLanguage] ||
      (selectedLanguage === "python"
        ? "# Write your solution here\nimport sys\n\ndef main():\n    pass\n\nif __name__ == '__main__':\n    main()\n"
        : selectedLanguage === "cpp"
          ? "#include <iostream>\nusing namespace std;\n\nint main() {\n    return 0;\n}\n"
          : "const fs = require('fs');\n// Write your solution here\n");
    setCodeMap((prev) => ({ ...prev, [problemKey]: defaultStarter }));
    toast.info("Reset code to official template.");
  };

  const copyToClipboard = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleRunCode = async () => {
    if (!activeProblem) return;
    setActiveConsoleTab("output");
    const result = await dispatch(
      runArenaCodeThunk({
        slug: contestSlug,
        payload: {
          problem_id: activeProblem.id,
          language: selectedLanguage,
          code: currentCode,
          ...(activeTestcaseIndex === -1 ? { custom_stdin: customStdin } : {}),
        },
      })
    );
    if (runArenaCodeThunk.fulfilled.match(result)) {
      if (result.payload.verdict === "ACCEPTED") {
        toast.success("Sample testcase passed!");
      } else {
        toast.error(`Execution: ${result.payload.verdict}`);
      }
    } else {
      toast.error(String(result.payload || "Failed to execute code"));
    }
  };

  const handleSubmitCode = async () => {
    if (!activeProblem) return;
    setActiveConsoleTab("output");
    const result = await dispatch(
      submitArenaCodeThunk({
        slug: contestSlug,
        payload: {
          problem_id: activeProblem.id,
          language: selectedLanguage,
          code: currentCode,
        },
      })
    );
    if (submitArenaCodeThunk.fulfilled.match(result)) {
      const res = result.payload;
      if (res.verdict === "ACCEPTED") {
        setSolvedProblemIds((prev) => new Set([...prev, activeProblem.id]));
        toast.success(`Problem ${activeProblem.problem_index} Solved! +${res.points_awarded} pts`);
      } else {
        toast.error(`Verdict: ${res.verdict} (${res.passed_testcases}/${res.total_testcases} passed)`);
      }
    } else {
      toast.error(String(result.payload || "Submission failed"));
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        void document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  if (isLoadingArena && !arenaData) {
    return <AssessmentStudioSkeleton />;
  }

  if (!arenaData) {
    return (
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-black p-4 text-white font-sans">
        <div className="w-full max-w-lg space-y-6 rounded-lg border border-amber-500/30 bg-black p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <ShieldCheck className="size-7" />
          </div>

          <div className="space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400 font-semibold">
              Physical Gate Check-in Required
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Proctor Verification Required
            </h1>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed">
              Round 2 Live Final is strictly an on-premise event at Medi-Caps Computing Complex. Access is unlocked once your digital Campus Pass is scanned by a proctor.
            </p>
          </div>

          <div className="space-y-2 rounded-md border border-white/8 bg-zinc-950 p-4 text-left font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Round 1 Screening:</span>
              <span className="font-semibold text-lime-400">Top 30 Qualified</span>
            </div>
            <div className="flex items-center justify-between border-t border-white/6 pt-2">
              <span className="text-zinc-500">Lab Gate Check-in:</span>
              <span className="font-semibold text-amber-400">Awaiting Proctor Scan</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              asChild
              className="rounded-md bg-lime-400 font-mono text-xs font-semibold text-black hover:bg-lime-300"
            >
              <Link to={`/contests/${contestSlug}/qualified`}>
                <QrCode className="mr-2 size-3.5" /> View Finalist Pass
              </Link>
            </Button>
            <div className="flex gap-2">
              <Button
                onClick={() => dispatch(fetchContestArenaThunk(contestSlug))}
                variant="outline"
                className="w-full rounded-md font-mono text-xs border-white/10 bg-black text-zinc-300 hover:text-white"
              >
                <RotateCcw className="mr-1.5 size-3" /> Re-check Status
              </Button>
              <Button
                asChild
                variant="ghost"
                className="rounded-md font-mono text-xs text-zinc-500 hover:text-white"
              >
                <Link to={`/contests/${contestSlug}`}>
                  Exit Lobby
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const title = arenaData?.title || "Live Final Arena";

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-black text-white select-none overflow-hidden font-sans">
      {/* Top Navigation Bar (48px) */}
      <header className="h-12 shrink-0 px-4 border-b border-white/8 bg-black flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-zinc-400 hover:text-white rounded-md font-mono text-xs"
          >
            <Link to={`/contests/${contestSlug}`}>
              <ArrowLeft className="size-3.5 mr-1" />
              Exit
            </Link>
          </Button>

          <div className="h-3 w-px bg-white/10" />

          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[10px] uppercase font-semibold tracking-wider text-lime-400 hidden sm:inline">
              Final Arena
            </span>
            <h1 className="text-xs font-semibold tracking-tight text-white truncate max-w-[200px] md:max-w-[320px]">
              {title}
            </h1>
            <span className="border border-lime-400/30 bg-lime-400/10 text-lime-400 font-mono text-[9px] uppercase px-1.5 py-0.5 rounded font-semibold">
              Live
            </span>
          </div>
        </div>

        {/* Center: Proctor & Workstation Indicator */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded border border-white/8 bg-zinc-950 text-xs font-mono">
            <ShieldCheck className="size-3 text-lime-400" />
            <span className="text-zinc-500">Proctors:</span>
            <span className="text-zinc-300 font-medium">{arenaData?.chief_proctors?.length ? arenaData.chief_proctors.join(", ") : "CCC Operations Desk"}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded border border-white/8 bg-black text-xs font-mono">
            <span className="size-1.5 rounded-full bg-lime-400" />
            <span className="text-zinc-300 font-medium">Elo Rated</span>
          </div>
        </div>

        {/* Right: Timer, Scoreboard & Fullscreen */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded border border-lime-400/30 bg-lime-400/10 text-lime-400 font-mono text-xs font-semibold tabular-nums">
            <span className="size-1.5 rounded-full bg-lime-400 animate-pulse" />
            <Clock className="size-3 text-lime-400" />
            <span>{formatTimer(remainingSeconds)}</span>
          </div>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden sm:flex h-7 text-xs font-mono border-white/10 bg-black text-zinc-300 hover:text-white rounded-md"
          >
            <Link to={`/contests/${contestSlug}/results`} target="_blank">
              <Trophy className="size-3 mr-1 text-lime-400" />
              Scoreboard
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-950"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Button>
        </div>
      </header>

      {/* Problem Tabs Subheader (36px) */}
      <div className="h-9 shrink-0 px-4 bg-black border-b border-white/8 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1">
          {problems.map((prob, idx) => {
            const isActive = idx === activeIndex;
            const isSolved = solvedProblemIds.has(prob.id);
            return (
              <button
                key={prob.id}
                type="button"
                onClick={() => {
                  setActiveIndex(idx);
                  dispatch(clearArenaResults());
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded transition-colors cursor-pointer border ${
                  isActive
                    ? "bg-zinc-900 text-white border-lime-400/40 font-semibold"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-950 border-transparent"
                }`}
              >
                <span>Problem {prob.problem_index}</span>
                <span className="text-[10px] px-1 py-0.2 rounded font-mono uppercase bg-zinc-950 text-zinc-500">
                  {prob.points}p
                </span>
                {isSolved && <BadgeCheck className="size-3 text-lime-400" />}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <Select
            value={selectedLanguage}
            onValueChange={(val: any) => setSelectedLanguage(val)}
          >
            <SelectTrigger className="h-6 w-[110px] text-xs font-mono bg-black border-white/10 text-zinc-300 rounded-md focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/10 text-white font-mono text-xs rounded-md">
              <SelectItem value="python">Python 3.12</SelectItem>
              <SelectItem value="cpp">C++ (GCC 14)</SelectItem>
              <SelectItem value="javascript">JavaScript</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs font-mono text-zinc-500 hover:text-white rounded-md hover:bg-zinc-950"
            onClick={handleResetStarter}
          >
            <RotateCcw className="size-2.5 mr-1" /> Reset
          </Button>
        </div>
      </div>

      {/* Main 2-Pane Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Problem Statement Pane */}
        <div className="w-1/2 border-r border-white/8 overflow-y-auto p-6 space-y-5 bg-black">
          {activeProblem ? (
            <div className="space-y-5">
              <div className="border-b border-white/8 pb-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase font-semibold text-lime-400">
                    Problem {activeProblem.problem_index}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500 tabular-nums">
                    {activeProblem.points} Points
                  </span>
                </div>
                <h2 className="text-base font-semibold tracking-tight text-white">
                  {activeProblem.title}
                </h2>
              </div>

              <div className="text-xs font-mono text-zinc-300 leading-relaxed whitespace-pre-line">
                {activeProblem.description}
              </div>

              {activeProblem.input_format && (
                <div className="space-y-1">
                  <h3 className="font-mono text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                    Input Format
                  </h3>
                  <div className="text-xs font-mono text-zinc-300 bg-zinc-950 border border-white/8 p-3 rounded-md whitespace-pre-line leading-relaxed">
                    {activeProblem.input_format}
                  </div>
                </div>
              )}

              {activeProblem.output_format && (
                <div className="space-y-1">
                  <h3 className="font-mono text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                    Output Format
                  </h3>
                  <div className="text-xs font-mono text-zinc-300 bg-zinc-950 border border-white/8 p-3 rounded-md whitespace-pre-line leading-relaxed">
                    {activeProblem.output_format}
                  </div>
                </div>
              )}

              {activeProblem.constraints && (
                <div className="space-y-1">
                  <h3 className="font-mono text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                    Constraints
                  </h3>
                  <pre className="text-xs font-mono text-amber-300 bg-zinc-950 border border-white/8 p-3 rounded-md overflow-x-auto whitespace-pre-wrap">
                    {activeProblem.constraints}
                  </pre>
                </div>
              )}

              {/* Sample Testcases */}
              <div className="space-y-3 pt-1">
                <h3 className="font-mono text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                  Sample Testcases
                </h3>
                {activeProblem.sample_testcases?.map((st, i) => (
                  <div key={i} className="p-3.5 rounded-md bg-zinc-950 border border-white/8 space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between text-zinc-400 font-semibold">
                      <span>Case {i + 1}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(st.stdin, `tc_${i}`)}
                        className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-white cursor-pointer"
                      >
                        {copiedKey === `tc_${i}` ? <Check className="size-3 text-lime-400" /> : <Copy className="size-3" />}
                        <span>{copiedKey === `tc_${i}` ? "Copied" : "Copy Input"}</span>
                      </button>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-500">Input</span>
                      <pre className="p-2 rounded bg-black border border-white/6 text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                        {st.stdin}
                      </pre>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-500">Expected Output</span>
                      <pre className="p-2 rounded bg-black border border-white/6 text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                        {st.expected_output}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-zinc-500 font-mono text-xs">Select a challenge to begin.</div>
          )}
        </div>

        {/* Right: Editor & Drawer */}
        <div className="w-1/2 flex flex-col bg-black">
          <div className="flex-1 relative overflow-hidden bg-black">
            <MonacoEditor
              value={currentCode}
              language={selectedLanguage}
              onChange={handleCodeChange}
            />
          </div>

          {/* Execution Drawer */}
          <div className="h-56 flex flex-col border-t border-white/8 bg-black">
            {/* Drawer Tab Header */}
            <div className="flex h-8 shrink-0 items-center justify-between border-b border-white/8 px-3 bg-black">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveConsoleTab("testcases")}
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
                  onClick={() => setActiveConsoleTab("output")}
                  className={`px-2 py-0.5 text-xs font-mono rounded cursor-pointer transition-colors flex items-center gap-1.5 ${
                    activeConsoleTab === "output"
                      ? "bg-zinc-900 text-white font-semibold"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <span>Output</span>
                  {submitResult && (
                    <span
                      className={`size-1.5 rounded-full ${
                        submitResult.verdict === "ACCEPTED" ? "bg-lime-400" : "bg-red-400"
                      }`}
                    />
                  )}
                  {runResult && (
                    <span
                      className={`size-1.5 rounded-full ${
                        runResult.verdict === "ACCEPTED" ? "bg-lime-400" : "bg-amber-400"
                      }`}
                    />
                  )}
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
              {activeConsoleTab === "testcases" ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    {activeProblem?.sample_testcases?.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveTestcaseIndex(i)}
                        className={`px-2 py-0.5 text-xs font-mono rounded ${
                          activeTestcaseIndex === i
                            ? "bg-zinc-900 text-white border border-white/10"
                            : "text-zinc-500 hover:text-white"
                        }`}
                      >
                        Case {i + 1}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setActiveTestcaseIndex(-1)}
                      className={`px-2 py-0.5 text-xs font-mono rounded ${
                        activeTestcaseIndex === -1
                          ? "bg-zinc-900 text-white border border-white/10"
                          : "text-zinc-500 hover:text-white"
                      }`}
                    >
                      Custom
                    </button>
                  </div>

                  {activeTestcaseIndex === -1 ? (
                    <textarea
                      value={customStdin}
                      onChange={(e) => setCustomStdin(e.target.value)}
                      placeholder="Enter custom input stdin..."
                      className="w-full h-20 p-2 rounded bg-black border border-white/10 text-zinc-300 font-mono text-xs resize-none focus:outline-none focus:border-lime-400"
                    />
                  ) : (
                    activeProblem?.sample_testcases?.[activeTestcaseIndex] && (
                      <div className="space-y-2">
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                            Standard Input
                          </span>
                          <pre className="p-2 bg-zinc-950 border border-white/8 rounded text-xs text-white">
                            {activeProblem.sample_testcases[activeTestcaseIndex].stdin}
                          </pre>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                            Expected Output
                          </span>
                          <pre className="p-2 bg-zinc-950 border border-white/8 rounded text-xs text-lime-400">
                            {activeProblem.sample_testcases[activeTestcaseIndex].expected_output}
                          </pre>
                        </div>
                      </div>
                    )
                  )}
                </div>
              ) : (
                /* Output Tab */
                <div className="space-y-3">
                  {submitResult ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {submitResult.verdict === "ACCEPTED" ? (
                          <div className="flex items-center gap-1.5 text-lime-400 font-semibold text-xs uppercase font-mono">
                            <CheckCircle2 className="size-4" /> Accepted
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-red-400 font-semibold text-xs uppercase font-mono">
                            <XCircle className="size-4" /> {submitResult.verdict}
                          </div>
                        )}
                        <span className="text-zinc-600">·</span>
                        <span className="text-white font-mono tabular-nums">
                          {submitResult.passed_testcases} / {submitResult.total_testcases} passed
                        </span>
                        {submitResult.points_awarded > 0 && (
                          <Badge className="bg-lime-400/10 text-lime-400 border border-lime-400/30 rounded font-mono text-[10px] tabular-nums">
                            +{submitResult.points_awarded} pts
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 font-mono">{submitResult.message}</p>
                    </div>
                  ) : runResult ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 font-mono">
                        <span
                          className={`font-semibold uppercase text-xs ${
                            runResult.verdict === "ACCEPTED" ? "text-lime-400" : "text-amber-400"
                          }`}
                        >
                          Verdict: {runResult.verdict}
                        </span>
                        {runResult.time !== undefined && (
                          <span className="text-zinc-500 text-xs tabular-nums">
                            ({Math.round(runResult.time * 1000)}ms)
                          </span>
                        )}
                      </div>
                      {runResult.stdout && (
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                            Stdout
                          </span>
                          <pre className="p-2 bg-zinc-950 border border-white/8 rounded text-xs text-white overflow-x-auto">
                            {runResult.stdout}
                          </pre>
                        </div>
                      )}
                      {runResult.stderr && (
                        <div>
                          <span className="text-[10px] text-red-400 uppercase tracking-wider font-mono">
                            Stderr
                          </span>
                          <pre className="p-2 bg-black border border-red-500/20 rounded text-xs text-red-400 overflow-x-auto">
                            {runResult.stderr}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-zinc-600 text-center py-6 font-mono text-xs">
                      Run code against sample cases or submit for evaluation.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Action Footer */}
            <div className="h-11 px-4 border-t border-white/8 flex items-center justify-between bg-black">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                <span className={`size-1.5 rounded-full ${isContestOver ? 'bg-red-500' : 'bg-lime-400'}`} />
                <span>{isContestOver ? 'Contest locked' : 'Workstation online'}</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isRunningCode || isSubmittingCode || isContestOver}
                  onClick={handleRunCode}
                  className="font-mono text-xs rounded-md border-white/10 bg-black text-white hover:bg-zinc-950 disabled:opacity-30"
                >
                  <Play className="size-3 mr-1 text-lime-400" />
                  {isRunningCode ? "Running…" : "Run"}
                </Button>

                <Button
                  size="sm"
                  disabled={isRunningCode || isSubmittingCode || isContestOver}
                  onClick={handleSubmitCode}
                  className="font-mono text-xs font-semibold rounded-md bg-lime-400 hover:bg-lime-300 text-black disabled:opacity-30"
                >
                  <Send className="size-3 mr-1" />
                  {isSubmittingCode ? "Judging…" : "Submit"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contest Over Overlay */}
      {isContestOver && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-black/95 backdrop-blur-md"
        >
          <div className="flex size-20 items-center justify-center rounded-lg border border-lime-400/40 bg-black">
            <Trophy className="size-8 text-lime-400" />
          </div>

          <div className="space-y-2 text-center">
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-lime-400">Contest Concluded</p>
            <h2 className="text-3xl font-semibold tracking-tight text-white">
              Time's Up
            </h2>
            <p className="max-w-sm text-xs text-zinc-400 font-mono leading-relaxed">
              All submissions are locked. Standings will be finalized.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-md border border-lime-400 bg-lime-400/10">
              <span className="text-xl font-bold text-lime-400 tabular-nums">{redirectCountdown}</span>
            </div>
            <button
              onClick={() => navigate(`/contests/${contestSlug}/final-results`)}
              className="font-mono text-xs font-semibold uppercase text-lime-400 border border-lime-400/40 bg-lime-400/10 px-5 py-2 rounded-md hover:bg-lime-400/20 transition-colors"
            >
              View Final Results →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
