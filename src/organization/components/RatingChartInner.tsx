/**
 * RatingChartInner — the actual recharts implementation.
 * This file is dynamically imported by RatingChart.tsx.
 * recharts lands in its own vendor-charts chunk.
 */

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

export function RatingChartInner({ data }: { data: RatingHistoryPoint[] }) {
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
              <stop offset="0%" stopColor="#CCFF00" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#CCFF00" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
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
            stroke="#CCFF00"
            strokeDasharray="4 4"
            label={{ value: "MASTER", fill: "#CCFF00", fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              background: "#000000",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "6px",
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
