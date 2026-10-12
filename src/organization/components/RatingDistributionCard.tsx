import { useState } from "react";
import type { MemberProfile } from "../data/types";
import type { RatingDistribution } from "../data/portal.functions";
import { cn } from "@/lib/utils";
import { RatingDistributionSkeleton } from "./skeletons";

/**
 * RatingDistributionCard
 * Renders a histogram sourced from the backend's /leaderboard/distribution endpoint.
 * Matiks dark theme with #1F1F1F cards, #171717 inner containers, and #B1FA63 accents.
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

  const isRanked = Boolean(member?.is_ranked && member?.university_rank);

  let percentileDisplay = "Unranked";

  if (isRanked && member?.university_rank) {
    // Strictly consume authoritative canonical standing from backend RankingService
    if (member?.standing) {
      percentileDisplay = member.standing;
    } else if (member?.top_percentage !== undefined && member.top_percentage !== null) {
      percentileDisplay = member.top_percentage <= 1 ? "Top 1%" : `Top ${member.top_percentage}%`;
    } else {
      percentileDisplay = "Ranked";
    }
  } else {
    percentileDisplay = "Unranked";
  }

  const buckets = distribution?.buckets ?? [];
  const total = distribution?.total ?? 0;
  const isEmpty = !loading && (total === 0 || buckets.length === 0);
  const maxCount = isEmpty ? 1 : Math.max(...buckets.map((b) => b.count), 1);

  const memberRating = userRating ?? member?.rating ?? 1200;
  let activeBucketIndex = -1;
  if (!isEmpty && isRanked) {
    activeBucketIndex = buckets.findIndex(
      (b) => memberRating >= b.min && memberRating < b.max
    );
    if (activeBucketIndex === -1 && memberRating >= 2400) {
      activeBucketIndex = buckets.length - 1;
    }
  }

  const PLACEHOLDER_BUCKETS = Array.from({ length: 28 }, (_, i) => ({
    min: 1000 + i * 50,
    max: 1050 + i * 50,
    count: 0,
  }));

  const displayBuckets = isEmpty ? PLACEHOLDER_BUCKETS : buckets;
  const MAX_BAR_PX = 80;

  return (
    <div className="flex flex-col justify-between h-full rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
      {/* Top Percentile Display */}
      <div>
        <span className="text-xs font-heading font-bold uppercase tracking-wider text-zinc-400 block">
          {isRanked ? "Cohort Standing" : "Standing"}
        </span>
        <h2 className="text-3xl sm:text-4xl font-display uppercase tracking-wide text-white mt-1">
          {percentileDisplay}
        </h2>
      </div>

      {/* Histogram Bar Chart */}
      <div className="my-auto py-6 relative">
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <span className="px-3 py-1.5 rounded-[8px] bg-[#171717]/90 border border-white/[0.08] text-[10px] font-mono tracking-widest text-zinc-400 uppercase shadow-lg backdrop-blur-sm">
              NO CONTEST DATA RECORDED
            </span>
          </div>
        )}
        <div
          className="flex items-end justify-between gap-[2px] sm:gap-[3px] h-[96px] w-full"
          aria-label="Rating distribution histogram"
        >
          {displayBuckets.map((bucket, index) => {
            const count = isEmpty ? 0 : (bucket.count ?? 0);
            const barHeightPx = isEmpty
              ? 4
              : Math.max(4, Math.round((count / maxCount) * MAX_BAR_PX));

            const isUserBucket = !isEmpty && index === activeBucketIndex;
            const isHovered = hoveredIndex === index;

            return (
              <div
                key={`${bucket.min}-${index}`}
                className="flex-1 flex flex-col items-center justify-end h-full relative cursor-pointer group"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Tooltip */}
                {isHovered && !isEmpty && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-[#171717] border border-white/[0.12] text-[10px] font-mono text-white rounded-[8px] whitespace-nowrap z-20 pointer-events-none shadow-xl">
                    {bucket.min}–{bucket.min + 50}:{" "}
                    <span className="tabular-nums font-bold text-[#B1FA63]">{count}</span>
                  </div>
                )}
                {/* Bar */}
                <div
                  style={{ height: `${barHeightPx}px` }}
                  className={cn(
                    "w-full rounded-t-[2px] transition-colors",
                    isEmpty
                      ? "bg-[#171717] border-t border-white/[0.06]"
                      : isUserBucket
                      ? "bg-[#B1FA63] shadow-[0_0_10px_rgba(177,250,99,0.4)]"
                      : isHovered
                      ? "bg-zinc-300"
                      : count === 0
                      ? "bg-[#171717]"
                      : "bg-white/[0.12]"
                  )}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
