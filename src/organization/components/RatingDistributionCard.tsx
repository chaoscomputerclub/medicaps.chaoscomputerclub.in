import { useState } from "react";
import type { MemberProfile } from "../data/types";
import { cn } from "@/lib/utils";

// 23 histogram distribution buckets matching contest rating distribution curve
const BUCKET_DISTRIBUTION = [
  { min: 1000, max: 1050, height: 6 },
  { min: 1050, max: 1100, height: 7 },
  { min: 1100, max: 1150, height: 7 },
  { min: 1150, max: 1200, height: 14 },
  { min: 1200, max: 1250, height: 35 },
  { min: 1250, max: 1300, height: 100 }, // Peak distribution
  { min: 1300, max: 1350, height: 80 },
  { min: 1350, max: 1400, height: 56 },
  { min: 1400, max: 1450, height: 38 },
  { min: 1450, max: 1500, height: 26 },
  { min: 1500, max: 1550, height: 18 },
  { min: 1550, max: 1600, height: 12 },
  { min: 1600, max: 1650, height: 8 },
  { min: 1650, max: 1700, height: 7 },
  { min: 1700, max: 1750, height: 7 },
  { min: 1750, max: 1800, height: 7 },
  { min: 1800, max: 1850, height: 7 },
  { min: 1850, max: 1900, height: 7 },
  { min: 1900, max: 1950, height: 7 },
  { min: 1950, max: 2000, height: 7 },
  { min: 2000, max: 2050, height: 7 },
  { min: 2050, max: 2100, height: 7 },
  { min: 2100, max: 2400, height: 7 },
];

export function RatingDistributionCard({
  member,
}: {
  member: MemberProfile;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const attendanceCount = member.attendance_count ?? 0;
  const hasAttended = attendanceCount > 0;

  // If cadet has 0 offline contests attended, set percentile to 0% and initial ranking at minimum
  let percentileDisplay = "0%";
  let activeBucket = 0; // Minimum baseline position

  if (hasAttended) {
    const cohortTotal = Math.max(member.active_members || 480, 480);
    const rank = Math.max(1, member.university_rank || 1);
    const pct = (rank / cohortTotal) * 100;
    percentileDisplay = pct < 1 ? `${pct.toFixed(2)}%` : `${pct.toFixed(1)}%`;

    const rating = member.rating || 1200;
    activeBucket = BUCKET_DISTRIBUTION.findIndex(
      (b) => rating >= b.min && rating < b.max
    );
    if (activeBucket === -1) {
      activeBucket = rating >= 2100 ? 22 : 0;
    }
  }

  const rankDisplay = hasAttended ? `#${member.university_rank}` : "#—";

  return (
    <div className="panel flex flex-col justify-between h-full bg-[var(--surface)] border border-[var(--line)] p-6">
      {/* Top Percentile Display */}
      <div>
        <span className="text-xs font-medium text-[var(--muted)] font-sans tracking-wide block">
          Top
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-0.5 font-sans">
          {percentileDisplay}
        </h2>
      </div>

      {/* Histogram Bar Chart */}
      <div className="my-6">
        <div className="flex items-end justify-between gap-[3px] sm:gap-[4px] h-[90px] w-full">
          {BUCKET_DISTRIBUTION.map((bucket, index) => {
            const isUserBucket = index === activeBucket;
            const isHovered = hoveredIndex === index;
            // Scale bar height to max ~75px
            const barHeightPx = Math.max(5, Math.round((bucket.height / 100) * 75));

            return (
              <div
                key={index}
                className="flex-1 flex flex-col items-center justify-end h-full relative group cursor-pointer"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Tooltip on hover */}
                {isHovered && (
                  <div className="absolute -top-8 px-2 py-1 bg-zinc-900 border border-zinc-700 text-[10px] font-mono text-zinc-200 rounded whitespace-nowrap z-10 pointer-events-none shadow-lg">
                    {bucket.min} - {bucket.max}
                  </div>
                )}
                {/* The Bar: themed with var(--accent) (#c8ff36 lime) */}
                <div
                  style={{ height: `${barHeightPx}px` }}
                  className={cn(
                    "w-full rounded-t-[2px] transition-all duration-150",
                    isUserBucket
                      ? "bg-[var(--accent)] shadow-md shadow-[var(--accent)]/40 brightness-110"
                      : isHovered
                      ? "bg-zinc-500"
                      : "bg-[#333333]"
                  )}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Summary Footer */}
      <div className="grid grid-cols-3 gap-2 pt-4 border-t border-[var(--line)] text-left">
        <div>
          <span className="text-[10px] font-mono text-[var(--muted)] uppercase block">
            Contest Rating
          </span>
          <strong className="text-sm font-mono font-bold text-white block mt-0.5">
            {member.rating?.toLocaleString() || 1200}
          </strong>
        </div>
        <div>
          <span className="text-[10px] font-mono text-[var(--muted)] uppercase block">
            Global Rank
          </span>
          <strong className="text-sm font-mono font-bold text-white block mt-0.5">
            {rankDisplay}
          </strong>
        </div>
        <div>
          <span className="text-[10px] font-mono text-[var(--muted)] uppercase block">
            Attended
          </span>
          <strong className="text-sm font-mono font-bold text-white block mt-0.5">
            {attendanceCount}
          </strong>
        </div>
      </div>
    </div>
  );
}
