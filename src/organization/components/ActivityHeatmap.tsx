import React, { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Flame, CheckCircle2, Calendar } from "lucide-react";

interface ActivityHeatmapProps {
  submissionCalendar?: Record<string, number>;
  totalSubmissions?: number;
  streak?: number;
}

export function ActivityHeatmap({
  submissionCalendar = {},
  totalSubmissions = 0,
  streak = 0,
}: ActivityHeatmapProps) {
  // Generate 52 weeks (7 days each) leading up to today
  const { weeks, monthLabels, activeDays, maxStreak } = useMemo(() => {
    const today = new Date();
    const days: { dateStr: string; date: Date; count: number; dayOfWeek: number }[] = [];
    
    // 52 weeks = 364 days
    for (let i = 363; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const count = submissionCalendar[dateStr] || 0;
      days.push({
        dateStr,
        date: d,
        count,
        dayOfWeek: d.getDay(), // 0 = Sun, 1 = Mon, ..., 6 = Sat
      });
    }

    // Group into columns of weeks (7 days each, starting Sunday)
    const weekCols: (typeof days)[] = [];
    let currentWeek: typeof days = [];
    
    days.forEach((day) => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weekCols.push(currentWeek);
        currentWeek = [];
      }
    });
    if (currentWeek.length > 0) {
      weekCols.push(currentWeek);
    }

    // Determine month label positions
    const months: { label: string; colIndex: number }[] = [];
    let lastMonth = -1;
    weekCols.forEach((week, colIdx) => {
      const firstDay = week[0]?.date;
      if (firstDay && firstDay.getMonth() !== lastMonth) {
        lastMonth = firstDay.getMonth();
        months.push({
          label: firstDay.toLocaleDateString("en-US", { month: "short" }),
          colIndex: colIdx,
        });
      }
    });

    // Calculate active days and max streak
    let active = 0;
    let currentStreakCounter = 0;
    let calculatedMaxStreak = 0;

    days.forEach((day) => {
      if (day.count > 0) {
        active++;
        currentStreakCounter++;
        if (currentStreakCounter > calculatedMaxStreak) {
          calculatedMaxStreak = currentStreakCounter;
        }
      } else {
        currentStreakCounter = 0;
      }
    });

    return {
      weeks: weekCols,
      monthLabels: months,
      activeDays: active,
      maxStreak: Math.max(calculatedMaxStreak, streak),
    };
  }, [submissionCalendar, streak]);

  const getIntensityColor = (count: number) => {
    if (count === 0) return "bg-neutral-900 border border-neutral-800/60";
    if (count === 1) return "bg-emerald-950 border border-emerald-800 text-emerald-400";
    if (count === 2 || count === 3) return "bg-emerald-800 border border-emerald-600";
    if (count === 4 || count === 5) return "bg-emerald-600 border border-emerald-400";
    return "bg-[var(--accent)] border border-[var(--accent)] shadow-[0_0_8px_rgba(202,255,0,0.4)]";
  };

  return (
    <div className="border border-[#292929] bg-[#0d0d0d] p-5 space-y-4">
      {/* Header & Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1f1f1f] pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="font-mono text-xs uppercase font-bold text-white tracking-wider">
            Annual Activity & Submissions
          </h3>
        </div>

        <div className="flex items-center gap-6 font-mono text-xs">
          <div className="flex items-center gap-1.5 text-neutral-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Total: <strong className="text-white font-bold">{totalSubmissions || activeDays}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-neutral-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Active Days: <strong className="text-white font-bold">{activeDays}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-neutral-400">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Streak: <strong className="text-amber-400 font-bold">{streak || maxStreak} days</strong></span>
          </div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[720px] space-y-1">
          {/* Month Labels */}
          <div className="flex text-[10px] font-mono text-neutral-500 h-4 pl-6 relative">
            {monthLabels.map((m, idx) => (
              <span
                key={idx}
                className="absolute"
                style={{ left: `${m.colIndex * 14 + 24}px` }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex gap-1 items-start">
            {/* Day of Week Labels */}
            <div className="flex flex-col gap-1 text-[9px] font-mono text-neutral-600 pr-1 select-none pt-0.5">
              <span className="h-[10px] leading-[10px]">Sun</span>
              <span className="h-[10px] leading-[10px]" />
              <span className="h-[10px] leading-[10px]">Tue</span>
              <span className="h-[10px] leading-[10px]" />
              <span className="h-[10px] leading-[10px]">Thu</span>
              <span className="h-[10px] leading-[10px]" />
              <span className="h-[10px] leading-[10px]">Sat</span>
            </div>

            {/* Weeks Columns */}
            <TooltipProvider delayDuration={100}>
              <div className="flex gap-1">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-1">
                    {week.map((day) => (
                      <Tooltip key={day.dateStr}>
                        <TooltipTrigger asChild>
                          <div
                            className={`w-[10px] h-[10px] rounded-[1.5px] transition-all hover:scale-125 cursor-pointer ${getIntensityColor(
                              day.count
                            )}`}
                          />
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="bg-neutral-900 border border-neutral-700 text-white font-mono text-[11px] px-2.5 py-1.5 shadow-xl"
                        >
                          <p className="font-bold text-[var(--accent)]">
                            {day.count} {day.count === 1 ? "submission" : "submissions"}
                          </p>
                          <p className="text-neutral-400 text-[10px]">
                            {day.date.toLocaleDateString("en-US", {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                ))}
              </div>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 pt-1">
        <span>365-day submission activity</span>
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          <span className="w-2.5 h-2.5 rounded-[1px] bg-neutral-900 border border-neutral-800" />
          <span className="w-2.5 h-2.5 rounded-[1px] bg-emerald-950 border border-emerald-800" />
          <span className="w-2.5 h-2.5 rounded-[1px] bg-emerald-800" />
          <span className="w-2.5 h-2.5 rounded-[1px] bg-emerald-600" />
          <span className="w-2.5 h-2.5 rounded-[1px] bg-[var(--accent)]" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
