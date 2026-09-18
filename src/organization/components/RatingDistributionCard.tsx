import { useState } from "react";
import type { MemberProfile } from "../data/types";
import type { RatingDistribution } from "../data/portal.functions";
import { cn } from "@/lib/utils";

/**
 * RatingDistributionCard
 * Renders a real histogram sourced from the backend's /leaderboard/distribution endpoint.
 * Falls back to an all-zero chart when the app has no members yet — no fake data.
 */
export function RatingDistributionCard({
  member,
  distribution,
  userRating,
  loading,
}: {
  member?: Partial<MemberProfile> | null;
  distribution?: RatingDistribution | null;
  userRating?: number;
  loading?: boolean;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const attendanceCount = member?.attendance_count ?? 0;
  const hasAttended = attendanceCount > 0;

  // --- Percentile & rank display ---
  let percentileDisplay = "—";
  if (hasAttended && member?.university_rank) {
    const cohortTotal = Math.max(distribution?.total || 1, 1);
    const rank = Math.max(1, member.university_rank || 1);
    const pct = (rank / cohortTotal) * 100;
    percentileDisplay = pct < 1 ? `Top ${pct.toFixed(2)}%` : `Top ${pct.toFixed(1)}%`;
  } else if (member?.percentile) {
    percentileDisplay = `Top ${(100 - member.percentile).toFixed(1)}%`;
  }
  const rankDisplay = member?.university_rank ? `#${member.university_rank}` : "—";

  // --- Build buckets from live backend data ---
  const buckets = distribution?.buckets ?? [];
  const total = distribution?.total ?? 0;

  // If no members yet, show ghost bars at equal low height (not a fake peak)
  const isEmpty = total === 0 || buckets.length === 0;

  // Normalise: find real max count so bars scale relative to each other
  const maxCount = isEmpty ? 1 : Math.max(...buckets.map((b) => b.count), 1);

  // Find bucket that contains the member's rating
  const memberRating = userRating ?? member?.rating ?? 1200;
  let activeBucketIndex = -1;
  if (!isEmpty) {
    activeBucketIndex = buckets.findIndex(
      (b) => memberRating >= b.min && memberRating < b.max
    );
    if (activeBucketIndex === -1) {
      // If rating is at/above last bucket's min, use last bucket
      activeBucketIndex = buckets.length - 1;
    }
  }

  // Ghost placeholder buckets (for empty state / loading)
  const PLACEHOLDER_BUCKETS = Array.from({ length: 28 }, (_, i) => ({
    min: 1000 + i * 50,
    max: 1050 + i * 50,
    count: 0,
  }));

  const displayBuckets = isEmpty ? PLACEHOLDER_BUCKETS : buckets;
  const MAX_BAR_PX = 72;

  return (
    <div className="flex flex-col justify-between h-full rounded-2xl border border-white/10 bg-zinc-900/60 p-6 backdrop-blur-md shadow-xl">
      {/* Top Percentile Display */}
      <div>
        <span className="text-xs font-medium text-zinc-400 font-sans tracking-wide block">
          {hasAttended ? "Percentile" : "Standing"}
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-0.5 font-sans">
          {percentileDisplay}
        </h2>
      </div>

      {/* Histogram Bar Chart */}
      <div className="my-6 relative">
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <span className="text-[10px] font-mono text-zinc-500 tracking-widest opacity-80">
              NO CONTEST DATA YET
            </span>
          </div>
        )}
        <div
          className="flex items-end justify-between gap-[2px] sm:gap-[3px] h-[90px] w-full"
          aria-label="Rating distribution histogram"
        >
          {displayBuckets.map((bucket, index) => {
            const count = isEmpty ? 0 : (bucket.count ?? 0);
            // Min height: 3px for ghost bars, otherwise 3px + scaled
            const barHeightPx = isEmpty
              ? 3
              : Math.max(3, Math.round((count / maxCount) * MAX_BAR_PX));

            const isUserBucket = !isEmpty && index === activeBucketIndex;
            const isHovered = hoveredIndex === index;

            return (
              <div
                key={`${bucket.min}-${index}`}
                className="flex-1 flex flex-col items-center justify-end h-full relative cursor-pointer"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Tooltip */}
                {isHovered && !isEmpty && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900 border border-white/10 text-[10px] font-mono text-zinc-200 rounded-md whitespace-nowrap z-20 pointer-events-none shadow-lg">
                    {bucket.min}–{bucket.min + 50}: <span className="tabular-nums font-bold">{count}</span>
                  </div>
                )}
                {/* Bar */}
                <div
                  style={{ height: `${barHeightPx}px` }}
                  className={cn(
                    "w-full rounded-t-[2px] transition-all duration-150",
                    isEmpty
                      ? "bg-zinc-800 opacity-40"
                      : isUserBucket
                      ? "bg-orange-500 shadow-md shadow-orange-500/40 brightness-110"
                      : isHovered
                      ? "bg-zinc-400"
                      : count === 0
                      ? "bg-zinc-800/40"
                      : "bg-zinc-700/60"
                  )}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Summary Footer */}
      <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/10 text-left">
        <div>
          <span className="text-[10px] font-mono text-zinc-400 uppercase block">
            Contest Rating
          </span>
          <strong className="text-sm font-mono font-bold text-orange-400 block mt-0.5 tabular-nums">
            {(userRating ?? member?.rating)?.toLocaleString() ?? 1200}
          </strong>
        </div>
        <div>
          <span className="text-[10px] font-mono text-zinc-400 uppercase block">
            Global Rank
          </span>
          <strong className="text-sm font-mono font-bold text-white block mt-0.5 tabular-nums">
            {rankDisplay}
          </strong>
        </div>
        <div>
          <span className="text-[10px] font-mono text-zinc-400 uppercase block">
            Attended
          </span>
          <strong className="text-sm font-mono font-bold text-white block mt-0.5 tabular-nums">
            {attendanceCount}
          </strong>
        </div>
      </div>
    </div>
  );
}
