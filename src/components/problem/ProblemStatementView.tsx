import React, { useState } from "react";
import {
  Clock,
  Cpu,
  Award,
  Tag,
  CheckCircle2,
  Lightbulb,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { ProblemExample } from "./ProblemExample";
import { ReadmeRenderer } from "./ReadmeRenderer";
import type { CanonicalProblem } from "@/lib/problemFormatter";

export interface ProblemStatementViewProps {
  problem: CanonicalProblem;
  className?: string;
  showStarterCodePreview?: boolean;
  showPoints?: boolean;
}

export const ProblemStatementView: React.FC<ProblemStatementViewProps> = ({
  problem,
  className = "",
  showPoints = true,
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

  // Dynamic & Optional Images extraction
  const rawImages: any[] = Array.isArray(problem.images)
    ? problem.images
    : (problem as any).image_url
      ? [(problem as any).image_url]
      : [];
  const imagesList = rawImages
    .map((img) => (typeof img === "string" ? { url: img, caption: "" } : img))
    .filter((img) => Boolean(img?.url));

  // Dynamic & Optional Hints extraction
  const rawHints = Array.isArray(problem.hints) ? problem.hints : [];
  const hintsList = rawHints
    .map((h) => (typeof h === "string" ? h.trim() : String(h || "")))
    .filter((h) => Boolean(h));

  const [revealedHints, setRevealedHints] = useState<Record<number, boolean>>({});

  const toggleHint = (idx: number) => {
    setRevealedHints((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const parsedNum = Number.parseInt(problem.problem_index || "", 10);
  const displayIndex = !Number.isNaN(parsedNum) && parsedNum > 0
    ? parsedNum
    : (problem.problem_index && !/^[A-Z]$/i.test(problem.problem_index) ? problem.problem_index : null);

  const userStatus = problem.user_status || (problem as any).solved_status;

  return (
    <div className={`space-y-6 text-zinc-300 font-sans ${className}`} data-testid="problem-statement-view">
      {/* 1. Header: Title, Index & Badges */}
      <div className="space-y-3 pb-4 border-b border-white/8">
        <div className="flex flex-wrap items-center gap-2">
          {displayIndex && (
            <span className="font-sans text-lg font-bold text-lime-400">
              {displayIndex}.
            </span>
          )}
          <h1 className="text-xl font-bold text-white tracking-tight">
            {problem.title}
          </h1>

          {userStatus === "SOLVED" ? (
            <span
              title="Solved"
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-lime-400/10 text-lime-400 border border-lime-400/30"
            >
              <CheckCircle2 className="size-3.5 text-lime-400" />
              <span>Solved</span>
            </span>
          ) : userStatus === "ATTEMPTED" ? (
            <span
              title="Attempted"
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-400/10 text-amber-400 border border-amber-400/30"
            >
              <Clock className="size-3.5 text-amber-400" />
              <span>Attempted</span>
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`font-sans text-[11px] font-semibold px-2.5 py-0.5 rounded border uppercase tracking-wider ${diffBadgeColor}`}
          >
            {difficulty}
          </span>

          {showPoints && problem.points !== undefined && (
            <span className="inline-flex items-center gap-1 font-sans text-[11px] text-zinc-400 bg-white/5 border border-white/8 px-2.5 py-0.5 rounded">
              <Award className="size-3 text-amber-400" />
              <span>{problem.points}&nbsp;pts</span>
            </span>
          )}

          {problem.topic && (
            <span className="inline-flex items-center gap-1 font-sans text-[11px] text-zinc-400 bg-white/5 border border-white/8 px-2.5 py-0.5 rounded">
              <Tag className="size-3 text-zinc-400" />
              <span>{problem.topic}</span>
            </span>
          )}

          {problem.time_limit !== undefined && (
            <span className="inline-flex items-center gap-1 font-sans text-[11px] text-zinc-500">
              <Clock className="size-3" />
              <span>{problem.time_limit}&nbsp;s</span>
            </span>
          )}

          {problem.memory_limit !== undefined && (
            <span className="inline-flex items-center gap-1 font-sans text-[11px] text-zinc-500">
              <Cpu className="size-3" />
              <span>{problem.memory_limit}&nbsp;MB</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Problem Description (Rich README / Markdown Renderer) */}
      <div className="space-y-3">
        <ReadmeRenderer content={problem.description} />
      </div>

      {/* 2b. Problem Reference Diagrams / Images (Dynamic & Optional) */}
      {imagesList.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <ImageIcon className="size-3.5 text-lime-400" />
            <span className="font-sans text-[11px] uppercase font-semibold text-zinc-400 tracking-wider">
              Reference {imagesList.length > 1 ? "Images & Diagrams" : "Diagram"}
            </span>
            <span className="font-sans text-[10px] text-zinc-400 bg-white/5 border border-white/8 px-1.5 py-0.2 rounded tabular-nums">
              {imagesList.length}
            </span>
          </div>

          <div
            className={`grid gap-3 ${
              imagesList.length > 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
            }`}
          >
            {imagesList.map((img, idx) => (
              <div
                key={idx}
                className="group relative rounded-[14px] border border-white/[0.08] bg-[#171717] p-2.5 overflow-hidden flex flex-col justify-between"
              >
                <div className="relative overflow-hidden rounded-[8px] bg-black/40 flex items-center justify-center min-h-[160px] max-h-[360px]">
                  <img
                    src={img.url}
                    alt={img.caption || `Problem diagram ${idx + 1}`}
                    loading="lazy"
                    className="max-h-[360px] w-auto max-w-full object-contain rounded-[8px] transition-transform duration-200 group-hover:scale-[1.01]"
                  />
                  <a
                    href={img.url}
                    target="_blank"
                    rel="noreferrer"
                    title="Open full resolution"
                    className="absolute top-2 right-2 p-1.5 rounded-[8px] bg-black/70 hover:bg-black text-zinc-300 hover:text-white border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px]"
                  >
                    <ExternalLink className="size-3" />
                  </a>
                </div>
                {img.caption && (
                  <p className="font-sans text-[11px] text-zinc-400 text-center mt-2 px-1">
                    {img.caption}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Input & Output Format (if specified) */}
      {(problem.input_format || problem.output_format) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {problem.input_format && (
            <div className="space-y-1.5">
              <span className="font-sans text-[11px] uppercase font-semibold text-zinc-400 tracking-wider block">
                Input Format
              </span>
              <div className="bg-[#171717] border border-white/[0.08] rounded-[12px] p-3 text-xs">
                <ReadmeRenderer content={problem.input_format} />
              </div>
            </div>
          )}

          {problem.output_format && (
            <div className="space-y-1.5">
              <span className="font-sans text-[11px] uppercase font-semibold text-zinc-400 tracking-wider block">
                Output Format
              </span>
              <div className="bg-[#171717] border border-white/[0.08] rounded-[12px] p-3 text-xs">
                <ReadmeRenderer content={problem.output_format} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Examples (Dynamic LeetCode renderer) */}
      {sampleCases.length > 0 && (
        <div className="space-y-3.5 pt-2">
          <span className="font-sans text-[11px] uppercase font-semibold text-zinc-400 tracking-wider block">
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
          <span className="font-sans text-[11px] uppercase font-semibold text-zinc-400 tracking-wider block">
            Constraints
          </span>
          <div className="bg-[#171717] border border-white/[0.08] rounded-[12px] p-3.5 space-y-1.5 text-xs">
            <ul className="space-y-1.5 list-none p-0 m-0">
              {constraintsList.map((c, i) => (
                <li key={i} className="flex items-start gap-2.5 text-zinc-200">
                  <span className="text-zinc-500 select-none text-[13px] leading-5 shrink-0">
                    •
                  </span>
                  <div className="flex-1 min-w-0 font-mono text-[12.5px] leading-5">
                    <ReadmeRenderer
                      inline
                      content={c.replace(/^[•·]\s*|^[-*]\s+/, "")}
                      className="text-zinc-200 font-mono"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 6. Problem Hints Section (Dynamic & Optional) */}
      {hintsList.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="size-3.5 text-amber-400" />
              <span className="font-sans text-[11px] uppercase font-semibold text-zinc-400 tracking-wider">
                Hints
              </span>
              <span className="font-sans text-[10px] text-zinc-400 bg-white/5 border border-white/8 px-1.5 py-0.2 rounded tabular-nums">
                {hintsList.length}
              </span>
            </div>
            <span className="text-[11px] font-sans text-zinc-500">
              Click to reveal individual hints
            </span>
          </div>

          <div className="space-y-2">
            {hintsList.map((hintText, idx) => {
              const isRevealed = Boolean(revealedHints[idx]);
              return (
                <div
                  key={idx}
                  className="rounded-[12px] border border-white/[0.08] bg-[#171717] overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => toggleHint(idx)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs font-medium hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
                  >
                    <div className="flex items-center gap-2">
                      <Lightbulb
                        className={`size-3.5 transition-colors ${
                          isRevealed ? "text-amber-400" : "text-zinc-500"
                        }`}
                      />
                      <span className="text-zinc-300 font-semibold">
                        Hint {idx + 1}
                      </span>
                      {!isRevealed && (
                        <span className="text-[10px] text-zinc-500 font-sans">
                          (Hidden)
                        </span>
                      )}
                    </div>
                    {isRevealed ? (
                      <ChevronUp className="size-3.5 text-zinc-400" />
                    ) : (
                      <ChevronDown className="size-3.5 text-zinc-400" />
                    )}
                  </button>

                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-280 ease-linear ${
                      isRevealed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
                    }`}
                  >
                    <div className="overflow-hidden min-h-0">
                      <div className="px-3.5 pb-3 pt-1 border-t border-white/[0.06] text-xs leading-relaxed text-zinc-300">
                        <ReadmeRenderer content={hintText} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProblemStatementView;

