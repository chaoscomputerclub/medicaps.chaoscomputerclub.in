/**
 * RatingChart — lazy-loads recharts on demand.
 * recharts is ~200 KB (vendor-charts chunk). We only pay this cost
 * when the component actually renders, not at initial app boot.
 */

import { Suspense, lazy, memo } from "react";
import type { RatingHistoryPoint } from "../data/types";
import { RatingChartSkeleton } from "./skeletons";
import { MakoMascot } from "@/components/common/MakoMascot";

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
      <div className="h-64 w-full flex flex-col items-center justify-center text-center p-6 border border-white/8 rounded-lg bg-black/60">
        <MakoMascot variant="focused" size="md" className="mb-2" />
        <strong className="text-xs font-sans font-bold uppercase tracking-wider text-white">
          No Rating History Recorded
        </strong>
        <p className="text-[11px] text-zinc-400 font-sans max-w-xs mt-1 leading-relaxed">
          Participate in rated campus rounds to plot your official ELO performance curve.
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={<RatingChartSkeleton />}>
      <RatingChartInner data={data} />
    </Suspense>
  );
});
