/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * Dedicated Air-Gapped Live Contest Arena (Round 2 Final)
 * Redesigned to Strix AI Paradigm (Pure Pitch Black × Electric Lime)
 */

import { Link, useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
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
  Eye,
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
  Sparkles,
  Lightbulb,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTab,
  TabsPanels,
  TabsPanel,
} from "@/components/animate-ui/components/base/tabs";
import { WanderingEyes } from "@/components/ui/WanderingEyes";
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
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchContestArenaThunk,
  fetchContestDetailThunk,
  fetchMyParticipationsThunk,
  runArenaCodeThunk,
  submitArenaCodeThunk,
  clearArenaResults,
} from "@/store/slices/contestSlice";
import { fetchCurrentUserThunk } from "@/store/slices/authSlice";
import { AssessmentStudioSkeleton } from "@/organization/components/skeletons";
import { useRealtimeEvents } from "@/lib/realtime";
import { slugifyProblem, resolveAvatarUrl, formatFullName, sanitizeCodeSnippet, formatTestcaseInput } from "@/lib/utils";
import { getToken } from "@/lib/auth";
import { useSwrData } from "@/lib/cache/swrCache";
import { contestApi } from "@/features/contest/api";
import { practiceApi } from "@/features/practice/api";
import type { PracticeProblemDetail, PracticeProblemListResponse } from "@/features/practice/types";
import type { AssessmentRanking, ContestArenaProblem, ArenaRunResult, ArenaSubmitResult } from "@/features/contest/types";
import {
  getProblemReviewUrl,
  getProblemSolveUrl,
  getContestOverviewUrl,
  getContestSummaryUrl,
  isContestConcluded,
} from "@/features/contest/navigation";

import { ProblemStatementView } from "@/components/problem/ProblemStatementView";
import {
  generateCanonicalStarterCodes,
  type FunctionSignatureContract,
} from "@/lib/problemFormatter";

const MonacoEditor = lazy(() => import("@/organization/components/MonacoEditor"));

function formatTimer(totalSeconds: number): string {
  if (totalSeconds <= 0) return "00:00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type ArenaLanguage = "python" | "cpp" | "c" | "java" | "javascript" | "typescript";

export const ARENA_LANGUAGES: { value: ArenaLanguage; label: string }[] = [
  { value: "python", label: "Python 3" },
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
];

export type UnifiedArenaProblem = {
  id: string;
  slug?: string | undefined;
  contest_id?: string | undefined;
  problem_index: string;
  title: string;
  topic?: string | undefined;
  points: number;
  difficulty: "EASY" | "MEDIUM" | "HARD" | string;
  description?: string | undefined;
  input_format?: string | undefined;
  output_format?: string | undefined;
  constraints?: string | undefined;
  time_limit?: number | undefined;
  memory_limit?: number | undefined;
  starter_code?: any;
  starter_codes?: Record<string, string> | undefined;
  sample_testcases?: Array<{
    stdin?: string | undefined;
    input?: string | undefined;
    expected_output?: string | undefined;
    output?: string | undefined;
    explanation?: string | undefined;
  }> | undefined;
  function_signature?: any;
  hints?: any;
  editorial?: any;
  tags?: any;
  user_status?: string | undefined;
  total_submissions?: number | undefined;
  acceptance_rate?: number | undefined;
};

function getFallbackStarter(
  lang: ArenaLanguage,
  title?: string,
  functionSignature?: FunctionSignatureContract | null,
  functionName?: string
): string {
  if (functionSignature && functionSignature.parameters && functionSignature.parameters.length > 0) {
    const starters = generateCanonicalStarterCodes(functionSignature);
    if (starters[lang]) return starters[lang];
  }

  const words = (functionName || title || "solve").match(/[a-zA-Z0-9]+/g) || ["solve"];
  let fnName =
    words[0].toLowerCase() +
    words
      .slice(1)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("");
  if (!/^[a-zA-Z_]/.test(fnName)) fnName = "solve" + fnName;

  const synthSig: FunctionSignatureContract = {
    name: fnName,
    parameters: [{ name: "nums", type: "integer[]" }],
    return_type: "integer[]",
  };
  const starters = generateCanonicalStarterCodes(synthSig);
  return starters[lang] || "";
}

export interface ContestArenaPageProps {
  mode?: "live" | "review" | "practice";
}

export function ContestArenaPage({ mode }: ContestArenaPageProps = {}) {
  const location = useLocation();
  const isPracticeMode = mode === "practice" || location.pathname.startsWith("/practice");
  const { contestSlug = "", problemSlug = "", slug = "" } = useParams<{
    contestSlug?: string;
    problemSlug?: string;
    slug?: string;
  }>();
  const effectiveProblemSlug = isPracticeMode ? (slug || problemSlug || "") : (problemSlug || "");
  const [searchParams] = useSearchParams();
  const problemParam = searchParams.get("problem");
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const {
    arenaData,
    runResult,
    submitResult,
    isRunningCode,
    isSubmittingCode,
    isLoadingArena,
    error,
    registration,
    myParticipations,
  } = useAppSelector((state) => state.contest);
  const member = useAppSelector((state) => state.auth.member);

  // Practice Mode queries
  const {
    data: practiceProblemData,
    loading: isPracticeLoading,
    revalidate: revalidatePracticeProblem,
  } = useSwrData<PracticeProblemDetail>(
    isPracticeMode && effectiveProblemSlug
      ? `practice:problem:${effectiveProblemSlug.toLowerCase()}`
      : null,
    () => practiceApi.getProblem(effectiveProblemSlug),
    { ttl: 5 * 60 * 1000, staleTime: 30 * 1000, enabled: Boolean(isPracticeMode && effectiveProblemSlug) }
  );

  const { data: practiceCatalogData } = useSwrData<PracticeProblemListResponse>(
    isPracticeMode ? "practice:catalog:all" : null,
    () => practiceApi.listProblems({ limit: 100 }),
    { ttl: 5 * 60 * 1000, staleTime: 60 * 1000, enabled: Boolean(isPracticeMode) }
  );

  const participation = !isPracticeMode ? myParticipations.find((p) => p.contest_slug === contestSlug) : undefined;

  const isAlreadySubmitted = Boolean(
    !isPracticeMode &&
    !member?.is_core_member &&
    (registration?.status === "submitted" ||
      registration?.status === "completed" ||
      arenaData?.is_submitted)
  );

  const isConcluded = !isPracticeMode && isContestConcluded(arenaData);
  const isReviewRoute = !isPracticeMode && (mode === "review" || location.pathname.includes("/review"));
  const isReviewMode = !isPracticeMode && (isReviewRoute || isConcluded || isAlreadySubmitted);

  useEffect(() => {
    if (!member && getToken()) {
      dispatch(fetchCurrentUserThunk());
    }
  }, [member, dispatch]);

  const resolvedAvatar = resolveAvatarUrl(member?.avatar_url);
  const displayName =
    formatFullName(member?.full_name) ||
    member?.handle ||
    member?.email?.split("@")[0] ||
    "Competitor";
  const userInitial = member?.full_name?.trim()
    ? member.full_name.trim().charAt(0).toUpperCase()
    : member?.handle?.trim()
      ? member.handle.trim().charAt(0).toUpperCase()
      : member?.email?.trim()
        ? member.email.trim().charAt(0).toUpperCase()
        : "U";

  useEffect(() => {
    if (!isPracticeMode && contestSlug) {
      dispatch(fetchContestArenaThunk(contestSlug));
      dispatch(fetchContestDetailThunk(contestSlug));
      dispatch(fetchMyParticipationsThunk(false));
    }
    return () => {
      dispatch(clearArenaResults());
    };
  }, [isPracticeMode, contestSlug, dispatch]);

  const practiceProblems = useMemo<UnifiedArenaProblem[]>(() => {
    if (!practiceCatalogData?.items || practiceCatalogData.items.length === 0) {
      if (practiceProblemData) {
        const parsedNum = Number.parseInt(practiceProblemData.problem_index || "", 10);
        const integerIndex = !Number.isNaN(parsedNum) && parsedNum > 0 ? String(parsedNum) : "1";
        return [
          {
            id: practiceProblemData.id,
            slug: practiceProblemData.slug,
            title: practiceProblemData.title,
            problem_index: integerIndex,
            points: 100,
            difficulty: practiceProblemData.difficulty,
            topic: practiceProblemData.topic,
            user_status: practiceProblemData.user_status,
            total_submissions: practiceProblemData.total_submissions || 0,
            acceptance_rate: practiceProblemData.acceptance_rate || 0,
            description: practiceProblemData.description,
            constraints: practiceProblemData.constraints,
            time_limit: practiceProblemData.time_limit,
            memory_limit: practiceProblemData.memory_limit,
            sample_testcases: (practiceProblemData.sample_testcases || practiceProblemData.samples || []) as any,
            starter_codes: practiceProblemData.starter_code as any,
            function_signature: practiceProblemData.function_signature,
            hints: practiceProblemData.hints,
            editorial: practiceProblemData.editorial,
            tags: practiceProblemData.tags,
          },
        ];
      }
      return [];
    }
    return practiceCatalogData.items.map((p, idx) => {
      const parsedNum = Number.parseInt(p.problem_index || "", 10);
      const integerIndex = !Number.isNaN(parsedNum) && parsedNum > 0 ? String(parsedNum) : String(idx + 1);
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        problem_index: integerIndex,
        points: 100,
        difficulty: p.difficulty,
        topic: p.topic,
        user_status: p.user_status || (p as any).solved_status,
        total_submissions: p.total_submissions || 0,
        acceptance_rate: p.acceptance_rate || 0,
      };
    });
  }, [practiceCatalogData, practiceProblemData]);

  const problems: UnifiedArenaProblem[] = isPracticeMode ? practiceProblems : ((arenaData?.problems as any) || []);

  // LeetCode-style URL problem resolution
  const activeIndex = problems.findIndex((p) => {
    if (isPracticeMode) {
      if (!effectiveProblemSlug) return false;
      const clean = effectiveProblemSlug.toLowerCase();
      return (
        (p.slug && p.slug.toLowerCase() === clean) ||
        p.id.toLowerCase() === clean ||
        (p.problem_index && p.problem_index.toLowerCase() === clean) ||
        slugifyProblem(p.title, p.problem_index) === clean
      );
    }
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

  const activeProblem = useMemo<UnifiedArenaProblem | null>(() => {
    if (isPracticeMode) {
      if (!practiceProblemData) return null;
      const samples = (
        practiceProblemData.sample_testcases ||
        practiceProblemData.samples ||
        []
      ).map((tc: any) => ({
        stdin: tc.input || tc.stdin || "",
        input: tc.input || tc.stdin || "",
        expected_output: tc.expected_output || tc.output || "",
        output: tc.expected_output || tc.output || "",
        explanation: tc.explanation,
      }));
      return {
        id: practiceProblemData.id,
        slug: practiceProblemData.slug,
        title: practiceProblemData.title,
        problem_index: (() => {
          const parsedPracticeNum = Number.parseInt(practiceProblemData.problem_index || "", 10);
          if (!Number.isNaN(parsedPracticeNum) && parsedPracticeNum > 0) return String(parsedPracticeNum);
          return problems[resolvedIndex]?.problem_index || String(resolvedIndex + 1);
        })(),
        difficulty: practiceProblemData.difficulty,
        topic: practiceProblemData.topic,
        points: 100,
        description: practiceProblemData.description,
        constraints: practiceProblemData.constraints,
        time_limit: practiceProblemData.time_limit,
        memory_limit: practiceProblemData.memory_limit,
        sample_testcases: samples,
        starter_code: practiceProblemData.starter_code,
        starter_codes: practiceProblemData.starter_code,
        function_signature: practiceProblemData.function_signature,
        hints: practiceProblemData.hints,
        editorial: practiceProblemData.editorial,
        tags: practiceProblemData.tags,
        user_status: practiceProblemData.user_status,
      };
    }
    return problems[resolvedIndex] || problems[0] || null;
  }, [isPracticeMode, practiceProblemData, problems, resolvedIndex]);

  // Auto-redirect to first problem's slug if URL is generic /arena or /problems or /review
  useEffect(() => {
    if (!isPracticeMode && problems.length > 0 && !problemSlug && contestSlug) {
      const firstProblem = problems[0];
      if (firstProblem) {
        const targetUrl = isReviewRoute
          ? getProblemReviewUrl(contestSlug, firstProblem.title, firstProblem.problem_index)
          : getProblemSolveUrl(contestSlug, firstProblem.title, firstProblem.problem_index);
        navigate(targetUrl, { replace: true });
      }
    }
  }, [problems, problemSlug, contestSlug, navigate, isReviewRoute, isPracticeMode]);

  const [selectedLanguage, setSelectedLanguage] = useState<ArenaLanguage>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ccc_preferred_language") as ArenaLanguage | null;
      if (saved && ARENA_LANGUAGES.some((l) => l.value === saved)) {
        return saved;
      }
    }
    return "python";
  });

  const handleSelectLanguage = (lang: ArenaLanguage) => {
    setSelectedLanguage(lang);
    try {
      localStorage.setItem("ccc_preferred_language", lang);
    } catch {}
  };

  const [codeMap, setCodeMap] = useState<Record<string, string>>({});
  const [customStdin, setCustomStdin] = useState("");
  const [activeConsoleTab, setActiveConsoleTab] = useState<"testcases" | "output">("testcases");
  const [activeTestcaseIndex, setActiveTestcaseIndex] = useState(0);
  const [activeRunCaseIndex, setActiveRunCaseIndex] = useState(0);
  const [activeSubmitCaseIndex, setActiveSubmitCaseIndex] = useState(0);
  const [lastAction, setLastAction] = useState<"run" | "submit" | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(() => {
    return typeof document !== "undefined" ? Boolean(document.fullscreenElement) : false;
  });
  const [showExitModal, setShowExitModal] = useState(false);
  const memberId = member?.id || "anon";

  // Practice execution states
  const [practiceRunResult, setPracticeRunResult] = useState<ArenaRunResult | null>(null);
  const [practiceSubmitResult, setPracticeSubmitResult] = useState<ArenaSubmitResult | null>(null);
  const [isPracticeRunning, setIsPracticeRunning] = useState(false);
  const [isPracticeSubmitting, setIsPracticeSubmitting] = useState(false);

  const effectiveRunResult: ArenaRunResult | null = isPracticeMode ? practiceRunResult : runResult;
  const effectiveSubmitResult: ArenaSubmitResult | null = isPracticeMode ? practiceSubmitResult : submitResult;
  const effectiveIsRunning = isPracticeMode ? isPracticeRunning : isRunningCode;
  const effectiveIsSubmitting = isPracticeMode ? isPracticeSubmitting : isSubmittingCode;

  const [solvedProblemIds, setSolvedProblemIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`ccc_solved_${member?.id || "anon"}_${contestSlug}`) ||
                    localStorage.getItem(`ccc_solved_${contestSlug}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [attemptedProblemIds, setAttemptedProblemIds] = useState<Set<string>>(() => new Set<string>());

  useEffect(() => {
    if (isPracticeMode) {
      const solved = new Set<string>();
      const attempted = new Set<string>();
      if (practiceCatalogData?.items) {
        practiceCatalogData.items.forEach((p) => {
          const st = p.user_status || (p as any).solved_status;
          if (st === "SOLVED") solved.add(p.id);
          else if (st === "ATTEMPTED") attempted.add(p.id);
        });
      }
      const activeSt = practiceProblemData?.user_status || (practiceProblemData as any)?.solved_status;
      if (practiceProblemData?.id) {
        if (activeSt === "SOLVED") {
          solved.add(practiceProblemData.id);
          attempted.delete(practiceProblemData.id);
        } else if (activeSt === "ATTEMPTED" && !solved.has(practiceProblemData.id)) {
          attempted.add(practiceProblemData.id);
        }
      }
      setSolvedProblemIds(solved);
      setAttemptedProblemIds(attempted);
    }
  }, [isPracticeMode, practiceCatalogData, practiceProblemData]);

  const [activeProblemTab, setActiveProblemTab] = useState<"description" | "submissions">(
    "description",
  );
  const [isProblemListOpen, setIsProblemListOpen] = useState(false);
  const [problemListTab, setProblemListTab] = useState<"problems" | "ranking">("problems");
  const [catalogSearchQuery, setCatalogSearchQuery] = useState("");

  const filteredDrawerProblems = useMemo(() => {
    if (!catalogSearchQuery.trim()) return problems;
    const q = catalogSearchQuery.toLowerCase().trim();
    return problems.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        String(p.problem_index || "").toLowerCase().includes(q) ||
        (p.topic && p.topic.toLowerCase().includes(q)),
    );
  }, [problems, catalogSearchQuery]);

  const { data: rankingData } = useSwrData<AssessmentRanking>(
    !isPracticeMode && contestSlug ? `contest:ranking:${contestSlug}` : null,
    () => contestApi.ranking(contestSlug),
    { ttl: 30 * 1000, enabled: !isPracticeMode && Boolean(contestSlug) },
  );

  const totalEarnedPoints = problems.reduce(
    (acc, p) => (solvedProblemIds.has(p.id) ? acc + (p.points || 0) : acc),
    0,
  );

  const isCurrentSolved = activeProblem
    ? (solvedProblemIds.has(activeProblem.id) || activeProblem.user_status === "SOLVED")
    : false;
  const isCurrentAttempted = activeProblem
    ? (!isCurrentSolved && (attemptedProblemIds.has(activeProblem.id) || activeProblem.user_status === "ATTEMPTED"))
    : false;
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"editor" | "shortcuts" | "timer">(
    "editor",
  );
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
        const saved = localStorage.getItem(`ccc_submissions_${memberId}_${contestSlug}_${activeProblem.id}`) ||
                      localStorage.getItem(`ccc_submissions_${contestSlug}_${activeProblem.id}`);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    if (isPracticeMode) {
      if (!effectiveProblemSlug) return;
      let cancelled = false;
      practiceApi
        .getSubmissions(effectiveProblemSlug)
        .then((records) => {
          if (cancelled || !Array.isArray(records)) return;
          const normalized = records.map((r) => ({
            id: r.id,
            problem_id: effectiveProblemSlug,
            verdict: r.verdict,
            time: r.runtime !== null ? r.runtime / 1000 : null,
            memory: r.memory,
            language: r.language,
            timestamp: new Date(r.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            passed_testcases: r.score > 0 ? 1 : 0,
            total_testcases: 1,
          }));
          setSubmissionHistory(normalized);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }

    if (!activeProblem?.id || !contestSlug) return;
    let cancelled = false;

    try {
      const saved = localStorage.getItem(`ccc_submissions_${memberId}_${contestSlug}_${activeProblem.id}`) ||
                    localStorage.getItem(`ccc_submissions_${contestSlug}_${activeProblem.id}`);
      if (saved) setSubmissionHistory(JSON.parse(saved));
    } catch {
      setSubmissionHistory([]);
    }

    contestApi
      .problemSubmissions(contestSlug, activeProblem.id)
      .then((serverSubs) => {
        if (cancelled || !Array.isArray(serverSubs) || serverSubs.length === 0) return;
        setSubmissionHistory(serverSubs);
        try {
          localStorage.setItem(
            `ccc_submissions_${memberId}_${contestSlug}_${activeProblem.id}`,
            JSON.stringify(serverSubs.slice(0, 20)),
          );
        } catch {}
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isPracticeMode, effectiveProblemSlug, activeProblem?.id, contestSlug, memberId]);

  const handlePrevProblem = useCallback(() => {
    if (resolvedIndex > 0) {
      const prev = problems[resolvedIndex - 1];
      if (prev) {
        if (isPracticeMode) {
          navigate(`/practice/${(prev as any).slug || prev.id}`);
        } else {
          const target = isReviewMode
            ? getProblemReviewUrl(contestSlug, prev.title, prev.problem_index)
            : getProblemSolveUrl(contestSlug, prev.title, prev.problem_index);
          navigate(target);
        }
      }
    }
  }, [resolvedIndex, problems, contestSlug, navigate, isReviewMode, isPracticeMode]);

  const handleNextProblem = useCallback(() => {
    if (resolvedIndex < problems.length - 1) {
      const next = problems[resolvedIndex + 1];
      if (next) {
        if (isPracticeMode) {
          navigate(`/practice/${(next as any).slug || next.id}`);
        } else {
          const target = isReviewMode
            ? getProblemReviewUrl(contestSlug, next.title, next.problem_index)
            : getProblemSolveUrl(contestSlug, next.title, next.problem_index);
          navigate(target);
        }
      }
    }
  }, [resolvedIndex, problems, contestSlug, navigate, isReviewMode, isPracticeMode]);

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
  useRealtimeEvents(isPracticeMode ? "" : contestSlug, (event) => {
    if (isPracticeMode) return;
    const evSlug = event.contest_slug || event.data?.contest_slug;
    if (evSlug && evSlug !== contestSlug) return;

    if (event.event === "arena_timer_reset" && event.data?.remaining_seconds !== undefined) {
      setRemainingSeconds(event.data.remaining_seconds);
      toast.info("Contest clock synchronized by Chief Proctor.");
    } else if (
      event.event === "contest_concluded" ||
      event.event === "contest_finished" ||
      (event.event === "contest_status_changed" &&
        (event.data?.new_status === "finished" || event.data?.status === "finished"))
    ) {
      if (!evSlug || evSlug !== contestSlug) return;
      setRemainingSeconds(0);
      toast.warning("Contest concluded by Chief Proctor.");
    }
  });

  useEffect(() => {
    if (isPracticeMode) return;
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isPracticeMode]);

  // Contest over: lock arena and navigate to summary console for review (ONLY when in live contest mode)
  useEffect(() => {
    if (isPracticeMode || isReviewMode) return; // In practice or review mode, NEVER kick candidate out to summary!
    if (remainingSeconds > 0 || isContestOver) return;
    setIsContestOver(true);
    let count = 5;
    const tick = setInterval(() => {
      count -= 1;
      setRedirectCountdown(count);
      if (count <= 0) {
        clearInterval(tick);
        navigate(getContestSummaryUrl(contestSlug));
      }
    }, 1000);
    contestOverRedirectRef.current = tick;
    return () => clearInterval(tick);
  }, [remainingSeconds, isContestOver, contestSlug, navigate, isReviewMode, isPracticeMode]);

  const problemKey = `${activeProblem?.id || effectiveProblemSlug || "p"}_${selectedLanguage}`;
  const problemStorageKey = isPracticeMode
    ? (activeProblem?.id ? `ccc_practice_code_${memberId}_${activeProblem.id}_${selectedLanguage}` : "")
    : (activeProblem ? `ccc_code_v4_${memberId}_${contestSlug}_${activeProblem.id}_${selectedLanguage}` : "");

  // Load durable code: state -> validated localStorage -> official problem starter_code
  const getInitialCode = (): string => {
    if (codeMap[problemKey]) {
      const code = sanitizeCodeSnippet(codeMap[problemKey]);
      const isLegacy =
        code.includes("def main():") ||
        code.includes("sys.stdin.read()") ||
        code.includes("TODO: Calculate valid mirror pairs") ||
        code.includes("def solve(") ||
        code.includes("int solve(") ||
        code.includes("var solve =") ||
        code.includes("function solve(");
      if (!isLegacy) {
        return code;
      }
    }
    if (problemStorageKey && typeof window !== "undefined") {
      try {
        // Clean up legacy unversioned keys if any
        if (activeProblem?.id && !isPracticeMode) {
          localStorage.removeItem(
            `ccc_code_${contestSlug}_${activeProblem.id}_${selectedLanguage}`,
          );
          localStorage.removeItem(
            `ccc_code_v2_${contestSlug}_${activeProblem.id}_${selectedLanguage}`,
          );
          localStorage.removeItem(
            `ccc_code_v3_${contestSlug}_${activeProblem.id}_${selectedLanguage}`,
          );
        }
        const saved = localStorage.getItem(problemStorageKey);
        if (saved) {
          const sanitizedSaved = sanitizeCodeSnippet(saved);
          // If saved code contains old competitive programming script or generic placeholder, purge it
          const isLegacy =
            sanitizedSaved.includes("def main():") ||
            sanitizedSaved.includes("sys.stdin.read()") ||
            sanitizedSaved.includes("TODO: Calculate valid mirror pairs") ||
            sanitizedSaved.includes("def solve(") ||
            sanitizedSaved.includes("int solve(") ||
            sanitizedSaved.includes("var solve =") ||
            sanitizedSaved.includes("function solve(");
          if (isLegacy) {
            localStorage.removeItem(problemStorageKey);
          } else {
            return sanitizedSaved;
          }
        }
      } catch {}
    }

    const starter =
      activeProblem?.starter_codes?.[selectedLanguage] ??
      (activeProblem as any)?.starter_code?.[selectedLanguage] ??
      getFallbackStarter(
        selectedLanguage,
        activeProblem?.title,
        (activeProblem as any)?.function_signature,
        (activeProblem as any)?.function_name
      );
    return sanitizeCodeSnippet(starter);
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
    const rawStarter =
      activeProblem?.starter_codes?.[selectedLanguage] ||
      (activeProblem as any)?.starter_code?.[selectedLanguage] ||
      getFallbackStarter(selectedLanguage, activeProblem?.title);
    const defaultStarter = sanitizeCodeSnippet(rawStarter);
    setCodeMap((prev) => ({ ...prev, [problemKey]: defaultStarter }));
    if (typeof window !== "undefined") {
      try {
        if (problemStorageKey) localStorage.removeItem(problemStorageKey);
        if (activeProblem?.id && !isPracticeMode) {
          localStorage.removeItem(
            `ccc_code_${contestSlug}_${activeProblem.id}_${selectedLanguage}`,
          );
          localStorage.removeItem(
            `ccc_code_v2_${contestSlug}_${activeProblem.id}_${selectedLanguage}`,
          );
          localStorage.removeItem(
            `ccc_code_v3_${contestSlug}_${activeProblem.id}_${selectedLanguage}`,
          );
          localStorage.removeItem(
            `ccc_code_v4_${contestSlug}_${activeProblem.id}_${selectedLanguage}`,
          );
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
    if (isPracticeMode) {
      if (!effectiveProblemSlug || effectiveIsRunning || effectiveIsSubmitting) return;
      setIsPracticeRunning(true);
      setHasRunCode(true);
      setIsDrawerCollapsed(false);
      setActiveConsoleTab("output");
      setLastAction("run");
      setActiveRunCaseIndex(0);
      try {
        const res = await practiceApi.runCode(effectiveProblemSlug, currentCode, selectedLanguage);
        const normalizedRunResult = {
          success: res.verdict === "ACCEPTED",
          verdict: res.verdict,
          time: (res.runtime_ms || 0) / 1000,
          passed_testcases: res.testcases?.filter((t) => t.passed).length ?? (res.verdict === "ACCEPTED" ? res.testcases?.length : 0),
          total_testcases: res.testcases?.length || 0,
          compile_output: res.compile_error || (res as any).compile_output,
          stdout: (res as any).stdout,
          stderr: (res as any).stderr,
          testcase_results: res.testcases?.map((tc: any, idx: number) => ({
            testcase_id: tc.testcase_id || `sample_${idx + 1}`,
            name: tc.name || `Case ${idx + 1}`,
            status: tc.status || tc.verdict,
            verdict: tc.verdict || tc.status,
            passed: tc.passed,
            input: tc.input || tc.stdin || "",
            stdin: tc.stdin || tc.input || "",
            expected_output: tc.expected_output || "",
            actual_output: tc.actual_output || tc.stdout || "",
            stdout: tc.stdout || tc.actual_output || "",
            stderr: tc.stderr || tc.error || "",
            error: tc.error || tc.stderr,
            compile_output: tc.compile_output || tc.compile_error || "",
            runtime_ms: tc.runtime_ms || 0,
            wall_time_ms: tc.wall_time_ms || tc.runtime_ms || 0,
          })),
        };
        setPracticeRunResult(normalizedRunResult as any);
        if (res.verdict === "ACCEPTED") {
          toast.success("Sample testcases passed!");
        } else {
          if (activeProblem?.id && !solvedProblemIds.has(activeProblem.id)) {
            setAttemptedProblemIds((prev) => new Set([...prev, activeProblem.id]));
          }
          toast.error(`Execution: ${res.verdict}`);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to execute code");
      } finally {
        setIsPracticeRunning(false);
      }
      return;
    }

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
      }),
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
    isPracticeMode,
    effectiveProblemSlug,
    effectiveIsRunning,
    effectiveIsSubmitting,
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
    if (isReviewMode) {
      toast.error("Contest submissions are locked in Review mode.");
      return;
    }
    if (isPracticeMode) {
      if (!effectiveProblemSlug || effectiveIsRunning || effectiveIsSubmitting) return;
      setIsPracticeSubmitting(true);
      setHasRunCode(true);
      setIsDrawerCollapsed(false);
      setActiveConsoleTab("output");
      setLastAction("submit");
      setActiveSubmitCaseIndex(0);
      try {
        const res = await practiceApi.submitCode(effectiveProblemSlug, currentCode, selectedLanguage);
        const submitTcResults = ((res as any).testcase_results || (res as any).testcases)?.map((tc: any, idx: number) => ({
          testcase_id: tc.testcase_id || `TC-${idx + 1}`,
          name: tc.name || `Case ${idx + 1}`,
          passed: tc.passed,
          status: tc.status || tc.verdict,
          verdict: tc.verdict || tc.status,
          is_hidden: tc.is_hidden,
          input: tc.input || tc.stdin || "",
          stdin: tc.stdin || tc.input || "",
          expected_output: tc.expected_output || "",
          actual_output: tc.actual_output || tc.stdout || "",
          stdout: tc.stdout || tc.actual_output || "",
          stderr: tc.stderr || tc.error || "",
          error: tc.error || tc.stderr || "",
          compile_output: tc.compile_output || "",
          wall_time_ms: tc.wall_time_ms || tc.runtime_ms || 0,
        })) || (res.first_failing_case ? [
          {
            testcase_id: res.first_failing_case.testcase_id || "TC-1",
            name: "Failing Testcase",
            status: res.verdict,
            verdict: res.verdict,
            passed: false,
            is_hidden: false,
            input: res.first_failing_case.input || "",
            stdin: res.first_failing_case.input || "",
            expected_output: res.first_failing_case.expected_output || "",
            actual_output: res.first_failing_case.actual_output || "",
            stdout: res.first_failing_case.actual_output || "",
            stderr: res.first_failing_case.error || "",
            error: res.first_failing_case.error,
            compile_output: "",
            wall_time_ms: 0,
          }
        ] : undefined);

        const normalizedSubmitResult = {
          submission_id: res.submission_id,
          success: res.verdict === "ACCEPTED",
          verdict: res.verdict,
          execution_time: (res.runtime || (res as any).execution_time || 0) / 1000,
          time: (res.runtime || (res as any).execution_time || 0) / 1000,
          memory: res.memory,
          passed_testcases: res.passed_count ?? (res as any).passed_testcases ?? 0,
          total_testcases: res.total_testcases ?? (res as any).total_count ?? 0,
          points_awarded: res.verdict === "ACCEPTED" ? (res.score || 100) : 0,
          compile_output: res.compile_error || (res as any).compile_output,
          message: (res as any).message || (res.verdict === "ACCEPTED" ? "Accepted! Problem solved successfully." : `Verdict: ${res.verdict}`),
          testcase_results: submitTcResults,
        };
        setPracticeSubmitResult(normalizedSubmitResult as any);

        const newRecord = {
          id: res.submission_id || String(Date.now()),
          problem_id: activeProblem?.id || effectiveProblemSlug,
          verdict: res.verdict,
          time: (res.runtime || 0) / 1000,
          memory: res.memory,
          language: selectedLanguage,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          passed_testcases: res.passed_count,
          total_testcases: res.total_testcases,
        };
        setSubmissionHistory((prev) => [newRecord, ...prev]);

        if (res.verdict === "ACCEPTED") {
          if (activeProblem?.id) {
            setSolvedProblemIds((prev) => new Set([...prev, activeProblem.id]));
            setAttemptedProblemIds((prev) => {
              const next = new Set(prev);
              next.delete(activeProblem.id);
              return next;
            });
          }
          toast.success("Accepted! Problem solved successfully.");
          if (revalidatePracticeProblem) {
            void revalidatePracticeProblem();
          }
        } else {
          if (activeProblem?.id) {
            setAttemptedProblemIds((prev) => {
              if (solvedProblemIds.has(activeProblem.id)) return prev;
              return new Set([...prev, activeProblem.id]);
            });
          }
          toast.error(`Verdict: ${res.verdict} (${res.passed_count}/${res.total_testcases} passed)`);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to submit code to judge");
      } finally {
        setIsPracticeSubmitting(false);
      }
      return;
    }

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
      }),
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
            `ccc_submissions_${memberId}_${contestSlug}_${activeProblem.id}`,
            JSON.stringify(updated.slice(0, 20)),
          );
        } catch {}
        return updated;
      });

      if (res.verdict === "ACCEPTED") {
        setSolvedProblemIds((prev) => {
          const next = new Set([...prev, activeProblem.id]);
          try {
            localStorage.setItem(`ccc_solved_${memberId}_${contestSlug}`, JSON.stringify(Array.from(next)));
          } catch {}
          return next;
        });
        toast.success(
          isPracticeMode
            ? "Problem Solved! Accepted"
            : `Problem ${activeProblem.problem_index} Solved! +${res.points_awarded} pts`,
        );
      } else {
        toast.error(
          `Verdict: ${res.verdict} (${res.passed_testcases}/${res.total_testcases} passed)`,
        );
      }
    } else {
      toast.error(String(result.payload || "Submission failed"));
    }
  }, [
    isReviewMode,
    isPracticeMode,
    effectiveProblemSlug,
    effectiveIsRunning,
    effectiveIsSubmitting,
    activeProblem,
    isRunningCode,
    isSubmittingCode,
    isContestOver,
    dispatch,
    contestSlug,
    selectedLanguage,
    currentCode,
    memberId,
    revalidatePracticeProblem,
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
        if (!isReviewMode) {
          void handleSubmitCode();
        }
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

  // Sync fullscreen state with native DOM fullscreenchange (e.g. Esc press, F11, etc.)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        void document.exitFullscreen().catch(() => {});
      }
    }
  };

  if (isPracticeMode) {
    if (isPracticeLoading && !practiceProblemData) {
      return <AssessmentStudioSkeleton />;
    }
    if (!practiceProblemData) {
      return (
        <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-[#171717] p-4 text-white font-sans">
          <div className="w-full max-w-md space-y-6 rounded-[24px] border border-red-500/30 bg-[#1F1F1F] p-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-[12px] border border-red-500/30 bg-red-500/10 text-red-400">
              <AlertTriangle className="size-7" />
            </div>

            <div className="space-y-2">
              <span className="font-heading font-bold text-xs uppercase tracking-widest text-red-400">
                404 Not Found
              </span>
              <h1 className="font-display text-2xl uppercase tracking-wide text-white">Problem Not Found</h1>
              <p className="text-sm text-zinc-400 font-sans leading-relaxed">
                We could not find a practice problem matching &quot;{effectiveProblemSlug}&quot;.
              </p>
            </div>

            <div className="pt-2">
              <Button asChild className="w-full">
                <Link to="/practice">
                  <ArrowLeft className="size-3.5 mr-1.5" />
                  <span>Return to Practice Catalog</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      );
    }
  } else {
    if (isLoadingArena || (!arenaData && !error)) {
      return <AssessmentStudioSkeleton />;
    }
  }

  if (!isPracticeMode && !arenaData) {
    const errLower = (error || "").toLowerCase();
    const isSubmitted =
      !member?.is_core_member &&
      (isAlreadySubmitted ||
        errLower.includes("already been submitted") ||
        errLower.includes("already submitted") ||
        errLower.includes("retake") ||
        errLower.includes("attempt concluded"));

    if (isSubmitted) {
      return (
        <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-[#171717] p-4 text-white font-sans">
          <div className="w-full max-w-lg space-y-6 rounded-[24px] border border-[#B1FA63]/30 bg-[#1F1F1F] p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#B1FA63] via-emerald-400 to-[#B1FA63]" />
            <div className="mx-auto flex size-14 items-center justify-center rounded-[12px] border border-[#B1FA63]/30 bg-[#B1FA63]/10 text-[#B1FA63]">
              <CheckCircle2 className="size-7" />
            </div>

            <div className="space-y-2">
              <span className="font-heading font-bold text-xs uppercase tracking-widest text-[#B1FA63]">
                Contest Attempt Concluded · Final Record
              </span>
              <h1 className="font-display text-2xl uppercase tracking-wide text-white">
                Contest Already Submitted
              </h1>
              <p className="text-sm text-zinc-400 font-sans leading-relaxed">
                You have officially finalized and submitted your contest attempt. In accordance with
                the fair competition protocol, retakes and further code executions are strictly
                prohibited.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <Button asChild variant="default" className="w-full">
                <Link to={`/contests/${contestSlug}/results`}>
                  <Trophy className="size-3.5 mr-1.5" />
                  <span>View Official Standings</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to={`/contests/${contestSlug}/summary`}>
                  <FileText className="size-3.5 mr-1.5" />
                  <span>Review Submission Summary</span>
                </Link>
              </Button>
            </div>

            <div className="pt-1">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-zinc-500 hover:text-zinc-300"
              >
                <Link to={`/contests/${contestSlug}`}>
                  <ArrowLeft className="size-3.5 mr-1.5" />
                  <span>Back to Contest Overview</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      );
    }

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

    const isNotFound = errLower.includes("not found") || errLower.includes("404");

    const isProctorGate =
      errLower.includes("physical gate") ||
      errLower.includes("proctor scan") ||
      errLower.includes("campus pass") ||
      errLower.includes("restricted") ||
      errLower.includes("registration");

    if (isUnauthenticated) {
      return (
        <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-[#171717] p-4 text-white font-sans">
          <div className="w-full max-w-md space-y-6 rounded-[24px] border border-white/10 bg-[#1F1F1F] p-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-[12px] border border-[#B1FA63]/30 bg-[#B1FA63]/10 text-[#B1FA63]">
              <Lock className="size-7" />
            </div>

            <div className="space-y-2">
              <span className="font-heading font-bold text-xs uppercase tracking-widest text-[#B1FA63]">
                Contest Authentication Required
              </span>
              <h1 className="font-display text-2xl uppercase tracking-wide text-white">
                Sign In to Enter Arena
              </h1>
              <p className="text-sm text-zinc-400 font-sans leading-relaxed">
                You must be signed in with your Medi-Caps account to enter the contest workspace,
                run test cases, and submit solutions.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <Button asChild>
                <Link to={`/auth?redirect=${encodeURIComponent(`/contests/${contestSlug}/arena`)}`}>
                  <LogIn className="size-3.5 mr-1.5" />
                  <span>Sign In to Continue</span>
                </Link>
              </Button>
              <Button asChild variant="ghost">
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
        <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-[#171717] p-4 text-white font-sans">
          <div className="w-full max-w-md space-y-6 rounded-[24px] border border-amber-500/30 bg-[#1F1F1F] p-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-[12px] border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <Clock className="size-7" />
            </div>

            <div className="space-y-2">
              <span className="font-heading font-bold text-xs uppercase tracking-widest text-amber-400">
                Contest Scheduled
              </span>
              <h1 className="font-display text-2xl uppercase tracking-wide text-white">
                Arena Has Not Started Yet
              </h1>
              <p className="text-sm text-zinc-400 font-sans leading-relaxed">
                The competition arena and problem statements unlock automatically when the scheduled
                contest countdown reaches zero.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <Button asChild variant="outline">
                <Link to={`/contests/${contestSlug}/lobby`}>
                  <Clock className="size-3.5 mr-1.5" />
                  <span>Go to Contest Waiting Lobby</span>
                </Link>
              </Button>
              <Button asChild variant="ghost">
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
        <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-[#171717] p-4 text-white font-sans">
          <div className="w-full max-w-md space-y-6 rounded-[24px] border border-red-500/30 bg-[#1F1F1F] p-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-[12px] border border-red-500/30 bg-red-500/10 text-red-400">
              <AlertTriangle className="size-7" />
            </div>

            <div className="space-y-2">
              <span className="font-heading font-bold text-xs uppercase tracking-widest text-red-400">
                404 Not Found
              </span>
              <h1 className="font-display text-2xl uppercase tracking-wide text-white">Contest Not Found</h1>
              <p className="text-sm text-zinc-400 font-sans leading-relaxed">
                We could not find a contest matching &quot;{contestSlug}&quot;. It may have
                concluded or the URL may be incorrect.
              </p>
            </div>

            <div className="pt-2">
              <Button asChild className="w-full">
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
        <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-[#171717] p-4 text-white font-sans">
          <div className="w-full max-w-lg space-y-6 rounded-[24px] border border-amber-500/30 bg-[#1F1F1F] p-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-[12px] border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <ShieldCheck className="size-7" />
            </div>

            <div className="space-y-2">
              <span className="font-heading font-bold text-xs uppercase tracking-widest text-amber-400">
                Contest Access Restricted
              </span>
              <h1 className="font-display text-2xl uppercase tracking-wide text-white">
                Contest Registration Required
              </h1>
              <p className="text-sm text-zinc-400 font-sans leading-relaxed">
                {error ||
                  "Active contest registration required. Please register for the contest to access problem statements and submit solutions."}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => dispatch(fetchContestArenaThunk(contestSlug))}
                variant="outline"
                className="w-full"
              >
                <RotateCcw className="size-3 mr-1.5" />
                <span>Re-check Status</span>
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link to={`/contests/${contestSlug}`}>Exit to Overview</Link>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Generic fallback error
    return (
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-[#171717] p-4 text-white font-sans">
        <div className="w-full max-w-md space-y-6 rounded-[24px] border border-white/10 bg-[#1F1F1F] p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-[12px] border border-white/10 bg-white/5 text-zinc-400">
            <AlertCircle className="size-7" />
          </div>

          <div className="space-y-2">
            <span className="font-heading font-bold text-xs uppercase tracking-widest text-zinc-400">
              Arena Access Notice
            </span>
            <h1 className="font-display text-2xl uppercase tracking-wide text-white">
              Unable to Access Arena
            </h1>
            <p className="text-sm text-zinc-400 font-sans leading-relaxed">
              {error || "An unexpected error occurred while loading the contest workspace."}
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => dispatch(fetchContestArenaThunk(contestSlug))}
              variant="outline"
              className="w-full"
            >
              <RotateCcw className="size-3 mr-1.5" />
              <span>Retry Connection</span>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link to={`/contests/${contestSlug}`}>Back to Contest</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const title = isPracticeMode
    ? (activeProblem?.title || "Practice Arena")
    : (arenaData?.title || contestSlug || "Contest Arena");

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#171717] text-white select-none overflow-hidden font-sans">
      {/* Top Navigation Bar — Tactical Header in Matiks Dark Theme */}
      <header className="relative h-12 shrink-0 px-3 bg-[#141414] border-b border-white/10 flex items-center justify-between gap-2 z-30">
        {/* Left: Exit, Separator, Title (Drawer Opener), Question Switcher & Chevrons */}
        <div className="relative z-10 flex items-center gap-2 min-w-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (isPracticeMode) {
                navigate("/practice");
              } else if (isReviewMode) {
                navigate(getContestOverviewUrl(contestSlug));
              } else {
                setShowExitModal(true);
              }
            }}
            title={
              isPracticeMode
                ? "Return to Practice Catalog"
                : isReviewMode
                  ? "Return to Contest Overview"
                  : "Exit to contest overview"
            }
          >
            <ChevronLeft className="size-4 mr-0.5" />
            <span>{isPracticeMode ? "Catalog" : isReviewMode ? "Overview" : "Exit"}</span>
          </Button>

          <div className="h-3.5 w-px bg-white/10 shrink-0" />

          {/* Drawer Opener via Problem List / Contest Title button */}
          <button
            type="button"
            onClick={() => setIsProblemListOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors cursor-pointer group min-w-0 text-left"
            title="Open Problem List (⌥P)"
          >
            <ListOrdered className="size-3.5 text-lime-400 shrink-0" />
            <span className="font-semibold text-xs sm:text-sm text-white truncate max-w-[140px] sm:max-w-[200px] md:max-w-[280px]">
              {isPracticeMode ? "Problem List" : title}
            </span>
            {!isPracticeMode && arenaData?.status ? (
              <span className="border border-lime-400/30 bg-lime-400/10 text-lime-400 font-sans text-[9px] uppercase px-1.5 py-0.5 rounded font-semibold hidden sm:inline">
                {arenaData.status}
              </span>
            ) : null}
            <ChevronRight className="size-3 text-zinc-400 group-hover:text-lime-400 transition-transform group-hover:translate-x-0.5 shrink-0" />
          </button>

          {/* Question Nav Switcher Pill & Chevrons (Contest Mode Only) */}
          {!isPracticeMode && (
            <div className="flex items-center gap-0.5 ml-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={handlePrevProblem}
                disabled={resolvedIndex <= 0}
                title="Previous question (⌥←)"
              >
                <ChevronLeft className="size-3.5" />
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsProblemListOpen(true)}
                title="Open Problem List (⌥P)"
                className="shrink-0"
              >
                {isCurrentSolved ? (
                  <CheckCircle2 className="size-3 text-lime-400 mr-1" />
                ) : isCurrentAttempted ? (
                  <Clock className="size-3 text-amber-400 mr-1" />
                ) : (
                  <ListOrdered className="size-3 text-lime-400 mr-1" />
                )}
                <span className="font-semibold text-lime-400">
                  Q{activeProblem?.problem_index || resolvedIndex + 1}
                </span>
                <span className="text-zinc-500 hidden sm:inline text-xs ml-0.5">
                  / {problems.length}
                </span>
                <ChevronDown className="size-3 text-zinc-500 ml-0.5" />
              </Button>

              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={handleNextProblem}
                disabled={resolvedIndex >= problems.length - 1}
                title="Next question (⌥→)"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}

          {!isPracticeMode && (
            <Button asChild variant="outline" size="icon-sm">
              <Link
                to={`/contests/${contestSlug}/results`}
                target="_blank"
                rel="noopener noreferrer"
                title="Live Standings & Ranking"
              >
                <BarChart2 className="size-3.5" />
              </Link>
            </Button>
          )}
        </div>

        {/* Center: Run & Submit Action Buttons (Pinned to center of screen) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-auto z-10">
          {isReviewMode ? (
            <>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-lime-400/40 bg-lime-400/10 text-lime-400 font-sans text-xs">
                <Eye className="size-3.5" />
                <span className="font-semibold uppercase tracking-wider text-[10px] sm:text-[11px]">
                  Review Mode (Read Only)
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={effectiveIsRunning}
                onClick={handleRunCode}
                title="Run code against sample testcases"
              >
                {effectiveIsRunning ? (
                  <WanderingEyes size="inline" className="h-3 mr-1.5" />
                ) : (
                  <Play className="size-3 fill-current" />
                )}
                <span>{effectiveIsRunning ? "Running…" : "Run"}</span>
                <span className="hidden md:inline text-[10px] text-zinc-400 font-sans">⌘'</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={effectiveIsRunning || effectiveIsSubmitting || (!isPracticeMode && isContestOver)}
                onClick={handleRunCode}
              >
                {effectiveIsRunning ? (
                  <WanderingEyes size="inline" className="h-3 mr-1.5" />
                ) : (
                  <Play className="size-3 fill-current" />
                )}
                <span>{effectiveIsRunning ? "Running…" : "Run"}</span>
                <span className="hidden md:inline text-[10px] text-zinc-400 font-sans">⌘'</span>
              </Button>

              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={effectiveIsRunning || effectiveIsSubmitting || (!isPracticeMode && isContestOver)}
                onClick={handleSubmitCode}
              >
                {effectiveIsSubmitting ? (
                  <WanderingEyes size="inline" className="h-3 mr-1.5" />
                ) : (
                  <Send className="size-3 fill-current" />
                )}
                <span>{effectiveIsSubmitting ? "Judging…" : "Submit"}</span>
                <span className="hidden md:inline text-[10px] text-black/70 font-sans font-bold">
                  ⌘⏎
                </span>
              </Button>
            </>
          )}
        </div>

        {/* Right: Layout, Settings, Countdown Timer, Avatar */}
        <div className="relative z-10 flex items-center gap-2">
          {/* Layout Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" title="Adjust Workspace Layout">
                <Layout className="size-3.5 text-lime-400" />
                <span className="hidden sm:inline">{isFocusMode ? "Focus" : "Default"}</span>
                <ChevronDown className="size-3 text-zinc-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-[#1F1F1F] border-white/10 text-white text-xs font-sans rounded-[12px]"
            >
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
            size="icon-sm"
            onClick={() => setShowSettingsModal(true)}
            title="Preferences & Keyboard Shortcuts"
          >
            <Settings className="size-3.5" />
          </Button>

          {/* Timer Badge / Status */}
          {isPracticeMode ? null : isReviewMode ? (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded border border-white/10 bg-white/5 text-zinc-400 font-sans text-xs font-semibold shrink-0">
              <span className="size-1.5 rounded-full bg-zinc-500" />
              <span>CONCLUDED</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded border border-lime-400/30 bg-lime-400/10 text-lime-400 font-sans text-xs font-semibold tabular-nums shrink-0">
              <span className="size-1.5 rounded-full bg-lime-400 animate-pulse" />
              <Clock className="size-3 text-lime-400" />
              <span>{formatTimer(remainingSeconds)}</span>
            </div>
          )}

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
              <AvatarFallback className="size-full rounded-full bg-lime-400 text-black font-sans font-bold text-xs flex items-center justify-center">
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
            className="flex flex-col bg-[#171717] border-r border-white/10 shrink-0 min-w-[280px] max-w-[calc(100%-300px)] h-full overflow-hidden"
          >
            <Tabs
              value={activeProblemTab}
              onValueChange={(v) => setActiveProblemTab(v as "description" | "submissions")}
              className="h-full flex flex-col gap-0"
            >
              {/* Panel Tabs Header */}
              <div className="h-9 shrink-0 px-3 border-b border-white/10 bg-[#141414] flex items-center">
                <TabsList className="bg-transparent border-none p-0 gap-1 h-auto">
                  <TabsTab value="description" className="px-3 py-1 text-sm font-sans font-semibold gap-1.5">
                    <FileText className="size-3.5" />
                    <span>Description</span>
                  </TabsTab>
                  <TabsTab value="submissions" className="px-3 py-1 text-sm font-sans font-semibold gap-1.5">
                    <RotateCcw className="size-3.5" />
                    <span>Submissions</span>
                    {submissionHistory.length > 0 && (
                      <span className="size-4 rounded-full bg-lime-400/10 text-lime-400 border border-lime-400/30 text-[10px] font-sans flex items-center justify-center">
                        {submissionHistory.length}
                      </span>
                    )}
                  </TabsTab>
                </TabsList>
              </div>

              {/* Panel Body */}
              <TabsPanels className="flex-1 overflow-y-auto min-h-0" data-problem-panel>
                <TabsPanel value="description" className="p-5 space-y-6 text-zinc-200">
                  {activeProblem ? (
                    <ProblemStatementView
                      problem={{
                        ...activeProblem,
                        user_status: isCurrentSolved
                          ? "SOLVED"
                          : isCurrentAttempted
                            ? "ATTEMPTED"
                            : ((activeProblem as any).user_status || (activeProblem as any).solved_status || "UNATTEMPTED"),
                      } as any}
                      showPoints={!isPracticeMode}
                    />
                  ) : (
                    <div className="text-zinc-500 font-sans text-xs">Select a question to begin.</div>
                  )}
                </TabsPanel>

                {/* Submissions History Tab */}
                <TabsPanel value="submissions" className="p-5 space-y-4 font-sans">
                  <div className="flex items-center justify-between border-b border-white/8 pb-3">
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                      Submissions History
                    </h3>
                    <span className="text-xs text-zinc-500">
                      {submissionHistory.length} attempts
                    </span>
                  </div>
                  {submissionHistory.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-white/10 rounded-md text-zinc-500 text-xs space-y-1">
                      <p>No submissions for this question yet.</p>
                      <p className="text-[11px] text-zinc-600">
                        Click &quot;Submit&quot; to test all cases and record an official attempt.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {submissionHistory.map((sub, idx) => (
                        <div
                          key={sub.id || idx}
                          className="p-3 bg-[#1F1F1F] border border-white/[0.08] rounded-md flex items-center justify-between text-xs"
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
                </TabsPanel>
              </TabsPanels>
            </Tabs>
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
                  ? "bg-lime-400 "
                  : "bg-white/10 group-hover:bg-lime-400/80"
              }`}
            />
            <div
              className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-3.5 h-7 rounded-full border  transition-all pointer-events-none ${
                isDraggingWidth
                  ? "bg-lime-400 border-lime-400 text-black scale-110"
                  : "bg-[#242424] border-white/20 text-zinc-400 group-hover:border-lime-400 group-hover:bg-black group-hover:text-lime-400"
              }`}
            >
              <GripVertical className="size-2.5" />
            </div>
          </div>
        )}

        {/* Right: Code Editor & Console Drawer */}
        <div
          ref={rightPaneRef}
          className="flex-1 flex flex-col bg-[#171717] min-w-0 h-full overflow-hidden relative"
        >
          {/* Top: Editor Toolbar Header */}
          <div className="h-9 shrink-0 px-3 bg-[#141414] border-b border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-sans font-semibold text-lime-400 bg-lime-400/10 border border-lime-400/30 rounded">
                <Code2 className="size-3" />
                <span>Code</span>
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-sans text-zinc-400">
              {/* Language Selector (Parent-Child DropdownMenu) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-0 h-7 px-2.5 text-xs font-sans gap-1.5 rounded-[8px]"
                    title="Select Programming Language"
                  >
                    <span>
                      {ARENA_LANGUAGES.find((l) => l.value === selectedLanguage)?.label || selectedLanguage}
                    </span>
                    <ChevronDown className="size-3 text-zinc-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="bg-[#1F1F1F] border-white/10 text-white text-xs font-sans rounded-[10px] min-w-[140px] p-1.5"
                >
                  {ARENA_LANGUAGES.map((lang) => (
                    <DropdownMenuItem
                      key={lang.value}
                      onClick={() => handleSelectLanguage(lang.value)}
                      className={`cursor-pointer flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-[6px] text-xs font-sans transition-colors ${
                        selectedLanguage === lang.value
                          ? "text-lime-400 font-semibold bg-white/5"
                          : "text-zinc-300 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <span>{lang.label}</span>
                      {selectedLanguage === lang.value && (
                        <Check className="size-3.5 text-lime-400 shrink-0" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Reset to Starter */}
              <Button
                variant="outline"
                size="sm"
                className="min-h-0 h-7 px-2.5 text-xs font-sans rounded-[8px]"
                onClick={handleResetStarter}
                title="Reset to official starter code"
              >
                <RotateCcw className="size-3 mr-1" />
                <span>Reset</span>
              </Button>

              {/* Fullscreen Toggle */}
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="min-h-0 h-7 w-7 rounded-[8px]"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="size-3.5" />
                ) : (
                  <Maximize2 className="size-3.5" />
                )}
              </Button>
            </div>
          </div>

          {/* Monaco Editor Pane */}
          <div className="flex-1 relative overflow-hidden bg-[#171717] min-h-0">
            <Suspense
              fallback={
                <div className="h-full w-full bg-[#171717] text-zinc-600 font-mono text-[13px] p-4 flex select-none overflow-hidden">
                  <div className="w-8 border-r border-white/5 pr-3 text-right text-zinc-600/50 space-y-1">
                    <div>1</div><div>2</div><div>3</div><div>4</div><div>5</div><div>6</div><div>7</div><div>8</div>
                  </div>
                  <div className="pl-4 space-y-2 flex-1">
                    <div className="h-3.5 bg-zinc-800/60 rounded w-1/4 animate-pulse" />
                    <div className="h-3.5 bg-zinc-800/40 rounded w-2/5 animate-pulse" />
                    <div className="h-3.5 bg-zinc-800/30 rounded w-1/3 animate-pulse" />
                    <div className="h-3.5 bg-zinc-800/50 rounded w-1/2 animate-pulse" />
                    <div className="pt-2 text-xs text-zinc-500 font-sans flex items-center gap-2">
                      <span className="inline-block size-2 rounded-full bg-[#B1FA63] animate-ping" />
                      <span>Readying editor environment…</span>
                    </div>
                  </div>
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
          <div className="h-6 px-3 bg-[#141414] border-t border-white/10 flex items-center justify-between text-[11px] font-sans text-zinc-400 shrink-0">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Check className="size-3 text-[#B1FA63]" />
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
                isDraggingHeight ? "bg-[#B1FA63]/20" : "hover:bg-[#B1FA63]/10"
              }`}
              title="Drag to adjust console height · Double-click to reset (240px)"
            >
              <div
                className={`h-px w-full transition-colors ${
                  isDraggingHeight
                    ? "bg-[#B1FA63] "
                    : "bg-white/10 group-hover:bg-[#B1FA63]/80"
                }`}
              />
              <div
                className={`absolute left-1/2 -translate-x-1/2 flex items-center justify-center h-3.5 w-7 rounded-full border  transition-all pointer-events-none ${
                  isDraggingHeight
                    ? "bg-[#B1FA63] border-[#B1FA63] text-black scale-110"
                    : "bg-[#1F1F1F] border-white/20 text-zinc-400 group-hover:border-[#B1FA63] group-hover:bg-[#141414] group-hover:text-[#B1FA63]"
                }`}
              >
                <GripHorizontal className="size-2.5" />
              </div>
            </div>
          )}

          {/* Console & Execution Drawer */}
          <div
            style={{ height: isDrawerCollapsed ? "0px" : `${drawerHeight}px` }}
            className={`flex flex-col border-t border-white/10 bg-[#171717] shrink-0 overflow-hidden transition-[height] duration-75 ease-out ${
              isDrawerCollapsed ? "border-t-0" : ""
            }`}
          >
            {/* Drawer Tab Header */}
            <div className="flex h-8 shrink-0 items-center justify-between border-b border-white/10 px-3 bg-[#141414]">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveConsoleTab("testcases");
                    if (isDrawerCollapsed) setIsDrawerCollapsed(false);
                  }}
                  className={`px-2.5 py-1 text-sm font-sans font-semibold rounded-md cursor-pointer transition-colors ${
                    activeConsoleTab === "testcases"
                      ? "bg-[#242424] text-white border border-white/10"
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
                  className={`px-2.5 py-1 text-sm font-sans font-semibold rounded-md cursor-pointer transition-colors flex items-center gap-1.5 ${
                    activeConsoleTab === "output"
                      ? "bg-[#242424] text-white border border-white/10"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <span>Test Result</span>
                  {effectiveSubmitResult && (
                    <span
                      className={`size-1.5 rounded-full ${
                        effectiveSubmitResult.verdict === "ACCEPTED"
                          ? "bg-lime-400 "
                          : "bg-rose-400"
                      }`}
                    />
                  )}
                  {!effectiveSubmitResult && effectiveRunResult && (
                    <span
                      className={`size-1.5 rounded-full ${
                        effectiveRunResult.verdict === "ACCEPTED"
                          ? "bg-lime-400 "
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
                  className="flex items-center gap-1 text-xs font-sans font-semibold text-zinc-500 hover:text-zinc-200 px-2 py-1 rounded-md hover:bg-[#242424] cursor-pointer transition-colors"
                  title="Collapse Console"
                >
                  <span className="hidden sm:inline">Collapse</span>
                  <ChevronDown className="size-3" />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            {!isDrawerCollapsed && (
              <div className="flex-1 overflow-y-auto p-3 font-sans text-xs">
                {activeConsoleTab === "testcases" ? (
                  <div className="space-y-3">
                    {/* Testcase Case Selector */}
                    <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
                      {activeProblem?.sample_testcases?.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setActiveTestcaseIndex(i)}
                          className={`px-3 py-1 rounded-md text-sm font-sans font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                            activeTestcaseIndex === i
                              ? "bg-[#242424] text-white border border-white/10"
                              : "text-zinc-400 hover:text-white bg-[#171717] border border-transparent"
                          }`}
                        >
                          <span>Case {i + 1}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setActiveTestcaseIndex(-1)}
                        className={`px-3 py-1 rounded-md text-sm font-sans font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                          activeTestcaseIndex === -1
                            ? "bg-[#242424] text-white border border-white/10"
                            : "text-zinc-400 hover:text-white bg-[#171717] border border-transparent"
                        }`}
                      >
                        <span>+ Custom</span>
                      </button>
                    </div>

                    {/* Active Testcase View */}
                    {activeTestcaseIndex === -1 ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-sans text-zinc-400">
                          <span>Custom Arguments</span>
                          <span className="text-[10px] text-zinc-500">Standard input</span>
                        </div>
                        <textarea
                          value={customStdin}
                          onChange={(e) => setCustomStdin(e.target.value)}
                          placeholder={
                            activeProblem?.sample_testcases?.[0]?.stdin ||
                            "Enter custom test inputs..."
                          }
                          className="w-full h-24 p-2.5 bg-[#171717] border border-white/10 rounded text-[13px] font-sans text-white resize-none focus:outline-none focus:border-lime-400/60 leading-relaxed"
                        />
                      </div>
                    ) : (
                      activeProblem?.sample_testcases?.[activeTestcaseIndex] && (
                        <div className="space-y-3">
                          <div>
                            <span className="text-[10px] font-sans uppercase tracking-wider text-zinc-400 block mb-1 font-semibold">
                              Input
                            </span>
                            <pre className="p-2.5 bg-[#171717] border border-white/[0.08] rounded-[10px] text-[13px] font-sans text-zinc-200 overflow-x-auto selection:bg-lime-400 selection:text-black leading-relaxed">
                              {formatTestcaseInput(
                                activeProblem.sample_testcases[activeTestcaseIndex].stdin ||
                                  (activeProblem.sample_testcases[activeTestcaseIndex] as any).input,
                                (activeProblem as any)?.function_signature
                              )}
                            </pre>
                          </div>
                          <div>
                            <span className="text-[10px] font-sans uppercase tracking-wider text-zinc-400 block mb-1 font-semibold">
                              Expected Output
                            </span>
                            <pre className="p-2.5 bg-[#171717] border border-white/[0.08] rounded-[10px] text-[13px] font-sans text-lime-400 overflow-x-auto selection:bg-lime-400 selection:text-black leading-relaxed">
                              {activeProblem.sample_testcases[activeTestcaseIndex].expected_output}
                            </pre>
                          </div>
                          {activeProblem.sample_testcases[activeTestcaseIndex].explanation && (
                            <div className="text-[11px] font-sans text-zinc-400 italic">
                              Note:{" "}
                              {activeProblem.sample_testcases[activeTestcaseIndex].explanation}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  /* Output / Test Result Tab */
                  <div className="space-y-3">
                    {effectiveIsRunning || effectiveIsSubmitting ? (
                      <div className="flex flex-col items-center justify-center py-12 space-y-3 font-sans">
                        <WanderingEyes size="modal" className="text-lime-400" />
                        <span className="text-xs text-zinc-400">
                          {effectiveIsRunning
                            ? "Running testcases in sandbox…"
                            : "Judging solution against evaluation suite…"}
                        </span>
                      </div>
                    ) : !hasRunCode ? (
                      /* LeetCode Standard Empty State in Strix AI Dark Theme */
                      <div className="flex flex-col items-center justify-center py-12 text-zinc-500 space-y-2 font-sans">
                        <Terminal className="size-6 text-zinc-600" />
                        <p className="text-xs">You must run your code first</p>
                      </div>
                    ) : lastAction === "submit" && effectiveSubmitResult ? (
                      /* Comprehensive Submission Report */
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-3">
                          <div className="flex items-center gap-3">
                            {effectiveSubmitResult.verdict === "ACCEPTED" ? (
                              <div className="flex items-center gap-2 text-lime-400 font-bold text-sm uppercase font-sans">
                                <CheckCircle2 className="size-5 text-lime-400" />
                                <span>Accepted</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm uppercase font-sans">
                                <XCircle className="size-5 text-rose-400" />
                                <span>{effectiveSubmitResult.verdict}</span>
                              </div>
                            )}
                            <span className="text-zinc-600">·</span>
                            <span className="text-zinc-300 font-sans text-xs tabular-nums">
                              {effectiveSubmitResult.passed_testcases} / {effectiveSubmitResult.total_testcases}{" "}
                              testcases passed
                            </span>
                            {!isPracticeMode && effectiveSubmitResult.points_awarded > 0 && (
                              <Badge className="bg-lime-400/15 text-lime-400 border border-lime-400/40 text-[11px] font-sans font-bold">
                                +{effectiveSubmitResult.points_awarded} pts
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs font-sans text-zinc-400 tabular-nums">
                            {effectiveSubmitResult.execution_time !== undefined && (
                              <span>
                                Runtime: {Math.round(effectiveSubmitResult.execution_time * 1000)}ms
                              </span>
                            )}
                            {effectiveSubmitResult.memory !== undefined && effectiveSubmitResult.memory > 0 && (
                              <span>Memory: {effectiveSubmitResult.memory}MB</span>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-[#242424] h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              effectiveSubmitResult.verdict === "ACCEPTED" ? "bg-lime-400" : "bg-rose-500"
                            }`}
                            style={{
                              width: `${Math.round(
                                (effectiveSubmitResult.passed_testcases /
                                   Math.max(1, effectiveSubmitResult.total_testcases)) *
                                  100,
                              )}%`,
                            }}
                          />
                        </div>

                        {/* Compiler Diagnostics if compilation error or compile output present */}
                        {(effectiveSubmitResult.compile_output ||
                          (effectiveSubmitResult.verdict === "COMPILATION_ERROR" &&
                            effectiveSubmitResult.stderr)) && (
                          <div className="p-3 bg-black border border-rose-500/30 rounded font-sans text-xs space-y-1.5">
                            <div className="flex items-center gap-2 text-rose-400 font-semibold text-[11px] uppercase tracking-wider">
                              <AlertCircle className="size-3.5" />
                              <span>Compiler Diagnostics</span>
                            </div>
                            <pre className="text-rose-300/90 whitespace-pre-wrap font-sans text-xs max-h-48 overflow-y-auto leading-relaxed">
                              {effectiveSubmitResult.compile_output || effectiveSubmitResult.stderr}
                            </pre>
                          </div>
                        )}

                        {/* Submission Testcases Breakdown */}
                        {effectiveSubmitResult.testcase_results &&
                          effectiveSubmitResult.testcase_results.length > 0 && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {effectiveSubmitResult.testcase_results.map((tc, idx) => (
                                  <button
                                    key={tc.testcase_id || idx}
                                    type="button"
                                    onClick={() => setActiveSubmitCaseIndex(idx)}
                                    className={`px-2.5 py-1 rounded-md text-sm font-sans font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                      activeSubmitCaseIndex === idx
                                        ? "bg-[#242424] text-white border border-white/10"
                                        : "text-zinc-400 hover:text-white bg-[#171717] border border-transparent"
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

                              {effectiveSubmitResult.testcase_results[activeSubmitCaseIndex] &&
                                (() => {
                                  const curTc =
                                    effectiveSubmitResult.testcase_results[activeSubmitCaseIndex];
                                  if (curTc.is_hidden) {
                                    return (
                                      <div className="p-3 bg-[#1F1F1F] border border-white/[0.08] rounded-[12px] space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Lock className="size-4 text-zinc-500" />
                                          <span className="font-semibold text-xs text-white">
                                            Hidden Evaluation Testcase
                                          </span>
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
                                        <pre className="p-2.5 bg-[#171717] border border-white/[0.08] rounded-[10px] text-xs text-zinc-200 overflow-x-auto whitespace-pre-wrap">
                                          {formatTestcaseInput(curTc.input, (activeProblem as any)?.function_signature)}
                                        </pre>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <div>
                                          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">
                                            Output
                                          </span>
                                          <pre
                                            className={`p-2.5 bg-[#171717] border rounded-[10px] text-xs overflow-x-auto ${
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
                                          <pre className="p-2.5 bg-[#171717] border border-white/[0.08] rounded-[10px] text-xs text-lime-400 overflow-x-auto">
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
                    ) : effectiveRunResult ? (
                      /* Run Result Inspection */
                      <div className="space-y-3">
                        {/* Verdict Header */}
                        <div className="flex items-center justify-between border-b border-white/8 pb-2.5">
                          <div className="flex items-center gap-3">
                            {effectiveRunResult.verdict === "ACCEPTED" ? (
                              <div className="flex items-center gap-1.5 text-lime-400 font-bold text-xs font-sans uppercase">
                                <CheckCircle2 className="size-4 text-lime-400" />
                                <span>Accepted</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs font-sans uppercase">
                                <AlertCircle className="size-4 text-rose-400" />
                                <span>{effectiveRunResult.verdict}</span>
                              </div>
                            )}
                            {effectiveRunResult.passed_testcases !== undefined &&
                              effectiveRunResult.total_testcases !== undefined && (
                                <span className="text-zinc-400 font-sans text-xs tabular-nums">
                                  {effectiveRunResult.passed_testcases} / {effectiveRunResult.total_testcases} sample
                                  cases passed
                                </span>
                              )}
                          </div>
                          {effectiveRunResult.time !== undefined && (
                            <span className="text-zinc-500 text-xs font-sans tabular-nums">
                              Runtime: {Math.round(effectiveRunResult.time * 1000)}ms
                            </span>
                          )}
                        </div>

                        {/* Compiler Diagnostics if compilation error or compile output present */}
                        {(effectiveRunResult.compile_output ||
                          (effectiveRunResult.verdict === "COMPILATION_ERROR" && effectiveRunResult.stderr)) && (
                          <div className="p-3 bg-black border border-rose-500/30 rounded font-sans text-xs space-y-1.5">
                            <div className="flex items-center gap-2 text-rose-400 font-semibold text-[11px] uppercase tracking-wider">
                              <AlertCircle className="size-3.5" />
                              <span>Compiler Diagnostics</span>
                            </div>
                            <pre className="text-rose-300/90 whitespace-pre-wrap font-sans text-xs max-h-48 overflow-y-auto leading-relaxed">
                              {effectiveRunResult.compile_output || effectiveRunResult.stderr}
                            </pre>
                          </div>
                        )}

                        {/* Testcase Sub-tabs */}
                        {effectiveRunResult.testcase_results && effectiveRunResult.testcase_results.length > 0 ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-1.5">
                              {effectiveRunResult.testcase_results.map((tc, idx) => (
                                <button
                                  key={tc.testcase_id || idx}
                                  type="button"
                                  onClick={() => setActiveRunCaseIndex(idx)}
                                  className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                                    activeRunCaseIndex === idx
                                      ? "bg-[#242424] text-white font-semibold border border-white/10"
                                      : "text-zinc-400 hover:text-white bg-[#171717] border border-transparent"
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

                            {effectiveRunResult.testcase_results[activeRunCaseIndex] &&
                              (() => {
                                const curTc = effectiveRunResult.testcase_results[activeRunCaseIndex];
                                return (
                                  <div className="space-y-2.5">
                                    {curTc.stdin && (
                                      <div>
                                        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">
                                          Input
                                        </span>
                                        <pre className="p-2.5 bg-[#171717] border border-white/[0.08] rounded-[10px] text-xs text-zinc-200 overflow-x-auto whitespace-pre-wrap">
                                          {formatTestcaseInput(curTc.stdin, (activeProblem as any)?.function_signature)}
                                        </pre>
                                      </div>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      <div>
                                        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">
                                          Output
                                        </span>
                                        <pre
                                          className={`p-2.5 bg-[#171717] border rounded-[10px] text-xs overflow-x-auto ${
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
                                        <pre className="p-2.5 bg-[#171717] border border-white/[0.08] rounded-[10px] text-xs text-lime-400 overflow-x-auto">
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
                            {effectiveRunResult.compile_output && (
                              <div>
                                <span className="text-[10px] text-rose-400 uppercase tracking-wider font-sans">
                                  Compiler Output
                                </span>
                                <pre className="p-2 bg-black border border-rose-500/20 rounded text-xs text-rose-300 overflow-x-auto whitespace-pre-wrap">
                                  {effectiveRunResult.compile_output}
                                </pre>
                              </div>
                            )}
                            {effectiveRunResult.stdout && (
                              <div>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-sans">
                                  Stdout
                                </span>
                                <pre className="p-2.5 bg-[#171717] border border-white/[0.08] rounded-[10px] text-xs text-white overflow-x-auto">
                                  {effectiveRunResult.stdout}
                                </pre>
                              </div>
                            )}
                            {effectiveRunResult.stderr && (
                              <div>
                                <span className="text-[10px] text-rose-400 uppercase tracking-wider font-sans">
                                  Stderr
                                </span>
                                <pre className="p-2 bg-black border border-rose-500/20 rounded text-xs text-rose-400 overflow-x-auto">
                                  {effectiveRunResult.stderr}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-zinc-600 text-center py-6 font-sans text-xs">
                        Run code against sample cases or submit for evaluation.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Footer in Tactical Dark Theme */}
          <div className="h-11 px-4 border-t border-white/10 flex items-center justify-between bg-[#141414] shrink-0">
            <div className="flex items-center gap-3">
              {/* LeetCode-style Console Toggle */}
              <button
                type="button"
                onClick={() => setIsDrawerCollapsed((prev) => !prev)}
                className="flex items-center gap-1.5 text-sm font-sans font-semibold text-zinc-400 hover:text-white px-2.5 py-1 rounded-[8px] bg-[#1F1F1F] border border-white/10 hover:border-white/20 transition-colors cursor-pointer"
                title={isDrawerCollapsed ? "Open Console Drawer" : "Close Console Drawer"}
              >
                <Terminal className="size-3 text-[#B1FA63]" />
                <span>Console</span>
                {isDrawerCollapsed ? (
                  <ChevronUp className="size-3 text-zinc-500" />
                ) : (
                  <ChevronDown className="size-3 text-zinc-500" />
                )}
              </button>

              <div className="flex items-center gap-2 text-[10px] font-sans uppercase tracking-wider text-zinc-500">
                <span
                  className={`size-1.5 rounded-full ${isContestOver ? "bg-red-500" : "bg-[#B1FA63]"}`}
                />
                <span>{isContestOver ? "Contest locked" : "Workstation online"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal (Editor Preferences & Keyboard Shortcuts) */}
      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="border border-white/10 bg-[#1F1F1F] text-white p-6 max-w-lg rounded-[24px]">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-lg font-heading font-bold text-white tracking-tight flex items-center gap-2">
              <Settings className="size-4 text-[#B1FA63]" />
              <span>Contest Workspace Settings</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 font-sans">
              Personalize editor typography, formatting, and inspect keyboard bindings.
            </DialogDescription>
          </DialogHeader>

          {/* Settings Tabs */}
          <div className="flex items-center gap-1 border-b border-white/10 pb-2 pt-1">
            <button
              type="button"
              onClick={() => setActiveSettingsTab("editor")}
              className={`px-3 py-1 rounded-md font-sans text-sm font-semibold transition-colors cursor-pointer ${
                activeSettingsTab === "editor"
                  ? "bg-[#242424] text-white border border-lime-400/40"
                  : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              Code Editor
            </button>
            <button
              type="button"
              onClick={() => setActiveSettingsTab("shortcuts")}
              className={`px-3 py-1 rounded-md font-sans text-sm font-semibold transition-colors cursor-pointer ${
                activeSettingsTab === "shortcuts"
                  ? "bg-[#242424] text-white border border-lime-400/40"
                  : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              Shortcuts
            </button>
            <button
              type="button"
              onClick={() => setActiveSettingsTab("timer")}
              className={`px-3 py-1 rounded-md font-sans text-sm font-semibold transition-colors cursor-pointer ${
                activeSettingsTab === "timer"
                  ? "bg-[#242424] text-white border border-lime-400/40"
                  : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              Contest Clock
            </button>
          </div>

          <div className="py-3 text-xs font-sans">
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
                        className={`size-7 rounded-md font-sans text-sm font-semibold transition-colors cursor-pointer border ${
                          editorFontSize === size
                            ? "bg-lime-400 text-black border-lime-400"
                            : "bg-black text-zinc-400 border-white/10 hover:bg-lime-400 hover:text-black hover:border-lime-400"
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
                    <div className="text-[11px] text-zinc-500">
                      Wrap long lines to fit editor viewport
                    </div>
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
                    className={`px-3 py-1 rounded-md text-sm font-sans font-semibold transition-colors cursor-pointer ${
                      editorWordWrap === "on"
                        ? "bg-lime-400/20 text-lime-400 border border-lime-400/40"
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
                    <div className="text-[11px] text-zinc-500">
                      Spaces per tab indentation level
                    </div>
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
                        className={`px-3 py-1 rounded-md font-sans text-sm font-semibold transition-colors cursor-pointer border ${
                          editorTabSize === spaces
                            ? "bg-lime-400 text-black border-lime-400"
                            : "bg-black text-zinc-400 border-white/10 hover:bg-lime-400 hover:text-black hover:border-lime-400"
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
              <div className="space-y-2 font-sans text-xs">
                <div className="flex items-center justify-between p-2 rounded bg-black border border-white/8">
                  <span className="text-zinc-300">Run Code</span>
                  <kbd className="px-2 py-0.5 rounded bg-[#242424] text-lime-400 border border-white/10 font-bold">
                    ⌘ ' / Ctrl + '
                  </kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-black border border-white/8">
                  <span className="text-zinc-300">Submit Solution</span>
                  <kbd className="px-2 py-0.5 rounded bg-[#242424] text-lime-400 border border-white/10 font-bold">
                    ⌘ ⏎ / Ctrl + Enter
                  </kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-black border border-white/8">
                  <span className="text-zinc-300">Previous Question</span>
                  <kbd className="px-2 py-0.5 rounded bg-[#242424] text-zinc-300 border border-white/10">
                    ⌥ ← / Alt + Left
                  </kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-black border border-white/8">
                  <span className="text-zinc-300">Next Question</span>
                  <kbd className="px-2 py-0.5 rounded bg-[#242424] text-zinc-300 border border-white/10">
                    ⌥ → / Alt + Right
                  </kbd>
                </div>
              </div>
            )}

            {activeSettingsTab === "timer" && (
              <div className="space-y-3 font-sans text-xs">
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
                  The contest clock is synchronized to server time via WebSockets. Solutions
                  submitted after the clock expires will not receive contest points.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => setShowSettingsModal(false)} className="w-full">
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

      {/* Contest Over Modal using official shadcn Dialog */}
      <Dialog open={!isPracticeMode && isContestOver && !isReviewMode}>
        <DialogContent className="max-w-md rounded-[24px] border border-[#B1FA63]/40 bg-[#1F1F1F] p-8 text-center space-y-6 [&>button]:hidden">
          <DialogHeader className="flex flex-col items-center space-y-3 text-center sm:text-center">
            <div className="flex size-14 items-center justify-center rounded-[12px] border border-[#B1FA63]/30 bg-[#B1FA63]/10 mx-auto text-[#B1FA63]">
              <Trophy className="size-7" />
            </div>

            <div className="space-y-1">
              <span className="text-xs uppercase tracking-widest text-[#B1FA63] font-bold block font-heading">
                Official Contest Bell
              </span>
              <DialogTitle className="text-2xl uppercase tracking-wide text-white font-display">
                Contest Concluded
              </DialogTitle>
              <DialogDescription className="text-sm text-zinc-400 font-sans leading-relaxed max-w-xs mx-auto">
                The competition clock has expired. Code execution is now locked. Proceed to the
                Contest Summary console to inspect your questions and finalize your submission.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-[12px] border border-[#B1FA63] bg-[#B1FA63]/10">
              <span className="text-2xl font-display text-[#B1FA63] tabular-nums">
                {redirectCountdown}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Button
                onClick={() => navigate(`/contests/${contestSlug}/summary`)}
                variant="default"
                className="w-full"
              >
                Proceed to Summary →
              </Button>
              <Button
                onClick={() => navigate(`/contests/${contestSlug}/results`)}
                variant="outline"
                className="w-full"
              >
                View Standings
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Slide-out Problem List Drawer */}
      {isProblemListOpen && (
        <div
          role="presentation"
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity animate-in fade-in duration-150"
          onClick={() => setIsProblemListOpen(false)}
        />
      )}

      <aside
        aria-label="Contest Problem List and Standings"
        className={`fixed inset-y-0 left-0 z-50 w-full max-w-[420px] bg-[#141414] border-r border-white/10  flex flex-col transition-transform duration-200 ease-out ${
          isProblemListOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
      >
        {/* Drawer Header */}
        {isPracticeMode ? (
          <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#141414]">
            <div className="flex items-center gap-1.5 text-zinc-100 font-medium text-sm">
              <span>Problem List</span>
              <ChevronRight className="size-3.5 text-zinc-500" />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-sans tabular-nums">
                <CheckCircle2 className="size-3.5 text-emerald-400" />
                <span>
                  {solvedProblemIds.size} / {problems.length} Solved
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsProblemListOpen(false)}
                title="Close Problem List (Esc)"
                className="text-zinc-400 hover:text-white hover:bg-white/10"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#141414]">
            <div className="flex items-center gap-2 min-w-0">
              <ListOrdered className="size-4 text-[#B1FA63] shrink-0" />
              <h2 className="font-heading font-bold text-xs text-white truncate max-w-[220px]">{title}</h2>
              {arenaData?.status ? (
                <span className="border border-[#B1FA63]/30 bg-[#B1FA63]/10 text-[#B1FA63] font-heading text-[10px] uppercase px-2 py-0.5 rounded-full font-bold shrink-0">
                  {arenaData.status} Arena
                </span>
              ) : null}
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setIsProblemListOpen(false)}
              title="Close Problem List (Esc)"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        )}

        {/* Practice Mode Search Input */}
        {isPracticeMode && (
          <div className="p-3 border-b border-white/10 bg-[#141414]">
            <div className="relative flex items-center">
              <Search className="absolute left-3 size-3.5 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={catalogSearchQuery}
                onChange={(e) => setCatalogSearchQuery(e.target.value)}
                placeholder="Search questions"
                className="w-full bg-[#1c1c1c] text-xs text-zinc-200 placeholder-zinc-500 rounded-md pl-9 pr-3 py-1.5 border border-white/10 focus:border-lime-400/50 focus:outline-none transition-colors font-sans"
              />
            </div>
          </div>
        )}

        {/* Contest Subheader: Problem List vs Standings Tabs + Score Badge (Contest Mode Only) */}
        {!isPracticeMode && (
          <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between gap-2 shrink-0 bg-[#141414]">
            <Tabs
              value={problemListTab}
              onValueChange={(v) => setProblemListTab(v as "problems" | "ranking")}
              className="gap-0"
            >
              <TabsList className="bg-[#1F1F1F] p-0.5 rounded-md border border-white/10 gap-1">
                <TabsTab value="problems" className="px-3 py-1 text-sm font-sans font-semibold gap-1.5">
                  <ListOrdered className="size-3.5" />
                  <span>Challenges</span>
                </TabsTab>
                <TabsTab value="ranking" className="px-3 py-1 text-sm font-sans font-semibold gap-1.5">
                  <BarChart2 className="size-3.5" />
                  <span>Standings</span>
                </TabsTab>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2 font-sans">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-lime-400/10 border border-lime-400/30 text-lime-400 text-xs font-semibold tabular-nums">
                <Trophy className="size-3 text-lime-400" />
                <span>{totalEarnedPoints}&nbsp;PTS</span>
              </div>
              <div className="flex items-center gap-1">
                {problems.map((p) => {
                  const isPsolved = solvedProblemIds.has(p.id) || p.user_status === "SOLVED";
                  const isPattempted = !isPsolved && (attemptedProblemIds.has(p.id) || p.user_status === "ATTEMPTED");
                  return (
                    <span
                      key={p.id}
                      className={`size-2 rounded-full transition-colors ${
                        isPsolved
                          ? "bg-lime-400 "
                          : isPattempted
                            ? "bg-amber-400 "
                            : "bg-[#242424] border border-white/10"
                      }`}
                      title={`Q${p.problem_index}: ${p.title} (${isPsolved ? "Solved" : isPattempted ? "Attempted" : "Unsolved"})`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Drawer Body */}
        {isPracticeMode ? (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredDrawerProblems.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 font-sans">
                No questions found matching &ldquo;{catalogSearchQuery}&rdquo;
              </div>
            ) : (
              filteredDrawerProblems.map((prob) => {
                const isActive = prob.slug === effectiveProblemSlug || prob.id === activeProblem?.id;
                const isSolved = solvedProblemIds.has(prob.id) || prob.user_status === "SOLVED";
                const isAttempted =
                  !isSolved && (attemptedProblemIds.has(prob.id) || prob.user_status === "ATTEMPTED");

                const diffUpper = (prob.difficulty || "EASY").toUpperCase();
                const isHard = diffUpper === "HARD";
                const isMed = diffUpper === "MEDIUM";
                const diffLabel = isHard ? "Hard" : isMed ? "Med." : "Easy";

                return (
                  <button
                    key={prob.id}
                    type="button"
                    onClick={() => {
                      navigate(`/practice/${prob.slug}`);
                      setIsProblemListOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-md border transition-all cursor-pointer flex items-center justify-between gap-3 group relative ${
                      isActive
                        ? "bg-white/[0.08] border-white/20 text-white"
                        : "bg-transparent hover:bg-white/[0.04] border-transparent text-zinc-300 hover:text-white"
                    }`}
                  >
                    {/* Left: Status indicator + Index + Title */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {isSolved ? (
                        <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                      ) : isAttempted ? (
                        <Clock className="size-4 text-amber-400 shrink-0" />
                      ) : (
                        <span className="size-4 shrink-0" />
                      )}

                      <span className="text-xs truncate font-medium">
                        <span className="text-zinc-500 mr-1.5">{prob.problem_index}.</span>
                        {prob.title}
                      </span>
                    </div>

                    {/* Right: Difficulty badge (No points in practice mode) */}
                    <span
                      className={`text-[11px] font-semibold shrink-0 ${
                        isHard
                          ? "text-rose-400"
                          : isMed
                            ? "text-amber-400"
                            : "text-emerald-400"
                      }`}
                    >
                      {diffLabel}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        ) : problemListTab === "problems" ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {problems.map((prob, idx) => {
              const pSlug = slugifyProblem(prob.title, prob.problem_index);
              const isActive = idx === resolvedIndex;
              const isSolved = solvedProblemIds.has(prob.id) || prob.user_status === "SOLVED";
              const isAttempted = !isSolved && (attemptedProblemIds.has(prob.id) || prob.user_status === "ATTEMPTED");

              const diffUpper = (prob.difficulty || "EASY").toUpperCase();
              const isHard = diffUpper === "HARD";
              const isMed = diffUpper === "MEDIUM";
              const diffLabel = isHard ? "Hard" : isMed ? "Medium" : "Easy";

              return (
                <button
                  key={prob.id}
                  type="button"
                  onClick={() => {
                    const target = isReviewMode
                      ? getProblemReviewUrl(contestSlug, prob.title, prob.problem_index)
                      : getProblemSolveUrl(contestSlug, prob.title, prob.problem_index);
                    navigate(target);
                    dispatch(clearArenaResults());
                    setIsProblemListOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-md border transition-all cursor-pointer flex items-center justify-between gap-3 group relative overflow-hidden ${
                    isActive
                      ? "bg-black border-lime-400/60 ring-1 ring-lime-400/30"
                      : "bg-black hover:bg-white/[0.03] border-white/10 hover:border-white/20 text-zinc-300 hover:text-white"
                  }`}
                >
                  {/* Left accent bar for active challenge */}
                  {isActive && (
                    <div className="absolute left-0 inset-y-0 w-1 bg-lime-400 " />
                  )}

                  {/* Left: Indicator, Question Title */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pl-1">
                    {isSolved ? (
                      <CheckCircle2 className="size-4 text-lime-400 shrink-0" />
                    ) : isAttempted ? (
                      <Clock className="size-4 text-amber-400 shrink-0" />
                    ) : isActive ? (
                      <span className="size-2 rounded-full bg-lime-400 shrink-0" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-zinc-700 group-hover:bg-zinc-400 transition-colors shrink-0" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-sans text-xs font-semibold ${
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
                  <div className="flex items-center gap-2 shrink-0 font-sans">
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
            <div className="flex items-center justify-between text-xs font-sans pb-3 border-b border-white/8">
              <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold">
                Live Tournament Standings
              </span>
              <span className="text-lime-400 font-semibold tabular-nums">
                {rankingData?.rows?.length || 0}{" "}
                {rankingData?.rows?.length === 1 ? "competitor" : "competitors"}
              </span>
            </div>

            <div className="flex-1 py-3 space-y-1.5 overflow-y-auto">
              {rankingData?.rows && rankingData.rows.length > 0 ? (
                rankingData.rows.slice(0, 20).map((row, idx) => (
                  <div
                    key={row.handle || idx}
                    className="p-2.5 rounded-md bg-[#1F1F1F] border border-white/[0.08] hover:border-white/16 flex items-center justify-between text-xs font-sans transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`size-5 rounded flex items-center justify-center font-bold tabular-nums text-[11px] ${
                          idx === 0
                            ? "bg-lime-400/15 text-lime-400 border border-lime-400/30"
                            : idx === 1
                              ? "bg-[#242424] text-zinc-200 border border-white/10"
                              : idx === 2
                                ? "bg-[#242424] text-zinc-400 border border-white/10"
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
                <div className="py-16 text-center text-zinc-500 text-xs font-sans space-y-2">
                  <Trophy className="size-8 mx-auto text-zinc-700 stroke-1" />
                  <p className="text-zinc-400">Standings will update as competitors submit.</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-white/8 shrink-0">
              <Button asChild variant="outline" className="w-full">
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
      <Dialog open={!isPracticeMode && showExitModal && !isReviewMode} onOpenChange={setShowExitModal}>
        <DialogContent className="border border-white/12 bg-black text-white p-6 max-w-md rounded-lg sm:rounded-lg">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-white tracking-tight font-sans">
                  Exit Coding Workspace?
                </DialogTitle>
                <p className="text-xs text-zinc-400 font-sans">
                  Review questions before final submission
                </p>
              </div>
            </div>
            <DialogDescription className="text-xs text-zinc-300 font-sans leading-relaxed pt-1">
              Your written code and test progress are automatically saved. Exiting will navigate you
              to the{" "}
              <strong className="text-white font-semibold">
                Contest Summary &amp; Submission Console
              </strong>
              , where you can inspect all attempted questions, check unattempted challenges, and
              officially submit your test.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-white/8 bg-black p-3.5 space-y-2 font-sans text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Challenges Solved:</span>
              <span className="font-semibold text-lime-400">
                {solvedProblemIds.size} / {problems.length} Solved
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-white/6 pt-2">
              <span className="text-zinc-500">Time Remaining:</span>
              <span className="font-semibold text-zinc-300">{formatTimer(remainingSeconds)}</span>
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowExitModal(false)}>
              Continue Solving
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => {
                setShowExitModal(false);
                navigate(`/contests/${contestSlug}/summary`);
              }}
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

export default ContestArenaPage;
