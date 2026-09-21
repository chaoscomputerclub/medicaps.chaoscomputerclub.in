/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * Dedicated Air-Gapped Live Contest Arena (Round 2 Final)
 * Redesigned to Strix AI Paradigm (Pure Pitch Black × Electric Lime)
 */

import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Cpu,
  GripHorizontal,
  GripVertical,
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
import { AssessmentStudioSkeleton } from "@/organization/components/skeletons";
import { useRealtimeEvents } from "@/lib/realtime";
import { slugifyProblem } from "@/lib/utils";

function formatTimer(totalSeconds: number): string {
  if (totalSeconds <= 0) return "00:00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type ArenaLanguage = "python" | "cpp" | "c" | "java" | "javascript" | "typescript";

const DEFAULT_LANGUAGE_STARTERS: Record<ArenaLanguage, string> = {
  python: "class Solution:\n    def solve(self) -> int:\n        # Write your solution here\n        pass\n",
  cpp: "#include <vector>\nusing namespace std;\n\nclass Solution {\npublic:\n    int solve() {\n        return 0;\n    }\n};\n",
  c: "#include <stdio.h>\n#include <stdlib.h>\n\nint solve() {\n    // Write your solution here\n    return 0;\n}\n",
  java: "class Solution {\n    public int solve() {\n        // Write your solution here\n        return 0;\n    }\n}\n",
  javascript: "/**\n * @return {number}\n */\nvar solve = function() {\n    // Write your solution here\n};\n",
  typescript: "function solve(): number {\n    // Write your solution here\n    return 0;\n}\n",
};

export function ContestArenaPage() {
  const { contestSlug = "", problemSlug = "" } = useParams<{ contestSlug: string; problemSlug?: string }>();
  const [searchParams] = useSearchParams();
  const problemParam = searchParams.get("problem");
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

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

  // LeetCode-style URL problem resolution
  const activeIndex = problems.findIndex((p) => {
    if (!problemSlug) return false;
    const clean = problemSlug.toLowerCase();
    return (
      slugifyProblem(p.title, p.problem_index) === clean ||
      p.problem_index.toLowerCase() === clean ||
      p.id.toLowerCase() === clean ||
      (problemParam && p.problem_index.toUpperCase() === problemParam.toUpperCase())
    );
  });
  const resolvedIndex = activeIndex >= 0 ? activeIndex : 0;
  const activeProblem = problems[resolvedIndex] || problems[0];

  // Auto-redirect to first problem's slug if URL is generic /arena or /problems
  useEffect(() => {
    if (problems.length > 0 && !problemSlug && contestSlug) {
      const firstSlug = slugifyProblem(problems[0].title, problems[0].problem_index);
      navigate(`/contests/${contestSlug}/problems/${firstSlug}`, { replace: true });
    }
  }, [problems, problemSlug, contestSlug, navigate]);

  const [selectedLanguage, setSelectedLanguage] = useState<"python" | "cpp" | "javascript">("python");
  const [codeMap, setCodeMap] = useState<Record<string, string>>({});
  const [customStdin, setCustomStdin] = useState("");
  const [activeConsoleTab, setActiveConsoleTab] = useState<"testcases" | "output">("testcases");
  const [activeTestcaseIndex, setActiveTestcaseIndex] = useState(0);
  const [activeRunCaseIndex, setActiveRunCaseIndex] = useState(0);
  const [activeSubmitCaseIndex, setActiveSubmitCaseIndex] = useState(0);
  const [lastAction, setLastAction] = useState<"run" | "submit" | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [solvedProblemIds, setSolvedProblemIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`ccc_solved_${contestSlug}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const contestOverRedirectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // LeetCode-style Draggable Splitters (Width & Height)
  const containerRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  const [leftWidthPercent, setLeftWidthPercent] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ccc_arena_split_width");
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 20 && parsed <= 80) return parsed;
      }
    }
    return 45; // Default 45% problem, 55% editor
  });

  const [drawerHeight, setDrawerHeight] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ccc_arena_drawer_height");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 100 && parsed <= 800) return parsed;
      }
    }
    return 240; // Default 240px console drawer height
  });

  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState(false);
  const [isDraggingWidth, setIsDraggingWidth] = useState(false);
  const [isDraggingHeight, setIsDraggingHeight] = useState(false);

  // Horizontal Width Dragging
  useEffect(() => {
    if (!isDraggingWidth) return;

    const handleMove = (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const rawPercent = ((clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(Math.max(rawPercent, 20), 80);
      setLeftWidthPercent(clamped);
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX);
    };

    const onMouseUp = () => {
      setIsDraggingWidth(false);
      setLeftWidthPercent((current) => {
        try {
          localStorage.setItem("ccc_arena_split_width", current.toFixed(1));
        } catch {}
        return current;
      });
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onMouseUp);
    };
  }, [isDraggingWidth]);

  // Vertical Height Dragging
  useEffect(() => {
    if (!isDraggingHeight) return;

    const handleMove = (clientY: number) => {
      if (!rightPaneRef.current) return;
      const rect = rightPaneRef.current.getBoundingClientRect();
      // Distance from bottom of right pane minus 44px footer
      const newHeight = rect.bottom - clientY - 44;
      const maxHeight = Math.max(rect.height - 150, 200);
      const clamped = Math.min(Math.max(newHeight, 90), maxHeight);
      setDrawerHeight(clamped);
      if (isDrawerCollapsed && clamped > 70) {
        setIsDrawerCollapsed(false);
      }
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientY);
    };

    const onMouseUp = () => {
      setIsDraggingHeight(false);
      setDrawerHeight((current) => {
        try {
          localStorage.setItem("ccc_arena_drawer_height", Math.round(current).toString());
        } catch {}
        return current;
      });
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onMouseUp);
    };
  }, [isDraggingHeight, isDrawerCollapsed]);

  const handleResetWidth = () => {
    setLeftWidthPercent(50);
    try {
      localStorage.setItem("ccc_arena_split_width", "50");
    } catch {}
    toast.info("Reset pane width (50/50)");
  };

  const handleResetHeight = () => {
    setDrawerHeight(240);
    setIsDrawerCollapsed(false);
    try {
      localStorage.setItem("ccc_arena_drawer_height", "240");
    } catch {}
    toast.info("Reset console height (240px)");
  };

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

  const problemKey = `${activeProblem?.id || "p"}_${selectedLanguage}`;
  const problemStorageKey = activeProblem
    ? `ccc_code_v3_${contestSlug}_${activeProblem.id}_${selectedLanguage}`
    : "";

  // Load durable code: state -> validated localStorage -> official problem starter_code
  const getInitialCode = (): string => {
    if (codeMap[problemKey]) {
      const isLegacy =
        codeMap[problemKey].includes("def main():") ||
        codeMap[problemKey].includes("sys.stdin.read()") ||
        codeMap[problemKey].includes("TODO: Calculate valid mirror pairs") ||
        (selectedLanguage === "python" && !codeMap[problemKey].includes("class Solution"));
      if (!isLegacy) {
        return codeMap[problemKey];
      }
    }
    if (problemStorageKey && typeof window !== "undefined") {
      try {
        // Clean up legacy unversioned keys if any
        if (activeProblem?.id) {
          localStorage.removeItem(`ccc_code_${contestSlug}_${activeProblem.id}_${selectedLanguage}`);
          localStorage.removeItem(`ccc_code_v2_${contestSlug}_${activeProblem.id}_${selectedLanguage}`);
        }
        const saved = localStorage.getItem(problemStorageKey);
        if (saved) {
          // If saved code contains old competitive programming script boilerplate, purge it
          const isLegacy =
            saved.includes("def main():") ||
            saved.includes("sys.stdin.read()") ||
            saved.includes("TODO: Calculate valid mirror pairs") ||
            (selectedLanguage === "python" && !saved.includes("class Solution"));
          if (isLegacy) {
            localStorage.removeItem(problemStorageKey);
          } else {
            return saved;
          }
        }
      } catch {}
    }

    return (
      activeProblem?.starter_codes?.[selectedLanguage] ??
      DEFAULT_LANGUAGE_STARTERS[selectedLanguage] ??
      "// Write your solution here\n"
    );
  };

  const currentCode = getInitialCode();

  const handleCodeChange = (newCode: string) => {
    setCodeMap((prev) => ({ ...prev, [problemKey]: newCode }));
    if (problemStorageKey && typeof window !== "undefined") {
      try {
        localStorage.setItem(problemStorageKey, newCode);
      } catch {}
    }
  };

  const handleResetStarter = () => {
    const defaultStarter =
      activeProblem?.starter_codes?.[selectedLanguage] ||
      DEFAULT_LANGUAGE_STARTERS[selectedLanguage] ||
      "// Write your solution here\n";
    setCodeMap((prev) => ({ ...prev, [problemKey]: defaultStarter }));
    if (typeof window !== "undefined") {
      try {
        if (problemStorageKey) localStorage.removeItem(problemStorageKey);
        if (activeProblem?.id) {
          localStorage.removeItem(`ccc_code_${contestSlug}_${activeProblem.id}_${selectedLanguage}`);
          localStorage.removeItem(`ccc_code_v2_${contestSlug}_${activeProblem.id}_${selectedLanguage}`);
        }
      } catch {}
    }
    toast.info("Reset code to official template.");
  };

  const copyToClipboard = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleRunCode = async () => {
    if (!activeProblem) return;
    setIsDrawerCollapsed(false);
    setActiveConsoleTab("output");
    setLastAction("run");
    setActiveRunCaseIndex(0);
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
        toast.success("All sample testcases passed!");
      } else {
        toast.error(`Execution: ${result.payload.verdict}`);
      }
    } else {
      toast.error(String(result.payload || "Failed to execute code"));
    }
  };

  const handleSubmitCode = async () => {
    if (!activeProblem) return;
    setIsDrawerCollapsed(false);
    setActiveConsoleTab("output");
    setLastAction("submit");
    setActiveSubmitCaseIndex(0);
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
        setSolvedProblemIds((prev) => {
          const next = new Set([...prev, activeProblem.id]);
          try {
            localStorage.setItem(`ccc_solved_${contestSlug}`, JSON.stringify(Array.from(next)));
          } catch {}
          return next;
        });
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
              className="rounded-md bg-transparent text-white border border-white/20 font-mono text-xs font-semibold hover:bg-lime-400 hover:text-black hover:border-lime-400 transition-colors [&_svg]:transition-colors"
            >
              <Link to={`/contests/${contestSlug}/qualified`}>
                <QrCode className="size-3.5" />
                <span>View Finalist Pass</span>
              </Link>
            </Button>
            <div className="flex gap-2">
              <Button
                onClick={() => dispatch(fetchContestArenaThunk(contestSlug))}
                variant="outline"
                className="w-full rounded-md font-mono text-xs border-white/10 bg-black text-zinc-300 hover:bg-lime-400 hover:text-black hover:border-lime-400"
              >
                <RotateCcw className="size-3" />
                <span>Re-check Status</span>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="rounded-md font-mono text-xs text-zinc-500 hover:bg-lime-400 hover:text-black"
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
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (window.opener) {
                window.close();
              } else {
                navigate(`/contests/${contestSlug}`);
              }
            }}
            className="h-7 px-2.5 text-zinc-300 border-white/10 bg-black hover:bg-lime-400 hover:text-black hover:border-lime-400 rounded-md font-mono text-xs cursor-pointer flex items-center transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Exit</span>
          </Button>

          <div className="h-3 w-px bg-white/10" />

          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[10px] uppercase font-semibold tracking-wider text-lime-400 hidden sm:inline">
              Live Contest Arena
            </span>
            <h1 className="text-xs font-semibold tracking-tight text-white truncate max-w-[200px] md:max-w-[320px]">
              {title}
            </h1>
            <span className="border border-lime-400/30 bg-lime-400/10 text-lime-400 font-mono text-[9px] uppercase px-1.5 py-0.5 rounded font-semibold">
              Live
            </span>
          </div>
        </div>

        {/* Center: Rating Badge */}
        <div className="hidden lg:flex items-center gap-3">
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
            className="group flex items-center gap-1.5 h-7 px-2.5 text-xs font-mono border-white/10 bg-black text-zinc-300 hover:bg-lime-400 hover:text-black hover:border-lime-400 rounded-md transition-colors shrink-0"
          >
            <Link to={`/contests/${contestSlug}/results`} target="_blank" rel="noopener noreferrer">
              <Trophy className="size-3.5 text-lime-400 group-hover:text-black transition-colors shrink-0" />
              <span>Scoreboard</span>
            </Link>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="size-7 p-0 text-zinc-400 hover:bg-lime-400 hover:text-black hover:border-lime-400 rounded-md border-white/10 bg-black transition-colors"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Button>
        </div>
      </header>

      {/* Problem Tabs Subheader (36px) - LeetCode Style Problem Slugs */}
      <div className="h-9 shrink-0 px-4 bg-black border-b border-white/8 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5">
          {problems.map((prob, idx) => {
            const pSlug = slugifyProblem(prob.title, prob.problem_index);
            const isActive = idx === resolvedIndex;
            const isSolved = solvedProblemIds.has(prob.id);
            return (
              <Link
                key={prob.id}
                to={`/contests/${contestSlug}/problems/${pSlug}`}
                onClick={() => dispatch(clearArenaResults())}
                className={`group flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-md transition-colors cursor-pointer border ${
                  isActive
                    ? "bg-zinc-900 text-white border-lime-400 font-semibold shadow-[0_0_10px_rgba(204,255,0,0.15)]"
                    : "text-zinc-400 hover:text-black hover:bg-lime-400 hover:border-lime-400 border-white/6 bg-black"
                }`}
              >
                <span>Problem {prob.problem_index}</span>
                <span
                  className={`text-[10px] font-mono uppercase tabular-nums transition-colors ${
                    isActive ? "text-zinc-400" : "text-zinc-500 group-hover:text-black/75"
                  }`}
                >
                  {prob.points}p
                </span>
                {isSolved && (
                  <CheckCircle2 className="size-3 text-lime-400 group-hover:text-black transition-colors" />
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <Select
            value={selectedLanguage}
            onValueChange={(val: any) => setSelectedLanguage(val)}
          >
            <SelectTrigger className="h-6 w-[120px] text-xs font-mono bg-black border-white/15 text-zinc-200 hover:border-lime-400/60 rounded-md focus:ring-1 focus:ring-lime-400">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/15 text-white font-mono text-xs rounded-md">
              <SelectItem value="python">Python 3.12</SelectItem>
              <SelectItem value="cpp">C++ (GCC 14)</SelectItem>
              <SelectItem value="c">C (GCC 14)</SelectItem>
              <SelectItem value="java">Java 21</SelectItem>
              <SelectItem value="javascript">JavaScript (Node.js)</SelectItem>
              <SelectItem value="typescript">TypeScript 5.0</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs font-mono border-white/10 bg-black text-zinc-400 hover:bg-lime-400 hover:text-black hover:border-lime-400 rounded-md transition-colors cursor-pointer"
            onClick={handleResetStarter}
            title="Reset to official starter code"
          >
            <RotateCcw className="size-2.5" />
            <span>Reset</span>
          </Button>
        </div>
      </div>

      {/* Main 2-Pane Split */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
        {/* Left: Problem Statement Pane */}
        <div
          style={{ width: `${leftWidthPercent}%` }}
          className="border-r border-white/8 overflow-y-auto p-6 space-y-5 bg-black shrink-0 min-w-[260px] max-w-[calc(100%-280px)]"
        >
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

        {/* LeetCode-style Draggable Width Adjuster */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize problem pane and code editor"
          onMouseDown={() => setIsDraggingWidth(true)}
          onTouchStart={() => setIsDraggingWidth(true)}
          onDoubleClick={handleResetWidth}
          className={`group relative flex items-center justify-center w-2 -mx-1 z-20 cursor-col-resize select-none shrink-0 transition-colors ${
            isDraggingWidth ? "bg-lime-400/20" : "hover:bg-lime-400/10"
          }`}
          title="Drag to resize pane width · Double-click to reset (50/50)"
        >
          <div
            className={`w-px h-full transition-colors ${
              isDraggingWidth
                ? "bg-lime-400 shadow-[0_0_10px_rgba(204,255,0,0.8)]"
                : "bg-white/10 group-hover:bg-lime-400/80"
            }`}
          />
          <div
            className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-3.5 h-7 rounded-full border shadow-sm transition-all pointer-events-none ${
              isDraggingWidth
                ? "bg-lime-400 border-lime-400 text-black scale-110"
                : "bg-zinc-900 border-white/20 text-zinc-400 group-hover:border-lime-400 group-hover:bg-black group-hover:text-lime-400"
            }`}
          >
            <GripVertical className="size-2.5" />
          </div>
        </div>

        {/* Right: Editor & Drawer */}
        <div
          ref={rightPaneRef}
          className="flex-1 flex flex-col bg-black min-w-0 h-full overflow-hidden relative"
        >
          {/* Top: Editor */}
          <div className="flex-1 relative overflow-hidden bg-black min-h-0">
            <MonacoEditor
              value={currentCode}
              language={selectedLanguage}
              onChange={handleCodeChange}
            />
          </div>

          {/* LeetCode-style Draggable Height Adjuster */}
          {!isDrawerCollapsed && (
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize console drawer"
              onMouseDown={() => setIsDraggingHeight(true)}
              onTouchStart={() => setIsDraggingHeight(true)}
              onDoubleClick={handleResetHeight}
              className={`group relative flex items-center justify-center h-2 -my-1 z-20 cursor-row-resize select-none shrink-0 transition-colors ${
                isDraggingHeight ? "bg-lime-400/20" : "hover:bg-lime-400/10"
              }`}
              title="Drag to adjust console height · Double-click to reset (240px)"
            >
              <div
                className={`h-px w-full transition-colors ${
                  isDraggingHeight
                    ? "bg-lime-400 shadow-[0_0_10px_rgba(204,255,0,0.8)]"
                    : "bg-white/10 group-hover:bg-lime-400/80"
                }`}
              />
              <div
                className={`absolute left-1/2 -translate-x-1/2 flex items-center justify-center h-3.5 w-7 rounded-full border shadow-sm transition-all pointer-events-none ${
                  isDraggingHeight
                    ? "bg-lime-400 border-lime-400 text-black scale-110"
                    : "bg-zinc-900 border-white/20 text-zinc-400 group-hover:border-lime-400 group-hover:bg-black group-hover:text-lime-400"
                }`}
              >
                <GripHorizontal className="size-2.5" />
              </div>
            </div>
          )}

          {/* Execution Drawer */}
          <div
            style={{ height: isDrawerCollapsed ? "0px" : `${drawerHeight}px` }}
            className={`flex flex-col border-t border-white/8 bg-black shrink-0 overflow-hidden transition-[height] duration-75 ease-out ${
              isDrawerCollapsed ? "border-t-0" : ""
            }`}
          >
            {/* Drawer Tab Header */}
            <div className="flex h-8 shrink-0 items-center justify-between border-b border-white/8 px-3 bg-black">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveConsoleTab("testcases");
                    if (isDrawerCollapsed) setIsDrawerCollapsed(false);
                  }}
                  className={`px-2.5 py-0.5 text-xs font-mono rounded cursor-pointer transition-colors ${
                    activeConsoleTab === "testcases"
                      ? "bg-zinc-900 text-white font-semibold"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Testcase
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveConsoleTab("output");
                    if (isDrawerCollapsed) setIsDrawerCollapsed(false);
                  }}
                  className={`px-2.5 py-0.5 text-xs font-mono rounded cursor-pointer transition-colors flex items-center gap-1.5 ${
                    activeConsoleTab === "output"
                      ? "bg-zinc-900 text-white font-semibold"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <span>Test Result</span>
                  {submitResult && (
                    <span
                      className={`size-1.5 rounded-full ${
                        submitResult.verdict === "ACCEPTED" ? "bg-lime-400 shadow-[0_0_6px_#a3e635]" : "bg-red-400"
                      }`}
                    />
                  )}
                  {!submitResult && runResult && (
                    <span
                      className={`size-1.5 rounded-full ${
                        runResult.verdict === "ACCEPTED" ? "bg-lime-400 shadow-[0_0_6px_#a3e635]" : "bg-amber-400"
                      }`}
                    />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsDrawerCollapsed(true)}
                  className="flex items-center gap-1 text-[11px] font-mono text-zinc-500 hover:text-zinc-200 px-1.5 py-0.5 rounded hover:bg-zinc-900 cursor-pointer transition-colors"
                  title="Collapse Console"
                >
                  <span className="hidden sm:inline">Collapse</span>
                  <ChevronDown className="size-3" />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            {!isDrawerCollapsed && (
              <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
                {activeConsoleTab === "testcases" ? (
                  <div className="space-y-3">
                    {/* Testcase Case Selector */}
                    <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
                      {activeProblem?.sample_testcases?.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setActiveTestcaseIndex(i)}
                          className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                            activeTestcaseIndex === i
                              ? "bg-zinc-800 text-white font-semibold border border-white/10"
                              : "text-zinc-400 hover:text-white bg-zinc-950 border border-transparent"
                          }`}
                        >
                          <span>Case {i + 1}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setActiveTestcaseIndex(-1)}
                        className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                          activeTestcaseIndex === -1
                            ? "bg-zinc-800 text-white font-semibold border border-white/10"
                            : "text-zinc-400 hover:text-white bg-zinc-950 border border-transparent"
                        }`}
                      >
                        <span>+ Custom</span>
                      </button>
                    </div>

                    {/* Active Testcase View */}
                    {activeTestcaseIndex === -1 ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                          <span>Custom Function Arguments</span>
                          <span className="text-[10px] text-zinc-500">e.g. passes = ["AB", "BA"] or pure JSON values</span>
                        </div>
                        <textarea
                          value={customStdin}
                          onChange={(e) => setCustomStdin(e.target.value)}
                          placeholder={activeProblem?.sample_testcases?.[0]?.stdin || 'passes = ["AB", "BA"]'}
                          className="w-full h-24 p-2.5 bg-zinc-950 border border-white/10 rounded text-xs font-mono text-white resize-none focus:outline-none focus:border-lime-400/60"
                        />
                      </div>
                    ) : (
                      activeProblem?.sample_testcases?.[activeTestcaseIndex] && (
                        <div className="space-y-3">
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1 font-semibold">
                              Input
                            </span>
                            <pre className="p-2.5 bg-zinc-950 border border-white/10 rounded text-xs font-mono text-zinc-200 overflow-x-auto selection:bg-lime-400 selection:text-black">
                              {activeProblem.sample_testcases[activeTestcaseIndex].stdin}
                            </pre>
                          </div>
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1 font-semibold">
                              Expected Output
                            </span>
                            <pre className="p-2.5 bg-zinc-950 border border-white/10 rounded text-xs font-mono text-lime-400 overflow-x-auto selection:bg-lime-400 selection:text-black">
                              {activeProblem.sample_testcases[activeTestcaseIndex].expected_output}
                            </pre>
                          </div>
                          {activeProblem.sample_testcases[activeTestcaseIndex].explanation && (
                            <div className="text-[11px] font-sans text-zinc-400 italic">
                              Note: {activeProblem.sample_testcases[activeTestcaseIndex].explanation}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  /* Output / Test Result Tab */
                  <div className="space-y-3">
                    {lastAction === "submit" && submitResult ? (
                      /* Comprehensive Submission Report */
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-3">
                          <div className="flex items-center gap-3">
                            {submitResult.verdict === "ACCEPTED" ? (
                              <div className="flex items-center gap-2 text-lime-400 font-bold text-sm uppercase font-mono">
                                <CheckCircle2 className="size-5 text-lime-400" />
                                <span>Accepted</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm uppercase font-mono">
                                <XCircle className="size-5 text-rose-400" />
                                <span>{submitResult.verdict}</span>
                              </div>
                            )}
                            <span className="text-zinc-600">·</span>
                            <span className="text-zinc-300 font-mono text-xs tabular-nums">
                              {submitResult.passed_testcases} / {submitResult.total_testcases} testcases passed
                            </span>
                            {submitResult.points_awarded > 0 && (
                              <Badge className="bg-lime-400/15 text-lime-400 border border-lime-400/40 text-[11px] font-mono font-bold">
                                +{submitResult.points_awarded} pts
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
                            {submitResult.execution_time !== undefined && (
                              <span>Runtime: {Math.round(submitResult.execution_time * 1000)}ms</span>
                            )}
                            {submitResult.memory !== undefined && submitResult.memory > 0 && (
                              <span>Memory: {submitResult.memory}MB</span>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              submitResult.verdict === "ACCEPTED" ? "bg-lime-400" : "bg-rose-500"
                            }`}
                            style={{
                              width: `${Math.round(
                                (submitResult.passed_testcases / Math.max(1, submitResult.total_testcases)) * 100
                              )}%`,
                            }}
                          />
                        </div>

                        {/* Submission Testcases Breakdown */}
                        {submitResult.testcase_results && submitResult.testcase_results.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {submitResult.testcase_results.map((tc, idx) => (
                                <button
                                  key={tc.testcase_id || idx}
                                  type="button"
                                  onClick={() => setActiveSubmitCaseIndex(idx)}
                                  className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                                    activeSubmitCaseIndex === idx
                                      ? "bg-zinc-800 text-white font-semibold border border-white/10"
                                      : "text-zinc-400 hover:text-white bg-zinc-950 border border-transparent"
                                  }`}
                                >
                                  <span
                                    className={`size-1.5 rounded-full ${
                                      tc.passed ? "bg-lime-400" : "bg-rose-400"
                                    }`}
                                  />
                                  <span>{tc.name || `Case ${idx + 1}`}</span>
                                </button>
                              ))}
                            </div>

                            {submitResult.testcase_results[activeSubmitCaseIndex] && (() => {
                              const curTc = submitResult.testcase_results[activeSubmitCaseIndex];
                              if (curTc.is_hidden) {
                                return (
                                  <div className="p-3 bg-zinc-950 border border-white/10 rounded space-y-2">
                                    <div className="flex items-center gap-2">
                                      <Lock className="size-4 text-zinc-500" />
                                      <span className="font-semibold text-xs text-white">Hidden Evaluation Testcase</span>
                                      {curTc.passed ? (
                                        <Badge className="bg-lime-400/10 text-lime-400 border border-lime-400/30 text-[10px]">Passed</Badge>
                                      ) : (
                                        <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px]">Failed</Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                                      {curTc.passed
                                        ? "Your solution passed this hidden verification case."
                                        : "Your solution produced an incorrect result or runtime error on this hidden edge case. Proprietary inputs are masked to preserve contest integrity."}
                                    </p>
                                  </div>
                                );
                              }
                              return (
                                <div className="space-y-2.5">
                                  <div>
                                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">
                                      Input
                                    </span>
                                    <pre className="p-2 bg-zinc-950 border border-white/10 rounded text-xs text-zinc-200 overflow-x-auto">
                                      {curTc.input}
                                    </pre>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <div>
                                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">
                                        Output
                                      </span>
                                      <pre
                                        className={`p-2 bg-zinc-950 border rounded text-xs overflow-x-auto ${
                                          curTc.passed ? "border-lime-400/30 text-lime-400" : "border-rose-500/30 text-rose-400"
                                        }`}
                                      >
                                        {curTc.stdout || "(empty)"}
                                      </pre>
                                    </div>
                                    <div>
                                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">
                                        Expected
                                      </span>
                                      <pre className="p-2 bg-zinc-950 border border-white/10 rounded text-xs text-lime-400 overflow-x-auto">
                                        {curTc.expected_output}
                                      </pre>
                                    </div>
                                  </div>
                                  {curTc.stderr && (
                                    <div>
                                      <span className="text-[10px] uppercase tracking-wider text-rose-400 font-semibold block mb-1">
                                        Stderr
                                      </span>
                                      <pre className="p-2 bg-rose-950/20 border border-rose-500/20 rounded text-xs text-rose-400 overflow-x-auto">
                                        {curTc.stderr}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    ) : runResult ? (
                      /* Run Result Inspection */
                      <div className="space-y-3">
                        {/* Verdict Header */}
                        <div className="flex items-center justify-between border-b border-white/8 pb-2.5">
                          <div className="flex items-center gap-3">
                            {runResult.verdict === "ACCEPTED" ? (
                              <div className="flex items-center gap-1.5 text-lime-400 font-bold text-xs font-mono uppercase">
                                <CheckCircle2 className="size-4 text-lime-400" />
                                <span>Accepted</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs font-mono uppercase">
                                <AlertCircle className="size-4 text-rose-400" />
                                <span>{runResult.verdict}</span>
                              </div>
                            )}
                            {runResult.passed_testcases !== undefined && runResult.total_testcases !== undefined && (
                              <span className="text-zinc-400 font-mono text-xs tabular-nums">
                                {runResult.passed_testcases} / {runResult.total_testcases} sample cases passed
                              </span>
                            )}
                          </div>
                          {runResult.time !== undefined && (
                            <span className="text-zinc-500 text-xs font-mono tabular-nums">
                              Runtime: {Math.round(runResult.time * 1000)}ms
                            </span>
                          )}
                        </div>

                        {/* Testcase Sub-tabs */}
                        {runResult.testcase_results && runResult.testcase_results.length > 0 ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-1.5">
                              {runResult.testcase_results.map((tc, idx) => (
                                <button
                                  key={tc.testcase_id || idx}
                                  type="button"
                                  onClick={() => setActiveRunCaseIndex(idx)}
                                  className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                                    activeRunCaseIndex === idx
                                      ? "bg-zinc-800 text-white font-semibold border border-white/10"
                                      : "text-zinc-400 hover:text-white bg-zinc-950 border border-transparent"
                                  }`}
                                >
                                  <span
                                    className={`size-1.5 rounded-full ${
                                      tc.passed ? "bg-lime-400" : "bg-rose-400"
                                    }`}
                                  />
                                  <span>Case {idx + 1}</span>
                                </button>
                              ))}
                            </div>

                            {runResult.testcase_results[activeRunCaseIndex] && (() => {
                              const curTc = runResult.testcase_results[activeRunCaseIndex];
                              return (
                                <div className="space-y-2.5">
                                  {curTc.stdin && (
                                    <div>
                                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">
                                        Input
                                      </span>
                                      <pre className="p-2 bg-zinc-950 border border-white/10 rounded text-xs text-zinc-200 overflow-x-auto">
                                        {curTc.stdin}
                                      </pre>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <div>
                                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">
                                        Output
                                      </span>
                                      <pre
                                        className={`p-2 bg-zinc-950 border rounded text-xs overflow-x-auto ${
                                          curTc.passed ? "border-lime-400/30 text-lime-400" : "border-rose-500/30 text-rose-400"
                                        }`}
                                      >
                                        {curTc.stdout || "(empty)"}
                                      </pre>
                                    </div>
                                    <div>
                                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">
                                        Expected
                                      </span>
                                      <pre className="p-2 bg-zinc-950 border border-white/10 rounded text-xs text-lime-400 overflow-x-auto">
                                        {curTc.expected_output}
                                      </pre>
                                    </div>
                                  </div>
                                  {curTc.stderr && (
                                    <div>
                                      <span className="text-[10px] uppercase tracking-wider text-rose-400 font-semibold block mb-1">
                                        Stderr
                                      </span>
                                      <pre className="p-2 bg-rose-950/20 border border-rose-500/20 rounded text-xs text-rose-400 overflow-x-auto">
                                        {curTc.stderr}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {runResult.stdout && (
                              <div>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Stdout</span>
                                <pre className="p-2 bg-zinc-950 border border-white/8 rounded text-xs text-white overflow-x-auto">
                                  {runResult.stdout}
                                </pre>
                              </div>
                            )}
                            {runResult.stderr && (
                              <div>
                                <span className="text-[10px] text-rose-400 uppercase tracking-wider font-mono">Stderr</span>
                                <pre className="p-2 bg-black border border-rose-500/20 rounded text-xs text-rose-400 overflow-x-auto">
                                  {runResult.stderr}
                                </pre>
                              </div>
                            )}
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
            )}
          </div>

          {/* Action Footer */}
          <div className="h-11 px-4 border-t border-white/8 flex items-center justify-between bg-black shrink-0">
            <div className="flex items-center gap-3">
              {/* LeetCode-style Console Toggle */}
              <button
                type="button"
                onClick={() => setIsDrawerCollapsed((prev) => !prev)}
                className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-950 border border-white/10 hover:border-white/20 transition-colors cursor-pointer"
                title={isDrawerCollapsed ? "Open Console Drawer" : "Close Console Drawer"}
              >
                <Terminal className="size-3 text-lime-400" />
                <span>Console</span>
                {isDrawerCollapsed ? <ChevronUp className="size-3 text-zinc-500" /> : <ChevronDown className="size-3 text-zinc-500" />}
              </button>

              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                <span className={`size-1.5 rounded-full ${isContestOver ? 'bg-red-500' : 'bg-lime-400'}`} />
                <span>{isContestOver ? 'Contest locked' : 'Workstation online'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRunningCode || isSubmittingCode || isContestOver}
                onClick={handleRunCode}
                className="font-mono text-xs font-semibold rounded-md border border-white/20 bg-black text-white hover:bg-lime-400 hover:text-black hover:border-lime-400 disabled:opacity-30 cursor-pointer transition-colors"
              >
                <Play className="size-3 fill-current" />
                <span>{isRunningCode ? "Running…" : "Run"}</span>
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={isRunningCode || isSubmittingCode || isContestOver}
                onClick={handleSubmitCode}
                className="font-mono text-xs font-bold uppercase tracking-wider rounded-md bg-lime-400 text-black border border-lime-400 hover:bg-lime-300 active:bg-lime-500 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors shadow-[0_0_12px_rgba(204,255,0,0.3)]"
              >
                <Send className="size-3 fill-current" />
                <span>{isSubmittingCode ? "Judging…" : "Submit"}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Overlay during drag to prevent mouse capturing or text selection */}
      {(isDraggingWidth || isDraggingHeight) && (
        <div
          className={`fixed inset-0 z-50 select-none ${
            isDraggingWidth ? "cursor-col-resize" : "cursor-row-resize"
          }`}
          style={{ userSelect: "none" }}
        />
      )}

      {/* Contest Over Overlay */}
      {isContestOver && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 font-mono select-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="contest-ended-title"
        >
          <div className="max-w-md w-full p-8 rounded-lg border border-lime-400/40 bg-black text-center space-y-6">
            <div className="flex size-14 items-center justify-center rounded-md border border-lime-400/30 bg-lime-400/10 mx-auto text-lime-400">
              <Trophy className="size-7" />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-widest text-lime-400 font-semibold block">
                Official Contest Bell
              </span>
              <h2 id="contest-ended-title" className="text-2xl font-bold text-white tracking-tight">
                Contest Concluded
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
                The competition clock has expired. All submitted solutions are locked for final rating computation.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="flex size-14 items-center justify-center rounded-md border border-lime-400 bg-lime-400/10">
                <span className="text-xl font-bold text-lime-400 tabular-nums">{redirectCountdown}</span>
              </div>
              <button
                onClick={() => navigate(`/contests/${contestSlug}/final-results`)}
                className="font-mono text-xs font-semibold uppercase text-white border border-white/20 bg-transparent px-5 py-2 rounded-md hover:bg-lime-400 hover:text-black hover:border-lime-400 transition-colors cursor-pointer [&_svg]:transition-colors"
              >
                View Final Results →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
