import React, { useMemo } from "react";
import { Info, Flame, Zap, Calendar } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { PracticeActivityResponse, ActivityDay } from "@/features/practice/types";

interface CodingActivityGraphProps {
  activityData?: PracticeActivityResponse | null;
  loading?: boolean;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface DayCell {
  date: string;
  dateObj: Date;
  dayData?: ActivityDay | undefined;
  isFuture: boolean;
  activity: number;
  accepted: number;
  dayOfMonth: number;
}

interface MonthGroup {
  name: string;
  fullName: string;
  monthIndex: number;
  weeks: Array<Array<DayCell | null>>;
  totalActivity: number;
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

  // Group days of targetYear into 12 distinct months with full weekly grid
  const { months, totalSubmissions } = useMemo(() => {
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

    const monthGroups: MonthGroup[] = [];

    for (let m = 0; m < 12; m++) {
      const monthName = MONTH_NAMES[m] ?? `M${m + 1}`;
      const fullMonthName = FULL_MONTH_NAMES[m] ?? monthName;

      // Last day of month m in targetYear
      const lastDateObj = new Date(targetYear, m + 1, 0);
      const totalDaysInMonth = lastDateObj.getDate();

      const weeks: Array<Array<DayCell | null>> = [];
      let currentWeek: Array<DayCell | null> = new Array(7).fill(null);
      let monthActivity = 0;

      for (let day = 1; day <= totalDaysInMonth; day++) {
        const curDate = new Date(targetYear, m, day);
        const dayOfWeek = curDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

        const monthStr = String(m + 1).padStart(2, "0");
        const dayStr = String(day).padStart(2, "0");
        const dateKey = `${targetYear}-${monthStr}-${dayStr}`;

        const dayData = dayMap.get(dateKey);
        const isFuture = curDate.getTime() > today.getTime();
        const activity = dayData?.activity || 0;
        const accepted = dayData?.accepted || 0;
        monthActivity += activity;

        currentWeek[dayOfWeek] = {
          date: dateKey,
          dateObj: curDate,
          dayData,
          isFuture,
          activity,
          accepted,
          dayOfMonth: day,
        };

        // Complete week on Saturday (6) or last day of the month
        if (dayOfWeek === 6 || day === totalDaysInMonth) {
          weeks.push([...currentWeek]);
          currentWeek = new Array(7).fill(null);
        }
      }

      monthGroups.push({
        name: monthName,
        fullName: fullMonthName,
        monthIndex: m,
        weeks,
        totalActivity: monthActivity,
      });
    }

    return {
      months: monthGroups,
      totalSubmissions: subSum || summary.total_accepted || 0,
    };
  }, [activityData, targetYear, summary.total_accepted]);

  const getIntensityClass = (activity: number, isFuture: boolean) => {
    if (isFuture) {
      return "bg-[#141414]/50 border-white/[0.03] opacity-35 cursor-default";
    }
    if (activity === 0) {
      return "bg-[#141414] border-white/[0.05] hover:border-white/25 hover:bg-white/[0.04]";
    }
    if (activity === 1) {
      return "bg-[#0e4429] border-[#006d32]/50 hover:border-[#39d353] hover:shadow-[0_0_8px_rgba(0,109,50,0.5)]";
    }
    if (activity === 2) {
      return "bg-[#006d32] border-[#22843b]/60 hover:border-[#B1FA63] hover:shadow-[0_0_10px_rgba(34,132,59,0.5)]";
    }
    if (activity === 3) {
      return "bg-[#26a641] border-[#39d353]/70 hover:border-[#B1FA63] hover:shadow-[0_0_12px_rgba(57,211,83,0.5)]";
    }
    return "bg-[#B1FA63] border-[#B1FA63] shadow-[0_0_8px_rgba(177,250,99,0.35)] hover:shadow-[0_0_14px_rgba(177,250,99,0.7)]";
  };

  return (
    <div className="w-full rounded-[20px] sm:rounded-[24px] border border-white/[0.08] bg-[#171717] p-5 sm:p-6 lg:p-7 space-y-5 shadow-[0_12px_36px_rgba(0,0,0,0.35)] relative overflow-hidden">
      {/* Subtle top ambient glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

      {/* Top Header Bar with Metrics & Telemetry Chips */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-white/[0.06]">
        {/* Left: Total Submissions Counter */}
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-heading text-white tracking-tight tabular-nums">
              {loading ? "…" : totalSubmissions}
            </span>
            <span className="text-xs sm:text-sm font-sans text-zinc-400">
              submissions in {targetYear}
            </span>
          </div>
          <span
            className="inline-flex items-center text-zinc-500 hover:text-zinc-300 transition-colors cursor-help"
            title="Authoritative problem-solving telemetry logged in the CCC academic ledger"
          >
            <Info className="size-3.5" />
          </span>
        </div>

        {/* Right: Telemetry Badges */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#121212] border border-white/[0.06] text-xs">
            <Calendar className="size-3.5 text-zinc-400" />
            <span className="text-zinc-400 font-sans text-[11px]">Active:</span>
            <strong className="font-mono text-white tabular-nums">
              {loading ? "…" : summary.active_days}d
            </strong>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#121212] border border-white/[0.06] text-xs">
            <Flame className="size-3.5 text-[#B1FA63]" />
            <span className="text-zinc-400 font-sans text-[11px]">Streak:</span>
            <strong className="font-mono text-[#B1FA63] tabular-nums">
              {loading ? "…" : summary.current_streak}d
            </strong>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#121212] border border-white/[0.06] text-xs">
            <Zap className="size-3.5 text-amber-400" />
            <span className="text-zinc-400 font-sans text-[11px]">Max:</span>
            <strong className="font-mono text-amber-400 tabular-nums">
              {loading ? "…" : summary.longest_streak}d
            </strong>
          </div>

          <div className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-[8px] bg-[#141414] border border-white/[0.08] text-[11px] font-mono text-zinc-300 font-semibold tracking-wider">
            {targetYear}
          </div>
        </div>
      </div>

      {/* Full-Width GitHub-Style Heatmap with Separated Months */}
      <TooltipProvider delayDuration={40}>
        <div className="w-full overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-white/10">
          <div className="w-full min-w-[760px] flex items-start gap-1">
            {/* Left Column: Fixed 7-Row Day of Week Labels (Aligned to Sun-Sat) */}
            <div className="flex flex-col shrink-0 select-none pr-1.5">
              {/* Header height spacer matching month labels */}
              <div className="h-5 mb-2" />
              <div className="grid grid-rows-7 gap-[3px] sm:gap-[3.5px]">
                <div className="size-2 sm:size-2.5" />
                <div className="text-[10px] font-mono text-zinc-500 leading-none flex items-center pr-1">
                  Mon
                </div>
                <div className="size-2 sm:size-2.5" />
                <div className="text-[10px] font-mono text-zinc-500 leading-none flex items-center pr-1">
                  Wed
                </div>
                <div className="size-2 sm:size-2.5" />
                <div className="text-[10px] font-mono text-zinc-500 leading-none flex items-center pr-1">
                  Fri
                </div>
                <div className="size-2 sm:size-2.5" />
              </div>
            </div>

            {/* 12 Separated Month Groups spanning 100% width */}
            <div className="flex items-start flex-1 w-full gap-2 sm:gap-2.5 md:gap-3 lg:gap-3.5">
              {months.map((month) => (
                <div
                  key={month.name}
                  className="flex flex-col items-center min-w-0 group"
                  style={{ flex: month.weeks.length }}
                >
                  {/* Month Header Label */}
                  <div className="h-5 mb-2 flex items-center justify-center w-full">
                    <span className="text-[10.5px] sm:text-[11px] font-mono font-semibold tracking-wider text-zinc-400 group-hover:text-zinc-200 transition-colors uppercase select-none">
                      {month.name}
                    </span>
                  </div>

                  {/* Week Columns of Month */}
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
                                className="w-full aspect-square bg-transparent opacity-0 pointer-events-none rounded-[2.5px]"
                              />
                            );
                          }

                          const formattedDate = cell.dateObj.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          });

                          return (
                            <Tooltip key={dIdx}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  disabled={cell.isFuture}
                                  aria-label={`${formattedDate}: ${cell.activity} submissions`}
                                  className={`w-full aspect-square rounded-[2.5px] sm:rounded-[3px] border transition-all duration-150 cursor-pointer focus-visible:ring-1 focus-visible:ring-lime-400 focus-visible:outline-none ${getIntensityClass(
                                    cell.activity,
                                    cell.isFuture
                                  )} ${!cell.isFuture ? "hover:scale-125 hover:z-20" : ""}`}
                                />
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                sideOffset={6}
                                className="bg-[#121212]/95 text-white border border-white/15 px-3 py-2 rounded-[10px] shadow-2xl backdrop-blur-md font-sans z-50 pointer-events-none"
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <div
                                    className={`size-2 rounded-full ${
                                      cell.activity > 0
                                        ? "bg-[#B1FA63]"
                                        : cell.isFuture
                                        ? "bg-zinc-700"
                                        : "bg-zinc-500"
                                    }`}
                                  />
                                  <span className="font-mono text-[11px] text-zinc-300 font-medium">
                                    {formattedDate}
                                  </span>
                                </div>
                                <div className="text-[12px] font-semibold text-white">
                                  {cell.isFuture
                                    ? "Upcoming schedule"
                                    : cell.activity === 0
                                    ? "No activity logged"
                                    : `${cell.activity} unique ${
                                        cell.activity === 1 ? "problem" : "problems"
                                      } solved`}
                                </div>
                                {!cell.isFuture && cell.accepted > 0 && (
                                  <div className="text-[11px] text-emerald-400 font-mono mt-0.5 flex items-center gap-1">
                                    <span>✓</span>
                                    <span>{cell.accepted} accepted {cell.accepted === 1 ? "solution" : "solutions"}</span>
                                  </div>
                                )}
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

      {/* Bottom Footer Bar: Context Guidance & GitHub Heat Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">
        <div className="text-[11px] font-sans text-zinc-500 select-none">
          Verified academic problem-solving ledger & tournament completions.
        </div>

        {/* GitHub Legend Scale */}
        <div className="flex items-center gap-2 self-end sm:self-auto text-[11px] font-sans text-zinc-400 select-none">
          <span className="text-zinc-500">Less</span>
          <div
            className="size-3 rounded-[2.5px] bg-[#141414] border border-white/[0.05]"
            title="0 submissions"
          />
          <div
            className="size-3 rounded-[2.5px] bg-[#0e4429] border border-[#006d32]/50"
            title="1 submission"
          />
          <div
            className="size-3 rounded-[2.5px] bg-[#006d32] border border-[#22843b]/60"
            title="2 submissions"
          />
          <div
            className="size-3 rounded-[2.5px] bg-[#26a641] border border-[#39d353]/70"
            title="3 submissions"
          />
          <div
            className="size-3 rounded-[2.5px] bg-[#B1FA63] border border-[#B1FA63] shadow-[0_0_8px_rgba(177,250,99,0.4)]"
            title="4+ submissions"
          />
          <span className="text-zinc-500">More</span>
        </div>
      </div>
    </div>
  );
}
