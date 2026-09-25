/**
 * RatingChart — lazy-loads recharts on demand.
 * recharts is ~200 KB (vendor-charts chunk). We only pay this cost
 * when the component actually renders, not at initial app boot.
 */

import { Suspense, lazy, memo } from "react";
import type { RatingHistoryPoint } from "../data/types";
import { RatingChartSkeleton } from "./skeletons";

// Lazy import of the actual recharts-powered chart
const RatingChartInner = lazy(() =>
  import("./RatingChartInner").then((m) => ({ default: m.RatingChartInner }))
);

export const RatingChart = memo(function RatingChart({
  data,
  loading = false,
}: {
  data?: RatingHistoryPoint[];
  loading?: boolean;
}) {
  if (loading) {
    return <RatingChartSkeleton />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 w-full flex items-center justify-center text-zinc-400 font-mono text-xs border border-white/8 rounded-lg bg-black">
        No rating history recorded yet.
      </div>
    );
  }

  return (
    <Suspense fallback={<RatingChartSkeleton />}>
      <RatingChartInner data={data} />
    </Suspense>
  );
});
