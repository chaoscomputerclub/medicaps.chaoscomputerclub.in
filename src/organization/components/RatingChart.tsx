/**
 * RatingChart — lazy-loads recharts on demand.
 * recharts is ~200 KB (vendor-charts chunk). We only pay this cost
 * when the component actually renders, not at initial app boot.
 */

import { Suspense, lazy, memo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
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
      <div className="h-64 w-full flex flex-col items-center justify-center text-center p-6 rounded-[16px] border border-white/[0.08] bg-[#171717]">
        <MakoMascot variant="focused" size="md" className="mb-2.5 opacity-90 drop-shadow-md" />
        <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-white">
          No Rating History Recorded
        </h3>
        <p className="text-xs text-zinc-400 font-sans max-w-sm mt-1 leading-relaxed">
          Participate in rated campus rounds to plot your official ELO performance curve.
        </p>
        <Link
          to="/contests"
          className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-white/[0.04] border border-white/10 hover:border-[#B1FA63] hover:text-[#B1FA63] text-xs font-heading font-bold uppercase tracking-wider text-zinc-300 transition-colors"
        >
          <span>Explore Contests</span>
          <ArrowRight className="size-3 text-[#B1FA63]" />
        </Link>
      </div>
    );
  }

  return (
    <Suspense fallback={<RatingChartSkeleton />}>
      <RatingChartInner data={data} />
    </Suspense>
  );
});
