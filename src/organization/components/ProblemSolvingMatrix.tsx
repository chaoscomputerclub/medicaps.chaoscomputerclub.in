import React from "react";
import { CheckCircle, Code, Layers, Zap } from "lucide-react";

interface ProblemStats {
  total_solved: number;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  total_submissions: number;
  acceptance_rate: number;
  topics?: { topic: string; solved: number }[];
}

interface ProblemSolvingMatrixProps {
  stats?: ProblemStats;
}

export function ProblemSolvingMatrix({ stats }: ProblemSolvingMatrixProps) {
  const s = stats || {
    total_solved: 0,
    easy_solved: 0,
    medium_solved: 0,
    hard_solved: 0,
    total_submissions: 0,
    acceptance_rate: 0,
    topics: [],
  };

  const totalPossible = Math.max(30, s.total_solved + 10);
  const easyTotal = 15;
  const medTotal = 15;
  const hardTotal = 10;

  const easyPct = Math.min(100, Math.round((s.easy_solved / easyTotal) * 100));
  const medPct = Math.min(100, Math.round((s.medium_solved / medTotal) * 100));
  const hardPct = Math.min(100, Math.round((s.hard_solved / hardTotal) * 100));

  return (
    <div className="border border-[#292929] bg-[#0d0d0d] p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1f1f1f] pb-3">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="font-mono text-xs uppercase font-bold text-white tracking-wider">
            Problem Solving Breakdown
          </h3>
        </div>
        <span className="font-mono text-xs text-neutral-400">
          Acceptance: <strong className="text-emerald-400 font-bold">{s.acceptance_rate || 78.5}%</strong>
        </span>
      </div>

      {/* Main Grid: Circle & Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Left: Doughnut Visual */}
        <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-neutral-950/60 border border-[#1f1f1f] relative">
          <div className="relative w-32 h-32 flex items-center justify-center">
            {/* SVG Ring */}
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                className="stroke-neutral-800"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                className="stroke-[var(--accent)]"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={`${(s.total_solved / totalPossible) * 251.2} 251.2`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="font-mono text-3xl font-black text-white">{s.total_solved}</span>
              <span className="font-mono text-[10px] uppercase text-neutral-400 tracking-wider">Solved</span>
            </div>
          </div>
          <p className="font-mono text-[11px] text-neutral-500 mt-2">
            {s.total_submissions || s.total_solved * 2} Submissions
          </p>
        </div>

        {/* Right: Difficulty Segmented Progress */}
        <div className="md:col-span-8 space-y-3.5">
          {/* Easy */}
          <div className="space-y-1.5">
            <div className="flex justify-between font-mono text-xs">
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Easy
              </span>
              <span className="text-neutral-300">
                <strong className="text-white">{s.easy_solved}</strong> / {easyTotal}
                <span className="text-neutral-500 text-[10px] ml-1.5">({easyPct}%)</span>
              </span>
            </div>
            <div className="h-2 bg-neutral-900 rounded-none overflow-hidden border border-neutral-800">
              <div
                className="h-full bg-emerald-400 transition-all duration-500"
                style={{ width: `${easyPct}%` }}
              />
            </div>
          </div>

          {/* Medium */}
          <div className="space-y-1.5">
            <div className="flex justify-between font-mono text-xs">
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Medium
              </span>
              <span className="text-neutral-300">
                <strong className="text-white">{s.medium_solved}</strong> / {medTotal}
                <span className="text-neutral-500 text-[10px] ml-1.5">({medPct}%)</span>
              </span>
            </div>
            <div className="h-2 bg-neutral-900 rounded-none overflow-hidden border border-neutral-800">
              <div
                className="h-full bg-amber-400 transition-all duration-500"
                style={{ width: `${medPct}%` }}
              />
            </div>
          </div>

          {/* Hard */}
          <div className="space-y-1.5">
            <div className="flex justify-between font-mono text-xs">
              <span className="text-rose-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                Hard
              </span>
              <span className="text-neutral-300">
                <strong className="text-white">{s.hard_solved}</strong> / {hardTotal}
                <span className="text-neutral-500 text-[10px] ml-1.5">({hardPct}%)</span>
              </span>
            </div>
            <div className="h-2 bg-neutral-900 rounded-none overflow-hidden border border-neutral-800">
              <div
                className="h-full bg-rose-400 transition-all duration-500"
                style={{ width: `${hardPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Topic Mastery Tags */}
      {s.topics && s.topics.length > 0 && (
        <div className="border-t border-[#1f1f1f] pt-3.5 space-y-2">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-400 uppercase">
            <Layers className="w-3.5 h-3.5 text-neutral-500" />
            <span>Mastered Problem Topics</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {s.topics.map((t, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-900/80 border border-neutral-800 text-neutral-300 font-mono text-xs hover:border-neutral-700 transition-colors"
              >
                <span>{t.topic}</span>
                <span className="text-[var(--accent)] font-bold">×{t.solved}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
