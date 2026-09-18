import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RatingHistoryPoint } from "../data/types";
import { RatingChartSkeleton } from "./skeletons";

export function RatingChart({
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
      <div className="h-64 w-full flex items-center justify-center text-zinc-500 font-mono text-xs border border-dashed border-white/10 rounded-none bg-zinc-900/30">
        No rating history recorded yet.
      </div>
    );
  }

  return (
    <div
      className="h-64 w-full"
      role="img"
      aria-label="Rating progression across offline contests"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 18, right: 12, bottom: 2, left: -16 }}>
          <defs>
            <linearGradient id="ratingFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#CCFF00" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#CCFF00" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => new Date(v).toLocaleDateString("en-IN", { month: "short" })}
            stroke="#71717a"
            fontSize={11}
            tickLine={false}
          />
          <YAxis domain={[1400, 2050]} stroke="#71717a" fontSize={11} tickLine={false} />
          <ReferenceLine
            y={1800}
            stroke="#eab308"
            strokeDasharray="4 4"
            label={{ value: "MASTER", fill: "#eab308", fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              background: "#080808",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 0,
              fontFamily: "monospace",
              fontSize: 12,
              color: "#ffffff",
            }}
            labelFormatter={(v) => new Date(v).toLocaleDateString("en-IN")}
          />
          <Area
            type="monotone"
            dataKey="new_rating"
            stroke="#CCFF00"
            strokeWidth={2}
            fill="url(#ratingFill)"
            dot={{ r: 3, fill: "#000000", stroke: "#CCFF00", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
