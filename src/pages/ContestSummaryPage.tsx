/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * Contest Summary & Submission Console (HackerRank Paradigm)
 * High-density tactical dark theme with tabular metrics, challenge review, and final submission.
 */

import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Code2,
  FileText,
  HelpCircle,
  Lock,
  MinusCircle,
  Send,
  ShieldAlert,
  Sparkles,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContestArenaThunk, fetchContestDetailThunk } from "@/store/slices/contestSlice";
import { AssessmentStudioSkeleton } from "@/organization/components/skeletons";
import { contestApi } from "@/features/contest/api";
import { slugifyProblem } from "@/lib/utils";

function formatTimer(totalSeconds: number): string {
  if (totalSeconds <= 0) return "00:00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ContestSummaryPage() {
  const { contestSlug = "" } = useParams<{ contestSlug: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { arenaData, isLoadingArena, currentContest, registration } = useAppSelector(
    (state) => state.contest
  );
  const member = useAppSelector((state) => state.auth.member);

  const [isSubmittingFinal, setIsSubmittingFinal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  useEffect(() => {
    if (contestSlug) {
      if (!arenaData) {
        dispatch(fetchContestArenaThunk(contestSlug));
      }
      if (!currentContest) {
        dispatch(fetchContestDetailThunk({ slug: contestSlug }));
      }
    }
  }, [contestSlug, arenaData, currentContest, dispatch]);

  const problems = arenaData?.problems || [];

  // Load solved problems from localStorage
  const solvedProblemIds = useMemo(() => {
    if (typeof window === "undefined" || !contestSlug) return new Set<string>();
    try {
      const saved = localStorage.getItem(`ccc_solved_${contestSlug}`);
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  }, [contestSlug]);

  // Inspect attempted status by checking if user saved custom code in localStorage
  const problemStatusMap = useMemo(() => {
    const map: Record<string, "solved" | "attempted" | "unattempted"> = {};
    if (typeof window === "undefined") return map;

    const languages = ["python", "cpp", "c", "java", "javascript", "typescript"];

    problems.forEach((p) => {
      if (solvedProblemIds.has(p.id)) {
        map[p.id] = "solved";
        return;
      }

      // Check if candidate wrote and saved code in any language for this problem
      let hasDraft = false;
      for (const lang of languages) {
        const key = `ccc_code_v4_${contestSlug}_${p.id}_${lang}`;
        const savedCode = localStorage.getItem(key);
        if (savedCode && savedCode.trim().length > 0) {
          // Check if it's more than just unmodified placeholder comments
          const isCustom =
            !savedCode.includes("TODO: Calculate valid mirror pairs") &&
            savedCode.replace(/\s+/g, "").length > 40;
          if (isCustom) {
            hasDraft = true;
            break;
          }
        }
      }

      map[p.id] = hasDraft ? "attempted" : "unattempted";
    });

    return map;
  }, [problems, solvedProblemIds, contestSlug]);

  const solvedCount = problems.filter((p) => problemStatusMap[p.id] === "solved").length;
  const attemptedCount = problems.filter((p) => problemStatusMap[p.id] === "attempted").length;
  const unattemptedCount = Math.max(0, problems.length - solvedCount - attemptedCount);

  const totalPossiblePoints = problems.reduce((acc, p) => acc + (p.points || 0), 0);
  const earnedPoints = problems
    .filter((p) => problemStatusMap[p.id] === "solved")
    .reduce((acc, p) => acc + (p.points || 0), 0);

  // Live countdown timer synced to arena ends_at
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    const endsStr = arenaData?.ends_at || currentContest?.ends_at;
    if (!endsStr) return 5400; // Default 90m
    const endMs = new Date(endsStr).getTime();
    const diff = Math.floor((endMs - Date.now()) / 1000);
    return Math.max(0, diff);
  });

  useEffect(() => {
    if (!arenaData?.ends_at && !currentContest?.ends_at) return;
    const endsStr = arenaData?.ends_at || currentContest?.ends_at || "";
    const endMs = new Date(endsStr).getTime();
    const initial = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
    setRemainingSeconds(initial);

    const timer = setInterval(() => {
      const diff = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      setRemainingSeconds(diff);
    }, 1000);

    return () => clearInterval(timer);
  }, [arenaData?.ends_at, currentContest?.ends_at]);

  const handleFinalSubmit = async () => {
    setIsSubmittingFinal(true);
    try {
      const res = await contestApi.finishContest(contestSlug);
      toast.success(res.message || "Contest successfully submitted!");
      setShowSubmitModal(false);
      navigate(`/contests/${contestSlug}/results`, { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Failed to finalize contest submission.");
    } finally {
      setIsSubmittingFinal(false);
    }
  };

  if (isLoadingArena && !arenaData) {
    return <AssessmentStudioSkeleton />;
  }

  const contestTitle = arenaData?.title || currentContest?.title || "Live Contest Arena";
  const firstProblemSlug = problems[0]
    ? slugifyProblem(problems[0].title, problems[0].problem_index)
    : "";

  return (
    <div className="min-h-[100dvh] w-full bg-black text-white font-sans selection:bg-lime-400 selection:text-black">
      {/* Top Utility Header */}
      <header className="sticky top-0 z-30 border-b border-white/8 bg-black/90 backdrop-blur-md px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 px-2.5 rounded-md font-mono text-xs border-white/10 bg-black text-zinc-300 hover:bg-lime-400 hover:text-black hover:border-lime-400 transition-colors"
          >
            <Link to={`/contests/${contestSlug}/problems/${firstProblemSlug}`}>
              <ArrowLeft className="size-3.5 mr-1" />
              <span>Back to Code Workspace</span>
            </Link>
          </Button>

          <div className="h-4 w-px bg-white/10 hidden sm:block" />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase font-semibold tracking-wider text-lime-400">
                Test Summary &amp; Review
              </span>
              <span className="size-1 rounded-full bg-zinc-600 hidden sm:inline" />
              <span className="text-xs text-zinc-400 font-mono hidden sm:inline truncate max-w-[240px]">
                {contestTitle}
              </span>
            </div>
          </div>
        </div>

        {/* Live Timer Pill */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-white/10 bg-zinc-950 font-mono text-xs shadow-inner">
            <Clock className={`size-3.5 ${remainingSeconds < 300 ? "text-red-400 animate-pulse" : "text-lime-400"}`} />
            <span className="text-zinc-500 uppercase text-[10px] tracking-wider hidden md:inline">Time Remaining:</span>
            <span className={`font-semibold tabular-nums ${remainingSeconds < 300 ? "text-red-400" : "text-white"}`}>
              {formatTimer(remainingSeconds)}
            </span>
          </div>

          <Button
            onClick={() => setShowSubmitModal(true)}
            size="sm"
            className="h-8 px-3.5 rounded-md font-mono text-xs font-semibold bg-lime-400 text-black hover:bg-lime-300 shadow-sm cursor-pointer transition-colors"
          >
            <Send className="size-3.5 mr-1.5" />
            <span>Submit Contest</span>
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Title Header */}
        <div className="space-y-2 border-b border-white/8 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                Official Contest Assessment
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
                {contestTitle}
              </h1>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-white/8 bg-zinc-950">
                <span className="size-1.5 rounded-full bg-lime-400" />
                <span>Candidate: <strong className="text-white">{member?.handle || "Cadet"}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-white/8 bg-zinc-950">
                <span>Earned: <strong className="text-lime-400 tabular-nums">{earnedPoints}</strong> / {totalPossiblePoints} Pts</span>
              </div>
            </div>
          </div>
        </div>

        {/* HackerRank-style Metric Bento Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-lg border border-white/8 bg-zinc-950 flex flex-col justify-between space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Total Challenges</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-white tabular-nums">{problems.length}</span>
              <FileText className="size-4 text-zinc-500" />
            </div>
            <span className="font-mono text-[10px] text-zinc-400">Problem statements</span>
          </div>

          <div className="p-4 rounded-lg border border-lime-400/20 bg-lime-400/5 flex flex-col justify-between space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-lime-400">Solved &amp; Passed</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-lime-400 tabular-nums">{solvedCount}</span>
              <CheckCircle2 className="size-4 text-lime-400" />
            </div>
            <span className="font-mono text-[10px] text-lime-400/70">100% test cases accepted</span>
          </div>

          <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 flex flex-col justify-between space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400">In Progress</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-amber-400 tabular-nums">{attemptedCount}</span>
              <Code2 className="size-4 text-amber-400" />
            </div>
            <span className="font-mono text-[10px] text-amber-400/70">Draft code stored</span>
          </div>

          <div className="p-4 rounded-lg border border-white/8 bg-zinc-950 flex flex-col justify-between space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Unattempted</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-zinc-400 tabular-nums">{unattemptedCount}</span>
              <MinusCircle className="size-4 text-zinc-600" />
            </div>
            <span className="font-mono text-[10px] text-zinc-500">No submission yet</span>
          </div>
        </section>

        {/* HackerRank-style Questions Review Table */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                Challenge Review &amp; Status
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                Click any challenge to return to the coding workspace and edit your solution.
              </p>
            </div>
            <span className="font-mono text-xs text-zinc-500">
              {solvedCount} of {problems.length} Complete
            </span>
          </div>

          <div className="rounded-lg border border-white/8 bg-zinc-950 overflow-hidden shadow-xl divide-y divide-white/6">
            {problems.map((problem) => {
              const status = problemStatusMap[problem.id] || "unattempted";
              const problemSlug = slugifyProblem(problem.title, problem.problem_index);
              const isSolved = status === "solved";
              const isAttempted = status === "attempted";

              return (
                <div
                  key={problem.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`size-8 shrink-0 rounded flex items-center justify-center font-mono text-xs font-bold ${
                        isSolved
                          ? "border border-lime-400/30 bg-lime-400/10 text-lime-400"
                          : isAttempted
                          ? "border border-amber-500/30 bg-amber-500/10 text-amber-400"
                          : "border border-white/10 bg-zinc-900 text-zinc-400"
                      }`}
                    >
                      {problem.problem_index}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/contests/${contestSlug}/problems/${problemSlug}`}
                          className="text-sm font-semibold text-white hover:text-lime-400 transition-colors truncate"
                        >
                          {problem.title}
                        </Link>
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-mono px-1.5 py-0 uppercase border ${
                            problem.difficulty === "HARD"
                              ? "border-red-500/30 text-red-400 bg-red-500/5"
                              : problem.difficulty === "MEDIUM"
                              ? "border-amber-500/30 text-amber-400 bg-amber-500/5"
                              : "border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
                          }`}
                        >
                          {problem.difficulty || "MEDIUM"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-500">
                        <span>{problem.topic || "Algorithmic"}</span>
                        <span>·</span>
                        <span>Max Score: <strong className="text-zinc-300">{problem.points || 100} Pts</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/6">
                    {/* Status Pill */}
                    {isSolved ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-lime-400/30 bg-lime-400/10 text-lime-400 font-mono text-xs">
                        <CheckCircle2 className="size-3.5" />
                        <span className="font-semibold">Accepted ({problem.points} pts)</span>
                      </div>
                    ) : isAttempted ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 font-mono text-xs">
                        <Code2 className="size-3.5" />
                        <span>Draft Saved</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-white/8 bg-zinc-900 text-zinc-500 font-mono text-xs">
                        <MinusCircle className="size-3.5" />
                        <span>Unattempted</span>
                      </div>
                    )}

                    {/* Action Button */}
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 rounded font-mono text-xs border-white/10 bg-black text-zinc-300 hover:bg-lime-400 hover:text-black hover:border-lime-400 transition-colors"
                    >
                      <Link to={`/contests/${contestSlug}/problems/${problemSlug}`}>
                        <span>{isSolved ? "Review Code" : isAttempted ? "Continue Solving" : "Solve Challenge"}</span>
                        <ArrowRight className="size-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Final Submission Card */}
        <section className="p-6 rounded-lg border border-white/10 bg-zinc-950 space-y-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md border border-white/10 bg-zinc-900 text-lime-400 shrink-0 mt-0.5">
              <Trophy className="size-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white">
                Ready to Complete Contest?
              </h3>
              <p className="text-xs text-zinc-400 font-mono leading-relaxed">
                {unattemptedCount > 0 ? (
                  <span className="text-amber-400">
                    You still have <strong>{unattemptedCount} unattempted question(s)</strong>. You can return to the coding workspace to complete them, or submit now if you are finished.
                  </span>
                ) : (
                  <span>
                    All challenges have been attempted and verified. Click below to officially submit your contest attempt and lock in your score.
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/6">
            <Button
              asChild
              variant="outline"
              className="w-full sm:w-auto rounded-md font-mono text-xs border-white/10 bg-black text-zinc-300 hover:bg-white/5 hover:text-white"
            >
              <Link to={`/contests/${contestSlug}/problems/${firstProblemSlug}`}>
                <ArrowLeft className="size-3.5 mr-1.5" />
                <span>Return to Coding Workspace</span>
              </Link>
            </Button>

            <Button
              onClick={() => setShowSubmitModal(true)}
              className="w-full sm:w-auto rounded-md font-mono text-xs font-semibold bg-lime-400 text-black hover:bg-lime-300 cursor-pointer shadow-lg transition-all"
            >
              <Send className="size-3.5 mr-1.5" />
              <span>Submit Final Contest</span>
            </Button>
          </div>
        </section>
      </main>

      {/* Final Submission Confirmation Dialog */}
      <AlertDialog open={showSubmitModal} onOpenChange={setShowSubmitModal}>
        <AlertDialogContent className="border border-white/10 bg-zinc-950 text-white p-6 max-w-md rounded-lg shadow-2xl">
          <AlertDialogHeader className="space-y-2.5 text-left">
            <div className="flex size-10 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <AlertTriangle className="size-5" />
            </div>
            <AlertDialogTitle className="text-base font-semibold text-white tracking-tight font-sans">
              Confirm Final Contest Submission?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-zinc-300 font-mono leading-relaxed">
              Once submitted, your test attempt will be finalized and evaluated against the full testcase judge. You will no longer be able to edit your solutions for this contest.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-md border border-white/8 bg-black p-3.5 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Total Solved:</span>
              <span className="font-semibold text-lime-400">{solvedCount} of {problems.length} Challenges</span>
            </div>
            {unattemptedCount > 0 && (
              <div className="flex items-center justify-between border-t border-white/6 pt-2">
                <span className="text-zinc-500">Unattempted:</span>
                <span className="font-semibold text-amber-400">{unattemptedCount} Questions</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-white/6 pt-2">
              <span className="text-zinc-500">Estimated Points:</span>
              <span className="font-semibold text-white">{earnedPoints} / {totalPossiblePoints} Pts</span>
            </div>
          </div>

          <AlertDialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
            <AlertDialogCancel
              disabled={isSubmittingFinal}
              className="rounded-md font-mono text-xs border-white/10 bg-black text-zinc-300 hover:bg-white/5 hover:text-white mt-0 cursor-pointer"
            >
              Continue Solving
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleFinalSubmit();
              }}
              disabled={isSubmittingFinal}
              className="rounded-md font-mono text-xs font-semibold bg-lime-400 text-black hover:bg-lime-300 cursor-pointer"
            >
              {isSubmittingFinal ? (
                <>
                  <span className="size-3 border-2 border-black border-t-transparent rounded-full animate-spin mr-1.5" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="size-3.5 mr-1.5" />
                  <span>Yes, Submit Contest</span>
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ContestSummaryPage;
