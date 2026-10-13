import React, { useState, useEffect, useMemo, useTransition } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search,
  CheckCircle2,
  Clock,
  Minus,
  Sparkles,
  Filter,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAppSelector } from "@/store/hooks";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, SectionHeader, EmptyState } from "@/organization/components/ui";
import { PracticeRowSkeleton, Skeleton } from "@/organization/components/skeletons";
import { practiceApi } from "@/features/practice/api";
import { getToken } from "@/lib/auth";
import { useSwrData } from "@/lib/cache/swrCache";
import type { PracticeProblemSummary, PracticeTopic, ProblemDifficulty } from "@/features/practice/types";

export function PracticePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Read URL query parameters as single source of truth
  const queryParam = searchParams.get("q") || "";
  const difficultyParam = searchParams.get("difficulty") || "ALL";
  const topicParam = searchParams.get("topic") || "ALL";
  const statusParam = searchParams.get("status") || "ALL";
  const pageParam = parseInt(searchParams.get("page") || "1", 10);

  // Local state for snappy typing in search bar
  const [searchInput, setSearchInput] = useState(queryParam);

  // Keep searchInput in sync if URL changes externally (e.g., back/forward)
  useEffect(() => {
    setSearchInput(queryParam);
  }, [queryParam]);

  // Fetch canonical topics taxonomy
  const { data: topicsData } = useSwrData<PracticeTopic[]>(
    "practice:topics",
    () => practiceApi.getTopics(),
    { ttl: 10 * 60 * 1000, staleTime: 60 * 1000 }
  );

  // Fetch problems list matching filters
  const { data: listData, loading, revalidate } = useSwrData(
    `practice:problems:${searchParams.toString()}`,
    () =>
      practiceApi.listProblems({
        q: queryParam || undefined,
        difficulty: difficultyParam !== "ALL" ? difficultyParam : undefined,
        topic: topicParam !== "ALL" ? topicParam : undefined,
        status: statusParam !== "ALL" ? statusParam : undefined,
        page: pageParam,
        limit: 50,
      }),
    { ttl: 60 * 1000, staleTime: 10 * 1000 }
  );

  const problems = listData?.items || [];
  const total = listData?.total || 0;
  const summary = listData?.summary || {
    total_published: 0,
    total_problems: 0,
    solved_count: 0,
    attempted_count: 0,
  };
  const totalPublishedCount =
    summary.total_published ??
    summary.total_problems ??
    listData?.total ??
    problems.length;
  const totalPages = listData?.pages || Math.ceil(total / 50) || 1;

  // Filter update handler updating URL search params
  const updateFilter = (key: string, value: string) => {
    startTransition(() => {
      const nextParams = new URLSearchParams(searchParams);
      if (!value || value === "ALL") {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
      // Reset to page 1 on filter changes
      if (key !== "page") {
        nextParams.delete("page");
      }
      setSearchParams(nextParams, { replace: true });
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilter("q", searchInput.trim());
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const hasActiveFilters =
    Boolean(queryParam) ||
    difficultyParam !== "ALL" ||
    topicParam !== "ALL" ||
    statusParam !== "ALL";

  // Current authenticated member
  const member = useAppSelector((state) => state.auth.member);
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedSuite = async () => {
    setIsSeeding(true);
    try {
      const res = await practiceApi.seedInstitutionalSuite();
      toast.success(res.message || "Institutional challenge suite calibrated successfully.");
      await revalidate();
    } catch (err: any) {
      toast.error(err?.message || "Failed to seed institutional challenges.");
    } finally {
      setIsSeeding(false);
    }
  };

  // Prefetch problem details on mouse enter
  const handlePrefetch = (slug: string) => {
    void practiceApi.getProblem(slug);
  };

  const getDifficultyBadge = (diff: ProblemDifficulty) => {
    switch (diff) {
      case "EASY":
        return (
          <span className="inline-flex items-center gap-1 font-sans text-[11px] font-semibold text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Easy
          </span>
        );
      case "MEDIUM":
        return (
          <span className="inline-flex items-center gap-1 font-sans text-[11px] font-semibold text-amber-400">
            <span className="size-1.5 rounded-full bg-amber-400" />
            Medium
          </span>
        );
      case "HARD":
        return (
          <span className="inline-flex items-center gap-1 font-sans text-[11px] font-semibold text-rose-400">
            <span className="size-1.5 rounded-full bg-rose-400" />
            Hard
          </span>
        );
      default:
        return <span className="font-sans text-[11px] text-zinc-500">{diff}</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Practice Arena"
        description="Sharpen your problem-solving skills across standard data structures and algorithms."
      />



      {/* Telemetry Header Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="p-5 rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] space-y-1 hover:border-[#B1FA63]/30 transition-all duration-200">
          <div className="text-xs font-heading font-bold uppercase tracking-wider text-zinc-400">
            Problems Available
          </div>
          <div className="text-3xl sm:text-4xl font-display text-white tabular-nums tracking-wide">
            {loading && !listData ? (
              <Skeleton className="h-9 sm:h-10 w-16 rounded-md my-1" />
            ) : (
              totalPublishedCount
            )}
          </div>
          <div className="text-xs font-sans text-zinc-500">Active repository</div>
        </div>

        <div className="p-5 rounded-[24px] border border-[#B1FA63]/25 bg-[#1F1F1F] space-y-1 hover:border-[#B1FA63]/50 transition-all duration-200">
          <div className="text-xs font-heading font-bold uppercase tracking-wider text-[#B1FA63]">
            Solved by You
          </div>
          <div className="text-3xl sm:text-4xl font-display text-[#B1FA63] tabular-nums tracking-wide">
            {loading && !listData ? (
              <Skeleton className="h-9 sm:h-10 w-16 rounded-md my-1" />
            ) : (
              summary.solved_count
            )}
          </div>
          <div className="text-xs font-sans text-[#B1FA63]/70">Authoritative solves</div>
        </div>

        <div className="p-5 rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] space-y-1 hover:border-[#B1FA63]/30 transition-all duration-200">
          <div className="text-xs font-heading font-bold uppercase tracking-wider text-zinc-400">
            Attempted
          </div>
          <div className="text-3xl sm:text-4xl font-display text-amber-400 tabular-nums tracking-wide">
            {loading && !listData ? (
              <Skeleton className="h-9 sm:h-10 w-16 rounded-md my-1" />
            ) : (
              summary.attempted_count
            )}
          </div>
          <div className="text-xs font-sans text-zinc-500">Submissions logged</div>
        </div>
      </section>

      {/* Search & Filter Toolbar */}
      <section className="rounded-[20px] border border-white/[0.08] bg-[#1F1F1F] p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full">
          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-0">
            <Search className="size-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search problems by title, topic, or keyword…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onBlur={() => {
                if (searchInput.trim() !== queryParam) {
                  updateFilter("q", searchInput.trim());
                }
              }}
              className="h-10 pl-9 pr-3 text-base md:text-xs bg-[#171717] border-white/12 font-sans rounded-md text-white placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-lime-400 focus-visible:border-lime-400 w-full"
            />
          </form>

          {/* Quick Filters - All in one horizontal line */}
          <div className="flex items-center gap-2 shrink-0 flex-nowrap overflow-x-auto no-scrollbar">
            {/* Difficulty Selector */}
            <Select
              value={difficultyParam}
              onValueChange={(val) => updateFilter("difficulty", val)}
            >
              <SelectTrigger
                aria-label="Filter by difficulty"
                className="w-[140px] shrink-0"
              >
                <SelectValue placeholder="All Difficulties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Difficulties</SelectItem>
                <SelectItem value="EASY">Easy</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HARD">Hard</SelectItem>
              </SelectContent>
            </Select>

            {/* Topic Selector */}
            <Select
              value={topicParam}
              onValueChange={(val) => updateFilter("topic", val)}
            >
              <SelectTrigger
                aria-label="Filter by topic"
                className="w-[140px] shrink-0"
              >
                <SelectValue placeholder="All Topics" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Topics</SelectItem>
                {(Array.isArray(topicsData) ? topicsData : []).map((t) => (
                  <SelectItem key={t.slug} value={t.slug}>
                    {t.name}{typeof t.count === "number" && t.count > 0 ? ` (${t.count})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Selector */}
            <Select
              value={statusParam}
              onValueChange={(val) => updateFilter("status", val)}
            >
              <SelectTrigger
                aria-label="Filter by status"
                className="w-[140px] shrink-0"
              >
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="SOLVED">Solved</SelectItem>
                <SelectItem value="ATTEMPTED">Attempted</SelectItem>
                <SelectItem value="UNSOLVED">Unsolved</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="h-10 px-3 shrink-0 text-xs font-sans font-medium text-zinc-400 hover:text-white flex items-center gap-1.5 border border-white/12 hover:border-white/20 rounded-md bg-[#171717] transition-colors cursor-pointer"
                title="Reset all filters"
              >
                <RotateCcw className="size-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Problems Dense Table */}
      <section className="rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] overflow-hidden">
        {problems.length === 0 && !loading ? (
          <div className="py-16 text-center space-y-4 font-sans px-4 flex flex-col items-center justify-center">
            <div className="mb-2 flex items-center justify-center">
              <img
                src="/matiks-assets/empty-states/no_feed.webp"
                alt="No matching practice problems"
                className="w-36 h-36 sm:w-44 sm:h-44 object-contain select-none pointer-events-none"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <div className="text-zinc-300 text-sm font-semibold">
              {hasActiveFilters ? "No problems match these filters." : "No practice challenges available yet."}
            </div>
            <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
              {hasActiveFilters
                ? "Try relaxing your search query or selecting a different topic."
                : member?.is_core_member
                ? "Institutional problems are unseeded or currently in DRAFT status. Proctors can seed the canonical 8-problem suite or calibrate new challenges via Mission Control."
                : "Institutional problems are being calibrated by CCC proctors."}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-lime-400 border border-lime-400/30 bg-lime-400/10 rounded-md hover:bg-lime-400/20 transition-colors cursor-pointer"
              >
                Clear all filters
              </button>
            ) : member?.is_core_member ? (
              <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleSeedSuite}
                  disabled={isSeeding}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-black bg-lime-400 hover:bg-lime-300 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSeeding ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  <span>Seed Canonical 8-Problem Suite</span>
                </button>
                <a
                  href={
                    typeof window !== "undefined" && window.location.hostname === "localhost"
                      ? getToken()
                        ? `http://localhost:8082?token=${encodeURIComponent(getToken()!)}`
                        : "http://localhost:8082"
                      : getToken()
                        ? `https://admin.chaoscomputerclub.in?token=${encodeURIComponent(getToken()!)}`
                        : "https://admin.chaoscomputerclub.in"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] rounded-md transition-colors"
                >
                  <span>Open Mission Control Desk</span>
                  <ExternalLink className="size-3.5 text-zinc-400" />
                </a>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead>
                <tr className="border-b border-white/8 text-[11px] text-zinc-500 uppercase tracking-wider bg-white/[0.01]">
                  <th className="py-3 px-4 w-12 text-center">Status</th>
                  <th className="py-3 px-4 w-16">#</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4 w-28">Difficulty</th>
                  <th className="py-3 px-4 w-40">Topic</th>
                  <th className="py-3 px-4 w-28 text-right">Acceptance</th>
                  <th className="py-3 px-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <PracticeRowSkeleton count={8} />
                ) : (
                  problems.map((p, idx) => {
                    const displayIndex = p.problem_index || String((pageParam - 1) * 50 + idx + 1).padStart(3, "0");
                    return (
                    <tr
                      key={p.id}
                      onMouseEnter={() => handlePrefetch(p.slug)}
                      onFocus={() => handlePrefetch(p.slug)}
                      className="group hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Solved Status Indicator */}
                      <td className="py-3.5 px-4 text-center">
                        {p.user_status === "SOLVED" ? (
                          <span title="Solved">
                            <CheckCircle2 className="size-4 text-lime-400 inline" />
                          </span>
                        ) : p.user_status === "ATTEMPTED" ? (
                          <span title="Attempted">
                            <Clock className="size-4 text-amber-400 inline" />
                          </span>
                        ) : (
                          <span title="Unattempted">
                            <Minus className="size-3 text-zinc-700 inline" />
                          </span>
                        )}
                      </td>

                      {/* Problem Number */}
                      <td className="py-3.5 px-4 text-zinc-500 tabular-nums">
                        {displayIndex}
                      </td>

                      {/* Title + Link */}
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/practice/${p.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-white hover:text-lime-400 transition-colors inline-flex items-center gap-1.5"
                        >
                          <span>{p.title}</span>
                        </Link>
                      </td>

                      {/* Difficulty */}
                      <td className="py-3.5 px-4">
                        {getDifficultyBadge(p.difficulty)}
                      </td>

                      {/* Topic */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded border border-white/8 bg-transparent text-[11px] text-zinc-300">
                          {p.topic}
                        </span>
                      </td>

                      {/* Acceptance Rate */}
                      <td className="py-3.5 px-4 text-right text-zinc-400 tabular-nums">
                        {p.total_submissions > 0 ? `${p.acceptance_rate}%` : "—"}
                      </td>

                      {/* Action Chevron */}
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/practice/${p.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-600 group-hover:text-lime-400 transition-colors inline-block"
                          aria-label={`Open problem ${p.title}`}
                        >
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-white/8 font-sans text-xs text-zinc-400">
            <div>
              Page <strong className="text-white tabular-nums">{pageParam}</strong> of{" "}
              <strong className="text-white tabular-nums">{totalPages}</strong>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pageParam <= 1}
                onClick={() => updateFilter("page", String(pageParam - 1))}
                className="px-3 py-1.5 rounded border border-white/10 hover:border-white/20 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ChevronLeft className="size-3.5" />
                Previous
              </button>
              <button
                type="button"
                disabled={pageParam >= totalPages}
                onClick={() => updateFilter("page", String(pageParam + 1))}
                className="px-3 py-1.5 rounded border border-white/10 hover:border-white/20 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                Next
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
