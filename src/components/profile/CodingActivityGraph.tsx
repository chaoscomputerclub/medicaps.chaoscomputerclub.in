import React, { useMemo } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { PracticeActivityResponse, ActivityDay } from "@/features/practice/types";

interface CodingActivityGraphProps {
  activityData?: PracticeActivityResponse | null;
  loading?: boolean;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface DayCell {
  date: string;
  dateObj: Date;
  dayData?: ActivityDay | undefined;
  isFuture: boolean;
  activity: number;
  accepted: number;
}

interface MonthGroup {
  name: string;
  monthIndex: number;
  weeks: Array<Array<DayCell | null>>;
}

export function CodingActivityGraph({ activityData, loading = false }: CodingActivityGraphProps) {
  const summary = activityData?.summary || {
    active_days: 0,
    total_problems: 0,
    total_accepted: 0,
    current_streak: 0,
    longest_streak: 0,
  };

  const targetYear = activityData?.year || new Date().getFullYear();

  // Build authoritative 12-month calendar for targetYear
  // Each month starts strictly on Day 1 and ends on its last day (28-31)
  const { monthsData, totalSubmissions } = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const dayMap = new Map<string, ActivityDay>();
    let subSum = 0;
    if (activityData?.days) {
      for (const d of activityData.days) {
        dayMap.set(d.date, d);
        subSum += d.activity || 0;
      }
    }

    const months: MonthGroup[] = [];

    for (let m = 0; m < 12; m++) {
      const monthName = MONTH_NAMES[m] ?? "";
      const numDays = new Date(targetYear, m + 1, 0).getDate();

      const weeks: Array<Array<DayCell | null>> = [];
      let currentWeek: Array<DayCell | null> = new Array(7).fill(null);

      for (let day = 1; day <= numDays; day++) {
        const curDate = new Date(targetYear, m, day);
        const dayOfWeek = curDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

        const mStr = String(m + 1).padStart(2, "0");
        const dStr = String(day).padStart(2, "0");
        const dateKey = `${targetYear}-${mStr}-${dStr}`;

        const dayData = dayMap.get(dateKey);
        const isFuture = curDate.getTime() > today.getTime();
        const activity = dayData?.activity || 0;
        const accepted = dayData?.accepted || 0;

        currentWeek[dayOfWeek] = {
          date: dateKey,
          dateObj: curDate,
          dayData,
          isFuture,
          activity,
          accepted,
        };

        // Close week on Saturday (6) or last day of the month
        if (dayOfWeek === 6 || day === numDays) {
          weeks.push([...currentWeek]);
          currentWeek = new Array(7).fill(null);
        }
      }

      months.push({
        name: monthName,
        monthIndex: m,
        weeks,
      });
    }

    return {
      monthsData: months,
      totalSubmissions: subSum || summary.total_accepted || 0,
    };
  }, [activityData, targetYear, summary.total_accepted]);

  const getIntensityClass = (activity: number) => {
    if (activity === 0) return "bg-[#171717] border-white/[0.06] hover:border-white/20";
    if (activity === 1) return "bg-[#0e4429] border-[#006d32]/40 hover:border-[#B1FA63]";
    if (activity === 2) return "bg-[#1a5d2c] border-[#22843b]/50 hover:border-[#B1FA63]";
    if (activity === 3) return "bg-[#2eb846] border-[#B1FA63]/60 hover:border-[#B1FA63]";
    return "bg-[#B1FA63] border-[#B1FA63]";
  };

  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] p-6 space-y-4">
      {/* Top Header Bar matching LeetCode Utilization */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs pb-1">
        <div className="flex items-center gap-2 text-zinc-300">
          <strong className="text-white text-lg font-sans font-bold tracking-tight tabular-nums">
            {loading ? "…" : totalSubmissions}
          </strong>
          <span className="font-sans text-zinc-400">submissions in the past one year</span>
          <span title="Counts unique problem solving activity logged in the academic ledger">
            <Info className="size-3.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-help" />
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-sans text-zinc-400 self-end sm:self-auto">
          <span>
            Active Days:{" "}
            <strong className="text-white tabular-nums font-sans font-semibold">
              {loading ? "…" : summary.active_days}
            </strong>
          </span>
          <span className="text-zinc-700">|</span>
          <span>
            Max Streak:{" "}
            <strong className="text-white tabular-nums font-sans font-semibold">
              {loading ? "…" : summary.longest_streak}
            </strong>
          </span>
        </div>
      </div>

      {/* Full-Width Heatmap Grid with Exact Month Separation */}
      <TooltipProvider delayDuration={50}>
        <div className="overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10 w-full">
          <div className="w-full min-w-[720px] flex items-start gap-1">
            {/* Day of week labels on left (Mon, Wed, Fri aligned to 7 rows) */}
            <div className="flex flex-col shrink-0 select-none pr-1">
              {/* Spacer matching month label height */}
              <div className="h-4 mb-2 text-transparent text-[10px]">Mon</div>
              <div className="grid grid-rows-7 gap-[3px] sm:gap-[3.5px]">
                <div className="text-[10px] font-sans text-transparent leading-none flex items-center">
                  Sun
                </div>
                <div className="text-[10px] font-sans text-zinc-500 leading-none flex items-center">
                  Mon
                </div>
                <div className="text-[10px] font-sans text-transparent leading-none flex items-center">
                  Tue
                </div>
                <div className="text-[10px] font-sans text-zinc-500 leading-none flex items-center">
                  Wed
                </div>
                <div className="text-[10px] font-sans text-transparent leading-none flex items-center">
                  Thu
                </div>
                <div className="text-[10px] font-sans text-zinc-500 leading-none flex items-center">
                  Fri
                </div>
                <div className="text-[10px] font-sans text-transparent leading-none flex items-center">
                  Sat
                </div>
              </div>
            </div>

            {/* 12 Dedicated Month Blocks (Starts on Day 1, ends on last day of month) */}
            <div className="flex items-start flex-1 w-full gap-2 sm:gap-2.5 md:gap-3 lg:gap-3.5">
              {monthsData.map((month) => (
                <div
                  key={month.name}
                  className="flex flex-col items-center min-w-0"
                  style={{ flex: month.weeks.length }}
                >
                  {/* Month Label Directly on Top */}
                  <div className="h-4 mb-2 flex items-center justify-center w-full">
                    <span className="text-[10px] sm:text-[11px] font-sans font-medium text-zinc-400 select-none">
                      {month.name}
                    </span>
                  </div>

                  {/* Month's Weekly Columns */}
                  <div className="flex gap-[3px] sm:gap-[3.5px] w-full justify-between">
                    {month.weeks.map((week, wIdx) => (
                      <div
                        key={wIdx}
                        className="grid grid-rows-7 gap-[3px] sm:gap-[3.5px] flex-1"
                      >
                        {week.map((cell, dIdx) => {
                          if (!cell) {
                            return (
                              <div
                                key={dIdx}
                                className="w-full aspect-square bg-transparent opacity-0 pointer-events-none rounded-[2px]"
                              />
                            );
                          }

                          if (cell.isFuture) {
                            return (
                              <div
                                key={dIdx}
                                className="w-full aspect-square rounded-[2px] bg-[#171717]/40 border border-white/[0.03] opacity-35 pointer-events-none"
                              />
                            );
                          }

                          const activity = cell.activity;
                          const accepted = cell.accepted;
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
                                  className={`w-full aspect-square rounded-[2px] border transition-all duration-100 cursor-pointer focus-visible:ring-1 focus-visible:ring-[#B1FA63] focus-visible:outline-none hover:scale-125 hover:z-10 ${getIntensityClass(
                                    activity
                                  )}`}
                                />
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="bg-black/95 text-white border border-white/15 px-2.5 py-1.5 font-sans text-xs rounded shadow-lg"
                              >
                                <div className="font-semibold text-[#B1FA63] text-[11px]">
                                  {dateFormatted}
                                </div>
                                <div className="text-[10px] text-zinc-300">
                                  {activity === 0
                                    ? "No submissions"
                                    : `${activity} unique ${
                                        activity === 1 ? "problem" : "problems"
                                      } (${accepted} accepted)`}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
}
