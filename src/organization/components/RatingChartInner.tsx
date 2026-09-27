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

export function RatingChartInner({ data }: { data: (RatingHistoryPoint | number)[] }) {
  const rawChartData = (data || []).map((d, idx) => {
    if (typeof d === "number") {
      return {
        contest: idx === 0 ? "Initial Baseline" : `Contest Round ${idx}`,
        date: new Date(Date.now() - Math.max(0, (data.length - 1 - idx)) * 86400000 * 7).toISOString(),
        new_rating: d,
        delta: 0,
      };
    }
    const rawDate = d?.date;
    const isValidDate = Boolean(rawDate && !isNaN(new Date(rawDate).getTime()));
    return {
      ...d,
      date: isValidDate
        ? rawDate
        : new Date(Date.now() - Math.max(0, (data.length - 1 - idx)) * 86400000 * 7).toISOString(),
      new_rating: d?.new_rating ?? (d as any)?.rating ?? 1200,
    };
  });

  // Guarantee baseline starting point (1200) if not present or single contest point
  const chartData = [...rawChartData];
  const firstPoint = chartData[0];
  if (chartData.length === 1 && firstPoint && firstPoint.contest !== "Initial Baseline") {
    const firstDateMs = new Date(firstPoint.date).getTime();
    const baselineDate = new Date(firstDateMs - 86400000).toISOString();
    chartData.unshift({
      contest: "Initial Baseline",
      date: baselineDate,
      new_rating: (firstPoint as any).old_rating ?? 1200,
      delta: 0,
    } as any);
  }

  const ratings = chartData
    .map((d) => d.new_rating)
    .filter((n) => typeof n === "number" && !isNaN(n));
  const minVal = ratings.length > 0 ? Math.min(...ratings) : 1200;
  const maxVal = ratings.length > 0 ? Math.max(...ratings) : 1200;
  const targetMilestone =
    maxVal >= 2000
      ? { y: 2200, label: "----ROOT ACCESS----", color: "#f43f5e" }
      : maxVal >= 1800
      ? { y: 2000, label: "----ROOT ACCESS----", color: "#f43f5e" }
      : maxVal >= 1600
      ? { y: 1800, label: "----ARCHITECT----", color: "#CCFF00" }
      : { y: 1600, label: "----NETRUNNER----", color: "#38bdf8" };

  const yMin = Math.max(800, Math.floor((minVal - 150) / 100) * 100);
  const yMax = Math.min(3000, Math.max(targetMilestone.y, Math.ceil((maxVal + 200) / 100) * 100));

  return (
    <div
      className="h-64 w-full"
      role="img"
      aria-label="Rating progression across offline contests"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 18, right: 12, bottom: 2, left: -16 }}>
          <defs>
            <linearGradient id="ratingFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#CCFF00" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#CCFF00" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => {
              if (!v) return "";
              const dateObj = new Date(v);
              if (isNaN(dateObj.getTime())) return String(v);
              return dateObj.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
            }}
            stroke="#71717a"
            fontSize={11}
            tickLine={false}
          />
          <YAxis domain={[yMin, yMax]} stroke="#71717a" fontSize={11} tickLine={false} />
          {targetMilestone && yMax >= targetMilestone.y && yMin <= targetMilestone.y && (
            <ReferenceLine
              y={targetMilestone.y}
              stroke={targetMilestone.color}
              strokeDasharray="4 4"
              label={{
                value: targetMilestone.label,
                fill: targetMilestone.color,
                fontSize: 10,
                fontWeight: 600,
              }}
            />
          )}
          <Tooltip
            contentStyle={{
              background: "#000000",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "6px",
              fontFamily: '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: 12,
              color: "#ffffff",
            }}
            labelFormatter={(v, payload) => {
              const item = payload?.[0]?.payload;
              const contestName = item?.contest;
              if (contestName === "Initial Baseline") {
                return "Initial Rating Baseline (1,200)";
              }
              if (!v) return contestName || "Rating Point";
              const dateObj = new Date(v);
              const formattedDate = isNaN(dateObj.getTime())
                ? String(v)
                : dateObj.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
              return contestName ? `${contestName} (${formattedDate})` : formattedDate;
            }}
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
