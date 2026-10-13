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
import { MakoMascot } from "@/components/common/MakoMascot";

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

  const safeSubmissions = Array.isArray(submissions) ? submissions : [];
  const safeBattles = Array.isArray(battles) ? battles : [];

  const acceptedSubmissions = safeSubmissions.filter((s) => {
    const v = (s.verdict || "").toUpperCase();
    return v === "ACCEPTED" || v === "AC";
  });

  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] p-6 space-y-4">
      {/* Tabs Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5 text-xs">
        <div className="flex items-center gap-1.5 bg-[#171717] p-1 rounded-[12px] border border-white/[0.08]">
          <button
            type="button"
            onClick={() => setActiveTab("recent_ac")}
            className={`px-3 py-1.5 rounded-[8px] flex items-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "recent_ac"
                ? "bg-[#B1FA63] text-black font-extrabold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <CheckCircle2 className={`size-3.5 ${activeTab === "recent_ac" ? "text-black" : "text-[#B1FA63]"}`} />
            <span>Recent AC</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-[8px] flex items-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "all"
                ? "bg-[#B1FA63] text-black font-extrabold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <History className="size-3.5" />
            <span>All Submissions</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tournaments")}
            className={`px-3 py-1.5 rounded-[8px] flex items-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "tournaments"
                ? "bg-[#B1FA63] text-black font-extrabold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Trophy className="size-3.5" />
            <span>Tournaments</span>
          </button>
        </div>

        <Link
          to={activeTab === "tournaments" ? "/contests" : "/practice"}
          className="text-zinc-400 hover:text-[#B1FA63] text-xs font-heading font-bold uppercase tracking-wider transition-colors flex items-center gap-1 self-end sm:self-auto"
        >
          <span>{activeTab === "tournaments" ? "All contests" : "Practice arena"}</span>
          <ChevronRight className="size-3" />
        </Link>
      </div>

      {/* Tab Body: Recent AC */}
      {activeTab === "recent_ac" && (
        <div className="space-y-1">
          {loading ? (
            <div className="py-8 text-center text-zinc-500 font-sans text-xs">
              Loading recent submissions…
            </div>
          ) : acceptedSubmissions.length === 0 ? (
            <div className="py-6 text-center flex flex-col items-center justify-center space-y-2.5">
              <MakoMascot variant="tasks" size="md" className="opacity-90" />
              <p className="text-zinc-500 font-sans text-xs">
                No accepted problem submissions on file yet.
              </p>
              <Link
                to="/practice"
                className="inline-block text-xs font-sans text-lime-400 hover:underline"
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
                  className="py-2.5 px-3 rounded-[10px] hover:bg-white/[0.03] flex items-center justify-between text-xs transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-3">
                    <span
                      className={`text-[10px] font-sans font-semibold px-1.5 py-0.5 rounded-[6px] border shrink-0 ${diffBadge.color}`}
                    >
                      {diffBadge.label}
                    </span>
                    <Link
                      to={targetUrl}
                      className="font-medium text-white group-hover:text-[#B1FA63] transition-colors truncate max-w-sm sm:max-w-md"
                    >
                      {item.problem_title || "Practice Problem"}
                    </Link>
                    {item.language && (
                      <span className="hidden sm:inline text-[10px] font-sans text-zinc-500 bg-[#171717] border border-white/[0.06] px-1.5 py-0.5 rounded-[6px]">
                        {item.language}
                      </span>
                    )}
                  </div>
                  <span className="font-sans text-[11px] text-zinc-500 tabular-nums shrink-0 ml-auto">
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
            <div className="py-8 text-center text-zinc-500 font-sans text-xs">
              Loading submissions…
            </div>
          ) : safeSubmissions.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-zinc-500 font-sans text-xs">
                No submissions logged on file yet.
              </p>
              <Link
                to="/practice"
                className="inline-block text-xs font-heading font-bold uppercase tracking-wider text-[#B1FA63] hover:underline"
              >
                Start practicing →
              </Link>
            </div>
          ) : (
            safeSubmissions.slice(0, 6).map((item) => {
              const diffBadge = getDifficultyBadge(item.difficulty);
              const verdictBadge = getVerdictBadge(item.verdict);
              const targetUrl = item.problem_slug
                ? `/practice/${item.problem_slug}`
                : `/practice`;

              return (
                <div
                  key={item.id}
                  className="py-2.5 px-3 rounded-[10px] hover:bg-white/[0.03] flex items-center justify-between text-xs transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-3">
                    <span
                      className={`text-[10px] font-sans font-semibold px-1.5 py-0.5 rounded-[6px] border shrink-0 ${diffBadge.color}`}
                    >
                      {diffBadge.label}
                    </span>
                    <Link
                      to={targetUrl}
                      className="font-medium text-white group-hover:text-[#B1FA63] transition-colors truncate max-w-xs sm:max-w-sm"
                    >
                      {item.problem_title || "Practice Problem"}
                    </Link>
                    <span
                      className={`text-[10px] font-sans px-1.5 py-0.5 rounded-[6px] border shrink-0 ${verdictBadge.color}`}
                    >
                      {verdictBadge.label}
                    </span>
                  </div>
                  <span className="font-sans text-[11px] text-zinc-500 tabular-nums shrink-0 ml-auto">
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
          {safeBattles.length === 0 ? (
            <div className="py-6 text-center flex flex-col items-center justify-center space-y-2.5">
              <MakoMascot variant="ready" size="md" className="opacity-90" />
              <p className="text-zinc-500 font-sans text-xs">
                No official tournament records on file yet.
              </p>
              <Link
                to="/contests"
                className="inline-block text-xs font-heading font-bold uppercase tracking-wider text-[#B1FA63] hover:underline"
              >
                View upcoming contests →
              </Link>
            </div>
          ) : (
            safeBattles.slice(0, 6).map((b, idx) => (
              <div
                key={b.certificate_id || idx}
                className="py-2.5 px-3 rounded-[10px] hover:bg-white/[0.03] flex items-center justify-between text-xs transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0 pr-3">
                  <span className="text-[10px] font-sans text-[#B1FA63] bg-[#B1FA63]/10 border border-[#B1FA63]/25 px-1.5 py-0.5 rounded-[6px] shrink-0 font-bold">
                    Rank #{b.rank}
                  </span>
                  <Link
                    to={b.contest_slug ? `/contests/${b.contest_slug}/results` : `/contests`}
                    className="font-medium text-white group-hover:text-[#B1FA63] transition-colors truncate max-w-xs sm:max-w-sm"
                  >
                    {b.contest}
                  </Link>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-auto font-sans text-[11px]">
                  <span className="text-zinc-400">Solved: {b.solved}</span>
                  <span
                    className={
                      b.delta >= 0 ? "text-[#B1FA63] font-semibold" : "text-red-400 font-semibold"
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
