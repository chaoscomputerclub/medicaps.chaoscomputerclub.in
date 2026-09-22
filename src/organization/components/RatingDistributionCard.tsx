import { useState } from "react";
import type { MemberProfile } from "../data/types";
import type { RatingDistribution } from "../data/portal.functions";
import { cn } from "@/lib/utils";
import { RatingDistributionSkeleton } from "./skeletons";

/**
 * RatingDistributionCard
 * Renders a histogram sourced from the backend's /leaderboard/distribution endpoint.
 * Strix AI pure black + electric lime styling.
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
  if (loading && !distribution) {
    return <RatingDistributionSkeleton />;
  }

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const attendanceCount = member?.attendance_count ?? 0;
  const hasAttended = attendanceCount > 0;

  let percentileDisplay = "—";
  let rankDisplay = "—";

  if (hasAttended && member?.university_rank) {
    const cohortTotal = Math.max(distribution?.total || (member as any)?.active_members || 1, 1);
    const rank = Math.max(1, member.university_rank || 1);
    const pct = (rank / cohortTotal) * 100;
    percentileDisplay = pct < 1 ? `Top ${pct.toFixed(2)}%` : `Top ${pct.toFixed(1)}%`;
    rankDisplay = `#${member.university_rank}`;
  } else if (hasAttended && member?.percentile) {
    percentileDisplay = `Top ${(100 - member.percentile).toFixed(1)}%`;
  }

  const buckets = distribution?.buckets ?? [];
  const total = distribution?.total ?? 0;
  const isEmpty = !loading && (total === 0 || buckets.length === 0);
  const maxCount = isEmpty ? 1 : Math.max(...buckets.map((b) => b.count), 1);

  const memberRating = userRating ?? member?.rating ?? 1200;
  let activeBucketIndex = -1;
  if (!isEmpty) {
    activeBucketIndex = buckets.findIndex(
      (b) => memberRating >= b.min && memberRating < b.max
    );
    if (activeBucketIndex === -1) {
      activeBucketIndex = buckets.length - 1;
    }
  }

  const PLACEHOLDER_BUCKETS = Array.from({ length: 28 }, (_, i) => ({
    min: 1000 + i * 50,
    max: 1050 + i * 50,
    count: 0,
  }));

  const displayBuckets = isEmpty ? PLACEHOLDER_BUCKETS : buckets;
  const MAX_BAR_PX = 72;

  return (
    <div className="flex flex-col justify-between h-full rounded-lg border border-white/8 bg-black p-5 sm:p-6">
      {/* Top Percentile Display */}
      <div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block">
          {hasAttended ? "Cohort Standing" : "Standing"}
        </span>
        <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight mt-1 font-sans">
          {percentileDisplay}
        </h2>
      </div>

      {/* Histogram Bar Chart */}
      <div className="my-6 relative">
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <span className="text-[9px] font-mono text-zinc-600 tracking-widest uppercase">
              NO CONTEST DATA RECORDED
            </span>
          </div>
        )}
        <div
          className="flex items-end justify-between gap-[2px] sm:gap-[3px] h-[80px] w-full"
          aria-label="Rating distribution histogram"
        >
          {displayBuckets.map((bucket, index) => {
            const count = isEmpty ? 0 : (bucket.count ?? 0);
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
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black border border-white/10 text-[9px] font-mono text-white rounded whitespace-nowrap z-20 pointer-events-none shadow-lg">
                    {bucket.min}–{bucket.min + 50}: <span className="tabular-nums font-semibold text-lime-400">{count}</span>
                  </div>
                )}
                {/* Bar */}
                <div
                  style={{ height: `${barHeightPx}px` }}
                  className={cn(
                    "w-full rounded-t-[2px] transition-colors",
                    isEmpty
                      ? "bg-zinc-900"
                      : isUserBucket
                      ? "bg-lime-400"
                      : isHovered
                      ? "bg-zinc-400"
                      : count === 0
                      ? "bg-zinc-900"
                      : "bg-zinc-800"
                  )}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Summary Footer */}
      <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/6 text-left font-mono">
        <div>
          <span className="text-[9px] text-zinc-500 uppercase block">
            Elo Rating
          </span>
          <strong className="text-xs font-semibold text-lime-400 block mt-0.5 tabular-nums">
            {(userRating ?? member?.rating)?.toLocaleString() ?? 1200}
          </strong>
        </div>
        <div>
          <span className="text-[9px] text-zinc-500 uppercase block">
            Rank
          </span>
          <strong className="text-xs font-semibold text-white block mt-0.5 tabular-nums">
            {rankDisplay}
          </strong>
        </div>
        <div>
          <span className="text-[9px] text-zinc-500 uppercase block">
            Attended
          </span>
          <strong className="text-xs font-semibold text-white block mt-0.5 tabular-nums">
            {attendanceCount}
          </strong>
        </div>
      </div>
    </div>
  );
}
