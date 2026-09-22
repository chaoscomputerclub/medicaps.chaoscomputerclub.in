/**
 * CCC Medi-Caps Portal — High-End SaaS Skeleton Loading Library
 * Sovereign, Strix AI-grade loaders pixel-matched to platform layouts.
 * Pure Pitch Black (#000000), Hairlines (white/8), Micro-Radii (rounded-md / rounded-lg / rounded-xl).
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
    <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { labelW: "w-20", valW: "w-24", subW: "w-28" },
        { labelW: "w-24", valW: "w-20", subW: "w-32" },
        { labelW: "w-24", valW: "w-16", subW: "w-28" },
        { labelW: "w-24", valW: "w-16", subW: "w-24" },
      ].map((item, idx) => (
        <div key={idx} className="p-4 rounded-lg border border-white/8 bg-black space-y-2">
          <Skeleton className={cn("h-2.5", item.labelW)} />
          <Skeleton className={cn("h-7", item.valW)} />
          <Skeleton className={cn("h-2.5", item.subW)} />
        </div>
      ))}
    </section>
  );
}

export function RatingChartSkeleton() {
  return (
    <div className="flex flex-col justify-between p-5 rounded-xl border border-white/8 bg-black min-h-[220px]">
      <div className="flex justify-between items-center mb-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="flex-1 flex items-end gap-2 pt-6 pb-2 border-b border-white/8">
        {[30, 48, 42, 65, 58, 80, 72, 88, 75, 92, 85, 96].map((h, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
            <Skeleton className="w-full rounded-t-sm" style={{ height: `${h}%` }} />
            <Skeleton className="h-2 w-5 mt-1" />
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center pt-3">
        <Skeleton className="h-2 w-16" />
        <Skeleton className="h-2 w-28" />
        <Skeleton className="h-2 w-16" />
      </div>
    </div>
  );
}

export function RatingDistributionSkeleton() {
  return (
    <div className="flex flex-col justify-between h-full rounded-lg border border-white/8 bg-black p-5 sm:p-6 space-y-4">
      {/* Top Percentile Display */}
      <div className="space-y-1">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-7 w-28" />
      </div>

      {/* Histogram Bar Chart */}
      <div className="my-4">
        <div
          className="flex items-end justify-between gap-[2px] sm:gap-[3px] h-[80px] w-full"
          aria-hidden="true"
        >
          {[
            12, 18, 25, 38, 50, 68, 80, 95, 88, 76, 62, 55, 45, 38, 30, 25,
            20, 18, 15, 12, 10, 8, 7, 5, 4, 3, 3, 2,
          ].map((pct, idx) => (
            <div
              key={idx}
              className="flex-1 rounded-t-sm"
              style={{ height: `${pct}%` }}
            >
              <Skeleton
                className={cn(
                  "w-full h-full rounded-t-sm",
                  idx === 7 ? "bg-lime-400/25" : "bg-white/[0.06]"
                )}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Standing Info */}
      <div className="flex justify-between items-center pt-3 border-t border-white/8">
        <div className="space-y-1">
          <Skeleton className="h-2 w-16" />
          <Skeleton className="h-3.5 w-20" />
        </div>
        <div className="space-y-1 text-right">
          <Skeleton className="h-2 w-20 ml-auto" />
          <Skeleton className="h-3.5 w-16 ml-auto" />
        </div>
      </div>
    </div>
  );
}

export function CampusPassSkeleton() {
  return (
    <article className="rounded-xl border border-white/8 bg-black p-5 sm:p-6 space-y-5 overflow-hidden">
      <header className="flex justify-between items-center pb-4 border-b border-white/8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-36" />
      </header>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 py-2 min-w-0">
        <div className="space-y-4 min-w-0 flex-1 w-full">
          <div>
            <Skeleton className="h-2.5 w-24 mb-2" />
            <Skeleton className="h-6 w-40 max-w-full mb-2" />
            <Skeleton className="h-3 w-32 max-w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <Skeleton className="h-2 w-12 mb-1.5" />
              <Skeleton className="h-4 w-20 max-w-full" />
            </div>
            <div>
              <Skeleton className="h-2 w-12 mb-1.5" />
              <Skeleton className="h-4 w-16 max-w-full" />
            </div>
            <div>
              <Skeleton className="h-2 w-12 mb-1.5" />
              <Skeleton className="h-4 w-20 max-w-full" />
            </div>
            <div>
              <Skeleton className="h-2 w-16 mb-1.5" />
              <Skeleton className="h-4 w-24 max-w-full" />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center p-3 rounded-lg border border-white/8 bg-white/[0.02] shrink-0 self-center sm:self-auto">
          <Skeleton className="w-[100px] h-[100px] rounded-md" />
          <Skeleton className="h-2.5 w-16 mt-2" />
        </div>
      </div>
      <footer className="flex justify-between items-center pt-4 border-t border-white/8">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-24" />
      </footer>
    </article>
  );
}

export function ProofBadgeSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <article className="rounded-xl border border-white/8 bg-black p-5 space-y-4">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
      </div>
      <dl className="grid grid-cols-2 gap-3 py-3 border-y border-white/8">
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
      <div className="p-2.5 rounded-md bg-white/[0.02] border border-white/8">
        <Skeleton className="h-2.5 w-full" />
      </div>
      <footer className="flex justify-between items-center pt-1">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-2.5 w-16" />
      </footer>
    </article>
  );
}

export function ScoreboardMatrixSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/8 bg-black">
      <table className="w-full text-left font-mono text-xs">
        <thead>
          <tr className="border-b border-white/8 bg-white/[0.02]">
            <th className="p-3.5 w-12">#</th>
            <th className="p-3.5">Contestant</th>
            {!compact && <th className="p-3.5">Dept.</th>}
            <th className="p-3.5 text-center">A</th>
            <th className="p-3.5 text-center">B</th>
            <th className="p-3.5 text-center">C</th>
            <th className="p-3.5 text-center">D</th>
            <th className="p-3.5 text-center">Solved</th>
            <th className="p-3.5 text-center">Penalty</th>
            <th className="p-3.5 text-center">Δ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <tr key={i} className="hover:bg-white/[0.02]">
              <td className="p-3.5">
                <Skeleton className="h-4 w-5" />
              </td>
              <td className="p-3.5">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-2.5 w-36" />
                </div>
              </td>
              {!compact && (
                <td className="p-3.5">
                  <Skeleton className="h-3 w-16" />
                </td>
              )}
              <td className="p-3.5 text-center">
                <Skeleton className="h-5 w-8 mx-auto" />
              </td>
              <td className="p-3.5 text-center">
                <Skeleton className="h-5 w-8 mx-auto" />
              </td>
              <td className="p-3.5 text-center">
                <Skeleton className="h-5 w-8 mx-auto" />
              </td>
              <td className="p-3.5 text-center">
                <Skeleton className="h-5 w-8 mx-auto" />
              </td>
              <td className="p-3.5 text-center">
                <Skeleton className="h-4 w-6 mx-auto" />
              </td>
              <td className="p-3.5 text-center">
                <Skeleton className="h-3 w-12 mx-auto" />
              </td>
              <td className="p-3.5 text-center">
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
        <tr key={i} className="border-b border-white/8 hover:bg-white/[0.02]">
          <td className="p-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-3 w-4" />
            </div>
          </td>
          <td className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-full shrink-0" />
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
              <Skeleton className="w-16 h-1.5 rounded-full" />
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
    <div className="rounded-xl border border-white/8 bg-black divide-y divide-white/8">
      {[1, 2, 3].map((i) => (
        <article key={i} className="p-5 space-y-2">
          <Skeleton className="h-2.5 w-20 mb-1" />
          <Skeleton className="h-4 w-4/5 mb-2" />
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-3/4 mb-3" />
          <Skeleton className="h-2.5 w-28" />
        </article>
      ))}
    </div>
  );
}

export function ContestActivityFeedSkeleton({ limit = 6 }: { limit?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: limit }).map((_, i) => (
        <article key={i} className="border-b border-white/10 pb-3 last:border-b-0">
          <Skeleton className="h-2.5 w-16 mb-2" />
          <div className="flex items-center gap-2">
            <Skeleton className="w-3.5 h-3.5 rounded shrink-0" />
            <Skeleton className="h-3.5 w-48" />
          </div>
          <Skeleton className="h-2.5 w-3/4 mt-2 ml-5" />
        </article>
      ))}
    </div>
  );
}

export function BattleHistorySkeleton() {
  return (
    <div className="rounded-xl border border-white/8 bg-black divide-y divide-white/8">
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
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <article key={i} className="rounded-lg border border-white/8 bg-black p-4 space-y-2">
          <Skeleton className="w-6 h-6 mb-2 rounded" />
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
    <article className="rounded-xl border border-white/8 bg-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5">
      <div className="flex items-start gap-4 flex-1">
        <div className="shrink-0 p-3 rounded-lg border border-white/8 bg-white/[0.02] text-center">
          <Skeleton className="h-6 w-8 mx-auto mb-1" />
          <Skeleton className="h-2.5 w-8 mx-auto" />
        </div>
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 animate-in fade-in duration-200">
      {/* Header Lockup */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/8 pb-6 mb-8">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-3.5 w-96 max-w-full" />
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/8 rounded-lg border border-white/8 bg-black lg:min-w-[320px]">
          <div className="p-3 text-center space-y-1">
            <Skeleton className="h-2 w-16 mx-auto" />
            <Skeleton className="h-6 w-8 mx-auto" />
          </div>
          <div className="p-3 text-center space-y-1">
            <Skeleton className="h-2 w-16 mx-auto" />
            <Skeleton className="h-6 w-8 mx-auto" />
          </div>
          <div className="p-3 text-center space-y-1">
            <Skeleton className="h-2 w-16 mx-auto" />
            <Skeleton className="h-6 w-8 mx-auto" />
          </div>
        </div>
      </header>

      {/* Section 1: Upcoming Contest Hero Cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/8 pb-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-white/8 bg-black p-6 space-y-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24 rounded" />
                <Skeleton className="h-3.5 w-28" />
              </div>

              <div className="space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-4/5" />
              </div>

              <div className="grid grid-cols-3 gap-3 py-3 border-y border-white/8">
                <div className="space-y-1">
                  <Skeleton className="h-2 w-14" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-2 w-14" />
                  <Skeleton className="h-3.5 w-20" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-2 w-14" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
              </div>

              {/* Countdown Ticker Box */}
              <div className="rounded-lg border border-white/8 bg-black p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-2.5 w-20" />
                  <Skeleton className="h-2.5 w-28" />
                </div>
                <div className="grid grid-cols-4 gap-2 text-center pt-1">
                  {[1, 2, 3, 4].map((slot) => (
                    <div key={slot} className="rounded border border-white/8 bg-white/[0.02] py-2 flex flex-col items-center gap-1">
                      <Skeleton className="h-5 w-8" />
                      <Skeleton className="h-2 w-6" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <Skeleton className="h-9 flex-1 rounded-md" />
                <Skeleton className="h-9 w-28 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: 2-Column Split (Past Contests + Top Rankers) */}
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Tabs & Search */}
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-8 w-28 rounded-md" />
            </div>
            <Skeleton className="h-8 w-60 rounded-md" />
          </div>

          {/* Past Contests List */}
          <div className="rounded-xl border border-white/8 bg-black divide-y divide-white/8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-5 flex flex-col sm:flex-row justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-16 rounded" />
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
                  <Skeleton className="h-8 w-28 rounded-md" />
                  <Skeleton className="h-8 w-24 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Top Rankers Podium */}
        <div className="space-y-4">
          <div className="rounded-xl border border-white/8 bg-black p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border border-white/8 bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-5" />
                    <Skeleton className="w-7 h-7 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
            <Skeleton className="h-8 w-full rounded-md mt-2" />
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-in fade-in duration-200">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/8 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-4 w-32 rounded" />
          </div>
          <Skeleton className="h-8 w-60" />
          <Skeleton className="h-3.5 w-96 max-w-full" />
        </div>
        <div className="p-4 rounded-lg border border-white/8 bg-black space-y-1.5 min-w-[180px]">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-28" />
        </div>
      </header>

      <div className="overflow-hidden rounded-lg border border-white/8 bg-black">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-white/8 bg-white/[0.02]">
              <th className="py-3.5 pl-5 text-left font-mono text-[10px] uppercase text-zinc-500">Rank</th>
              <th className="py-3.5 text-left font-mono text-[10px] uppercase text-zinc-500">Cadet / Handle</th>
              <th className="py-3.5 text-left font-mono text-[10px] uppercase text-zinc-500">Trend</th>
              <th className="py-3.5 text-left font-mono text-[10px] uppercase text-zinc-500">Rating</th>
              <th className="py-3.5 text-left font-mono text-[10px] uppercase text-zinc-500">Peak</th>
              <th className="py-3.5 pr-5 text-left font-mono text-[10px] uppercase text-zinc-500">Attendance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
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
    <div className="max-w-6xl mx-auto space-y-6 px-4 py-8 sm:px-6 animate-in fade-in duration-200">
      {/* Header with 3 quick stat boxes */}
      <header className="flex flex-col justify-between gap-5 border-b border-white/8 pb-6 md:flex-row md:items-end">
        <div className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>
        <div className="flex gap-4 sm:gap-6 items-center flex-wrap">
          <div className="border-l-2 border-lime-400 pl-3 space-y-1">
            <Skeleton className="h-6 w-8" />
            <Skeleton className="h-2 w-16" />
          </div>
          <div className="border-l-2 border-white/20 pl-3 space-y-1">
            <Skeleton className="h-6 w-8" />
            <Skeleton className="h-2 w-20" />
          </div>
          <div className="border-l-2 border-lime-400/40 pl-3 space-y-1">
            <Skeleton className="h-6 w-8" />
            <Skeleton className="h-2 w-20" />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 rounded-lg border border-white/8 bg-black p-1 w-fit">
        <Skeleton className="h-7 w-20 rounded" />
        <Skeleton className="h-7 w-28 rounded" />
        <Skeleton className="h-7 w-32 rounded" />
        <Skeleton className="h-7 w-28 rounded" />
      </div>

      {/* Main Ledger Card */}
      <section className="rounded-xl border border-white/8 bg-black">
        <div className="flex items-center justify-between border-b border-white/8 bg-white/[0.02] p-4 sm:p-6">
          <div className="space-y-1">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-5 w-44" />
          </div>
          <Skeleton className="h-8 w-36 rounded-md" />
        </div>

        <div className="divide-y divide-white/8">
          {[1, 2, 3, 4].map((i) => (
            <article key={i} className="p-5 sm:p-6 flex flex-col lg:flex-row justify-between gap-5 lg:items-center">
              <div className="flex items-start gap-4">
                <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-16 rounded" />
                    <Skeleton className="h-4 w-28 rounded" />
                  </div>
                  <Skeleton className="h-5 w-64" />
                  <div className="flex items-center gap-4 pt-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-white/8">
                <div className="space-y-1 text-right">
                  <Skeleton className="h-2 w-10 ml-auto" />
                  <Skeleton className="h-5 w-12 ml-auto" />
                </div>
                <div className="space-y-1 text-right">
                  <Skeleton className="h-2 w-12 ml-auto" />
                  <Skeleton className="h-5 w-16 ml-auto" />
                </div>
                <Skeleton className="h-8 w-28 rounded-md" />
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-in fade-in duration-200">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/8 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-4 w-32 rounded" />
          </div>
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-3.5 w-96 max-w-full" />
        </div>
        <div className="flex size-12 items-center justify-center rounded-lg border border-white/8 bg-black">
          <Skeleton className="size-6 rounded" />
        </div>
      </header>

      <section className="rounded-lg border border-white/8 bg-black p-5 sm:p-6 space-y-5">
        <div className="space-y-1">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-5 w-48" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <article key={i} className="flex items-center justify-between p-4 rounded-lg border border-white/8 bg-black">
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <Skeleton className="w-7 h-5 rounded shrink-0" />
                <div className="min-w-0 space-y-1 flex-1">
                  <Skeleton className="h-2 w-24" />
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-2.5 w-32" />
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 pl-3">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="size-8 rounded-md" />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export const ProblemsSkeleton = ProblemArchiveSkeleton;

/**
 * ProblemDetailSkeleton: Editorial & statement preview.
 */
export function ProblemDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-200">
      <Skeleton className="h-4 w-36" />

      <header className="border-b border-white/8 pb-6 flex items-start gap-5">
        <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-3 w-40" />
        </div>
      </header>

      {/* Editorial Body */}
      <article className="rounded-xl border border-white/8 bg-black p-6 space-y-6">
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
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>

        <div className="pt-4 border-t border-white/8 flex items-center gap-2">
          <Skeleton className="w-4 h-4 rounded shrink-0" />
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
      <Skeleton className="h-4 w-32" />

      {/* Hero */}
      <header className="rounded-xl border border-white/8 bg-black p-6 md:p-8 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-4 w-10 rounded" />
          </div>
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-4/5 max-w-full" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-5 w-32" />
            </div>
          ))}
        </div>
      </header>

      {/* Registration Status Band */}
      <div className="rounded-xl border border-white/8 bg-black p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>
        <div className="flex gap-3 shrink-0">
          <Skeleton className="h-9 w-36 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* Problem Set Preview */}
      <section className="rounded-xl border border-white/8 bg-black p-6 space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-5 w-44" />
        </div>
        <div className="divide-y divide-white/8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
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
 * ContestSummarySkeleton:
 * Contest submission review console layout with summary metrics, challenge checklist table,
 * and final submission action bar.
 */
export function ContestSummarySkeleton() {
  return (
    <div className="min-h-[100dvh] w-full bg-black text-white font-sans flex flex-col animate-in fade-in duration-200">
      {/* Top Microservice Header */}
      <header className="sticky top-0 z-30 border-b border-white/8 bg-black px-4 sm:px-6 h-14 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex items-center gap-2">
            <Skeleton className="size-7 rounded" />
            <div className="hidden md:flex flex-col gap-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2 w-24" />
            </div>
          </div>
          <div className="h-4 w-px bg-white/10 hidden sm:block" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-4 w-28 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <div className="hidden md:flex items-center gap-2">
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-8 w-32 rounded-md" />
        </div>
      </header>

      {/* Microservice Sub-bar */}
      <div className="border-b border-white/6 bg-zinc-950/80 px-4 sm:px-8 py-2 flex items-center justify-between text-[11px] shrink-0">
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-3 w-32 hidden sm:block" />
        </div>
        <Skeleton className="h-3 w-36" />
      </div>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 space-y-8 flex-1">
        {/* Title Header */}
        <div className="space-y-2 border-b border-white/8 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-8 w-64" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-32 rounded" />
              <Skeleton className="h-7 w-36 rounded" />
            </div>
          </div>
        </div>

        {/* 4 Metric Bento Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-lg border border-white/8 bg-zinc-950 space-y-2">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          ))}
        </div>

        {/* Problem Checklist Card */}
        <div className="rounded-xl border border-white/8 bg-zinc-950 overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/8">
            <div className="space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-7 w-28 rounded-md" />
          </div>

          <div className="divide-y divide-white/8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-md shrink-0" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-8 w-24 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Final Submission Card */}
        <div className="rounded-xl border border-white/8 bg-zinc-950 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-52" />
            <Skeleton className="h-3 w-96 max-w-full" />
          </div>
          <Skeleton className="h-10 w-44 rounded-md" />
        </div>
      </main>
    </div>
  );
}


/**
 * ContestResultsSkeleton: Round 1 ranking leaderboard.
 */
export function ContestResultsSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-200">
      <Skeleton className="h-4 w-32" />

      <header className="space-y-2 border-b border-white/8 pb-6">
        <Skeleton className="h-3 w-44" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-3.5 w-96 max-w-full" />
      </header>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
        <Skeleton className="h-8 w-56 rounded-md" />
      </div>

      {/* Standings Table */}
      <div className="overflow-x-auto rounded-xl border border-white/8 bg-black">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-white/8 bg-white/[0.02]">
              <th className="p-3">Rank</th>
              <th className="p-3">Candidate</th>
              <th className="p-3">Dept</th>
              <th className="p-3 text-right">Score</th>
              <th className="p-3 text-right">Solved</th>
              <th className="p-3 text-right">Penalty</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <tr key={i} className="hover:bg-white/[0.02]">
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
                  <Skeleton className="h-5 w-24 rounded" />
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-in fade-in duration-200">
      <Skeleton className="h-4 w-32" />

      <header className="space-y-2 border-b border-white/8 pb-6">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-3.5 w-96 max-w-full" />
      </header>

      {/* Top 3 Finalists Podium */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-white/8 bg-black p-5 space-y-3">
            <Skeleton className="size-5 rounded" />
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-4 w-24 pt-2" />
          </div>
        ))}
      </section>

      {/* Full Matrix Table */}
      <div className="overflow-x-auto rounded-lg border border-white/8 bg-black">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-white/8 bg-white/[0.02]">
              <th className="p-3">Rank</th>
              <th className="p-3">Finalist</th>
              <th className="p-3">Division</th>
              <th className="p-3 text-right">Solved</th>
              <th className="p-3 text-right">Score</th>
              <th className="p-3 text-right">Penalty</th>
              <th className="p-3 text-right">Rating Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <tr key={i} className="hover:bg-white/[0.02]">
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
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 animate-in fade-in duration-200">
      <Skeleton className="h-4 w-32" />

      <header className="space-y-2 border-b border-white/8 pb-6">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-3.5 w-96 max-w-full" />
      </header>

      {/* Hero Live Arena Launcher */}
      <div className="p-5 border border-lime-400/30 bg-black rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Countdown */}
        <div className="rounded-lg border border-white/8 bg-black p-5 space-y-3">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Gate Pass */}
        <div className="rounded-lg border border-white/8 bg-black p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="size-24 rounded mx-auto" />
          <div className="space-y-1 pt-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
          <Skeleton className="h-8 w-full rounded-md" />
        </div>

        {/* Workstation Lab Info */}
        <div className="rounded-lg border border-white/8 bg-black p-5 space-y-3">
          <Skeleton className="h-4 w-28" />
          <div className="space-y-2 pt-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ContestLobbySkeleton: Rules, countdown timer, acknowledge box.
 */
export function ContestLobbySkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-200">
      <Skeleton className="h-4 w-32" />

      <header className="space-y-2 border-b border-white/8 pb-6 text-center">
        <Skeleton className="h-3 w-44 mx-auto" />
        <Skeleton className="h-8 w-64 mx-auto" />
        <Skeleton className="h-3.5 w-96 max-w-full mx-auto" />
      </header>

      <div className="rounded-xl border border-white/8 bg-black p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg border border-white/8 bg-white/[0.02] p-3 space-y-1">
              <Skeleton className="h-2.5 w-16 mx-auto" />
              <Skeleton className="h-5 w-20 mx-auto" />
            </div>
          ))}
        </div>

        <div className="space-y-3 pt-2">
          <Skeleton className="h-4 w-36" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 items-start">
              <Skeleton className="w-4 h-4 rounded shrink-0 mt-0.5" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>

        <div className="border-t border-white/8 pt-4 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-4 h-4 rounded shrink-0" />
            <Skeleton className="h-3.5 w-80" />
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
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
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-200">
      <header className="flex justify-between items-start border-b border-white/8 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-3.5 w-96 max-w-full" />
        </div>
        <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
      </header>

      {/* Tabs */}
      <div className="flex gap-2 rounded-lg border border-white/8 bg-black p-1 w-fit">
        <Skeleton className="h-8 w-40 rounded" />
        <Skeleton className="h-8 w-44 rounded" />
      </div>

      {/* Form Search */}
      <div className="rounded-xl border border-white/8 bg-black p-6 space-y-4">
        <Skeleton className="h-3 w-48" />
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1 rounded-md" />
          <Skeleton className="h-10 w-28 rounded-md" />
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-in fade-in duration-200">
      {/* Profile Header Card */}
      <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 rounded-lg border border-white/8 bg-black p-6 sm:p-7">
        <div className="flex items-start gap-5">
          {/* Avatar Container */}
          <Skeleton className="size-16 sm:size-20 rounded-lg shrink-0" />

          <div className="space-y-2">
            <Skeleton className="h-2.5 w-24" />
            <div className="flex items-center gap-3 flex-wrap">
              <Skeleton className="h-7 w-48" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-20 rounded-md" />
                <Skeleton className="h-7 w-24 rounded-md" />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              <Skeleton className="h-5 w-24 rounded" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>

            <Skeleton className="h-3 w-80 max-w-full pt-0.5" />

            {/* Social Pills */}
            <div className="flex items-center gap-2 flex-wrap pt-2">
              <Skeleton className="h-6 w-24 rounded" />
              <Skeleton className="h-6 w-24 rounded" />
              <Skeleton className="h-6 w-20 rounded" />
              <Skeleton className="h-6 w-20 rounded" />
            </div>
          </div>
        </div>

        <dl className="flex sm:flex-col gap-3 font-mono text-xs border-t lg:border-t-0 lg:border-l border-white/8 pt-4 lg:pt-0 lg:pl-6 shrink-0">
          <div className="space-y-1">
            <Skeleton className="h-2 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-2 w-12" />
            <Skeleton className="h-4 w-36" />
          </div>
        </dl>
      </header>

      {/* 4 Metric Bento Strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { labelW: "w-14", valW: "w-20", subW: "w-24" },
          { labelW: "w-12", valW: "w-16", subW: "w-28" },
          { labelW: "w-16", valW: "w-12", subW: "w-24" },
          { labelW: "w-16", valW: "w-20", subW: "w-24" },
        ].map((item, idx) => (
          <div key={idx} className="p-4 rounded-lg border border-white/8 bg-black space-y-1.5">
            <Skeleton className={cn("h-2.5", item.labelW)} />
            <Skeleton className={cn("h-7", item.valW)} />
            <Skeleton className={cn("h-2.5", item.subW)} />
          </div>
        ))}
      </section>

      {/* Trajectory & Distribution */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-lg border border-white/8 bg-black p-5 sm:p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-white/8 pb-3">
            <div className="space-y-1">
              <Skeleton className="h-2 w-24" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
          <RatingChartSkeleton />
        </div>
        <div>
          <RatingDistributionSkeleton />
        </div>
      </section>

      {/* Contest Battle Logs */}
      <section className="rounded-lg border border-white/8 bg-black p-5 sm:p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-white/8 pb-3">
          <div className="space-y-1">
            <Skeleton className="h-2 w-20" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="divide-y divide-white/6 font-mono text-xs">
          {[1, 2, 3].map((i) => (
            <article key={i} className="py-3 flex items-center justify-between flex-wrap gap-3">
              <Skeleton className="h-3 w-20" />
              <div className="space-y-1">
                <Skeleton className="h-3.5 w-44" />
                <Skeleton className="h-2.5 w-28" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-10" />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Achievements & Proof */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-lg border border-white/8 bg-black p-5 sm:p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-white/8 pb-3">
            <div className="space-y-1">
              <Skeleton className="h-2 w-24" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            {[1, 2, 3, 4].map((i) => (
              <article key={i} className="p-3.5 rounded-lg border border-white/8 bg-black space-y-2">
                <div className="flex items-center gap-1.5">
                  <Skeleton className="size-3.5 rounded" />
                  <Skeleton className="h-2 w-12" />
                </div>
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-full" />
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/8 bg-black p-5 sm:p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-white/8 pb-3">
            <div className="space-y-1">
              <Skeleton className="h-2 w-24" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          <ProofBadgeSkeleton compact />
          <Skeleton className="h-3 w-44 pt-1" />
        </div>
      </section>

      {/* Trust Footer */}
      <footer className="flex items-center gap-2.5 p-4 rounded-lg border border-white/8 bg-black text-zinc-500 font-mono text-xs">
        <Skeleton className="size-3.5 rounded shrink-0" />
        <Skeleton className="h-3 w-3/4 max-w-md" />
      </footer>
    </div>
  );
}

/**
 * SettingsSkeleton: User settings, profile edit form, and account credentials.
 */
export function SettingsSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 animate-in fade-in duration-200">
      {/* Page Title Header */}
      <div className="flex items-center justify-between mb-6 pb-5 border-b border-white/8">
        <div className="space-y-1.5">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
        <Skeleton className="h-8 w-28 rounded-md hidden sm:block" />
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Left sidebar nav */}
        <nav
          className="relative hidden md:flex flex-col w-52 shrink-0 sticky top-6 gap-1 p-1 rounded-lg border border-white/8 bg-black"
          aria-label="Settings navigation skeleton"
        >
          {[
            { w: "w-28" },
            { w: "w-20" },
            { w: "w-24" },
            { w: "w-32" },
            { w: "w-24" },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-2.5 px-3 py-2 rounded-md">
              <Skeleton className="size-4 rounded shrink-0" />
              <Skeleton className={cn("h-3", item.w)} />
            </div>
          ))}
        </nav>

        {/* Right Main Content Sections */}
        <div className="flex-1 min-w-0 space-y-6 w-full">
          {/* Avatar Section */}
          <div className="rounded-lg border border-white/8 bg-black p-5 sm:p-6 space-y-5">
            <div className="space-y-1 pb-3 border-b border-white/8">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
            <div className="flex items-center gap-5">
              <Skeleton className="size-16 sm:size-20 rounded-lg shrink-0" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-28 rounded-md" />
                <Skeleton className="h-2.5 w-44" />
              </div>
            </div>
          </div>

          {/* Basic Profile Section */}
          <div className="rounded-lg border border-white/8 bg-black p-5 sm:p-6 space-y-5">
            <div className="space-y-1 pb-3 border-b border-white/8">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            </div>
            <div className="space-y-2 pt-1">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
          </div>

          {/* Academic Details Section */}
          <div className="rounded-lg border border-white/8 bg-black p-5 sm:p-6 space-y-5">
            <div className="space-y-1 pb-3 border-b border-white/8">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            </div>
          </div>
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
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/8 pb-5">
        <div className="space-y-1">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
      </div>

      {/* Telemetry Bento Strip (4 Columns) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { labelW: "w-28", valW: "w-16", subW: "w-24" },
          { labelW: "w-24", valW: "w-20", subW: "w-20" },
          { labelW: "w-24", valW: "w-12", subW: "w-28" },
          { labelW: "w-28", valW: "w-12", subW: "w-24" },
        ].map((item, idx) => (
          <div key={idx} className="p-4 rounded-lg border border-white/8 bg-black space-y-1.5">
            <Skeleton className={cn("h-2.5", item.labelW)} />
            <Skeleton className={cn("h-7", item.valW)} />
            <Skeleton className={cn("h-2.5", item.subW)} />
          </div>
        ))}
      </div>

      {/* Live Contest Banner / Next Contest Alert */}
      <section className="rounded-lg border border-lime-400/20 bg-black p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 flex-1">
            <div className="flex items-center gap-2">
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-6 w-3/4 max-w-md" />
            <Skeleton className="h-3.5 w-5/6 max-w-xl" />
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
          <div className="shrink-0">
            <Skeleton className="h-9 w-36 rounded-md" />
          </div>
        </div>
      </section>

      {/* Rating Analytics */}
      <section className="p-5 rounded-lg border border-white/8 bg-black space-y-4">
        <div className="flex justify-between items-center border-b border-white/8 pb-3">
          <div className="space-y-1">
            <Skeleton className="h-2 w-28" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
        <RatingChartSkeleton />
      </section>

      {/* Campus Scoreboard Radar */}
      <section className="p-5 rounded-lg border border-white/8 bg-black space-y-4">
        <div className="flex justify-between items-center border-b border-white/8 pb-3">
          <div className="space-y-1">
            <Skeleton className="h-2 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
        <ScoreboardMatrixSkeleton />
      </section>

      {/* Live Campus Activity Stream */}
      <section className="p-5 rounded-lg border border-white/8 bg-black space-y-4">
        <div className="flex justify-between items-center border-b border-white/8 pb-3">
          <div className="space-y-1">
            <Skeleton className="h-2 w-24" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
        <ContestActivityFeedSkeleton limit={6} />
      </section>
    </div>
  );
}

export const ContestsSkeleton = ContestsHubSkeleton;

/**
 * AssessmentStudioSkeleton: Live code editor & assessment workspace skeleton.
 */
export function AssessmentStudioSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-black text-zinc-200 font-sans select-none overflow-hidden animate-in fade-in duration-200">
      {/* Top Proctored Header */}
      <header className="flex items-center justify-between border-b border-white/8 bg-black px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-28 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
      </header>

      {/* Problem Picker Bar */}
      <div className="flex items-center border-b border-white/8 bg-black px-3 py-1.5 gap-2 shrink-0">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-7 w-28 rounded-md" />
        ))}
      </div>

      {/* Split Arena: Left Problem + Right Code Editor */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        <div className="border-r border-white/8 p-6 space-y-4 overflow-y-auto">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
          </div>
          <Skeleton className="h-7 w-64" />
          <div className="space-y-2 pt-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
          <div className="pt-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </div>
        <div className="flex flex-col bg-black">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-2 bg-black">
            <Skeleton className="h-6 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded" />
              <Skeleton className="h-6 w-16 rounded" />
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
          <div className="border-t border-white/8 p-3 flex justify-between items-center bg-black">
            <Skeleton className="h-7 w-24 rounded-md" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-20 rounded-md" />
              <Skeleton className="h-7 w-24 rounded-md" />
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
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-200">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/8 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-3.5 w-96 max-w-full" />
        </div>
        <div className="p-3 rounded-lg border border-white/8 bg-black space-y-1">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </header>
      <div className="rounded-xl border border-white/8 bg-black p-4 flex justify-between items-center">
        <div className="flex gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-8 w-44 rounded-md" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/8 bg-black">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-white/8 bg-white/[0.02]">
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
          <tbody className="divide-y divide-white/8">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <tr key={i} className="hover:bg-white/[0.02]">
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
    <div className="flex min-h-screen bg-black animate-in fade-in duration-200">
      <div className="hidden md:flex flex-1 p-12 flex-col justify-between border-r border-white/8">
        <div className="w-full space-y-4">
          <Skeleton className="w-12 h-12 rounded-xl" />
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
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-white/8 bg-black p-8 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-3 w-48 mx-auto" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
