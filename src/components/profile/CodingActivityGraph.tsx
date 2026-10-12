import React, { useMemo } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { PracticeActivityResponse, ActivityDay } from "@/features/practice/types";

interface CodingActivityGraphProps {
  activityData?: PracticeActivityResponse | null;
  loading?: boolean;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function CodingActivityGraph({ activityData, loading = false }: CodingActivityGraphProps) {
  const summary = activityData?.summary || {
    active_days: 0,
    total_problems: 0,
    total_accepted: 0,
    current_streak: 0,
    longest_streak: 0,
  };

  // Build 53-week grid for the past 365 days
  const { weeks, monthHeaders, totalSubmissions } = useMemo(() => {
    const dayMap = new Map<string, ActivityDay>();
    let subSum = 0;
    if (activityData?.days) {
      for (const d of activityData.days) {
        dayMap.set(d.date, d);
        subSum += d.activity || 0;
      }
    }

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 364);
    const startDayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDayOfWeek);

    const weeksList: Array<Array<{ date: string; dateObj: Date; dayData?: ActivityDay | undefined; inRange: boolean }>> = [];
    const months: Array<{ label: string; weekIndex: number }> = [];
    let lastMonth = -1;

    let curr = new Date(startDate);
    let currentWeek: Array<{ date: string; dateObj: Date; dayData?: ActivityDay | undefined; inRange: boolean }> = [];

    while (curr <= today || currentWeek.length > 0) {
      const dateStr = curr.toISOString().split("T")[0] ?? "";
      const m = curr.getMonth();

      if (currentWeek.length === 0 && m !== lastMonth) {
        months.push({ label: MONTH_NAMES[m] ?? "", weekIndex: weeksList.length });
        lastMonth = m;
      }

      const dayData = dayMap.get(dateStr);
      const inRange = curr <= today;

      currentWeek.push({
        date: dateStr,
        dateObj: new Date(curr),
        dayData,
        inRange,
      });

      if (currentWeek.length === 7) {
        weeksList.push(currentWeek);
        currentWeek = [];
        if (curr > today) break;
      }

      curr.setDate(curr.getDate() + 1);
    }

    return { weeks: weeksList, monthHeaders: months, totalSubmissions: subSum };
  }, [activityData]);

  const getIntensityClass = (activity: number) => {
    if (activity === 0) return "bg-[#171717] border-white/[0.06] hover:border-white/20";
    if (activity === 1) return "bg-[#0e4429] border-[#006d32]/40 hover:border-[#B1FA63]";
    if (activity === 2) return "bg-[#1a5d2c] border-[#22843b]/50 hover:border-[#B1FA63]";
    if (activity === 3) return "bg-[#2eb846] border-[#B1FA63]/60 hover:border-[#B1FA63]";
    return "bg-[#B1FA63] border-[#B1FA63] shadow-[0_0_8px_rgba(177,250,99,0.5)]";
  };

  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] p-6 space-y-4">
      {/* Top Header Bar matching LeetCode Utilization */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs pb-1">
        <div className="flex items-center gap-2 text-zinc-300">
          <strong className="text-white text-lg font-display tracking-wide tabular-nums">
            {loading ? "…" : totalSubmissions || summary.total_accepted || 0}
          </strong>
          <span className="font-sans text-zinc-400">submissions in the past one year</span>
          <span title="Counts unique problem solving activity logged in the academic ledger">
            <Info className="size-3.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-help" />
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-heading font-bold uppercase tracking-wider text-zinc-400 self-end sm:self-auto">
          <span>
            Active Days:{" "}
            <strong className="text-white tabular-nums font-mono font-bold">
              {loading ? "…" : summary.active_days}
            </strong>
          </span>
          <span className="text-zinc-700">|</span>
          <span>
            Max Streak:{" "}
            <strong className="text-white tabular-nums font-mono font-bold">
              {loading ? "…" : summary.longest_streak}
            </strong>
          </span>
        </div>
      </div>

      {/* 52-Week Heatmap Grid */}
      <TooltipProvider delayDuration={50}>
        <div className="overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10">
          <div className="min-w-[720px] space-y-2">
            {/* 7 rows x 52 columns of cells */}
            <div className="flex gap-[3.5px]">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-[3.5px]">
                  {week.map((cell, dIdx) => {
                    if (!cell.inRange) {
                      return (
                        <div
                          key={dIdx}
                          className="size-[11.5px] rounded-[2px] bg-transparent opacity-0 pointer-events-none"
                        />
                      );
                    }

                    const activity = cell.dayData?.activity || 0;
                    const accepted = cell.dayData?.accepted || 0;
                    const dateFormatted = cell.dateObj.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });

                    return (
                      <Tooltip key={dIdx}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label={`${dateFormatted}: ${activity} submissions`}
                            className={`size-[11.5px] rounded-[2px] border transition-all duration-100 cursor-pointer focus-visible:ring-1 focus-visible:ring-lime-400 focus-visible:outline-none ${getIntensityClass(
                              activity
                            )}`}
                          />
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="bg-black/95 text-white border border-white/15 px-2.5 py-1.5 font-mono text-xs rounded"
                        >
                          <div className="font-semibold text-emerald-400 text-[11px]">
                            {dateFormatted}
                          </div>
                          <div className="text-[10px] text-zinc-300">
                            {activity === 0
                              ? "No submissions"
                              : `${activity} unique ${activity === 1 ? "problem" : "problems"} (${accepted} accepted)`}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Months Row Along the Bottom (Exactly like LeetCode) */}
            <div className="flex text-[10px] font-mono text-zinc-500 pt-1 select-none">
              {weeks.map((_, idx) => {
                const header = monthHeaders.find((m) => m.weekIndex === idx);
                return (
                  <div key={idx} className="w-[11.5px] mr-[3.5px] text-left shrink-0 overflow-visible whitespace-nowrap">
                    {header ? header.label : ""}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
}
