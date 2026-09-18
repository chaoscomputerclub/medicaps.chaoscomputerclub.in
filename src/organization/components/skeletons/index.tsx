/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * Cyber Skeleton Loading Library
 * Ultra-high-fidelity production-grade loaders pixel-matched to CCC layouts.
 */

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export { Skeleton };

/* -------------------------------------------------------------------------- */
/* 1. Component Primitives & Micro Skeletons                                  */
/* -------------------------------------------------------------------------- */

export function SkeletonText({ className, lines = 1 }: { className?: string; lines?: number }) {
  if (lines === 1) {
    return <Skeleton className={cn("h-3 w-3/4 rounded-md", className)} />;
  }
  return (
    <div className="space-y-2 w-full">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3 rounded-md", i === lines - 1 ? "w-4/5" : "w-full", className)}
        />
      ))}
    </div>
  );
}

export function MetricsGridSkeleton() {
  return (
    <section className="metrics-grid">
      {[
        { labelW: "w-20", valW: "w-24", subW: "w-28" },
        { labelW: "w-24", valW: "w-20", subW: "w-32" },
        { labelW: "w-24", valW: "w-16", subW: "w-28" },
        { labelW: "w-24", valW: "w-16", subW: "w-24" },
      ].map((item, idx) => (
        <div key={idx} className="metric border border-white/10 bg-zinc-900/60 p-4">
          <Skeleton className={cn("h-2.5 mb-2.5", item.labelW)} />
          <Skeleton className={cn("h-7 mb-2", item.valW)} />
          <Skeleton className={cn("h-2.5", item.subW)} />
        </div>
      ))}
    </section>
  );
}

export function RatingChartSkeleton() {
  return (
    <div className="rating-chart flex flex-col justify-between p-4 border border-white/10 bg-zinc-900/60 min-h-[220px]">
      <div className="flex justify-between items-center mb-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="flex-1 flex items-end gap-2 pt-6 pb-2 border-b border-white/10">
        {[30, 48, 42, 65, 58, 80, 72, 88, 75, 92, 85, 96].map((h, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
            <Skeleton className="w-full rounded-md" style={{ height: `${h}%` }} />
            <Skeleton className="h-2 w-5 mt-1" />
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center pt-2">
        <Skeleton className="h-2 w-16" />
        <Skeleton className="h-2 w-28" />
        <Skeleton className="h-2 w-16" />
      </div>
    </div>
  );
}

export function CampusPassSkeleton() {
  return (
    <article className="campus-pass border border-white/10 bg-zinc-900/60 p-6 relative">
      <div className="pass-cut pass-cut-left" />
      <div className="pass-cut pass-cut-right" />
      <header className="flex justify-between items-center pb-4 border-b border-white/10">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-36" />
      </header>
      <div className="pass-body grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 py-5">
        <div>
          <Skeleton className="h-2.5 w-24 mb-2" />
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-3 w-36 mb-5" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Skeleton className="h-2 w-14 mb-1.5" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div>
              <Skeleton className="h-2 w-12 mb-1.5" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div>
              <Skeleton className="h-2 w-14 mb-1.5" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div>
              <Skeleton className="h-2 w-20 mb-1.5" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
        <div className="pass-qr flex flex-col items-center justify-center p-3 border border-white/10 bg-black/40">
          <Skeleton className="w-[110px] h-[110px] rounded-md" />
          <Skeleton className="h-2.5 w-20 mt-2" />
        </div>
      </div>
      <footer className="flex justify-between items-center pt-4 border-t border-white/10">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-28" />
      </footer>
    </article>
  );
}

export function ProofBadgeSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <article className="proof-badge border border-white/10 bg-zinc-900/60 p-5 space-y-4">
      <div className="proof-header flex justify-between items-start">
        <div className="w-full">
          <Skeleton className="h-3.5 w-28 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="w-8 h-8 rounded-md flex-shrink-0" />
      </div>
      <dl className="proof-grid grid grid-cols-2 gap-3 py-2 border-y border-white/10">
        <div>
          <Skeleton className="h-2 w-14 mb-1" />
          <Skeleton className="h-3.5 w-28" />
        </div>
        <div>
          <Skeleton className="h-2 w-14 mb-1" />
          <Skeleton className="h-3.5 w-24" />
        </div>
        {!compact && (
          <>
            <div>
              <Skeleton className="h-2 w-20 mb-1" />
              <Skeleton className="h-3.5 w-32" />
            </div>
            <div>
              <Skeleton className="h-2 w-20 mb-1" />
              <Skeleton className="h-3.5 w-32" />
            </div>
          </>
        )}
      </dl>
      <div className="hash-row p-2 bg-black/60 border border-white/10">
        <Skeleton className="h-2.5 w-full" />
      </div>
      <footer className="flex justify-between items-center">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-2.5 w-16" />
      </footer>
    </article>
  );
}

export function ScoreboardMatrixSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="overflow-x-auto border border-white/10 bg-zinc-900/60">
      <table className="w-full text-left font-mono text-xs">
        <thead>
          <tr className="border-b border-white/10 bg-neutral-900/50">
            <th className="p-3 w-12">#</th>
            <th className="p-3">Contestant</th>
            {!compact && <th className="p-3">Dept.</th>}
            <th className="p-3 text-center">A</th>
            <th className="p-3 text-center">B</th>
            <th className="p-3 text-center">C</th>
            <th className="p-3 text-center">D</th>
            <th className="p-3 text-center">Solved</th>
            <th className="p-3 text-center">Penalty</th>
            <th className="p-3 text-center">Δ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <tr key={i} className="hover:bg-neutral-900/30">
              <td className="p-3">
                <Skeleton className="h-4 w-5" />
              </td>
              <td className="p-3">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-2.5 w-36" />
                </div>
              </td>
              {!compact && (
                <td className="p-3">
                  <Skeleton className="h-3 w-16" />
                </td>
              )}
              <td className="p-3 text-center">
                <Skeleton className="h-5 w-8 mx-auto" />
              </td>
              <td className="p-3 text-center">
                <Skeleton className="h-5 w-8 mx-auto" />
              </td>
              <td className="p-3 text-center">
                <Skeleton className="h-5 w-8 mx-auto" />
              </td>
              <td className="p-3 text-center">
                <Skeleton className="h-5 w-8 mx-auto" />
              </td>
              <td className="p-3 text-center">
                <Skeleton className="h-4 w-6 mx-auto" />
              </td>
              <td className="p-3 text-center">
                <Skeleton className="h-3 w-12 mx-auto" />
              </td>
              <td className="p-3 text-center">
                <Skeleton className="h-3 w-8 mx-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LeaderboardRowSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="border-b border-white/10 hover:bg-neutral-900/30">
          <td className="p-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-3 w-4" />
            </div>
          </td>
          <td className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-md flex-shrink-0" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-2.5 w-20" />
              </div>
            </div>
          </td>
          <td className="p-4">
            <Skeleton className="h-5 w-20" />
          </td>
          <td className="p-4">
            <Skeleton className="h-4 w-12" />
          </td>
          <td className="p-4">
            <Skeleton className="h-4 w-12" />
          </td>
          <td className="p-4">
            <div className="flex items-center gap-2">
              <Skeleton className="w-16 h-1.5 rounded-md" />
              <Skeleton className="h-3 w-8" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

export function AnnouncementFeedSkeleton() {
  return (
    <div className="feed-list divide-y divide-white/10 border border-white/10 bg-zinc-900/60">
      {[1, 2, 3].map((i) => (
        <article key={i} className="p-4 space-y-2">
          <Skeleton className="h-2.5 w-20 mb-2" />
          <Skeleton className="h-4 w-4/5 mb-2" />
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-3/4 mb-3" />
          <Skeleton className="h-2.5 w-28" />
        </article>
      ))}
    </div>
  );
}

export function BattleHistorySkeleton() {
  return (
    <div className="battle-history divide-y divide-white/10 border border-white/10 bg-zinc-900/60">
      {[1, 2, 3, 4].map((i) => (
        <article key={i} className="p-4 flex items-center justify-between gap-4">
          <Skeleton className="h-3 w-20" />
          <div className="flex flex-col gap-1 flex-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-2.5 w-32" />
          </div>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-10 ml-auto" />
        </article>
      ))}
    </div>
  );
}

export function AchievementGridSkeleton() {
  return (
    <div className="achievement-grid grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <article key={i} className="border border-white/10 bg-zinc-900/60 p-4 space-y-2">
          <Skeleton className="w-6 h-6 mb-2 rounded-md" />
          <Skeleton className="h-2.5 w-16 mb-2" />
          <Skeleton className="h-3.5 w-32 mb-1.5" />
          <Skeleton className="h-2.5 w-full mb-1" />
          <Skeleton className="h-2.5 w-4/5" />
        </article>
      ))}
    </div>
  );
}

export function ContestRowSkeleton() {
  return (
    <article className="contest-row flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 border border-white/10 bg-neutral-900/40">
      <div className="flex items-start gap-4 flex-1">
        <div className="shrink-0 p-3 border border-white/10 bg-black/50 text-center">
          <Skeleton className="h-6 w-8 mx-auto mb-1" />
          <Skeleton className="h-2.5 w-8 mx-auto" />
        </div>
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-3.5 w-4/5" />
          <div className="flex items-center gap-4 pt-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Full Page-Level Skeletons                                               */
/* -------------------------------------------------------------------------- */

/**
 * ContestsHubSkeleton: Matches the LeetCode + CCC competitive arena hub.
 */
export function ContestsHubSkeleton() {
  return (
    <div className="page-wrap space-y-8 animate-in fade-in duration-300">
      {/* Header Lockup */}
      <header className="page-header flex flex-col md:flex-row justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-3.5 w-96 max-w-full" />
        </div>
        <div className="ranking-meta p-3 border border-white/10 bg-zinc-900/60 space-y-1">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      </header>

      {/* Section 1: Upcoming Contest Hero Cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="border border-white/10 bg-zinc-900/60 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-4 w-10" />
                </div>
                <Skeleton className="h-3.5 w-28" />
              </div>

              <div className="space-y-2">
                <Skeleton className="h-6 w-4/5" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-3/4" />
              </div>

              {/* Countdown Ticker Box */}
              <div className="border border-white/10 bg-black/40 p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <div className="grid grid-cols-4 gap-2 text-center pt-1">
                  {[1, 2, 3, 4].map((slot) => (
                    <div key={slot} className="border border-white/10 bg-neutral-900/50 py-2 flex flex-col items-center gap-1">
                      <Skeleton className="h-5 w-8" />
                      <Skeleton className="h-2 w-6" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <Skeleton className="h-9 flex-1" />
                <Skeleton className="h-9 w-28" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: Screening Alert Banner */}
      <div className="border border-white/10 bg-neutral-900/30 p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-md flex-shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-80 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-8 w-32" />
      </div>

      {/* Section 3: 2-Column Split (Past Contests + Top Rankers) */}
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Tabs & Search */}
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-28" />
            </div>
            <Skeleton className="h-8 w-60" />
          </div>

          {/* Past Contests List */}
          <div className="border border-white/10 bg-zinc-900/60 divide-y divide-white/10">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-5 flex flex-col sm:flex-row justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-8" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-5 w-3/4" />
                  <div className="flex items-center gap-4 pt-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Skeleton className="h-8 w-28" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Top Rankers Podium */}
        <div className="space-y-4">
          <div className="border border-white/10 bg-zinc-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between p-2.5 border border-white/10 bg-black/40">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-5" />
                    <Skeleton className="w-7 h-7 rounded-md" />
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
            <Skeleton className="h-8 w-full mt-2" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * LeaderboardSkeleton: Full page university rankings skeleton.
 */
export function LeaderboardSkeleton() {
  return (
    <div className="page-wrap space-y-6 animate-in fade-in duration-300">
      <header className="page-header flex flex-col md:flex-row justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-8 w-60" />
          <Skeleton className="h-3.5 w-96 max-w-full" />
        </div>
        <div className="ranking-meta p-3 border border-white/10 bg-zinc-900/60 space-y-1">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </header>

      <div className="overflow-x-auto border border-white/10 bg-zinc-900/60">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-neutral-900/50">
              <th className="p-4 text-left font-mono text-xs uppercase font-bold text-neutral-400">Rank</th>
              <th className="p-4 text-left font-mono text-xs uppercase font-bold text-neutral-400">Member</th>
              <th className="p-4 text-left font-mono text-xs uppercase font-bold text-neutral-400">Trend</th>
              <th className="p-4 text-left font-mono text-xs uppercase font-bold text-neutral-400">Rating</th>
              <th className="p-4 text-left font-mono text-xs uppercase font-bold text-neutral-400">Peak</th>
              <th className="p-4 text-left font-mono text-xs uppercase font-bold text-neutral-400">Attended</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            <LeaderboardRowSkeleton count={10} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * MyContestsSkeleton: User's personal contest record ledger.
 */
export function MyContestsSkeleton() {
  return (
    <div className="page-wrap p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header with 3 quick stat boxes */}
      <header className="flex flex-col justify-between gap-5 border-b border-white/10 pb-6 md:flex-row md:items-end">
        <div className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>
        <div className="flex gap-4 sm:gap-6 items-center flex-wrap">
          <div className="border-l-2 border-orange-500 pl-3 space-y-1">
            <Skeleton className="h-6 w-8" />
            <Skeleton className="h-2 w-20" />
          </div>
          <div className="border-l-2 border-yellow-500 pl-3 space-y-1">
            <Skeleton className="h-6 w-8" />
            <Skeleton className="h-2 w-24" />
          </div>
          <div className="border-l-2 border-emerald-500 pl-3 space-y-1">
            <Skeleton className="h-6 w-8" />
            <Skeleton className="h-2 w-28" />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border border-white/10 bg-zinc-900/60 p-1 w-fit">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-7 w-28" />
      </div>

      {/* Main Ledger Card */}
      <section className="border border-white/10 bg-zinc-900/60">
        <div className="flex items-center justify-between border-b border-white/10 bg-neutral-900/50 p-4 sm:p-6">
          <div className="space-y-1">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-5 w-44" />
          </div>
          <Skeleton className="h-8 w-36" />
        </div>

        <div className="divide-y divide-white/10">
          {[1, 2, 3, 4].map((i) => (
            <article key={i} className="p-5 sm:p-6 flex flex-col lg:flex-row justify-between gap-5 lg:items-center">
              <div className="flex items-start gap-4">
                <Skeleton className="w-10 h-10 rounded-md shrink-0" />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <Skeleton className="h-5 w-64" />
                  <div className="flex items-center gap-4 pt-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-white/10">
                <div className="space-y-1 text-right">
                  <Skeleton className="h-2 w-10 ml-auto" />
                  <Skeleton className="h-5 w-12 ml-auto" />
                </div>
                <div className="space-y-1 text-right">
                  <Skeleton className="h-2 w-12 ml-auto" />
                  <Skeleton className="h-5 w-16 ml-auto" />
                </div>
                <Skeleton className="h-8 w-28" />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * ProblemArchiveSkeleton: Completed problem archive grid.
 */
export function ProblemArchiveSkeleton() {
  return (
    <div className="page-wrap space-y-6 animate-in fade-in duration-300">
      <header className="page-header flex flex-col md:flex-row justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-3.5 w-96 max-w-full" />
        </div>
        <Skeleton className="w-10 h-10 rounded-md flex-shrink-0" />
      </header>

      <section className="border border-white/10 bg-zinc-900/60 p-6 space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-5 w-48" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <article key={i} className="flex items-center justify-between p-4 border border-white/10 bg-neutral-900/40">
              <div className="flex items-center gap-4 flex-1">
                <Skeleton className="w-8 h-8 rounded-md shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-2.5 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * ProblemsSkeleton: Alias for ProblemArchiveSkeleton.
 */
export const ProblemsSkeleton = ProblemArchiveSkeleton;

/**
 * ProblemDetailSkeleton: Editorial & statement preview.
 */
export function ProblemDetailSkeleton() {
  return (
    <div className="page-wrap p-6 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <Skeleton className="h-4 w-36" />

      <header className="border-b border-white/10 pb-6 flex items-start gap-5">
        <Skeleton className="w-12 h-12 rounded-md shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-3 w-40" />
        </div>
      </header>

      {/* No submission banner */}
      <div className="border border-yellow-500/30 bg-yellow-950/20 p-4 flex items-start gap-3">
        <Skeleton className="w-5 h-5 rounded-md shrink-0 mt-0.5" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>

      {/* Editorial Body */}
      <article className="border border-white/10 bg-zinc-900/60 p-6 space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-6 w-52" />
        </div>

        <div className="space-y-2 pt-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3.5 w-full" />
        </div>

        <div className="space-y-3 pt-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3.5 w-5/6" />
          <Skeleton className="h-20 w-full" />
        </div>

        <div className="pt-4 border-t border-white/10 flex items-center gap-2">
          <Skeleton className="w-4 h-4 rounded-md shrink-0" />
          <Skeleton className="h-3 w-80" />
        </div>
      </article>
    </div>
  );
}

/**
 * ContestDetailSkeleton / ContestOverviewSkeleton:
 * Contest hero briefing, timeline, registration bar, problem sets.
 */
export function ContestDetailSkeleton() {
  return (
    <div className="page-wrap space-y-8 animate-in fade-in duration-300">
      <Skeleton className="h-4 w-32" />

      {/* Hero */}
      <header className="border border-white/10 bg-zinc-900/60 p-6 md:p-8 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-10" />
          </div>
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-4/5 max-w-full" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/10">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-5 w-32" />
            </div>
          ))}
        </div>
      </header>

      {/* Registration Status Band */}
      <div className="border border-white/10 bg-neutral-900/40 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>
        <div className="flex gap-3 shrink-0">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* Problem Set Preview */}
      <section className="border border-white/10 bg-zinc-900/60 p-6 space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-5 w-44" />
        </div>
        <div className="divide-y divide-white/10">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-md shrink-0" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-2.5 w-28" />
                </div>
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export const ContestOverviewSkeleton = ContestDetailSkeleton;

/**
 * ContestResultsSkeleton: Round 1 ranking leaderboard.
 */
export function ContestResultsSkeleton() {
  return (
    <div className="page-wrap max-w-6xl space-y-6 animate-in fade-in duration-300">
      <Skeleton className="h-4 w-32" />

      <header className="space-y-2 border-b border-white/10 pb-6">
        <Skeleton className="h-3 w-44" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-3.5 w-96 max-w-full" />
      </header>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
        </div>
        <Skeleton className="h-8 w-56" />
      </div>

      {/* Standings Table */}
      <div className="overflow-x-auto border border-white/10 bg-zinc-900/60">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-neutral-900/50">
              <th className="p-3">Rank</th>
              <th className="p-3">Candidate</th>
              <th className="p-3">Dept</th>
              <th className="p-3 text-right">Score</th>
              <th className="p-3 text-right">Solved</th>
              <th className="p-3 text-right">Penalty</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <tr key={i} className="hover:bg-neutral-900/30">
                <td className="p-3">
                  <Skeleton className="h-4 w-6" />
                </td>
                <td className="p-3">
                  <div className="space-y-1">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                </td>
                <td className="p-3">
                  <Skeleton className="h-3 w-12" />
                </td>
                <td className="p-3 text-right">
                  <Skeleton className="h-4 w-10 ml-auto" />
                </td>
                <td className="p-3 text-right">
                  <Skeleton className="h-4 w-8 ml-auto" />
                </td>
                <td className="p-3 text-right">
                  <Skeleton className="h-3 w-14 ml-auto" />
                </td>
                <td className="p-3">
                  <Skeleton className="h-5 w-24" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * ContestFinalResultsSkeleton: Round 2 top 3 podium & final matrix.
 */
export function ContestFinalResultsSkeleton() {
  return (
    <div className="page-wrap space-y-6 animate-in fade-in duration-300">
      <Skeleton className="h-4 w-32" />

      <header className="space-y-2 border-b border-white/10 pb-6">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-3.5 w-96 max-w-full" />
      </header>

      {/* Top 3 Finalists Podium */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border border-white/10 bg-zinc-900/60 p-5 space-y-3">
            <Skeleton className="w-6 h-6 rounded-md" />
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-4 w-24 pt-2" />
          </div>
        ))}
      </section>

      {/* Full Matrix Table */}
      <div className="overflow-x-auto border border-white/10 bg-zinc-900/60">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-neutral-900/50">
              <th className="p-3">Rank</th>
              <th className="p-3">Finalist</th>
              <th className="p-3">Division</th>
              <th className="p-3 text-right">Solved</th>
              <th className="p-3 text-right">Score</th>
              <th className="p-3 text-right">Penalty</th>
              <th className="p-3 text-right">Rating Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <tr key={i} className="hover:bg-neutral-900/30">
                <td className="p-3">
                  <Skeleton className="h-4 w-6" />
                </td>
                <td className="p-3">
                  <div className="space-y-1">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-2.5 w-24" />
                  </div>
                </td>
                <td className="p-3">
                  <Skeleton className="h-3 w-12" />
                </td>
                <td className="p-3 text-right">
                  <Skeleton className="h-4 w-8 ml-auto" />
                </td>
                <td className="p-3 text-right">
                  <Skeleton className="h-4 w-12 ml-auto" />
                </td>
                <td className="p-3 text-right">
                  <Skeleton className="h-3 w-10 ml-auto" />
                </td>
                <td className="p-3 text-right">
                  <Skeleton className="h-4 w-10 ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * ContestOfflineSkeleton: Hardware pass, seat allocation, and offline briefing.
 */
export function ContestOfflineSkeleton() {
  return (
    <div className="page-wrap space-y-6 animate-in fade-in duration-300">
      <Skeleton className="h-4 w-32" />

      <header className="space-y-2 border-b border-white/10 pb-6">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-3.5 w-96 max-w-full" />
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pass Card */}
        <CampusPassSkeleton />

        {/* Venue / Proctor Briefing */}
        <div className="border border-white/10 bg-zinc-900/60 p-6 space-y-5">
          <div className="space-y-1">
            <Skeleton className="h-2.5 w-28" />
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3 items-center">
                <Skeleton className="w-5 h-5 rounded-md shrink-0" />
                <Skeleton className="h-3.5 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-full pt-2" />
        </div>
      </div>
    </div>
  );
}

/**
 * ContestLobbySkeleton: Assessment rules, countdown timer, acknowledge box.
 */
export function ContestLobbySkeleton() {
  return (
    <div className="page-wrap max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      <Skeleton className="h-4 w-32" />

      <header className="space-y-2 border-b border-white/10 pb-6 text-center">
        <Skeleton className="h-3 w-44 mx-auto" />
        <Skeleton className="h-8 w-64 mx-auto" />
        <Skeleton className="h-3.5 w-96 max-w-full mx-auto" />
      </header>

      <div className="border border-white/10 bg-zinc-900/60 p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border border-white/10 bg-black/40 p-3 space-y-1">
              <Skeleton className="h-2.5 w-16 mx-auto" />
              <Skeleton className="h-5 w-20 mx-auto" />
            </div>
          ))}
        </div>

        <div className="space-y-3 pt-2">
          <Skeleton className="h-4 w-36" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 items-start">
              <Skeleton className="w-4 h-4 rounded-md shrink-0 mt-0.5" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-4 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-4 h-4 rounded-md shrink-0" />
            <Skeleton className="h-3.5 w-80" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * VerifyProofSkeleton: Cryptographic proof validation console.
 */
export function VerifyProofSkeleton() {
  return (
    <div className="page-wrap p-6 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <header className="page-header flex justify-between items-start border-b border-white/10 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-3.5 w-96 max-w-full" />
        </div>
        <Skeleton className="w-10 h-10 rounded-md flex-shrink-0" />
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border border-white/10 bg-zinc-900/60 p-1 w-fit">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-44" />
      </div>

      {/* Form Search */}
      <div className="border border-white/10 bg-zinc-900/60 p-6 space-y-4">
        <Skeleton className="h-3 w-48" />
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-28" />
        </div>
        <Skeleton className="h-2.5 w-64" />
      </div>

      {/* Proof Card Preview */}
      <ProofBadgeSkeleton />
    </div>
  );
}

export const VerifySkeleton = VerifyProofSkeleton;

/**
 * ProfileSkeleton: Full cadet profile screen.
 */
export function ProfileSkeleton() {
  return (
    <div className="page-wrap p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Profile Header */}
      <header className="border border-white/10 bg-zinc-900/60 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5">
          <Skeleton className="w-20 h-20 rounded-md shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-3.5 w-44" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>

        <div className="flex gap-6 border-t md:border-t-0 pt-4 md:pt-0 border-white/10">
          <div className="space-y-1 text-right">
            <Skeleton className="h-2.5 w-16 ml-auto" />
            <Skeleton className="h-7 w-20 ml-auto" />
            <Skeleton className="h-2.5 w-24 ml-auto" />
          </div>
          <div className="space-y-1 text-right">
            <Skeleton className="h-2.5 w-20 ml-auto" />
            <Skeleton className="h-7 w-24 ml-auto" />
            <Skeleton className="h-2.5 w-16 ml-auto" />
          </div>
        </div>
      </header>

      {/* Metrics */}
      <MetricsGridSkeleton />

      {/* Rating Chart + Hardware Pass */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 border border-white/10 bg-zinc-900/60 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <Skeleton className="h-2.5 w-28" />
              <Skeleton className="h-5 w-44" />
            </div>
            <Skeleton className="h-3 w-20" />
          </div>
          <RatingChartSkeleton />
        </div>

        <CampusPassSkeleton />
      </div>

      {/* Battle History */}
      <section className="border border-white/10 bg-zinc-900/60 p-6 space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-5 w-40" />
        </div>
        <BattleHistorySkeleton />
      </section>

      {/* Achievements + Cryptographic Proof */}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="border border-white/10 bg-zinc-900/60 p-6 space-y-4">
          <div className="space-y-1">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-5 w-36" />
          </div>
          <AchievementGridSkeleton />
        </section>

        <section className="border border-white/10 bg-zinc-900/60 p-6 space-y-4">
          <div className="space-y-1">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-5 w-44" />
          </div>
          <ProofBadgeSkeleton />
        </section>
      </div>
    </div>
  );
}

/**
 * SettingsSkeleton: User settings, profile edit form, and account credentials.
 */
export function SettingsSkeleton() {
  return (
    <div className="page-wrap p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      <header className="border-b border-white/10 pb-6 space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-3.5 w-80 max-w-full" />
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border border-white/10 bg-zinc-900/60 p-1 w-fit">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-32" />
      </div>

      {/* Form Card */}
      <div className="border border-white/10 bg-zinc-900/60 p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-5 border-b border-white/10 pb-6">
          <Skeleton className="w-16 h-16 rounded-md shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-36" />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-24 w-full" />
        </div>

        <div className="flex justify-end pt-4 border-t border-white/10">
          <Skeleton className="h-10 w-36" />
        </div>
      </div>
    </div>
  );
}

/**
 * DashboardSkeleton: Main home operations console.
 */
export function DashboardSkeleton() {
  return (
    <div className="page-wrap space-y-8 animate-in fade-in duration-300">
      <header className="page-header flex flex-col md:flex-row justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>
        <div className="member-rating p-3 border border-white/10 bg-zinc-900/60 space-y-1">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </header>

      {/* Live Command Banner */}
      <div className="border border-white/10 bg-zinc-900/60 p-6 flex flex-col lg:flex-row justify-between gap-6">
        <div className="space-y-3 flex-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-3.5 w-5/6" />
          <div className="flex items-center gap-2 pt-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-6">
          <div className="space-y-1">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-6 w-20" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
      </div>

      <MetricsGridSkeleton />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 border border-white/10 bg-zinc-900/60 p-6 space-y-4">
          <div className="space-y-1">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-5 w-40" />
          </div>
          <RatingChartSkeleton />
        </div>
        <CampusPassSkeleton />
      </div>

      <section className="border border-white/10 bg-zinc-900/60 p-6 space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-5 w-48" />
        </div>
        <ScoreboardMatrixSkeleton />
      </section>
    </div>
  );
}

/**
 * ContestsSkeleton: Legacy export.
 */
export const ContestsSkeleton = ContestsHubSkeleton;

/**
 * AssessmentStudioSkeleton: Live code editor & assessment workspace skeleton.
 */
export function AssessmentStudioSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-200 font-sans select-none overflow-hidden animate-in fade-in duration-300">
      {/* Top Proctored Header */}
      <header className="flex items-center justify-between border-b border-white/10 bg-zinc-900/60 px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-7 w-20" />
        </div>
      </header>

      {/* Problem Picker Bar */}
      <div className="flex items-center border-b border-white/10 bg-zinc-900/80 px-3 py-1.5 gap-2 shrink-0">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-7 w-28" />
        ))}
      </div>

      {/* Split Arena: Left Problem + Right Code Editor */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        <div className="border-r border-white/10 p-6 space-y-4 overflow-y-auto">
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
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
        <div className="flex flex-col bg-zinc-950">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 bg-zinc-900">
            <Skeleton className="h-6 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
          <div className="flex-1 p-4 space-y-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-3 w-6" />
                <Skeleton className="h-3" style={{ width: `${((i * 37) % 60) + 30}%` }} />
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 p-3 flex justify-between items-center bg-zinc-900/60">
            <Skeleton className="h-7 w-24" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-7 w-24" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * AssessmentLeaderboardSkeleton: Proctored assessment standings.
 */
export function AssessmentLeaderboardSkeleton() {
  return (
    <div className="page-wrap space-y-6 animate-in fade-in duration-300">
      <header className="page-header flex flex-col md:flex-row justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-3.5 w-96 max-w-full" />
        </div>
        <div className="ranking-meta p-3 border border-white/10 bg-zinc-900/60 space-y-1">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </header>
      <div className="border border-white/10 bg-zinc-900/60 p-4 flex justify-between items-center">
        <div className="flex gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-8 w-44" />
      </div>
      <div className="overflow-x-auto border border-white/10 bg-zinc-900/60">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-neutral-900/50">
              <th className="p-3">Rank</th>
              <th className="p-3">Status</th>
              <th className="p-3">Handle</th>
              <th className="p-3">Full Name</th>
              <th className="p-3">Dept</th>
              <th className="p-3">Score</th>
              <th className="p-3">Solved</th>
              <th className="p-3">Penalty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <tr key={i} className="hover:bg-neutral-900/30">
                <td className="p-3">
                  <Skeleton className="h-4 w-6" />
                </td>
                <td className="p-3">
                  <Skeleton className="h-4 w-16" />
                </td>
                <td className="p-3">
                  <Skeleton className="h-3.5 w-28" />
                </td>
                <td className="p-3">
                  <Skeleton className="h-3.5 w-36" />
                </td>
                <td className="p-3">
                  <Skeleton className="h-3 w-16" />
                </td>
                <td className="p-3">
                  <Skeleton className="h-4 w-10" />
                </td>
                <td className="p-3">
                  <Skeleton className="h-4 w-8" />
                </td>
                <td className="p-3">
                  <Skeleton className="h-3 w-14" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * AuthSkeleton: Auth portal split layout skeleton.
 */
export function AuthSkeleton() {
  return (
    <div className="auth-shell flex min-h-screen bg-zinc-950 animate-in fade-in duration-300">
      <div className="auth-brand hidden md:flex flex-1 p-12 flex-col justify-between border-r border-white/10">
        <div className="auth-brand-inner w-full space-y-4">
          <Skeleton className="w-12 h-12 rounded-md" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-12 w-full" />
          <div className="space-y-3 pt-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-52" />
            <Skeleton className="h-4 w-44" />
          </div>
        </div>
      </div>
      <div className="auth-form-panel flex-1 flex items-center justify-center p-6">
        <div className="auth-card w-full max-w-md border border-white/10 bg-zinc-900/60 p-8 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-3 w-48 mx-auto" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
