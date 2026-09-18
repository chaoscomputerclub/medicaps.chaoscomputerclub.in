/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * Dedicated Air-Gapped Live Contest Arena (Round 2 Final)
 * Pure Redux Toolkit & React Router Architecture
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
import { AssessmentStudioSkeleton, Skeleton } from "@/organization/components/skeletons";
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

  // Real-time arena clock push: proctors can pause, extend, or reset timers via SSE/Webhooks
  useRealtimeEvents(contestSlug, (event) => {
    if (event.event === "arena_timer_reset" && event.data?.remaining_seconds !== undefined) {
      setRemainingSeconds(event.data.remaining_seconds);
      toast.info("Contest clock updated by Chief Proctor Command.");
    } else if (event.event === "contest_status_changed" && event.data?.status === "finished") {
      setRemainingSeconds(0);
      toast.warning("Contest concluded by Proctor Command.");
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
    // Countdown 5 → 0 then navigate
    let count = 5;
    const tick = setInterval(() => {
      count -= 1;
      setRedirectCountdown(count);
      if (count <= 0) {
        clearInterval(tick);
        navigate(`/portal/contests/${contestSlug}/final-results`);
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
        toast.success(`🎉 Problem ${activeProblem.problem_index} Solved! +${res.points_awarded} pts`);
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
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-zinc-950 p-4 text-white">
        <div className="w-full max-w-lg space-y-6 rounded-2xl border border-amber-500/40 bg-zinc-900/80 p-8 shadow-2xl relative overflow-hidden text-center backdrop-blur-md">
          <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-amber-500/10 blur-3xl" />

          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10">
            <ShieldCheck className="size-8 text-amber-400" />
          </div>

          <div className="space-y-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-400">
              Air-Gapped Physical Gate Check-in Required
            </span>
            <h1 className="text-xl font-black uppercase tracking-tight text-white font-mono">
              Proctor Verification Required
            </h1>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed">
              Round 2 Live Final is strictly an on-premise, physically proctored event at the Medi-Caps Computing Complex. Remote access from outside the lab gate is blocked until your QR Campus Pass is scanned by a proctor.
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-white/10 bg-zinc-950/60 p-4 text-left font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Round 1 Screening:</span>
              <span className="font-bold text-emerald-400">✓ Top 30 Confirmed</span>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-2">
              <span className="text-zinc-400">Lab Gate Check-in:</span>
              <span className="font-bold text-amber-400">● Awaiting Proctor Scan</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button
              asChild
              className="rounded-xl bg-orange-500 font-mono text-xs font-black uppercase tracking-wider text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20"
            >
              <Link to={`/portal/contests/${contestSlug}/qualified`}>
                <QrCode className="mr-2 size-4" /> View Your QR Campus Pass
              </Link>
            </Button>
            <div className="flex gap-2">
              <Button
                onClick={() => dispatch(fetchContestArenaThunk(contestSlug))}
                variant="outline"
                className="w-full rounded-xl font-mono text-xs"
              >
                <RotateCcw className="mr-1.5 size-3.5" /> Re-check Gate Status
              </Button>
              <Button
                asChild
                variant="ghost"
                className="rounded-xl font-mono text-xs text-zinc-400"
              >
                <Link to={`/portal/contests/${contestSlug}`}>
                  Exit to Lobby
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const title = arenaData?.title || "Live Contest Arena";

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-zinc-950 text-zinc-100 select-none overflow-hidden font-sans">
      {/* ── TOP NAV BAR ────────────────────────────────────────────────────────── */}
      <header className="h-14 shrink-0 px-4 border-b border-white/10 bg-zinc-900/90 backdrop-blur-md flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-zinc-400 hover:text-white rounded-lg font-mono text-xs uppercase"
          >
            <Link to={`/portal/contests/${contestSlug}`}>
              <ArrowLeft className="size-3.5 mr-1" />
              Exit Arena
            </Link>
          </Button>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="text-xs font-bold uppercase tracking-wider text-white font-mono truncate max-w-[200px] md:max-w-[320px]">
              {title}
            </h1>
            <Badge
              variant="outline"
              className="border-orange-500/40 bg-orange-500/10 text-orange-400 font-mono text-[10px] uppercase rounded-md tracking-wider"
            >
              Live Final
            </Badge>
          </div>
        </div>

        {/* Center: Chief Proctor & Workstation Indicator */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-800/60 border border-white/10 text-xs font-mono">
            <ShieldCheck className="size-3.5 text-orange-500" />
            <span className="text-zinc-400">Proctors:</span>
            <span className="text-white font-medium">{arenaData?.chief_proctors?.length ? arenaData.chief_proctors.join(", ") : "Chief Proctor, CCC Operations Desk"}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-800/60 border border-white/10 text-xs font-mono">
            <Cpu className="size-3.5 text-cyan-400" />
            <span className="text-zinc-400">Workstation:</span>
            <span className="text-white font-bold">{arenaData?.assigned_seat || "Lab-04-WS-07"}</span>
          </div>
        </div>

        {/* Right: Countdown, Scoreboard & Fullscreen */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 font-mono text-xs font-bold tabular-nums">
            <span className="size-1.5 rounded-full bg-orange-500 animate-pulse" />
            <Clock className="size-3.5 text-orange-500" />
            <span className="tracking-wider">{formatTimer(remainingSeconds)}</span>
          </div>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden sm:flex h-8 text-xs font-mono uppercase tracking-wider border-white/10 bg-zinc-800/60 text-white hover:bg-zinc-700/60 rounded-lg"
          >
            <Link to={`/portal/contests/${contestSlug}/results`} target="_blank">
              <Trophy className="size-3.5 mr-1.5 text-amber-400" />
              Scoreboard
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/60"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
        </div>
      </header>

      {/* ── PROBLEM TABS SUBHEADER ────────────────────────────────────────────── */}
      <div className="h-10 shrink-0 px-4 bg-zinc-900/80 border-b border-white/10 flex items-center justify-between gap-2 overflow-x-auto">
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
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-medium rounded-lg transition-colors border ${
                  isActive
                    ? "bg-zinc-800 text-orange-400 border-orange-500/50 shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/50 border-transparent"
                }`}
              >
                <span>Problem {prob.problem_index}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase bg-zinc-900 text-zinc-400">
                  {prob.points}p
                </span>
                {isSolved && <BadgeCheck className="size-3.5 text-orange-400" />}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <span className="hidden md:inline uppercase text-[10px] tracking-wider">Lang:</span>
          <Select
            value={selectedLanguage}
            onValueChange={(val: any) => setSelectedLanguage(val)}
          >
            <SelectTrigger className="h-7 w-[125px] text-xs font-mono uppercase bg-zinc-800 border-white/10 text-white rounded-lg focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/10 text-white font-mono text-xs rounded-xl">
              <SelectItem value="python">Python 3.12</SelectItem>
              <SelectItem value="cpp">C++ (GCC 14)</SelectItem>
              <SelectItem value="javascript">JavaScript</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs font-mono uppercase text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
            onClick={handleResetStarter}
            title="Reset starter template"
          >
            <RotateCcw className="size-3 mr-1" /> Reset
          </Button>
        </div>
      </div>

      {/* ── WORKSPACE SPLIT: PROBLEM (LEFT) vs MONACO EDITOR (RIGHT) ──────────── */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* LEFT COLUMN: Problem Description & Statements */}
        <div className="w-full md:w-1/2 lg:w-5/12 h-full border-r border-white/10 overflow-y-auto p-5 space-y-6 bg-zinc-900/40">
          {activeProblem ? (
            <div className="space-y-5">
              <div className="space-y-2 border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold uppercase tracking-tight text-white font-mono">
                    {activeProblem.problem_index}. {activeProblem.title}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                  <Badge
                    variant="outline"
                    className={`font-mono text-[10px] uppercase rounded-md tracking-wider ${
                      activeProblem.difficulty === "EASY"
                        ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/20"
                        : activeProblem.difficulty === "HARD"
                          ? "border-rose-500/40 text-rose-400 bg-rose-950/20"
                          : "border-amber-500/40 text-amber-400 bg-amber-950/20"
                    }`}
                  >
                    {activeProblem.difficulty}
                  </Badge>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-400">{activeProblem.topic}</span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-orange-400 font-bold tabular-nums">{activeProblem.points} points</span>
                </div>
              </div>

              {/* Description */}
              <div className="text-sm leading-relaxed text-zinc-300 whitespace-pre-line font-sans">
                {activeProblem.description}
              </div>

              {/* Input Format */}
              {activeProblem.input_format && (
                <div className="space-y-1.5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest font-mono text-zinc-400">
                    Input Format
                  </h3>
                  <div className="text-xs text-zinc-200 font-mono p-3 rounded-xl bg-zinc-900 border border-white/10 whitespace-pre-line">
                    {activeProblem.input_format}
                  </div>
                </div>
              )}

              {/* Output Format */}
              {activeProblem.output_format && (
                <div className="space-y-1.5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest font-mono text-zinc-400">
                    Output Format
                  </h3>
                  <div className="text-xs text-zinc-200 font-mono p-3 rounded-xl bg-zinc-900 border border-white/10 whitespace-pre-line">
                    {activeProblem.output_format}
                  </div>
                </div>
              )}

              {/* Constraints */}
              {activeProblem.constraints && (
                <div className="space-y-1.5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest font-mono text-zinc-400">
                    Constraints
                  </h3>
                  <div className="text-xs text-amber-300 font-mono p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 whitespace-pre-line">
                    {activeProblem.constraints}
                  </div>
                </div>
              )}

              {/* Sample Testcases */}
              <div className="space-y-3 pt-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest font-mono text-zinc-400">
                  Sample Test Cases
                </h3>
                {activeProblem.sample_testcases && activeProblem.sample_testcases.length > 0 ? (
                  activeProblem.sample_testcases.map((tc, idx) => (
                    <div key={idx} className="space-y-2.5 border border-white/10 rounded-xl p-3.5 bg-zinc-950/60">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                          Sample #{idx + 1}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px] font-mono uppercase tracking-wider text-zinc-400 hover:text-white rounded-lg border border-white/10 bg-zinc-900 hover:bg-zinc-800"
                          onClick={() => copyToClipboard(tc.stdin, `tc_in_${idx}`)}
                        >
                          {copiedKey === `tc_in_${idx}` ? (
                            <Check className="size-3 text-orange-500 mr-1" />
                          ) : (
                            <Copy className="size-3 mr-1" />
                          )}
                          Copy Input
                        </Button>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                          Input
                        </span>
                        <pre className="p-2.5 rounded-lg bg-zinc-900 border border-white/10 text-xs font-mono text-zinc-200 overflow-x-auto">
                          {tc.stdin}
                        </pre>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                          Expected Output
                        </span>
                        <pre className="p-2.5 rounded-lg bg-zinc-900 border border-white/10 text-xs font-mono text-orange-400 overflow-x-auto">
                          {tc.expected_output}
                        </pre>
                      </div>

                      {tc.explanation && (
                        <p className="text-xs text-zinc-400 italic pt-1 border-t border-white/10">
                          {tc.explanation}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-zinc-400">No sample testcases provided.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-7 w-64" />
              <div className="space-y-2 pt-2">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-11/12" />
                <Skeleton className="h-3.5 w-4/5" />
              </div>
              <div className="pt-4 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Monaco Code Editor + Interactive Console */}
        <div className="w-full md:w-1/2 lg:w-7/12 h-full flex flex-col min-h-0 bg-zinc-950">
          {/* Top: Monaco Editor Area */}
          <div className="flex-1 min-h-[260px] overflow-hidden relative border-b border-white/10 bg-zinc-950">
            <MonacoEditor
              value={currentCode}
              language={selectedLanguage}
              onChange={handleCodeChange}
              height="100%"
            />
          </div>

          {/* Bottom: Console / Testcase Drawer */}
          <div className="h-[230px] shrink-0 flex flex-col bg-zinc-900">
            <div className="h-9 px-3 border-b border-white/10 flex items-center justify-between bg-zinc-900/90">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveConsoleTab("testcases")}
                  className={`px-3 py-1 text-xs font-mono uppercase tracking-wider font-medium rounded-t-lg transition-colors ${
                    activeConsoleTab === "testcases"
                      ? "bg-zinc-800 text-orange-400 border-t-2 border-t-orange-500"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Terminal className="size-3.5 inline mr-1" />
                  Testcases
                </button>
                <button
                  type="button"
                  onClick={() => setActiveConsoleTab("output")}
                  className={`px-3 py-1 text-xs font-mono uppercase tracking-wider font-medium rounded-t-lg transition-colors ${
                    activeConsoleTab === "output"
                      ? "bg-zinc-800 text-orange-400 border-t-2 border-t-orange-500"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Console Output
                  {runResult || submitResult ? (
                    <span className="size-1.5 rounded-full bg-orange-500 inline-block ml-1.5" />
                  ) : null}
                </button>
              </div>

              {activeConsoleTab === "testcases" && (
                <div className="flex items-center gap-1 text-[11px] font-mono">
                  {activeProblem?.sample_testcases?.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveTestcaseIndex(idx)}
                      className={`px-2 py-0.5 rounded-md border text-xs font-mono ${
                        activeTestcaseIndex === idx
                          ? "bg-orange-500/10 text-orange-400 border-orange-500/50"
                          : "text-zinc-400 hover:text-white border-white/10 bg-zinc-900"
                      }`}
                    >
                      Case {idx + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setActiveTestcaseIndex(-1)}
                    className={`px-2 py-0.5 rounded-md border text-xs font-mono ${
                      activeTestcaseIndex === -1
                        ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/50"
                        : "text-zinc-400 hover:text-white border-white/10 bg-zinc-900"
                    }`}
                  >
                    Custom Input
                  </button>
                </div>
              )}
            </div>

            {/* Console Content */}
            <div className="flex-1 overflow-y-auto p-3.5 text-xs font-mono bg-zinc-900/60">
              {activeConsoleTab === "testcases" ? (
                <div>
                  {activeTestcaseIndex === -1 ? (
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">
                        Custom Stdin Input:
                      </span>
                      <textarea
                        value={customStdin}
                        onChange={(e) => setCustomStdin(e.target.value)}
                        placeholder="Enter custom stdin test values..."
                        className="w-full h-24 p-2.5 bg-zinc-950 border border-white/10 rounded-lg text-xs font-mono text-white resize-none focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                      />
                    </div>
                  ) : (
                    activeProblem?.sample_testcases?.[activeTestcaseIndex] && (
                      <div className="space-y-2.5">
                        <div>
                          <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">
                            Standard Input
                          </span>
                          <pre className="p-2.5 bg-zinc-950 border border-white/10 rounded-lg text-xs text-white">
                            {activeProblem.sample_testcases[activeTestcaseIndex].stdin}
                          </pre>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">
                            Expected Output
                          </span>
                          <pre className="p-2.5 bg-zinc-950 border border-white/10 rounded-lg text-xs text-orange-400">
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
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        {submitResult.verdict === "ACCEPTED" ? (
                          <div className="flex items-center gap-1.5 text-orange-400 font-bold text-xs uppercase font-mono">
                            <CheckCircle2 className="size-4 text-emerald-400" /> Accepted
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs uppercase font-mono">
                            <XCircle className="size-4" /> {submitResult.verdict}
                          </div>
                        )}
                        <span className="text-zinc-600">·</span>
                        <span className="text-white font-mono tabular-nums">
                          {submitResult.passed_testcases} / {submitResult.total_testcases} testcases passed
                        </span>
                        {submitResult.points_awarded > 0 && (
                          <Badge className="bg-orange-500/15 text-orange-400 border border-orange-500/40 rounded-md font-mono text-[10px] tabular-nums">
                            +{submitResult.points_awarded} pts
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 font-mono">{submitResult.message}</p>
                    </div>
                  ) : runResult ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 font-mono">
                        <span
                          className={`font-bold uppercase text-xs ${
                            runResult.verdict === "ACCEPTED" ? "text-emerald-400" : "text-amber-400"
                          }`}
                        >
                          Verdict: {runResult.verdict}
                        </span>
                        {runResult.time !== undefined && (
                          <span className="text-zinc-400 text-xs tabular-nums">
                            ({Math.round(runResult.time * 1000)}ms)
                          </span>
                        )}
                      </div>
                      {runResult.stdout && (
                        <div>
                          <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono">
                            Stdout
                          </span>
                          <pre className="p-2.5 bg-zinc-950 border border-white/10 rounded-lg text-xs text-white overflow-x-auto">
                            {runResult.stdout}
                          </pre>
                        </div>
                      )}
                      {runResult.stderr && (
                        <div>
                          <span className="text-[10px] text-rose-400 uppercase tracking-wider font-mono">
                            Stderr
                          </span>
                          <pre className="p-2.5 bg-rose-950/20 border border-rose-500/30 rounded-lg text-xs text-rose-400 overflow-x-auto">
                            {runResult.stderr}
                          </pre>
                        </div>
                      )}
                      {runResult.compile_output && (
                        <div>
                          <span className="text-[10px] text-amber-400 uppercase tracking-wider font-mono">
                            Compiler Output
                          </span>
                          <pre className="p-2.5 bg-zinc-950 border border-amber-500/30 rounded-lg text-xs text-amber-300 overflow-x-auto">
                            {runResult.compile_output}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-zinc-400 text-center py-6 font-mono text-xs">
                      Click "Run Code" to test sample cases or "Submit Solution" for official judging.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ── ACTION FOOTER ─────────────────────────────────────────────────── */}
            <div className="h-12 px-4 border-t border-white/10 flex items-center justify-between bg-zinc-900/90">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                <span className={`size-2 rounded-full ${isContestOver ? 'bg-rose-500' : 'bg-emerald-400'}`} />
                <span>{isContestOver ? 'Contest ended — submissions locked' : 'Lab workstation online'}</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isRunningCode || isSubmittingCode || isContestOver}
                  onClick={handleRunCode}
                  className="font-mono text-xs uppercase tracking-wider rounded-lg border-white/10 bg-zinc-800/80 text-white hover:bg-zinc-700/80 disabled:opacity-30"
                >
                  <Play className="size-3.5 mr-1 text-cyan-400" />
                  {isRunningCode ? "Running…" : "Run Code"}
                </Button>

                <Button
                  size="sm"
                  disabled={isRunningCode || isSubmittingCode || isContestOver}
                  onClick={handleSubmitCode}
                  className="font-mono text-xs uppercase font-bold tracking-wider rounded-lg bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 disabled:opacity-30"
                >
                  <Send className="size-3.5 mr-1" />
                  {isSubmittingCode ? "Evaluating…" : "Submit Solution"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTEST OVER OVERLAY ────────────────────────────────────────────── */}
      {isContestOver && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8 bg-black/95 backdrop-blur-md animate-in fade-in duration-300"
        >
          {/* Glow ring */}
          <div className="relative flex size-28 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-orange-500/20 blur-2xl animate-pulse" />
            <div className="flex size-24 items-center justify-center rounded-full border-2 border-orange-500/40 bg-zinc-900">
              <Trophy className="size-10 text-orange-500" />
            </div>
          </div>

          <div className="space-y-3 text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-orange-500">Contest Concluded</p>
            <h2 className="text-4xl font-black uppercase tracking-tight text-white">
              Time's Up
            </h2>
            <p className="max-w-sm text-sm text-zinc-400 font-mono leading-relaxed">
              All submissions are locked. The proctors are collecting results.
              Final standings will be published shortly.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <p className="font-mono text-xs text-zinc-400 uppercase tracking-widest">
              Redirecting to Final Results in
            </p>
            <div className="flex size-16 items-center justify-center rounded-full border-2 border-orange-500 bg-orange-500/10">
              <span className="text-2xl font-black text-orange-400 tabular-nums">{redirectCountdown}</span>
            </div>
            <button
              onClick={() => navigate(`/portal/contests/${contestSlug}/final-results`)}
              className="font-mono text-xs font-bold uppercase tracking-widest text-orange-400 border border-orange-500/40 bg-orange-500/10 px-6 py-2.5 rounded-xl hover:bg-orange-500/20 transition-colors"
            >
              View Final Results Now →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
