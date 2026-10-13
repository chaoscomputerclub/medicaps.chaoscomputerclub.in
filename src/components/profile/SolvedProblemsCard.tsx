import React from "react";
import { Check, Info } from "lucide-react";
import type { PracticeStatsResponse } from "@/features/practice/types";

interface SolvedProblemsCardProps {
  stats?: PracticeStatsResponse | null;
  loading?: boolean;
}

export function SolvedProblemsCard({ stats, loading = false }: SolvedProblemsCardProps) {
  const problems = stats?.problems || { solved: 0, attempted: 0, total: 0 };
  const diff = stats?.difficulty || {
    easy: { solved: 0, total: 0 },
    medium: { solved: 0, total: 0 },
    hard: { solved: 0, total: 0 },
  };

  const totalPublished = problems.total || (diff.easy.total + diff.medium.total + diff.hard.total) || 0;
  const totalSolved = problems.solved;
  const attemptingCount = Math.max(0, problems.attempted - problems.solved);

  // Gauge geometry: Open 260° circular arc (open at bottom)
  const radius = 56;
  const circumference = 2 * Math.PI * radius; // ~351.86
  const arcFraction = 0.75; // 270 degrees visible arc
  const totalArcLength = circumference * arcFraction; // ~263.9
  const gapLength = circumference - totalArcLength; // ~87.96

  // Calculate arc lengths for Easy, Medium, Hard
  // Scale each difficulty by its proportion of total published problems
  const easyPortion = totalPublished > 0 ? (diff.easy.solved / totalPublished) * totalArcLength : 0;
  const medPortion = totalPublished > 0 ? (diff.medium.solved / totalPublished) * totalArcLength : 0;
  const hardPortion = totalPublished > 0 ? (diff.hard.solved / totalPublished) * totalArcLength : 0;

  // Rotation: Start at 135° so opening is symmetrically at the bottom
  const startAngle = 135;

  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] p-6 h-full flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08]">
        <span className="text-xs font-heading font-bold uppercase tracking-wider text-zinc-400">
          Solved Problems
        </span>
        <span className="text-[10px] font-sans text-zinc-400 bg-[#171717] px-2.5 py-0.5 rounded-[6px] border border-white/[0.08] flex items-center gap-1">
          <span>Authoritative</span>
        </span>
      </div>

      {/* Main Utilization Body: Radial Arc + 3 Stacked Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center py-2 flex-1">
        {/* Left: Multi-segment Radial Arc */}
        <div className="sm:col-span-6 flex flex-col items-center justify-center relative">
          <div className="relative size-44 flex items-center justify-center">
            <svg
              className="size-full"
              viewBox="0 0 140 140"
            >
              <g transform={`rotate(${startAngle} 70 70)`}>
                {/* Background Arc Track */}
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  className="stroke-zinc-800/80"
                  strokeWidth="7"
                  fill="transparent"
                  strokeDasharray={`${totalArcLength} ${circumference}`}
                  strokeLinecap="round"
                />

                {/* Easy Arc (Cyan / Emerald) */}
                {easyPortion > 0 && (
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    className="stroke-[#00b8a3] transition-all duration-700 ease-out"
                    strokeWidth="7"
                    fill="transparent"
                    strokeDasharray={`${easyPortion} ${circumference}`}
                    strokeDashoffset={0}
                    strokeLinecap="round"
                  />
                )}

                {/* Medium Arc (Amber / Yellow) */}
                {medPortion > 0 && (
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    className="stroke-[#ffc01e] transition-all duration-700 ease-out"
                    strokeWidth="7"
                    fill="transparent"
                    strokeDasharray={`${medPortion} ${circumference}`}
                    strokeDashoffset={-easyPortion}
                    strokeLinecap="round"
                  />
                )}

                {/* Hard Arc (Red / Rose) */}
                {hardPortion > 0 && (
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    className="stroke-[#ff375f] transition-all duration-700 ease-out"
                    strokeWidth="7"
                    fill="transparent"
                    strokeDasharray={`${hardPortion} ${circumference}`}
                    strokeDashoffset={-(easyPortion + medPortion)}
                    strokeLinecap="round"
                  />
                )}
              </g>
            </svg>

            {/* Arc Center Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center font-sans text-center pointer-events-none">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl sm:text-5xl font-display font-bold text-white tabular-nums tracking-wide">
                  {loading ? "…" : totalSolved}
                </span>
                <span className="text-xs font-sans text-zinc-500 tabular-nums">
                  /{loading ? "…" : totalPublished}
                </span>
              </div>

              <div className="flex items-center gap-1 text-[11px] font-heading font-bold uppercase tracking-wider text-[#B1FA63] mt-0.5">
                <Check className="size-3 stroke-[3]" />
                <span>Solved</span>
              </div>

              <div className="text-[10px] font-sans text-zinc-500 mt-1 tabular-nums">
                {attemptingCount > 0 ? `${attemptingCount} Attempting` : `${problems.attempted} Attempted`}
              </div>
            </div>
          </div>
        </div>

        {/* Right: 3 Difficulty Cards (LeetCode Utilization Style) */}
        <div className="sm:col-span-6 flex flex-col justify-center gap-2.5 font-sans">
          {/* Easy Card */}
          <div className="rounded-[14px] bg-[#171717] border border-white/[0.08] px-4 py-3 space-y-2 hover:border-white/[0.16] transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#00b8a3]">
                Easy
              </span>
              <span className="font-sans text-xs tabular-nums">
                <strong className="text-white font-bold">{diff.easy.solved}</strong>
                <span className="text-zinc-500">/{diff.easy.total || 0}</span>
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/[0.08] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#00b8a3] rounded-full transition-all duration-500"
                style={{
                  width: `${diff.easy.total > 0 ? Math.min(100, Math.round((diff.easy.solved / diff.easy.total) * 100)) : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Medium Card */}
          <div className="rounded-[14px] bg-[#171717] border border-white/[0.08] px-4 py-3 space-y-2 hover:border-white/[0.16] transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#ffc01e]">
                Med.
              </span>
              <span className="font-sans text-xs tabular-nums">
                <strong className="text-white font-bold">{diff.medium.solved}</strong>
                <span className="text-zinc-500">/{diff.medium.total || 0}</span>
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/[0.08] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#ffc01e] rounded-full transition-all duration-500"
                style={{
                  width: `${diff.medium.total > 0 ? Math.min(100, Math.round((diff.medium.solved / diff.medium.total) * 100)) : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Hard Card */}
          <div className="rounded-[14px] bg-[#171717] border border-white/[0.08] px-4 py-3 space-y-2 hover:border-white/[0.16] transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#ff375f]">
                Hard
              </span>
              <span className="font-sans text-xs tabular-nums">
                <strong className="text-white font-bold">{diff.hard.solved}</strong>
                <span className="text-zinc-500">/{diff.hard.total || 0}</span>
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/[0.08] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#ff375f] rounded-full transition-all duration-500"
                style={{
                  width: `${diff.hard.total > 0 ? Math.min(100, Math.round((diff.hard.solved / diff.hard.total) * 100)) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
