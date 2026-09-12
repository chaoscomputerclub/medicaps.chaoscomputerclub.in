import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RatingHistoryPoint } from "../data/types";
import { RatingChartSkeleton } from "./skeletons";

export function RatingChart({ data, loading = false }: { data?: RatingHistoryPoint[]; loading?: boolean }) {
  if (loading) {
    return <RatingChartSkeleton />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="rating-chart flex items-center justify-center text-[#666] font-mono text-xs border border-dashed border-[#222]">
        No rating history recorded yet.
      </div>
    );
  }

  return (
    <div className="rating-chart" role="img" aria-label="Rating progression across offline contests">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 18, right: 12, bottom: 2, left: -16 }}>
          <defs>
            <linearGradient id="ratingFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => new Date(v).toLocaleDateString("en-IN", { month: "short" })}
            stroke="var(--muted)"
            fontSize={11}
          />
          <YAxis domain={[1400, 2050]} stroke="var(--muted)" fontSize={11} />
          <ReferenceLine y={1800} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: "MASTER", fill: "var(--warning)", fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              background: "var(--surface-2)",
              border: "1px solid var(--line-strong)",
              borderRadius: 2,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
            labelFormatter={(v) => new Date(v).toLocaleDateString("en-IN")}
          />
          <Area
            type="monotone"
            dataKey="new_rating"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#ratingFill)"
            dot={{ r: 3, fill: "var(--bg)", stroke: "var(--accent)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
