import type { ContestProblem, ScoreboardEntry } from "../data/types";
import { cn } from "@/lib/utils";
import { formatPenalty } from "./ui";
import { ScoreboardMatrixSkeleton } from "./skeletons";

export function ScoreboardMatrix({
  entries,
  problems,
  compact = false,
  loading = false,
}: {
  entries?: ScoreboardEntry[];
  problems?: ContestProblem[];
  compact?: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return <ScoreboardMatrixSkeleton compact={compact} />;
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="text-center py-10 text-[#666] font-mono text-xs border border-dashed border-[#222]">
        No standings recorded yet.
      </div>
    );
  }

  const safeProblems = problems || [];

  return (
    <div className="overflow-x-auto border border-white/10 bg-black rounded-none">
      <table className="w-full text-left font-mono text-xs border-collapse">
        <thead className="bg-zinc-950 text-slate-400 text-[10px] uppercase tracking-wider border-b border-white/10">
          <tr>
            <th className="p-3 w-12 text-center">#</th>
            <th className="p-3">Contestant</th>
            {!compact && <th className="p-3">Dept.</th>}
            {safeProblems.map((p, idx) => {
              const label = (p as any).problem_index || p.index || String.fromCharCode(65 + idx);
              return (
                <th key={(p as any).id || label} title={p.title} className="p-3 text-center w-16">
                  {label}
                </th>
              );
            })}
            <th className="p-3 text-center w-16">Solved</th>
            <th className="p-3 text-right w-24">Penalty</th>
            <th className="p-3 text-right w-16">Δ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {entries.map((row) => (
            <tr
              key={row.handle}
              className={cn(
                "hover:bg-zinc-900/50 transition-colors duration-100",
                row.is_you ? "bg-lime-400/5 border-l-2 border-l-lime-400" : ""
              )}
            >
              <td className="p-3 text-center font-bold text-slate-300 tabular-nums">
                {row.rank}
              </td>
              <td className="p-3">
                <div className="flex flex-col">
                  <strong className="text-white font-semibold flex items-center gap-1.5">
                    {row.handle}
                    {row.is_you && (
                      <span className="text-[9px] px-1 py-0.2 bg-lime-400 text-black font-bold uppercase">
                        YOU
                      </span>
                    )}
                  </strong>
                  <span className="text-[11px] text-slate-400 font-sans">{row.full_name}</span>
                </div>
              </td>
              {!compact && (
                <td className="p-3">
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono bg-zinc-900 border border-white/10 text-slate-300">
                    {row.department} · {row.batch.slice(2)}
                  </span>
                </td>
              )}
              {safeProblems.map((p, i) => {
                const cell = row.problems?.[i];
                const key = (p as any).id || (p as any).problem_index || p.index || i;
                return (
                  <td key={key} className="p-2 text-center">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center min-w-[3rem] px-1.5 py-0.5 text-[11px] font-mono tabular-nums",
                        cell?.solved
                          ? cell.first_ac
                            ? "bg-lime-400 text-black font-bold border border-lime-400"
                            : "bg-lime-400/15 text-lime-400 font-bold border border-lime-400/30"
                          : cell?.wrong_attempts
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "text-slate-600"
                      )}
                    >
                      {cell?.solved
                        ? formatPenalty(cell.solve_seconds ?? 0).slice(3)
                        : cell?.wrong_attempts
                          ? `−${cell.wrong_attempts}`
                          : "·"}
                    </span>
                  </td>
                );
              })}
              <td className="p-3 text-center font-bold text-white tabular-nums text-sm">
                {row.solved}
              </td>
              <td className="p-3 text-right text-slate-300 tabular-nums">
                {formatPenalty(row.penalty_seconds)}
              </td>
              <td
                className={cn(
                  "p-3 text-right font-bold tabular-nums",
                  row.rating_delta > 0
                    ? "text-lime-400"
                    : row.rating_delta < 0
                      ? "text-red-400"
                      : "text-slate-400"
                )}
              >
                {row.rating_delta > 0 ? "+" : ""}
                {row.rating_delta}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
