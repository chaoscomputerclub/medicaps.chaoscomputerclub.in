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
    <div className="flex flex-col justify-between h-full rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] p-6 sm:p-7">
      {/* Top Percentile Display */}
      <div>
        <span className="text-xs font-heading font-bold uppercase tracking-wider text-zinc-400 block">
          {isRanked ? "Cohort Standing" : "Standing"}
        </span>
        <h2 className="text-3xl sm:text-4xl font-display uppercase tracking-wide text-white mt-1">
          {percentileDisplay}
        </h2>
      </div>

      {/* Empty State / Histogram Bar Chart */}
      {isEmpty ? (
        <div className="my-auto py-5 flex flex-col items-center justify-center text-center">
          <div className="size-20 mb-3 flex items-center justify-center">
            <img
              src="/matiks-assets/empty-states/empty_leaderboard.png"
              alt="Leaderboard Standing"
              className="w-16 h-auto object-contain opacity-90 select-none drop-shadow-md"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.includes("state-empty-leaderboard.svg")) {
                  target.src = "/graphics/states/state-empty-leaderboard.svg";
                }
              }}
            />
          </div>
          <span className="px-3 py-1 rounded-[8px] bg-[#171717] border border-white/[0.08] text-[10px] font-sans font-medium tracking-wider text-zinc-400 uppercase">
            NO CONTEST DATA RECORDED
          </span>
          <p className="text-[11px] text-zinc-500 font-sans max-w-[220px] mt-2 leading-relaxed">
            Attend rated contests to unlock your university cohort rank and standing.
          </p>
        </div>
      ) : (
        <div className="my-auto py-6 relative">
          <div
            className="flex items-end justify-between gap-[2px] sm:gap-[3px] h-[96px] w-full"
            aria-label="Rating distribution histogram"
          >
            {displayBuckets.map((bucket, index) => {
              const count = bucket.count ?? 0;
              const barHeightPx = Math.max(4, Math.round((count / maxCount) * MAX_BAR_PX));
              const isUserBucket = index === activeBucketIndex;
              const isHovered = hoveredIndex === index;

              return (
                <div
                  key={`${bucket.min}-${index}`}
                  className="flex-1 flex flex-col items-center justify-end h-full relative cursor-pointer group"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-[#171717] border border-white/[0.12] text-[10px] font-sans text-white rounded-[8px] whitespace-nowrap z-20 pointer-events-none">
                      {bucket.min}–{bucket.min + 50}:{" "}
                      <span className="tabular-nums font-bold text-[#B1FA63]">{count}</span>
                    </div>
                  )}
                  {/* Bar */}
                  <div
                    style={{ height: `${barHeightPx}px` }}
                    className={cn(
                      "w-full rounded-t-[2px] transition-colors",
                      isUserBucket
                        ? "bg-[#B1FA63]"
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
      )}
    </div>
  );
}
