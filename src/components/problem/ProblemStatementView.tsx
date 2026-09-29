import React from "react";
import { Clock, Cpu, Award, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProblemExample } from "./ProblemExample";
import type { CanonicalProblem } from "@/lib/problemFormatter";

export interface ProblemStatementViewProps {
  problem: CanonicalProblem;
  className?: string;
  showStarterCodePreview?: boolean;
}

export const ProblemStatementView: React.FC<ProblemStatementViewProps> = ({
  problem,
  className = "",
}) => {
  const difficulty = (problem.difficulty || "MEDIUM").toUpperCase();
  const diffBadgeColor =
    difficulty === "EASY"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : difficulty === "HARD"
        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
        : "bg-amber-500/10 text-amber-400 border-amber-500/20";

  const sampleCases = problem.sample_testcases || [];

  // Parse constraints into clean bullet points if multi-line
  const constraintsList = problem.constraints
    ? problem.constraints
        .split("\n")
        .map((c) => c.trim())
        .filter((c) => Boolean(c))
    : [];

  return (
    <div className={`space-y-6 text-zinc-300 font-sans ${className}`} data-testid="problem-statement-view">
      {/* 1. Header: Title, Index & Badges */}
      <div className="space-y-3 pb-4 border-b border-white/8">
        <div className="flex flex-wrap items-baseline gap-2">
          {problem.problem_index && (
            <span className="font-mono text-lg font-bold text-lime-400">
              {problem.problem_index}.
            </span>
          )}
          <h1 className="text-xl font-bold text-white tracking-tight">
            {problem.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded border uppercase tracking-wider ${diffBadgeColor}`}
          >
            {difficulty}
          </span>

          {problem.points !== undefined && (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-400 bg-white/5 border border-white/8 px-2.5 py-0.5 rounded">
              <Award className="size-3 text-amber-400" />
              <span>{problem.points}&nbsp;pts</span>
            </span>
          )}

          {problem.topic && (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-400 bg-white/5 border border-white/8 px-2.5 py-0.5 rounded">
              <Tag className="size-3 text-zinc-400" />
              <span>{problem.topic}</span>
            </span>
          )}

          {problem.time_limit !== undefined && (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-500">
              <Clock className="size-3" />
              <span>{problem.time_limit}&nbsp;s</span>
            </span>
          )}

          {problem.memory_limit !== undefined && (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-500">
              <Cpu className="size-3" />
              <span>{problem.memory_limit}&nbsp;MB</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Problem Description */}
      <div className="space-y-3 text-[13.5px] leading-relaxed text-zinc-200">
        <div className="whitespace-pre-line leading-relaxed selection:bg-lime-400/20 selection:text-white">
          {problem.description}
        </div>
      </div>

      {/* 3. Input & Output Format (if specified) */}
      {(problem.input_format || problem.output_format) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {problem.input_format && (
            <div className="space-y-1.5">
              <span className="font-mono text-[11px] uppercase font-semibold text-zinc-400 tracking-wider block">
                Input Format
              </span>
              <div className="bg-zinc-950 border border-white/8 rounded-lg p-3 text-xs font-mono text-zinc-300 whitespace-pre-line leading-relaxed">
                {problem.input_format}
              </div>
            </div>
          )}

          {problem.output_format && (
            <div className="space-y-1.5">
              <span className="font-mono text-[11px] uppercase font-semibold text-zinc-400 tracking-wider block">
                Output Format
              </span>
              <div className="bg-zinc-950 border border-white/8 rounded-lg p-3 text-xs font-mono text-zinc-300 whitespace-pre-line leading-relaxed">
                {problem.output_format}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Examples (Dynamic LeetCode renderer) */}
      {sampleCases.length > 0 && (
        <div className="space-y-3.5 pt-2">
          <span className="font-mono text-[11px] uppercase font-semibold text-zinc-400 tracking-wider block">
            Examples
          </span>

          <div className="space-y-3">
            {sampleCases.map((tc, idx) => (
              <ProblemExample
                key={idx}
                index={idx + 1}
                functionSignature={problem.function_signature}
                testcase={tc}
              />
            ))}
          </div>
        </div>
      )}

      {/* 5. Constraints Section */}
      {constraintsList.length > 0 && (
        <div className="space-y-2 pt-2">
          <span className="font-mono text-[11px] uppercase font-semibold text-zinc-400 tracking-wider block">
            Constraints
          </span>
          <div className="bg-zinc-950 border border-white/8 rounded-lg p-3.5 space-y-1.5 font-mono text-xs text-amber-300/90">
            <ul className="space-y-1 list-disc list-inside">
              {constraintsList.map((c, i) => (
                <li key={i} className="leading-relaxed">
                  <span className="text-zinc-200">{c.replace(/^-\s*/, "")}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProblemStatementView;
