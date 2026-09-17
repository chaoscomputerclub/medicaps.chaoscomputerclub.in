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
  Lock,
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
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-[var(--bg)] p-4 text-foreground">
        <div className="w-full max-w-lg space-y-6 border border-amber-500/40 bg-[var(--surface)] p-8 shadow-2xl relative overflow-hidden text-center">
          <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-amber-500/10 blur-3xl" />

          <div className="mx-auto flex size-16 items-center justify-center border border-amber-500/40 bg-amber-500/10">
            <ShieldCheck className="size-8 text-amber-400" />
          </div>

          <div className="space-y-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-400">
              Air-Gapped Physical Gate Check-in Required
            </span>
            <h1 className="text-xl font-black uppercase tracking-tight text-white font-mono">
              Proctor Verification Required
            </h1>
            <p className="text-xs text-[var(--muted)] font-mono leading-relaxed">
              Round 2 Live Final is strictly an on-premise, physically proctored event at the Medi-Caps Computing Complex. Remote access from outside the lab gate is blocked until your QR Campus Pass is scanned by a proctor.
            </p>
          </div>

          <div className="space-y-2 border border-[var(--line)] bg-[var(--surface-2)] p-4 text-left font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Round 1 Screening:</span>
              <span className="font-bold text-emerald-400">✓ Top 30 Confirmed</span>
            </div>
            <div className="flex items-center justify-between border-t border-[var(--line)] pt-2">
              <span className="text-[var(--muted)]">Lab Gate Check-in:</span>
              <span className="font-bold text-amber-400">● Awaiting Proctor Scan</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button
              asChild
              className="rounded-none bg-[var(--accent)] font-mono text-xs font-black uppercase tracking-wider text-black hover:bg-[var(--accent)]/90"
            >
              <Link to={`/portal/contests/${contestSlug}/qualified`}>
                <QrCode className="mr-2 size-4" /> View Your QR Campus Pass
              </Link>
            </Button>
            <div className="flex gap-2">
              <Button
                onClick={() => dispatch(fetchContestArenaThunk(contestSlug))}
                variant="outline"
                className="w-full rounded-none font-mono text-xs"
              >
                <RotateCcw className="mr-1.5 size-3.5" /> Re-check Gate Status
              </Button>
              <Button
                asChild
                variant="ghost"
                className="rounded-none font-mono text-xs text-[var(--muted)]"
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
    <div className="flex flex-col h-[100dvh] w-full bg-[var(--bg)] text-[var(--foreground)] select-none overflow-hidden font-sans">
      {/* ── TOP NAV BAR ────────────────────────────────────────────────────────── */}
      <header className="h-13 shrink-0 px-4 border-b border-[var(--line)] bg-[var(--surface)] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-[var(--muted)] hover:text-white rounded-none font-mono text-xs uppercase"
          >
            <Link to={`/portal/contests/${contestSlug}`}>
              <ArrowLeft className="size-3.5 mr-1" />
              Exit Arena
            </Link>
          </Button>

          <div className="h-4 w-px bg-[var(--line)]" />

          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="text-xs font-bold uppercase tracking-wider text-white font-mono truncate max-w-[200px] md:max-w-[320px]">
              {title}
            </h1>
            <Badge
              variant="outline"
              className="border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent)] font-mono text-[10px] uppercase rounded-none tracking-wider"
            >
              Live Final
            </Badge>
          </div>
        </div>

        {/* Center: Chief Proctor & Workstation Indicator */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-none bg-[var(--surface-2)] border border-[var(--line)] text-xs font-mono">
            <ShieldCheck className="size-3.5 text-[var(--accent)]" />
            <span className="text-[var(--muted)]">Proctors:</span>
            <span className="text-white font-medium">{arenaData?.chief_proctors?.length ? arenaData.chief_proctors.join(", ") : "Chief Proctor, CCC Operations Desk"}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-none bg-[var(--surface-2)] border border-[var(--line)] text-xs font-mono">
            <Cpu className="size-3.5 text-[var(--cyan)]" />
            <span className="text-[var(--muted)]">Workstation:</span>
            <span className="text-white font-bold">{arenaData?.assigned_seat || "Lab-04-WS-07"}</span>
          </div>
        </div>

        {/* Right: Countdown, Scoreboard & Fullscreen */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1 rounded-none bg-[var(--accent)]/10 border border-[var(--accent)]/40 text-[var(--accent)] font-mono text-xs font-bold">
            <span className="size-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            <Clock className="size-3.5 text-[var(--accent)]" />
            <span className="tracking-wider">{formatTimer(remainingSeconds)}</span>
          </div>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden sm:flex h-8 text-xs font-mono uppercase tracking-wider border-[var(--line)] bg-[var(--surface-2)] text-white hover:bg-[var(--surface-3)] rounded-none"
          >
            <Link to={`/portal/contests/${contestSlug}/results`} target="_blank">
              <Trophy className="size-3.5 mr-1.5 text-[var(--warning)]" />
              Scoreboard
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-[var(--muted)] hover:text-white rounded-none hover:bg-[var(--surface-2)]"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
        </div>
      </header>

      {/* ── PROBLEM TABS SUBHEADER ────────────────────────────────────────────── */}
      <div className="h-10 shrink-0 px-4 bg-[var(--surface-2)] border-b border-[var(--line)] flex items-center justify-between gap-2 overflow-x-auto">
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
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-medium rounded-none transition-colors border ${
                  isActive
                    ? "bg-[var(--surface)] text-[var(--accent)] border-b-2 border-b-[var(--accent)] border-t-[var(--line)] border-x-[var(--line)]"
                    : "text-[var(--muted)] hover:text-white hover:bg-[var(--surface-3)] border-transparent"
                }`}
              >
                <span>Problem {prob.problem_index}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-none font-mono uppercase bg-[var(--surface-3)] text-[var(--muted)]">
                  {prob.points}p
                </span>
                {isSolved && <BadgeCheck className="size-3.5 text-[var(--accent)]" />}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[var(--muted)]">
          <span className="hidden md:inline uppercase text-[10px] tracking-wider">Lang:</span>
          <Select
            value={selectedLanguage}
            onValueChange={(val: any) => setSelectedLanguage(val)}
          >
            <SelectTrigger className="h-7 w-[125px] text-xs font-mono uppercase bg-[var(--surface)] border-[var(--line)] text-white rounded-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[var(--surface-2)] border-[var(--line)] text-white font-mono text-xs rounded-none">
              <SelectItem value="python">Python 3.12</SelectItem>
              <SelectItem value="cpp">C++ (GCC 14)</SelectItem>
              <SelectItem value="javascript">JavaScript</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs font-mono uppercase text-[var(--muted)] hover:text-white rounded-none hover:bg-[var(--surface-3)]"
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
        <div className="w-full md:w-1/2 lg:w-5/12 h-full border-r border-[var(--line)] overflow-y-auto p-5 space-y-6 bg-[var(--surface)]">
          {activeProblem ? (
            <div className="space-y-5">
              <div className="space-y-2 border-b border-[var(--line)] pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold uppercase tracking-tight text-white font-mono">
                    {activeProblem.problem_index}. {activeProblem.title}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                  <Badge
                    variant="outline"
                    className={`font-mono text-[10px] uppercase rounded-none tracking-wider ${
                      activeProblem.difficulty === "EASY"
                        ? "border-[var(--accent)]/50 text-[var(--accent)] bg-[var(--accent)]/10"
                        : activeProblem.difficulty === "HARD"
                          ? "border-[var(--danger)]/50 text-[var(--danger)] bg-[var(--danger)]/10"
                          : "border-[var(--warning)]/50 text-[var(--warning)] bg-[var(--warning)]/10"
                    }`}
                  >
                    {activeProblem.difficulty}
                  </Badge>
                  <span className="text-[var(--muted)]">·</span>
                  <span className="text-[var(--muted)]">{activeProblem.topic}</span>
                  <span className="text-[var(--muted)]">·</span>
                  <span className="text-[var(--accent)] font-bold">{activeProblem.points} points</span>
                </div>
              </div>

              {/* Description */}
              <div className="text-sm leading-relaxed text-[#c2c0b6] whitespace-pre-line font-sans">
                {activeProblem.description}
              </div>

              {/* Input Format */}
              {activeProblem.input_format && (
                <div className="space-y-1.5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest font-mono text-[var(--muted)]">
                    Input Format
                  </h3>
                  <div className="text-xs text-[var(--foreground)] font-mono p-3 rounded-none bg-[var(--surface-2)] border border-[var(--line)] whitespace-pre-line">
                    {activeProblem.input_format}
                  </div>
                </div>
              )}

              {/* Output Format */}
              {activeProblem.output_format && (
                <div className="space-y-1.5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest font-mono text-[var(--muted)]">
                    Output Format
                  </h3>
                  <div className="text-xs text-[var(--foreground)] font-mono p-3 rounded-none bg-[var(--surface-2)] border border-[var(--line)] whitespace-pre-line">
                    {activeProblem.output_format}
                  </div>
                </div>
              )}

              {/* Constraints */}
              {activeProblem.constraints && (
                <div className="space-y-1.5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest font-mono text-[var(--muted)]">
                    Constraints
                  </h3>
                  <div className="text-xs text-[var(--warning)] font-mono p-3 rounded-none bg-[var(--warning)]/10 border border-[var(--warning)]/30 whitespace-pre-line">
                    {activeProblem.constraints}
                  </div>
                </div>
              )}

              {/* Sample Testcases */}
              <div className="space-y-3 pt-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest font-mono text-[var(--muted)]">
                  Sample Test Cases
                </h3>
                {activeProblem.sample_testcases && activeProblem.sample_testcases.length > 0 ? (
                  activeProblem.sample_testcases.map((tc, idx) => (
                    <div key={idx} className="space-y-2.5 border border-[var(--line)] rounded-none p-3.5 bg-[var(--bg)]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                          Sample #{idx + 1}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px] font-mono uppercase tracking-wider text-[var(--muted)] hover:text-white rounded-none border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                          onClick={() => copyToClipboard(tc.stdin, `tc_in_${idx}`)}
                        >
                          {copiedKey === `tc_in_${idx}` ? (
                            <Check className="size-3 text-[var(--accent)] mr-1" />
                          ) : (
                            <Copy className="size-3 mr-1" />
                          )}
                          Copy Input
                        </Button>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--muted)]">
                          Input
                        </span>
                        <pre className="p-2.5 rounded-none bg-[var(--surface-2)] border border-[var(--line)] text-xs font-mono text-[var(--foreground)] overflow-x-auto">
                          {tc.stdin}
                        </pre>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--muted)]">
                          Expected Output
                        </span>
                        <pre className="p-2.5 rounded-none bg-[var(--surface-2)] border border-[var(--line)] text-xs font-mono text-[var(--accent)] overflow-x-auto">
                          {tc.expected_output}
                        </pre>
                      </div>

                      {tc.explanation && (
                        <p className="text-xs text-[var(--muted)] italic pt-1 border-t border-[var(--line)]">
                          {tc.explanation}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[var(--muted)]">No sample testcases provided.</p>
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
        <div className="w-full md:w-1/2 lg:w-7/12 h-full flex flex-col min-h-0 bg-[var(--bg)]">
          {/* Top: Monaco Editor Area */}
          <div className="flex-1 min-h-[260px] overflow-hidden relative border-b border-[var(--line)] bg-[var(--bg)]">
            <MonacoEditor
              value={currentCode}
              language={selectedLanguage}
              onChange={handleCodeChange}
              height="100%"
            />
          </div>

          {/* Bottom: Console / Testcase Drawer */}
          <div className="h-[230px] shrink-0 flex flex-col bg-[var(--surface)]">
            <div className="h-9 px-3 border-b border-[var(--line)] flex items-center justify-between bg-[var(--surface-2)]">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveConsoleTab("testcases")}
                  className={`px-3 py-1 text-xs font-mono uppercase tracking-wider font-medium rounded-none transition-colors ${
                    activeConsoleTab === "testcases"
                      ? "bg-[var(--surface)] text-[var(--accent)] border-t-2 border-t-[var(--accent)]"
                      : "text-[var(--muted)] hover:text-white"
                  }`}
                >
                  <Terminal className="size-3.5 inline mr-1" />
                  Testcases
                </button>
                <button
                  type="button"
                  onClick={() => setActiveConsoleTab("output")}
                  className={`px-3 py-1 text-xs font-mono uppercase tracking-wider font-medium rounded-none transition-colors ${
                    activeConsoleTab === "output"
                      ? "bg-[var(--surface)] text-[var(--accent)] border-t-2 border-t-[var(--accent)]"
                      : "text-[var(--muted)] hover:text-white"
                  }`}
                >
                  Console Output
                  {runResult || submitResult ? (
                    <span className="size-1.5 rounded-full bg-[var(--accent)] inline-block ml-1.5" />
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
                      className={`px-2 py-0.5 rounded-none border text-xs font-mono ${
                        activeTestcaseIndex === idx
                          ? "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]"
                          : "text-[var(--muted)] hover:text-white border-[var(--line)] bg-[var(--surface)]"
                      }`}
                    >
                      Case {idx + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setActiveTestcaseIndex(-1)}
                    className={`px-2 py-0.5 rounded-none border text-xs font-mono ${
                      activeTestcaseIndex === -1
                        ? "bg-[var(--cyan)]/10 text-[var(--cyan)] border-[var(--cyan)]"
                        : "text-[var(--muted)] hover:text-white border-[var(--line)] bg-[var(--surface)]"
                    }`}
                  >
                    Custom Input
                  </button>
                </div>
              )}
            </div>

            {/* Console Content */}
            <div className="flex-1 overflow-y-auto p-3.5 text-xs font-mono bg-[var(--surface)]">
              {activeConsoleTab === "testcases" ? (
                <div>
                  {activeTestcaseIndex === -1 ? (
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-[var(--muted)] font-mono uppercase tracking-wider">
                        Custom Stdin Input:
                      </span>
                      <textarea
                        value={customStdin}
                        onChange={(e) => setCustomStdin(e.target.value)}
                        placeholder="Enter custom stdin test values..."
                        className="w-full h-24 p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-none text-xs font-mono text-white resize-none focus:outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                  ) : (
                    activeProblem?.sample_testcases?.[activeTestcaseIndex] && (
                      <div className="space-y-2.5">
                        <div>
                          <span className="text-[10px] text-[var(--muted)] font-mono uppercase tracking-wider">
                            Standard Input
                          </span>
                          <pre className="p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-none text-xs text-white">
                            {activeProblem.sample_testcases[activeTestcaseIndex].stdin}
                          </pre>
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--muted)] font-mono uppercase tracking-wider">
                            Expected Output
                          </span>
                          <pre className="p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-none text-xs text-[var(--accent)]">
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
                          <div className="flex items-center gap-1.5 text-[var(--accent)] font-bold text-xs uppercase font-mono">
                            <CheckCircle2 className="size-4" /> Accepted
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[var(--danger)] font-bold text-xs uppercase font-mono">
                            <XCircle className="size-4" /> {submitResult.verdict}
                          </div>
                        )}
                        <span className="text-[var(--muted)]">·</span>
                        <span className="text-white font-mono">
                          {submitResult.passed_testcases} / {submitResult.total_testcases} testcases passed
                        </span>
                        {submitResult.points_awarded > 0 && (
                          <Badge className="bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/40 rounded-none font-mono text-[10px]">
                            +{submitResult.points_awarded} pts
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[var(--muted)] font-mono">{submitResult.message}</p>
                    </div>
                  ) : runResult ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 font-mono">
                        <span
                          className={`font-bold uppercase text-xs ${
                            runResult.verdict === "ACCEPTED" ? "text-[var(--accent)]" : "text-[var(--warning)]"
                          }`}
                        >
                          Verdict: {runResult.verdict}
                        </span>
                        {runResult.time !== undefined && (
                          <span className="text-[var(--muted)] text-xs">
                            ({Math.round(runResult.time * 1000)}ms)
                          </span>
                        )}
                      </div>
                      {runResult.stdout && (
                        <div>
                          <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-mono">
                            Stdout
                          </span>
                          <pre className="p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-none text-xs text-white overflow-x-auto">
                            {runResult.stdout}
                          </pre>
                        </div>
                      )}
                      {runResult.stderr && (
                        <div>
                          <span className="text-[10px] text-[var(--danger)] uppercase tracking-wider font-mono">
                            Stderr
                          </span>
                          <pre className="p-2.5 bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-none text-xs text-[var(--danger)] overflow-x-auto">
                            {runResult.stderr}
                          </pre>
                        </div>
                      )}
                      {runResult.compile_output && (
                        <div>
                          <span className="text-[10px] text-[var(--warning)] uppercase tracking-wider font-mono">
                            Compiler Output
                          </span>
                          <pre className="p-2.5 bg-[var(--bg)] border border-[var(--warning)]/30 rounded-none text-xs text-[var(--warning)] overflow-x-auto">
                            {runResult.compile_output}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[var(--muted)] text-center py-6 font-mono text-xs">
                      Click "Run Code" to test sample cases or "Submit Solution" for official judging.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ── ACTION FOOTER ─────────────────────────────────────────────────── */}
            <div className="h-12 px-4 border-t border-[var(--line)] flex items-center justify-between bg-[var(--surface)]">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-[var(--muted)]">
                <span className={`size-2 rounded-full ${isContestOver ? 'bg-red-500' : 'bg-[var(--accent)]'}`} />
                <span>{isContestOver ? 'Contest ended — submissions locked' : 'Lab workstation online'}</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isRunningCode || isSubmittingCode || isContestOver}
                  onClick={handleRunCode}
                  className="font-mono text-xs uppercase tracking-wider rounded-none border-[var(--line)] bg-[var(--surface-2)] text-white hover:bg-[var(--surface-3)] disabled:opacity-30"
                >
                  <Play className="size-3.5 mr-1 text-[var(--cyan)]" />
                  {isRunningCode ? "Running…" : "Run Code"}
                </Button>

                <Button
                  size="sm"
                  disabled={isRunningCode || isSubmittingCode || isContestOver}
                  onClick={handleSubmitCode}
                  className="font-mono text-xs uppercase font-bold tracking-wider rounded-none bg-[var(--accent)] hover:bg-[#b8f025] text-black shadow-none disabled:opacity-30"
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
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8 bg-black/95 backdrop-blur-sm"
          style={{ animation: 'fadeIn 0.4s ease' }}
        >
          <style>{`@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }`}</style>

          {/* Glow ring */}
          <div className="relative flex size-28 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-[var(--accent)]/20 blur-2xl animate-pulse" />
            <div className="flex size-24 items-center justify-center rounded-full border-2 border-[var(--accent)]/40 bg-[var(--surface)]">
              <Trophy className="size-10 text-[var(--accent)]" />
            </div>
          </div>

          <div className="space-y-3 text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-[var(--accent)]">Contest Concluded</p>
            <h2 className="text-4xl font-black uppercase tracking-tight text-white">
              Time's Up
            </h2>
            <p className="max-w-sm text-sm text-[var(--muted)] font-mono leading-relaxed">
              All submissions are locked. The proctors are collecting results.
              Final standings will be published shortly.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-widest">
              Redirecting to Final Results in
            </p>
            <div className="flex size-16 items-center justify-center rounded-full border-2 border-[var(--accent)] bg-[var(--accent)]/10">
              <span className="text-2xl font-black text-[var(--accent)]">{redirectCountdown}</span>
            </div>
            <button
              onClick={() => navigate(`/portal/contests/${contestSlug}/final-results`)}
              className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--accent)] border border-[var(--accent)]/50 bg-[var(--accent)]/10 px-6 py-2.5 hover:bg-[var(--accent)]/20 transition-colors"
            >
              View Final Results Now →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
