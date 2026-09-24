/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * Dedicated Air-Gapped Live Contest Arena (Round 2 Final)
 * Redesigned to Strix AI Paradigm (Pure Pitch Black × Electric Lime)
 */

import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Code2,
  Copy,
  Cpu,
  FileText,
  GripHorizontal,
  GripVertical,
  Layout,
  Lock,
  LogIn,
  LogOut,
  Maximize2,
  Minimize2,
  Play,
  QrCode,
  RotateCcw,
  Send,
  Settings,
  ShieldCheck,
  Terminal,
  Trophy,
  X,
  XCircle,
  ListOrdered,
  Coins,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
const MonacoEditor = lazy(() => import("@/organization/components/MonacoEditor"));
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchContestArenaThunk,
  runArenaCodeThunk,
  submitArenaCodeThunk,
  clearArenaResults,
} from "@/store/slices/contestSlice";
import { fetchCurrentUserThunk } from "@/store/slices/authSlice";
import { AssessmentStudioSkeleton } from "@/organization/components/skeletons";
import { useRealtimeEvents } from "@/lib/realtime";
import { slugifyProblem, resolveAvatarUrl, formatFullName } from "@/lib/utils";
import { getToken } from "@/lib/auth";
import { useSwrData } from "@/lib/cache/swrCache";
import { contestApi } from "@/features/contest/api";
import type { AssessmentRanking } from "@/features/contest/types";

function formatTimer(totalSeconds: number): string {
  if (totalSeconds <= 0) return "00:00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type ArenaLanguage = "python" | "cpp" | "c" | "java" | "javascript" | "typescript";

function getFallbackStarter(lang: ArenaLanguage, title?: string): string {
  const words = (title || "solve").match(/[a-zA-Z0-9]+/g) || ["solve"];
  let fnName = words[0].toLowerCase() + words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
  if (!/^[a-zA-Z]/.test(fnName)) fnName = "solve" + fnName;

  switch (lang) {
    case "python":
      return `class Solution:\n    def ${fnName}(self) -> int:\n        # Write your solution here\n        pass\n`;
    case "cpp":
      return `#include <vector>\nusing namespace std;\n\nclass Solution {\npublic:\n    int ${fnName}() {\n        // Write your solution here\n        return 0;\n    }\n};\n`;
    case "c":
      return `#include <stdio.h>\n#include <stdlib.h>\n\nint ${fnName}() {\n    // Write your solution here\n    return 0;\n}\n`;
    case "java":
      return `class Solution {\n    public int ${fnName}() {\n        // Write your solution here\n        return 0;\n    }\n}\n`;
    case "javascript":
      return `/**\n * @return {number}\n */\nvar ${fnName} = function() {\n    // Write your solution here\n};\n`;
    case "typescript":
      return `function ${fnName}(): number {\n    // Write your solution here\n    return 0;\n}\n`;
  }
}

export function ContestArenaPage() {
  const { contestSlug = "", problemSlug = "" } = useParams<{ contestSlug: string; problemSlug?: string }>();
  const [searchParams] = useSearchParams();
  const problemParam = searchParams.get("problem");
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { arenaData, runResult, submitResult, isRunningCode, isSubmittingCode, isLoadingArena, error } =
    useAppSelector((state) => state.contest);
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
      const firstProblem = problems[0];
      if (firstProblem) {
        const firstSlug = slugifyProblem(firstProblem.title, firstProblem.problem_index);
        navigate(`/contests/${contestSlug}/problems/${firstSlug}`, { replace: true });
      }
    }
  }, [problems, problemSlug, contestSlug, navigate]);

  const [selectedLanguage, setSelectedLanguage] = useState<ArenaLanguage>("python");
  const [codeMap, setCodeMap] = useState<Record<string, string>>({});
  const [customStdin, setCustomStdin] = useState("");
  const [activeConsoleTab, setActiveConsoleTab] = useState<"testcases" | "output">("testcases");
  const [activeTestcaseIndex, setActiveTestcaseIndex] = useState(0);
  const [activeRunCaseIndex, setActiveRunCaseIndex] = useState(0);
  const [activeSubmitCaseIndex, setActiveSubmitCaseIndex] = useState(0);
  const [lastAction, setLastAction] = useState<"run" | "submit" | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [solvedProblemIds, setSolvedProblemIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`ccc_solved_${contestSlug}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [activeProblemTab, setActiveProblemTab] = useState<"description" | "submissions">("description");
  const [isProblemListOpen, setIsProblemListOpen] = useState(false);
  const [problemListTab, setProblemListTab] = useState<"problems" | "ranking">("problems");

  const { data: rankingData } = useSwrData<AssessmentRanking>(
    contestSlug ? `contest:ranking:${contestSlug}` : null,
    () => contestApi.ranking(contestSlug),
    { ttl: 30 * 1000 }
  );

  const totalEarnedPoints = problems.reduce(
    (acc, p) => (solvedProblemIds.has(p.id) ? acc + (p.points || 0) : acc),
    0
  );
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"editor" | "shortcuts" | "timer">("editor");
  const [editorFontSize, setEditorFontSize] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ccc_editor_fontsize");
      if (saved) return parseInt(saved, 10);
    }
    return 13;
  });
  const [editorWordWrap, setEditorWordWrap] = useState<"on" | "off">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ccc_editor_wordwrap");
      if (saved === "off") return "off";
    }
    return "on";
  });
  const [editorTabSize, setEditorTabSize] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ccc_editor_tabsize");
      if (saved) return parseInt(saved, 10);
    }
    return 4;
  });
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [hasRunCode, setHasRunCode] = useState(false);
  const [submissionHistory, setSubmissionHistory] = useState<any[]>(() => {
    if (typeof window !== "undefined" && contestSlug && activeProblem?.id) {
      try {
        const saved = localStorage.getItem(`ccc_submissions_${contestSlug}_${activeProblem.id}`);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    if (!activeProblem?.id || !contestSlug) return;
    try {
      const saved = localStorage.getItem(`ccc_submissions_${contestSlug}_${activeProblem.id}`);
      setSubmissionHistory(saved ? JSON.parse(saved) : []);
    } catch {
      setSubmissionHistory([]);
    }
  }, [activeProblem?.id, contestSlug]);

  const handlePrevProblem = useCallback(() => {
    if (resolvedIndex > 0) {
      const prev = problems[resolvedIndex - 1];
      if (prev) {
        const pSlug = slugifyProblem(prev.title, prev.problem_index);
        navigate(`/contests/${contestSlug}/problems/${pSlug}`);
      }
    }
  }, [resolvedIndex, problems, contestSlug, navigate]);

  const handleNextProblem = useCallback(() => {
    if (resolvedIndex < problems.length - 1) {
      const next = problems[resolvedIndex + 1];
      if (next) {
        const pSlug = slugifyProblem(next.title, next.problem_index);
        navigate(`/contests/${contestSlug}/problems/${pSlug}`);
      }
    }
  }, [resolvedIndex, problems, contestSlug, navigate]);

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
    ? `ccc_code_v4_${contestSlug}_${activeProblem.id}_${selectedLanguage}`
    : "";

  // Load durable code: state -> validated localStorage -> official problem starter_code
  const getInitialCode = (): string => {
    if (codeMap[problemKey]) {
      const isLegacy =
        codeMap[problemKey].includes("def main():") ||
        codeMap[problemKey].includes("sys.stdin.read()") ||
        codeMap[problemKey].includes("TODO: Calculate valid mirror pairs") ||
        codeMap[problemKey].includes("def solve(") ||
        codeMap[problemKey].includes("int solve(") ||
        codeMap[problemKey].includes("var solve =") ||
        codeMap[problemKey].includes("function solve(") ||
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
          localStorage.removeItem(`ccc_code_v3_${contestSlug}_${activeProblem.id}_${selectedLanguage}`);
        }
        const saved = localStorage.getItem(problemStorageKey);
        if (saved) {
          // If saved code contains old competitive programming script or generic placeholder, purge it
          const isLegacy =
            saved.includes("def main():") ||
            saved.includes("sys.stdin.read()") ||
            saved.includes("TODO: Calculate valid mirror pairs") ||
            saved.includes("def solve(") ||
            saved.includes("int solve(") ||
            saved.includes("var solve =") ||
            saved.includes("function solve(") ||
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
      getFallbackStarter(selectedLanguage, activeProblem?.title)
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
      getFallbackStarter(selectedLanguage, activeProblem?.title);
    setCodeMap((prev) => ({ ...prev, [problemKey]: defaultStarter }));
    if (typeof window !== "undefined") {
      try {
        if (problemStorageKey) localStorage.removeItem(problemStorageKey);
        if (activeProblem?.id) {
          localStorage.removeItem(`ccc_code_${contestSlug}_${activeProblem.id}_${selectedLanguage}`);
          localStorage.removeItem(`ccc_code_v2_${contestSlug}_${activeProblem.id}_${selectedLanguage}`);
          localStorage.removeItem(`ccc_code_v3_${contestSlug}_${activeProblem.id}_${selectedLanguage}`);
          localStorage.removeItem(`ccc_code_v4_${contestSlug}_${activeProblem.id}_${selectedLanguage}`);
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

  const handleRunCode = useCallback(async () => {
    if (!activeProblem || isRunningCode || isSubmittingCode || isContestOver) return;
    setHasRunCode(true);
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
        toast.success("Sample testcases passed!");
      } else {
        toast.error(`Execution: ${result.payload.verdict}`);
      }
    } else {
      toast.error(String(result.payload || "Failed to execute code"));
    }
  }, [
    activeProblem,
    isRunningCode,
    isSubmittingCode,
    isContestOver,
    dispatch,
    contestSlug,
    selectedLanguage,
    currentCode,
    activeTestcaseIndex,
    customStdin,
  ]);

  const handleSubmitCode = useCallback(async () => {
    if (!activeProblem || isRunningCode || isSubmittingCode || isContestOver) return;
    setHasRunCode(true);
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
      const newRecord = {
        id: String(Date.now()),
        problem_id: activeProblem.id,
        verdict: res.verdict,
        time: res.time,
        memory: res.memory,
        language: selectedLanguage,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        passed_testcases: res.passed_testcases,
        total_testcases: res.total_testcases,
      };
      setSubmissionHistory((prev) => {
        const updated = [newRecord, ...prev];
        try {
          localStorage.setItem(
            `ccc_submissions_${contestSlug}_${activeProblem.id}`,
            JSON.stringify(updated.slice(0, 20))
          );
        } catch {}
        return updated;
      });

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
  }, [
    activeProblem,
    isRunningCode,
    isSubmittingCode,
    isContestOver,
    dispatch,
    contestSlug,
    selectedLanguage,
    currentCode,
  ]);

  // Global Keyboard Shortcuts (⌘' Run, ⌘⏎ Submit, ⌥← Prev, ⌥→ Next)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+' or Ctrl+' to run
      if ((e.metaKey || e.ctrlKey) && e.key === "'") {
        e.preventDefault();
        void handleRunCode();
      }
      // Cmd+Enter or Ctrl+Enter to submit
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void handleSubmitCode();
      }
      // Alt+Left to prev problem
      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevProblem();
      }
      // Alt+Right to next problem
      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        handleNextProblem();
      }
      // Escape to close Problem List drawer
      if (e.key === "Escape") {
        setIsProblemListOpen(false);
      }
      // Alt+P to toggle problem list drawer
      if (e.altKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setIsProblemListOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRunCode, handleSubmitCode, handlePrevProblem, handleNextProblem]);

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

  if (isLoadingArena || (!arenaData && !error)) {
    return <AssessmentStudioSkeleton />;
  }

  if (!arenaData) {
    const errLower = (error || "").toLowerCase();
    const isUnauthenticated =
      (!member && !getToken()) ||
      errLower.includes("authentication") ||
      errLower.includes("unauthorized") ||
      errLower.includes("sign in") ||
      errLower.includes("401");

    const isUpcoming =
      errLower.includes("not started") ||
      errLower.includes("upcoming") ||
      errLower.includes("opens at");

    const isNotFound =
      errLower.includes("not found") ||
      errLower.includes("404");

    const isProctorGate =
      errLower.includes("physical gate") ||
      errLower.includes("proctor scan") ||
      errLower.includes("campus pass");

    if (isUnauthenticated) {
      return (
        <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-black p-4 text-white font-sans">
          <div className="w-full max-w-md space-y-6 rounded-lg border border-white/10 bg-zinc-950 p-8 text-center shadow-2xl">
            <div className="mx-auto flex size-14 items-center justify-center rounded-md border border-lime-400/30 bg-lime-400/10 text-lime-400">
              <Lock className="size-7" />
            </div>

            <div className="space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-lime-400 font-semibold">
                Contest Authentication Required
              </span>
              <h1 className="text-xl font-semibold tracking-tight text-white">
                Sign In to Enter Arena
              </h1>
              <p className="text-xs text-zinc-400 font-mono leading-relaxed">
                You must be signed in with your Medi-Caps account to enter the contest workspace, run test cases, and submit solutions.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <Button
                asChild
                className="rounded-md bg-lime-400 text-black font-mono text-xs font-semibold hover:bg-lime-300 transition-colors cursor-pointer"
              >
                <Link to={`/auth?redirect=${encodeURIComponent(`/contests/${contestSlug}/arena`)}`}>
                  <LogIn className="size-3.5 mr-1.5" />
                  <span>Sign In to Continue</span>
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="rounded-md font-mono text-xs text-zinc-400 hover:bg-white/5 hover:text-white"
              >
                <Link to={`/contests/${contestSlug}`}>
                  <ArrowLeft className="size-3.5 mr-1.5" />
                  <span>Return to Contest Overview</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (isUpcoming) {
      return (
        <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-black p-4 text-white font-sans">
          <div className="w-full max-w-md space-y-6 rounded-lg border border-amber-500/30 bg-zinc-950 p-8 text-center shadow-2xl">
            <div className="mx-auto flex size-14 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <Clock className="size-7" />
            </div>

            <div className="space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400 font-semibold">
                Contest Scheduled
              </span>
              <h1 className="text-xl font-semibold tracking-tight text-white">
                Arena Has Not Started Yet
              </h1>
              <p className="text-xs text-zinc-400 font-mono leading-relaxed">
                The competition arena and problem statements unlock automatically when the scheduled contest countdown reaches zero.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <Button
                asChild
                className="rounded-md bg-transparent text-white border border-white/20 font-mono text-xs font-semibold hover:bg-lime-400 hover:text-black hover:border-lime-400 transition-colors cursor-pointer"
              >
                <Link to={`/contests/${contestSlug}/lobby`}>
                  <Clock className="size-3.5 mr-1.5" />
                  <span>Go to Contest Waiting Lobby</span>
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="rounded-md font-mono text-xs text-zinc-400 hover:bg-white/5 hover:text-white"
              >
                <Link to={`/contests/${contestSlug}`}>
                  <ArrowLeft className="size-3.5 mr-1.5" />
                  <span>Contest Overview</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (isNotFound) {
      return (
        <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-black p-4 text-white font-sans">
          <div className="w-full max-w-md space-y-6 rounded-lg border border-red-500/30 bg-zinc-950 p-8 text-center shadow-2xl">
            <div className="mx-auto flex size-14 items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 text-red-400">
              <AlertTriangle className="size-7" />
            </div>

            <div className="space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-red-400 font-semibold">
                404 Not Found
              </span>
              <h1 className="text-xl font-semibold tracking-tight text-white">
                Contest Not Found
              </h1>
              <p className="text-xs text-zinc-400 font-mono leading-relaxed">
                We could not find a contest matching &quot;{contestSlug}&quot;. It may have concluded or the URL may be incorrect.
              </p>
            </div>

            <div className="pt-2">
              <Button
                asChild
                className="w-full rounded-md bg-lime-400 text-black font-mono text-xs font-semibold hover:bg-lime-300 transition-colors cursor-pointer"
              >
                <Link to="/contests">
                  <ArrowLeft className="size-3.5 mr-1.5" />
                  <span>Explore All Contests</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (isProctorGate) {
      return (
        <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-black p-4 text-white font-sans">
          <div className="w-full max-w-lg space-y-6 rounded-lg border border-amber-500/30 bg-zinc-950 p-8 text-center shadow-2xl">
            <div className="mx-auto flex size-14 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <ShieldCheck className="size-7" />
            </div>

            <div className="space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400 font-semibold">
                Proctor Verification Required
              </span>
              <h1 className="text-xl font-semibold tracking-tight text-white">
                On-Premise Check-in Required
              </h1>
              <p className="text-xs text-zinc-400 font-mono leading-relaxed">
                {error || "Physical gate check-in required. Your campus pass must be scanned by a lab proctor before entering the live arena."}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => dispatch(fetchContestArenaThunk(contestSlug))}
                variant="outline"
                className="w-full rounded-md font-mono text-xs border-white/10 bg-black text-zinc-300 hover:bg-lime-400 hover:text-black hover:border-lime-400 cursor-pointer"
              >
                <RotateCcw className="size-3 mr-1.5" />
                <span>Re-check Status</span>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="w-full rounded-md font-mono text-xs text-zinc-500 hover:bg-white/5 hover:text-white"
              >
                <Link to={`/contests/${contestSlug}`}>
                  Exit to Overview
                </Link>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Generic fallback error
    return (
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-black p-4 text-white font-sans">
        <div className="w-full max-w-md space-y-6 rounded-lg border border-white/10 bg-zinc-950 p-8 text-center shadow-2xl">
          <div className="mx-auto flex size-14 items-center justify-center rounded-md border border-white/10 bg-zinc-900 text-zinc-400">
            <AlertCircle className="size-7" />
          </div>

          <div className="space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
              Arena Access Notice
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Unable to Access Arena
            </h1>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed">
              {error || "An unexpected error occurred while loading the contest workspace."}
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => dispatch(fetchContestArenaThunk(contestSlug))}
              variant="outline"
              className="w-full rounded-md font-mono text-xs border-white/10 bg-black text-zinc-300 hover:bg-lime-400 hover:text-black hover:border-lime-400 cursor-pointer"
            >
              <RotateCcw className="size-3 mr-1.5" />
              <span>Retry Connection</span>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="w-full rounded-md font-mono text-xs text-zinc-400 hover:bg-white/5 hover:text-white"
            >
              <Link to={`/contests/${contestSlug}`}>
                Back to Contest
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const title = arenaData?.title || contestSlug || "Contest Arena";

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-black text-white select-none overflow-hidden font-sans">
      {/* Top Navigation Bar — LeetCode Weekly Contest Architecture in Strix AI Dark Theme */}
      <header className="h-12 shrink-0 px-3 bg-black border-b border-white/8 flex items-center justify-between gap-2 z-30">
        {/* Left: Exit, Separator, Title (Drawer Opener), Question Switcher & Chevrons */}
        <div className="flex items-center gap-2 min-w-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowExitModal(true)}
            className="h-7 px-2 text-zinc-300 border-white/10 bg-black hover:bg-lime-400 hover:text-black hover:border-lime-400 rounded-md font-mono text-xs cursor-pointer flex items-center transition-colors shrink-0"
            title="Exit to contest overview"
          >
            <ChevronLeft className="size-4 mr-0.5" />
            <span>Exit</span>
          </Button>

          <div className="h-3.5 w-px bg-white/10 shrink-0" />

          {/* Drawer Opener via Contest Title button */}
          <button
            type="button"
            onClick={() => setIsProblemListOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-zinc-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors cursor-pointer group min-w-0 text-left"
            title="Open Problem List & Standings (⌥P)"
          >
            <span className="font-semibold text-xs sm:text-sm text-white truncate max-w-[130px] sm:max-w-[200px] md:max-w-[280px]">
              {title}
            </span>
            {arenaData?.status && (
              <span className="border border-lime-400/30 bg-lime-400/10 text-lime-400 font-mono text-[9px] uppercase px-1.5 py-0.5 rounded font-semibold hidden sm:inline">
                {arenaData.status}
              </span>
            )}
            <ChevronRight className="size-3.5 text-zinc-400 group-hover:text-lime-400 transition-transform group-hover:translate-x-0.5 shrink-0" />
          </button>

          {/* Question Nav Switcher Pill & Chevrons */}
          <div className="flex items-center gap-0.5 ml-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrevProblem}
              disabled={resolvedIndex <= 0}
              className="size-7 p-0 rounded-md border-white/10 bg-black text-zinc-400 hover:bg-lime-400 hover:text-black hover:border-lime-400 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer shrink-0"
              title="Previous question (⌥←)"
            >
              <ChevronLeft className="size-3.5" />
            </Button>

            <button
              type="button"
              onClick={() => setIsProblemListOpen(true)}
              className="h-7 px-2.5 rounded-md border border-white/10 bg-zinc-950 text-xs font-mono font-medium text-zinc-300 hover:border-lime-400/40 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              title="Open Problem List (⌥P)"
            >
              <ListOrdered className="size-3 text-lime-400" />
              <span className="font-semibold text-lime-400">
                Q{activeProblem?.problem_index || resolvedIndex + 1}
              </span>
              <span className="text-zinc-500 hidden sm:inline text-[10px]">
                / {problems.length}
              </span>
              <ChevronDown className="size-3 text-zinc-500 ml-0.5" />
            </button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleNextProblem}
              disabled={resolvedIndex >= problems.length - 1}
              className="size-7 p-0 rounded-md border-white/10 bg-black text-zinc-400 hover:bg-lime-400 hover:text-black hover:border-lime-400 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer shrink-0"
              title="Next question (⌥→)"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="size-7 p-0 text-zinc-400 hover:bg-lime-400 hover:text-black hover:border-lime-400 rounded-md border-white/10 bg-black transition-colors ml-0.5 shrink-0"
          >
            <Link
              to={`/contests/${contestSlug}/results`}
              target="_blank"
              rel="noopener noreferrer"
              title="Live Standings & Ranking"
            >
              <BarChart2 className="size-3.5" />
            </Link>
          </Button>
        </div>

        {/* Center: Run & Submit Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRunningCode || isSubmittingCode || isContestOver}
            onClick={handleRunCode}
            className="h-7 px-3 text-xs font-mono font-semibold rounded-md border border-white/20 bg-black text-white hover:bg-lime-400 hover:text-black hover:border-lime-400 disabled:opacity-30 cursor-pointer transition-colors flex items-center gap-1.5"
          >
            <Play className="size-3 fill-current" />
            <span>{isRunningCode ? "Running…" : "Run"}</span>
            <span className="hidden md:inline text-[10px] text-zinc-400 font-mono">⌘'</span>
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isRunningCode || isSubmittingCode || isContestOver}
            onClick={handleSubmitCode}
            className="h-7 px-3.5 text-xs font-mono font-bold uppercase tracking-wider rounded-md bg-lime-400 text-black border border-lime-400 hover:bg-lime-300 active:bg-lime-500 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors shadow-[0_0_12px_rgba(204,255,0,0.3)] flex items-center gap-1.5"
          >
            <Send className="size-3 fill-current" />
            <span>{isSubmittingCode ? "Judging…" : "Submit"}</span>
            <span className="hidden md:inline text-[10px] text-black/70 font-mono font-bold">⌘⏎</span>
          </Button>
        </div>

        {/* Right: Layout, Settings, Countdown Timer, Avatar */}
        <div className="flex items-center gap-2">
          {/* Layout Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-mono text-zinc-400 hover:text-white px-2 py-1 rounded bg-black border border-white/10 hover:border-white/20 transition-colors cursor-pointer h-7"
                title="Adjust Workspace Layout"
              >
                <Layout className="size-3.5 text-lime-400" />
                <span className="hidden sm:inline">{isFocusMode ? "Focus" : "Default"}</span>
                <ChevronDown className="size-3 text-zinc-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-950 border-white/10 text-white text-xs font-mono">
              <DropdownMenuItem
                onClick={() => setIsFocusMode(false)}
                className={`cursor-pointer ${!isFocusMode ? "text-lime-400 font-semibold" : "text-zinc-300"}`}
              >
                Default Split Layout
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setIsFocusMode(true)}
                className={`cursor-pointer ${isFocusMode ? "text-lime-400 font-semibold" : "text-zinc-300"}`}
              >
                🧘 Focus Mode (Full Editor)
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={handleResetWidth} className="cursor-pointer text-zinc-400">
                Reset Pane Split (50/50)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Settings Gear Modal Trigger */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowSettingsModal(true)}
            className="size-7 p-0 text-zinc-400 hover:bg-lime-400 hover:text-black hover:border-lime-400 rounded-md border-white/10 bg-black transition-colors cursor-pointer shrink-0"
            title="Preferences & Keyboard Shortcuts"
          >
            <Settings className="size-3.5" />
          </Button>

          {/* Timer Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded border border-lime-400/30 bg-lime-400/10 text-lime-400 font-mono text-xs font-semibold tabular-nums shrink-0">
            <span className="size-1.5 rounded-full bg-lime-400 animate-pulse" />
            <Clock className="size-3 text-lime-400" />
            <span>{formatTimer(remainingSeconds)}</span>
          </div>

          {/* User Profile Logo / Avatar */}
          <Link
            to="/profile"
            className="flex items-center gap-1.5 pl-0.5 hover:opacity-90 transition-opacity cursor-pointer shrink-0"
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

      {/* Main 2-Pane Split */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Left: Problem Statement & Submissions Pane */}
        {!isFocusMode && (
          <div
            style={{ width: `${leftWidthPercent}%` }}
            className="flex flex-col bg-black border-r border-white/8 shrink-0 min-w-[280px] max-w-[calc(100%-300px)] h-full overflow-hidden"
          >
            {/* Panel Tabs Header */}
            <div className="h-9 shrink-0 px-3 border-b border-white/8 bg-black flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveProblemTab("description")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded transition-colors cursor-pointer border ${
                  activeProblemTab === "description"
                    ? "bg-zinc-900 text-white border-lime-400/40 font-semibold"
                    : "text-zinc-400 hover:text-white hover:bg-white/5 border-transparent"
                }`}
              >
                <FileText className="size-3.5 text-lime-400" />
                <span>Description</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveProblemTab("submissions")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded transition-colors cursor-pointer border ${
                  activeProblemTab === "submissions"
                    ? "bg-zinc-900 text-white border-lime-400/40 font-semibold"
                    : "text-zinc-400 hover:text-white hover:bg-white/5 border-transparent"
                }`}
              >
                <RotateCcw className="size-3.5 text-zinc-400" />
                <span>Submissions</span>
                {submissionHistory.length > 0 && (
                  <span className="size-4 rounded-full bg-lime-400/10 text-lime-400 border border-lime-400/30 text-[10px] font-mono flex items-center justify-center">
                    {submissionHistory.length}
                  </span>
                )}
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 text-zinc-200" data-problem-panel>
              {activeProblemTab === "description" ? (
                activeProblem ? (
                  <>
                    {/* Problem Title & Badges */}
                    <div className="space-y-2 border-b border-white/8 pb-4">
                      <div className="flex items-center gap-2">
                        {/* Difficulty Badge */}
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase font-semibold border ${
                            activeProblem.difficulty === "HARD"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              : activeProblem.difficulty === "MEDIUM"
                              ? "bg-amber-400/10 text-amber-400 border-amber-400/30"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          }`}
                        >
                          {activeProblem.difficulty || "EASY"}
                        </span>
                        <span className="text-xs text-zinc-400 font-mono tabular-nums">
                          {activeProblem.points} Points
                        </span>
                      </div>
                      <h1 className="text-base font-semibold tracking-tight text-white font-sans">
                        Q{activeProblem.problem_index}. {activeProblem.title}
                      </h1>
                    </div>

                    {/* Problem Description */}
                    <div className="text-sm font-sans text-zinc-200 leading-relaxed whitespace-pre-line">
                      {activeProblem.description}
                    </div>

                    {activeProblem.input_format && (
                      <div className="space-y-1.5">
                        <span className="font-mono text-[10px] uppercase font-semibold text-zinc-500 tracking-wider block">
                          Input Format
                        </span>
                        <div className="bg-zinc-950 border border-white/8 rounded-md p-3 text-[13px] font-mono text-zinc-300 whitespace-pre-line leading-relaxed">
                          {activeProblem.input_format}
                        </div>
                      </div>
                    )}

                    {activeProblem.output_format && (
                      <div className="space-y-1.5">
                        <span className="font-mono text-[10px] uppercase font-semibold text-zinc-500 tracking-wider block">
                          Output Format
                        </span>
                        <div className="bg-zinc-950 border border-white/8 rounded-md p-3 text-[13px] font-mono text-zinc-300 whitespace-pre-line leading-relaxed">
                          {activeProblem.output_format}
                        </div>
                      </div>
                    )}

                    {/* Examples Section */}
                    {activeProblem.sample_testcases && activeProblem.sample_testcases.length > 0 && (
                      <div className="space-y-3 pt-1">
                        <span className="font-mono text-[10px] uppercase font-semibold text-zinc-500 tracking-wider block">
                          Sample Testcases
                        </span>
                        {activeProblem.sample_testcases.map((st, i) => (
                          <div key={i} className="p-3.5 rounded-md bg-zinc-950 border border-white/8 space-y-2 text-xs font-mono">
                            <div className="flex items-center justify-between text-zinc-400 font-semibold">
                              <span>Example {i + 1}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(st.stdin, `tc_in_${i}`)}
                                className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-white cursor-pointer font-mono"
                              >
                                {copiedKey === `tc_in_${i}` ? (
                                  <Check className="size-3 text-lime-400" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                                <span>{copiedKey === `tc_in_${i}` ? "Copied" : "Copy"}</span>
                              </button>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] text-zinc-500">Input</span>
                              <pre className="p-2.5 rounded bg-black border border-white/6 text-zinc-200 overflow-x-auto whitespace-pre-wrap text-[13px] font-mono leading-relaxed">
                                {st.stdin}
                              </pre>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] text-zinc-500">Expected Output</span>
                              <pre className="p-2.5 rounded bg-black border border-white/6 text-lime-400 overflow-x-auto whitespace-pre-wrap text-[13px] font-mono leading-relaxed">
                                {st.expected_output}
                              </pre>
                            </div>
                            {st.explanation && (
                              <div className="text-[11px] text-zinc-400 italic pt-1 font-mono">
                                Note: {st.explanation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Constraints Section */}
                    {activeProblem.constraints && (
                      <div className="space-y-1.5 pt-1">
                        <span className="font-mono text-[10px] uppercase font-semibold text-zinc-500 tracking-wider block">
                          Constraints
                        </span>
                        <pre className="text-[13px] font-mono text-amber-300 bg-zinc-950 border border-white/8 p-3 rounded-md overflow-x-auto whitespace-pre-wrap leading-relaxed">
                          {activeProblem.constraints}
                        </pre>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-zinc-500 font-mono text-xs">Select a question to begin.</div>
                )
              ) : (
                /* Submissions History Tab */
                <div className="space-y-4 font-mono">
                  <div className="flex items-center justify-between border-b border-white/8 pb-3">
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Submissions History</h3>
                    <span className="text-xs text-zinc-500">{submissionHistory.length} attempts</span>
                  </div>
                  {submissionHistory.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-white/10 rounded-md text-zinc-500 text-xs space-y-1">
                      <p>No submissions for this question yet.</p>
                      <p className="text-[11px] text-zinc-600">Click &quot;Submit&quot; to test all cases and record an official attempt.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {submissionHistory.map((sub, idx) => (
                        <div
                          key={sub.id || idx}
                          className="p-3 bg-zinc-950 border border-white/8 rounded-md flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`font-semibold ${
                                sub.verdict === "ACCEPTED" ? "text-lime-400" : "text-rose-400"
                              }`}
                            >
                              {sub.verdict === "ACCEPTED" ? "Accepted" : sub.verdict}
                            </span>
                            <span className="text-zinc-600">·</span>
                            <span className="text-zinc-400">{sub.language}</span>
                          </div>
                          <div className="flex items-center gap-3 text-zinc-400 tabular-nums">
                            {sub.time && <span>{Math.round(sub.time * 1000)} ms</span>}
                            {sub.memory && <span>{sub.memory} MB</span>}
                            <span className="text-zinc-500">{sub.timestamp}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Draggable Width Adjuster in Strix AI Dark Theme */}
        {!isFocusMode && (
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
        )}

        {/* Right: Code Editor & Console Drawer */}
        <div
          ref={rightPaneRef}
          className="flex-1 flex flex-col bg-black min-w-0 h-full overflow-hidden relative"
        >
          {/* Top: Editor Toolbar Header */}
          <div className="h-9 shrink-0 px-3 bg-black border-b border-white/8 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-semibold text-lime-400 bg-lime-400/10 border border-lime-400/30 rounded">
                <Code2 className="size-3" />
                <span>Code</span>
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              {/* Language Selector */}
              <Select
                value={selectedLanguage}
                onValueChange={(val: any) => setSelectedLanguage(val)}
              >
                <SelectTrigger className="h-6 w-[120px] text-xs font-mono bg-black border-white/15 text-zinc-200 hover:border-lime-400/60 rounded focus:ring-1 focus:ring-lime-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black border-white/15 text-white font-mono text-xs rounded-md">
                  <SelectItem value="python">Python 3</SelectItem>
                  <SelectItem value="cpp">C++</SelectItem>
                  <SelectItem value="c">C</SelectItem>
                  <SelectItem value="java">Java</SelectItem>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                  <SelectItem value="typescript">TypeScript</SelectItem>
                </SelectContent>
              </Select>

              {/* Reset to Starter */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetStarter}
                className="h-6 px-2 text-xs font-mono border-white/10 bg-black text-zinc-400 hover:bg-lime-400 hover:text-black hover:border-lime-400 rounded transition-colors cursor-pointer"
                title="Reset to official starter code"
              >
                <RotateCcw className="size-2.5 mr-1" />
                <span>Reset</span>
              </Button>

              {/* Fullscreen Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
                className="size-6 p-0 text-zinc-400 hover:bg-lime-400 hover:text-black hover:border-lime-400 rounded border-white/10 bg-black transition-colors cursor-pointer"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}
              </Button>
            </div>
          </div>

          {/* Monaco Editor Pane */}
          <div className="flex-1 relative overflow-hidden bg-black min-h-0">
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
                onChange={handleCodeChange}
                fontSize={editorFontSize}
                wordWrap={editorWordWrap ? "on" : "off"}
                tabSize={editorTabSize}
                onCursorChange={(line, col) => setCursorPos({ line, col })}
              />
            </Suspense>
          </div>

          {/* Editor Status Bar */}
          <div className="h-6 px-3 bg-black border-t border-white/6 flex items-center justify-between text-[11px] font-mono text-zinc-400 shrink-0">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Check className="size-3 text-lime-400" />
              <span>Saved</span>
            </div>
            <div className="flex items-center gap-3 tabular-nums">
              <span>
                Ln {cursorPos.line}, Col {cursorPos.col}
              </span>
              <span>{selectedLanguage.toUpperCase()}</span>
            </div>
          </div>

          {/* Draggable Console Height Adjuster */}
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

          {/* Console & Execution Drawer */}
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
                      ? "bg-zinc-900 text-white font-semibold border border-white/10"
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
                      ? "bg-zinc-900 text-white font-semibold border border-white/10"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <span>Test Result</span>
                  {submitResult && (
                    <span
                      className={`size-1.5 rounded-full ${
                        submitResult.verdict === "ACCEPTED"
                          ? "bg-lime-400 shadow-[0_0_6px_#a3e635]"
                          : "bg-rose-400"
                      }`}
                    />
                  )}
                  {!submitResult && runResult && (
                    <span
                      className={`size-1.5 rounded-full ${
                        runResult.verdict === "ACCEPTED"
                          ? "bg-lime-400 shadow-[0_0_6px_#a3e635]"
                          : "bg-amber-400"
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
                          <span>Custom Arguments</span>
                          <span className="text-[10px] text-zinc-500">Standard input</span>
                        </div>
                        <textarea
                          value={customStdin}
                          onChange={(e) => setCustomStdin(e.target.value)}
                          placeholder={activeProblem?.sample_testcases?.[0]?.stdin || "Enter custom test inputs..."}
                          className="w-full h-24 p-2.5 bg-zinc-950 border border-white/10 rounded text-[13px] font-mono text-white resize-none focus:outline-none focus:border-lime-400/60 leading-relaxed"
                        />
                      </div>
                    ) : (
                      activeProblem?.sample_testcases?.[activeTestcaseIndex] && (
                        <div className="space-y-3">
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1 font-semibold">
                              Input
                            </span>
                            <pre className="p-2.5 bg-zinc-950 border border-white/10 rounded text-[13px] font-mono text-zinc-200 overflow-x-auto selection:bg-lime-400 selection:text-black leading-relaxed">
                              {activeProblem.sample_testcases[activeTestcaseIndex].stdin}
                            </pre>
                          </div>
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1 font-semibold">
                              Expected Output
                            </span>
                            <pre className="p-2.5 bg-zinc-950 border border-white/10 rounded text-[13px] font-mono text-lime-400 overflow-x-auto selection:bg-lime-400 selection:text-black leading-relaxed">
                              {activeProblem.sample_testcases[activeTestcaseIndex].expected_output}
                            </pre>
                          </div>
                          {activeProblem.sample_testcases[activeTestcaseIndex].explanation && (
                            <div className="text-[11px] font-mono text-zinc-400 italic">
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
                    {!hasRunCode ? (
                      /* LeetCode Standard Empty State in Strix AI Dark Theme */
                      <div className="flex flex-col items-center justify-center py-12 text-zinc-500 space-y-2 font-mono">
                        <Terminal className="size-6 text-zinc-600" />
                        <p className="text-xs">You must run your code first</p>
                      </div>
                    ) : lastAction === "submit" && submitResult ? (
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

                          <div className="flex items-center gap-3 text-xs font-mono text-zinc-400 tabular-nums">
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

                        {/* Compiler Diagnostics if compilation error or compile output present */}
                        {(submitResult.compile_output || (submitResult.verdict === "COMPILATION_ERROR" && submitResult.stderr)) && (
                          <div className="p-3 bg-black border border-rose-500/30 rounded font-mono text-xs space-y-1.5">
                            <div className="flex items-center gap-2 text-rose-400 font-semibold text-[11px] uppercase tracking-wider">
                              <AlertCircle className="size-3.5" />
                              <span>Compiler Diagnostics</span>
                            </div>
                            <pre className="text-rose-300/90 whitespace-pre-wrap font-mono text-xs max-h-48 overflow-y-auto leading-relaxed">
                              {submitResult.compile_output || submitResult.stderr}
                            </pre>
                          </div>
                        )}

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
                                        <Badge className="bg-lime-400/10 text-lime-400 border border-lime-400/30 text-[10px]">
                                          Passed
                                        </Badge>
                                      ) : (
                                        <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px]">
                                          Failed
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                                      {curTc.passed
                                        ? "Your solution passed this hidden verification case."
                                        : "Your solution produced an incorrect result or runtime error on this hidden edge case."}
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
                                          curTc.passed
                                            ? "border-lime-400/30 text-lime-400"
                                            : "border-rose-500/30 text-rose-400"
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
                                  {curTc.compile_output && (
                                    <div>
                                      <span className="text-[10px] uppercase tracking-wider text-rose-400 font-semibold block mb-1">
                                        Compiler Output
                                      </span>
                                      <pre className="p-2 bg-rose-950/20 border border-rose-500/20 rounded text-xs text-rose-300 overflow-x-auto whitespace-pre-wrap">
                                        {curTc.compile_output}
                                      </pre>
                                    </div>
                                  )}
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

                        {/* Compiler Diagnostics if compilation error or compile output present */}
                        {(runResult.compile_output || (runResult.verdict === "COMPILATION_ERROR" && runResult.stderr)) && (
                          <div className="p-3 bg-black border border-rose-500/30 rounded font-mono text-xs space-y-1.5">
                            <div className="flex items-center gap-2 text-rose-400 font-semibold text-[11px] uppercase tracking-wider">
                              <AlertCircle className="size-3.5" />
                              <span>Compiler Diagnostics</span>
                            </div>
                            <pre className="text-rose-300/90 whitespace-pre-wrap font-mono text-xs max-h-48 overflow-y-auto leading-relaxed">
                              {runResult.compile_output || runResult.stderr}
                            </pre>
                          </div>
                        )}

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
                                          curTc.passed
                                            ? "border-lime-400/30 text-lime-400"
                                            : "border-rose-500/30 text-rose-400"
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
                                  {curTc.compile_output && (
                                    <div>
                                      <span className="text-[10px] uppercase tracking-wider text-rose-400 font-semibold block mb-1">
                                        Compiler Output
                                      </span>
                                      <pre className="p-2 bg-rose-950/20 border border-rose-500/20 rounded text-xs text-rose-300 overflow-x-auto whitespace-pre-wrap">
                                        {curTc.compile_output}
                                      </pre>
                                    </div>
                                  )}
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
                            {runResult.compile_output && (
                              <div>
                                <span className="text-[10px] text-rose-400 uppercase tracking-wider font-mono">Compiler Output</span>
                                <pre className="p-2 bg-black border border-rose-500/20 rounded text-xs text-rose-300 overflow-x-auto whitespace-pre-wrap">
                                  {runResult.compile_output}
                                </pre>
                              </div>
                            )}
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

          {/* Action Footer in Strix AI Dark Theme */}
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
                {isDrawerCollapsed ? (
                  <ChevronUp className="size-3 text-zinc-500" />
                ) : (
                  <ChevronDown className="size-3 text-zinc-500" />
                )}
              </button>

              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                <span className={`size-1.5 rounded-full ${isContestOver ? "bg-red-500" : "bg-lime-400"}`} />
                <span>{isContestOver ? "Contest locked" : "Workstation online"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal (Editor Preferences & Keyboard Shortcuts) in Strix AI Theme */}
      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="border border-white/10 bg-zinc-950 text-white p-6 max-w-lg rounded-lg shadow-2xl">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
              <Settings className="size-4 text-lime-400" />
              <span>Contest Workspace Settings</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 font-mono">
              Personalize editor typography, formatting, and inspect keyboard bindings.
            </DialogDescription>
          </DialogHeader>

          {/* Settings Tabs */}
          <div className="flex items-center gap-1 border-b border-white/10 pb-2 pt-1 text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveSettingsTab("editor")}
              className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                activeSettingsTab === "editor"
                  ? "bg-zinc-900 text-white border border-lime-400/40 font-semibold"
                  : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              Code Editor
            </button>
            <button
              type="button"
              onClick={() => setActiveSettingsTab("shortcuts")}
              className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                activeSettingsTab === "shortcuts"
                  ? "bg-zinc-900 text-white border border-lime-400/40 font-semibold"
                  : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              Shortcuts
            </button>
            <button
              type="button"
              onClick={() => setActiveSettingsTab("timer")}
              className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                activeSettingsTab === "timer"
                  ? "bg-zinc-900 text-white border border-lime-400/40 font-semibold"
                  : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              Contest Clock
            </button>
          </div>

          <div className="py-3 text-xs font-mono">
            {activeSettingsTab === "editor" && (
              <div className="space-y-4">
                {/* Font Size */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-zinc-200 font-medium">Font Size</div>
                    <div className="text-[11px] text-zinc-500">Editor character scale</div>
                  </div>
                  <div className="flex items-center gap-1">
                    {[12, 13, 14, 15, 16].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          setEditorFontSize(size);
                          try {
                            localStorage.setItem("ccc_editor_font_size", String(size));
                          } catch {}
                        }}
                        className={`size-7 rounded font-mono text-xs transition-colors cursor-pointer border ${
                          editorFontSize === size
                            ? "bg-lime-400 text-black border-lime-400 font-bold"
                            : "bg-black text-zinc-400 border-white/10 hover:border-lime-400 hover:text-white"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Word Wrap */}
                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <div>
                    <div className="text-zinc-200 font-medium">Word Wrap</div>
                    <div className="text-[11px] text-zinc-500">Wrap long lines to fit editor viewport</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = editorWordWrap === "on" ? "off" : "on";
                      setEditorWordWrap(next);
                      try {
                        localStorage.setItem("ccc_editor_wordwrap", next);
                      } catch {}
                    }}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                      editorWordWrap === "on"
                        ? "bg-lime-400/20 text-lime-400 border border-lime-400/40 font-semibold"
                        : "bg-black text-zinc-500 border border-white/10"
                    }`}
                  >
                    {editorWordWrap === "on" ? "Enabled" : "Disabled"}
                  </button>
                </div>

                {/* Tab Size */}
                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <div>
                    <div className="text-zinc-200 font-medium">Tab Indentation</div>
                    <div className="text-[11px] text-zinc-500">Spaces per tab indentation level</div>
                  </div>
                  <div className="flex items-center gap-1">
                    {[2, 4].map((spaces) => (
                      <button
                        key={spaces}
                        type="button"
                        onClick={() => {
                          setEditorTabSize(spaces);
                          try {
                            localStorage.setItem("ccc_editor_tab_size", String(spaces));
                          } catch {}
                        }}
                        className={`px-3 py-1 rounded font-mono text-xs transition-colors cursor-pointer border ${
                          editorTabSize === spaces
                            ? "bg-lime-400 text-black border-lime-400 font-bold"
                            : "bg-black text-zinc-400 border-white/10 hover:border-lime-400 hover:text-white"
                        }`}
                      >
                        {spaces} Spaces
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSettingsTab === "shortcuts" && (
              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between p-2 rounded bg-black border border-white/8">
                  <span className="text-zinc-300">Run Code</span>
                  <kbd className="px-2 py-0.5 rounded bg-zinc-900 text-lime-400 border border-white/10 font-bold">⌘ ' / Ctrl + '</kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-black border border-white/8">
                  <span className="text-zinc-300">Submit Solution</span>
                  <kbd className="px-2 py-0.5 rounded bg-zinc-900 text-lime-400 border border-white/10 font-bold">⌘ ⏎ / Ctrl + Enter</kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-black border border-white/8">
                  <span className="text-zinc-300">Previous Question</span>
                  <kbd className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-white/10">⌥ ← / Alt + Left</kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-black border border-white/8">
                  <span className="text-zinc-300">Next Question</span>
                  <kbd className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-white/10">⌥ → / Alt + Right</kbd>
                </div>
              </div>
            )}

            {activeSettingsTab === "timer" && (
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 bg-black border border-white/8 rounded-md space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Contest Remaining:</span>
                    <span className="text-lime-400 font-semibold tabular-nums text-sm">
                      {formatTimer(remainingSeconds)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/5 pt-2">
                    <span className="text-zinc-400">Official Status:</span>
                    <span className="text-zinc-200">{arenaData?.status || "Live"}</span>
                  </div>
                </div>
                <p className="text-zinc-500 text-[11px] leading-relaxed font-sans">
                  The contest clock is synchronized to server time via WebSockets. Solutions submitted after the clock expires will not receive contest points.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              className="w-full rounded-md bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs font-bold cursor-pointer transition-colors"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Slide-out Problem List Drawer (Strix AI Theme: Pitch Black × Electric Lime) */}
      {isProblemListOpen && (
        <div
          role="presentation"
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity animate-in fade-in duration-150"
          onClick={() => setIsProblemListOpen(false)}
        />
      )}

      <aside
        aria-label="Contest Problem List and Standings"
        className={`fixed inset-y-0 left-0 z-50 w-full max-w-[420px] bg-black border-r border-white/10 shadow-2xl flex flex-col transition-transform duration-200 ease-out ${
          isProblemListOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
      >
        {/* Drawer Header: Title + Live Arena badge + ✕ Close */}
        <div className="h-12 px-4 border-b border-white/8 flex items-center justify-between shrink-0 bg-black">
          <div className="flex items-center gap-2 min-w-0">
            <ListOrdered className="size-4 text-lime-400 shrink-0" />
            <h2 className="font-semibold text-xs text-white truncate max-w-[220px]">
              {title}
            </h2>
            {arenaData?.status ? (
              <span className="border border-lime-400/30 bg-lime-400/10 text-lime-400 font-mono text-[9px] uppercase px-1.5 py-0.5 rounded font-semibold shrink-0">
                {arenaData.status} Arena
              </span>
            ) : null}
          </div>

          {/* Close Button (✕) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsProblemListOpen(false)}
            className="size-7 p-0 rounded-md border-white/10 bg-black text-zinc-400 hover:bg-lime-400 hover:text-black hover:border-lime-400 transition-colors cursor-pointer shrink-0"
            title="Close Problem List (Esc)"
          >
            <X className="size-3.5" />
          </Button>
        </div>

        {/* Drawer Subheader: Problem List vs Standings Tabs + Score Badge */}
        <div className="px-4 py-2.5 border-b border-white/8 flex items-center justify-between gap-2 shrink-0 bg-black">
          {/* Sub-tabs: Challenges vs Standings */}
          <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-md border border-white/10">
            <button
              type="button"
              onClick={() => setProblemListTab("problems")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded transition-all cursor-pointer ${
                problemListTab === "problems"
                  ? "bg-lime-400/10 text-lime-400 border border-lime-400/30 font-semibold shadow-[0_0_10px_rgba(204,255,0,0.15)]"
                  : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <ListOrdered className="size-3.5" />
              <span>Challenges</span>
            </button>
            <button
              type="button"
              onClick={() => setProblemListTab("ranking")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded transition-all cursor-pointer ${
                problemListTab === "ranking"
                  ? "bg-lime-400/10 text-lime-400 border border-lime-400/30 font-semibold shadow-[0_0_10px_rgba(204,255,0,0.15)]"
                  : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <BarChart2 className="size-3.5" />
              <span>Standings</span>
            </button>
          </div>

          {/* Points & Progress Pips */}
          <div className="flex items-center gap-2 font-mono">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-lime-400/10 border border-lime-400/30 text-lime-400 text-xs font-semibold tabular-nums">
              <Trophy className="size-3 text-lime-400" />
              <span>{totalEarnedPoints}&nbsp;PTS</span>
            </div>
            <div className="flex items-center gap-1">
              {problems.map((p) => {
                const isPsolved = solvedProblemIds.has(p.id);
                return (
                  <span
                    key={p.id}
                    className={`size-2 rounded-full transition-colors ${
                      isPsolved
                        ? "bg-lime-400 shadow-[0_0_6px_#a3e635]"
                        : "bg-zinc-800 border border-white/10"
                    }`}
                    title={`Q${p.problem_index}: ${p.title} (${isPsolved ? "Solved" : "Unsolved"})`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Drawer Body */}
        {problemListTab === "problems" ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {problems.map((prob, idx) => {
              const pSlug = slugifyProblem(prob.title, prob.problem_index);
              const isActive = idx === resolvedIndex;
              const isSolved = solvedProblemIds.has(prob.id);

              const diffUpper = (prob.difficulty || "EASY").toUpperCase();
              const isHard = diffUpper === "HARD";
              const isMed = diffUpper === "MEDIUM";
              const diffLabel = isHard ? "Hard" : isMed ? "Medium" : "Easy";

              return (
                <button
                  key={prob.id}
                  type="button"
                  onClick={() => {
                    navigate(`/contests/${contestSlug}/problems/${pSlug}`);
                    dispatch(clearArenaResults());
                    setIsProblemListOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-md border transition-all cursor-pointer flex items-center justify-between gap-3 group relative overflow-hidden ${
                    isActive
                      ? "bg-zinc-950 border-lime-400/60 shadow-[0_0_24px_rgba(204,255,0,0.12)] ring-1 ring-lime-400/30"
                      : "bg-black hover:bg-zinc-950 border-white/8 hover:border-white/16 text-zinc-300 hover:text-white"
                  }`}
                >
                  {/* Left accent bar for active challenge */}
                  {isActive && (
                    <div className="absolute left-0 inset-y-0 w-1 bg-lime-400 shadow-[0_0_10px_#a3e635]" />
                  )}

                  {/* Left: Indicator, Question Title */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pl-1">
                    {isSolved ? (
                      <CheckCircle2 className="size-4 text-lime-400 shrink-0" />
                    ) : isActive ? (
                      <span className="size-2 rounded-full bg-lime-400 shadow-[0_0_8px_#a3e635] shrink-0" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-zinc-700 group-hover:bg-zinc-400 transition-colors shrink-0" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-mono text-xs font-semibold ${
                            isActive ? "text-lime-400" : "text-zinc-500 group-hover:text-zinc-300"
                          }`}
                        >
                          Q{prob.problem_index}.
                        </span>
                        <span
                          className={`text-xs truncate ${
                            isActive
                              ? "text-white font-semibold"
                              : "text-zinc-300 group-hover:text-white font-medium"
                          }`}
                        >
                          {prob.title}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Difficulty & Points Pills */}
                  <div className="flex items-center gap-2 shrink-0 font-mono">
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${
                        isHard
                          ? "text-rose-400 bg-rose-500/10 border-rose-500/30"
                          : isMed
                          ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                          : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                      }`}
                    >
                      {diffLabel}
                    </span>

                    <span
                      className={`text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded border ${
                        isActive
                          ? "bg-lime-400/10 text-lime-400 border-lime-400/30"
                          : "bg-black text-zinc-400 border-white/8"
                      }`}
                    >
                      {prob.points}&nbsp;pt
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* Standings / Ranking Tab */
          <div className="flex-1 overflow-y-auto p-4 flex flex-col">
            <div className="flex items-center justify-between text-xs font-mono pb-3 border-b border-white/8">
              <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold">
                Live Tournament Standings
              </span>
              <span className="text-lime-400 font-semibold tabular-nums">
                {rankingData?.rows?.length || 0} {rankingData?.rows?.length === 1 ? "competitor" : "competitors"}
              </span>
            </div>

            <div className="flex-1 py-3 space-y-1.5 overflow-y-auto">
              {rankingData?.rows && rankingData.rows.length > 0 ? (
                rankingData.rows.slice(0, 20).map((row, idx) => (
                  <div
                    key={row.handle || idx}
                    className="p-2.5 rounded-md bg-zinc-950 border border-white/8 hover:border-white/16 flex items-center justify-between text-xs font-mono transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`size-5 rounded flex items-center justify-center font-bold tabular-nums text-[11px] ${
                          idx === 0
                            ? "bg-lime-400/15 text-lime-400 border border-lime-400/30"
                            : idx === 1
                            ? "bg-zinc-800 text-zinc-200 border border-white/10"
                            : idx === 2
                            ? "bg-zinc-900 text-zinc-400 border border-white/10"
                            : "text-zinc-500"
                        }`}
                      >
                        {row.rank || idx + 1}
                      </span>
                      <span className="truncate text-white font-medium max-w-[150px]">
                        {row.full_name || row.handle}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums shrink-0">
                      <span className="text-lime-400 font-semibold">{row.total_score} pts</span>
                      <span className="text-zinc-500 text-[11px]">{row.penalty_minutes || 0}m</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-16 text-center text-zinc-500 text-xs font-mono space-y-2">
                  <Trophy className="size-8 mx-auto text-zinc-700 stroke-1" />
                  <p className="text-zinc-400">Standings will update as competitors submit.</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-white/8 shrink-0">
              <Button
                asChild
                className="w-full h-9 rounded-md bg-transparent text-white border border-white/20 hover:bg-lime-400 hover:text-black hover:border-lime-400 font-mono text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                <Link
                  to={`/contests/${contestSlug}/results`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5"
                >
                  <BarChart2 className="size-3.5" />
                  <span>Open Full Live Standings ↗</span>
                </Link>
              </Button>
            </div>
          </div>
        )}
      </aside>

      {/* Exit Confirmation Dialog (HackerRank Flow) */}
      <Dialog open={showExitModal} onOpenChange={setShowExitModal}>
        <DialogContent className="border border-white/10 bg-zinc-950 text-white p-6 max-w-md rounded-lg sm:rounded-lg shadow-2xl">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-white tracking-tight font-sans">
                  Exit Coding Workspace?
                </DialogTitle>
                <p className="text-xs text-zinc-400 font-mono">
                  Review questions before final submission
                </p>
              </div>
            </div>
            <DialogDescription className="text-xs text-zinc-300 font-mono leading-relaxed pt-1">
              Your written code and test progress are automatically saved. Exiting will navigate you to the <strong className="text-white font-semibold">Contest Summary &amp; Submission Console</strong>, where you can inspect all attempted questions, check unattempted challenges, and officially submit your test.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-white/8 bg-black p-3.5 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Challenges Solved:</span>
              <span className="font-semibold text-lime-400">
                {solvedProblemIds.size} / {problems.length} Solved
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-white/6 pt-2">
              <span className="text-zinc-500">Time Remaining:</span>
              <span className="font-semibold text-zinc-300">
                {formatTimer(remainingSeconds)}
              </span>
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowExitModal(false)}
              className="rounded-md font-mono text-xs border-white/10 bg-black text-zinc-300 hover:bg-white/5 hover:text-white cursor-pointer"
            >
              Continue Solving
            </Button>
            <Button
              type="button"
              onClick={() => {
                setShowExitModal(false);
                navigate(`/contests/${contestSlug}/summary`);
              }}
              className="rounded-md font-mono text-xs font-semibold bg-lime-400 text-black hover:bg-lime-300 cursor-pointer"
            >
              <span>Proceed to Summary</span>
              <ArrowRight className="size-3.5 ml-1" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
