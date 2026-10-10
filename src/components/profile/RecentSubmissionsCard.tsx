import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  ChevronRight,
  Layers,
  Trophy,
  History,
  Clock,
  Code2,
} from "lucide-react";

interface RecentSubmissionsCardProps {
  submissions?: any[];
  battles?: any[];
  loading?: boolean;
}

function formatTimeAgo(isoString?: string | null): string {
  if (!isoString) return "Recently";
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getDifficultyBadge(diff?: string) {
  const d = (diff || "MEDIUM").toUpperCase();
  if (d === "EASY") {
    return { label: "Easy", color: "text-[#00b8a3] bg-[#00b8a3]/10 border-[#00b8a3]/20" };
  }
  if (d === "HARD") {
    return { label: "Hard", color: "text-[#ff375f] bg-[#ff375f]/10 border-[#ff375f]/20" };
  }
  return { label: "Med.", color: "text-[#ffc01e] bg-[#ffc01e]/10 border-[#ffc01e]/20" };
}

function getVerdictBadge(verdict?: string) {
  const v = (verdict || "PENDING").toUpperCase();
  if (v === "ACCEPTED" || v === "AC") {
    return { label: "Accepted", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" };
  }
  if (v === "WRONG_ANSWER" || v === "WA") {
    return { label: "Wrong Answer", color: "text-red-400 bg-red-400/10 border-red-400/20" };
  }
  if (v.includes("TIME")) {
    return { label: "TLE", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" };
  }
  if (v.includes("MEMORY")) {
    return { label: "MLE", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" };
  }
  if (v.includes("RUNTIME")) {
    return { label: "Runtime Error", color: "text-rose-400 bg-rose-400/10 border-rose-400/20" };
  }
  if (v.includes("COMPILE")) {
    return { label: "Compile Error", color: "text-orange-400 bg-orange-400/10 border-orange-400/20" };
  }
  return { label: verdict || "Submitted", color: "text-zinc-400 bg-zinc-800/50 border-white/10" };
}

export function RecentSubmissionsCard({
  submissions = [],
  battles = [],
  loading = false,
}: RecentSubmissionsCardProps) {
  const [activeTab, setActiveTab] = useState<"recent_ac" | "all" | "tournaments">("recent_ac");

  const acceptedSubmissions = submissions.filter((s) => {
    const v = (s.verdict || "").toUpperCase();
    return v === "ACCEPTED" || v === "AC";
  });

  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.03)] space-y-4">
      {/* Tabs Header */}
      <div className="flex items-center justify-between border-b border-white/6 pb-3 text-xs font-sans">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("recent_ac")}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 font-medium transition-colors cursor-pointer ${
              activeTab === "recent_ac"
                ? "bg-white/10 text-white font-semibold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <CheckCircle2 className="size-3.5 text-emerald-400" />
            <span>Recent AC</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 font-medium transition-colors cursor-pointer ${
              activeTab === "all"
                ? "bg-white/10 text-white font-semibold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <History className="size-3.5 text-zinc-400" />
            <span>All Submissions</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tournaments")}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 font-medium transition-colors cursor-pointer ${
              activeTab === "tournaments"
                ? "bg-white/10 text-white font-semibold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Trophy className="size-3.5 text-zinc-400" />
            <span>Tournaments</span>
          </button>
        </div>

        <Link
          to={activeTab === "tournaments" ? "/contests" : "/practice"}
          className="text-zinc-500 hover:text-lime-400 text-xs font-mono transition-colors flex items-center gap-1"
        >
          <span>{activeTab === "tournaments" ? "All contests" : "Practice arena"}</span>
          <ChevronRight className="size-3" />
        </Link>
      </div>

      {/* Tab Body: Recent AC */}
      {activeTab === "recent_ac" && (
        <div className="space-y-1">
          {loading ? (
            <div className="py-8 text-center text-zinc-500 font-mono text-xs">
              Loading recent submissions…
            </div>
          ) : acceptedSubmissions.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-zinc-500 font-mono text-xs">
                No accepted problem submissions on file yet.
              </p>
              <Link
                to="/practice"
                className="inline-block text-xs font-mono text-lime-400 hover:underline"
              >
                Solve practice problems →
              </Link>
            </div>
          ) : (
            acceptedSubmissions.slice(0, 6).map((item) => {
              const diffBadge = getDifficultyBadge(item.difficulty);
              const targetUrl = item.problem_slug
                ? `/practice/${item.problem_slug}`
                : `/practice`;

              return (
                <div
                  key={item.id}
                  className="py-2.5 px-3 rounded-md hover:bg-white/[0.02] flex items-center justify-between text-xs transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-3">
                    <span
                      className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border shrink-0 ${diffBadge.color}`}
                    >
                      {diffBadge.label}
                    </span>
                    <Link
                      to={targetUrl}
                      className="font-medium text-white group-hover:text-lime-400 transition-colors truncate max-w-sm sm:max-w-md"
                    >
                      {item.problem_title || "Practice Problem"}
                    </Link>
                    {item.language && (
                      <span className="hidden sm:inline text-[10px] font-mono text-zinc-500 bg-zinc-900 border border-white/6 px-1.5 py-0.5 rounded">
                        {item.language}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-zinc-500 tabular-nums shrink-0 ml-auto">
                    {formatTimeAgo(item.submitted_at)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab Body: All Submissions */}
      {activeTab === "all" && (
        <div className="space-y-1">
          {loading ? (
            <div className="py-8 text-center text-zinc-500 font-mono text-xs">
              Loading submissions…
            </div>
          ) : submissions.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-zinc-500 font-mono text-xs">
                No submissions logged on file yet.
              </p>
              <Link
                to="/practice"
                className="inline-block text-xs font-mono text-lime-400 hover:underline"
              >
                Start practicing →
              </Link>
            </div>
          ) : (
            submissions.slice(0, 6).map((item) => {
              const diffBadge = getDifficultyBadge(item.difficulty);
              const verdictBadge = getVerdictBadge(item.verdict);
              const targetUrl = item.problem_slug
                ? `/practice/${item.problem_slug}`
                : `/practice`;

              return (
                <div
                  key={item.id}
                  className="py-2.5 px-3 rounded-md hover:bg-white/[0.02] flex items-center justify-between text-xs transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-3">
                    <span
                      className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border shrink-0 ${diffBadge.color}`}
                    >
                      {diffBadge.label}
                    </span>
                    <Link
                      to={targetUrl}
                      className="font-medium text-white group-hover:text-lime-400 transition-colors truncate max-w-xs sm:max-w-sm"
                    >
                      {item.problem_title || "Practice Problem"}
                    </Link>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${verdictBadge.color}`}
                    >
                      {verdictBadge.label}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-zinc-500 tabular-nums shrink-0 ml-auto">
                    {formatTimeAgo(item.submitted_at)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab Body: Tournaments */}
      {activeTab === "tournaments" && (
        <div className="space-y-1">
          {battles.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-zinc-500 font-mono text-xs">
                No official tournament records on file yet.
              </p>
              <Link
                to="/contests"
                className="inline-block text-xs font-mono text-lime-400 hover:underline"
              >
                View upcoming contests →
              </Link>
            </div>
          ) : (
            battles.slice(0, 6).map((b, idx) => (
              <div
                key={b.certificate_id || idx}
                className="py-2.5 px-3 rounded-md hover:bg-white/[0.02] flex items-center justify-between text-xs transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0 pr-3">
                  <span className="text-[10px] font-mono text-lime-400 bg-lime-400/10 border border-lime-400/20 px-1.5 py-0.5 rounded shrink-0">
                    Rank #{b.rank}
                  </span>
                  <Link
                    to={b.contest_slug ? `/contests/${b.contest_slug}/results` : `/contests`}
                    className="font-medium text-white group-hover:text-lime-400 transition-colors truncate max-w-xs sm:max-w-sm"
                  >
                    {b.contest}
                  </Link>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-auto font-mono text-[11px]">
                  <span className="text-zinc-400">Solved: {b.solved}</span>
                  <span
                    className={
                      b.delta >= 0 ? "text-lime-400 font-semibold" : "text-red-400 font-semibold"
                    }
                  >
                    {b.delta > 0 ? `+${b.delta}` : b.delta}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
