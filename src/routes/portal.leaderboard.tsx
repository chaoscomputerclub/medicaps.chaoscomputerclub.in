/**
 * Chaos Computer Club India — University Leaderboard
 * Strictly formatted with original UI layout:
 * Header: Verified Elo index | University leaderboard. | Rating Cycle Monsoon '26
 * Columns: RANK | NAME (with profile pic) | ATTENDED | SCORE
 * Clean brutalist styling, zero filters.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/store/hooks";
import { ChevronDown, ChevronUp, Minus } from "lucide-react";
import { LeaderboardSkeleton } from "@/organization/components/skeletons";
import { portalQueries } from "@/organization/data/queries";
import type { LeaderboardEntry } from "@/organization/data/types";
import { cn } from "@/lib/utils";

const q = portalQueries.leaderboard();

export const Route = createFileRoute("/portal/leaderboard")({
  head: () => ({
    meta: [
      { title: "University Leaderboard — CCC Medi-Caps" },
      {
        name: "description",
        content: "University-wide CCC rating standings from verified offline contests across CSE, IT, AIDS, and Cyber Security.",
      },
      { property: "og:title", content: "CCC Medi-Caps University Leaderboard" },
      {
        property: "og:description",
        content: "Verified offline contest ratings across CSE, IT, AIDS and Cyber Security.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  pendingComponent: LeaderboardSkeleton,
  component: Leaderboard,
});

const EMBLEM_MAP: Record<string, { icon: string; bg: string; border: string; text: string }> = {
  volt: { icon: "⚡", bg: "bg-lime-500/10", border: "border-lime-500/40", text: "text-lime-400" },
  binary: { icon: "👾", bg: "bg-cyan-500/10", border: "border-cyan-500/40", text: "text-cyan-400" },
  quantum: { icon: "⚛️", bg: "bg-purple-500/10", border: "border-purple-500/40", text: "text-purple-400" },
  matrix: { icon: "💻", bg: "bg-emerald-500/10", border: "border-emerald-500/40", text: "text-emerald-400" },
  grandmaster: { icon: "🏆", bg: "bg-amber-500/10", border: "border-amber-500/40", text: "text-amber-400" },
  cipher: { icon: "🛡️", bg: "bg-rose-500/10", border: "border-rose-500/40", text: "text-rose-400" },
};

function AvatarBubble({ item }: { item: LeaderboardEntry }) {
  const emblem = item.avatar_url && EMBLEM_MAP[item.avatar_url];

  if (emblem) {
    return (
      <div
        className={cn(
          "w-8 h-8 rounded-[1px] border flex items-center justify-center text-sm flex-shrink-0 shadow-sm",
          emblem.bg,
          emblem.border,
          emblem.text
        )}
      >
        <span>{emblem.icon}</span>
      </div>
    );
  }

  const hasImg = Boolean(
    item.avatar_url &&
      (item.avatar_url.startsWith("http") ||
        item.avatar_url.startsWith("/media/") ||
        item.avatar_url.startsWith("/"))
  );

  const initials = item.full_name
    ? item.full_name
        .split(" ")
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : item.handle?.slice(0, 2).toUpperCase() || "CC";

  if (hasImg) {
    return (
      <div className="w-8 h-8 rounded-[1px] border border-[var(--line)] overflow-hidden flex-shrink-0 bg-zinc-900 shadow-sm">
        <img
          src={item.avatar_url!}
          alt={item.full_name || item.handle}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = "none";
            e.currentTarget.parentElement!.innerText = initials;
          }}
        />
      </div>
    );
  }

  return (
    <div className="w-8 h-8 rounded-[1px] border border-[var(--line)] bg-[var(--surface)] text-[var(--accent)] font-mono text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-sm">
      {initials}
    </div>
  );
}

function Leaderboard() {
  const { data } = useSuspenseQuery(q);
  const currentMemberId = useAppSelector((s) => s.auth.member?.id);

  return (
    <div className="page-wrap">
      {/* Original University Leaderboard Page Header */}
      <header className="page-header">
        <div>
          <p className="kicker">Verified Elo index</p>
          <h1>University leaderboard.</h1>
          <p>
            One standing across CSE, IT, AIDS, and Cyber Security. Browser activity never affects rank.
          </p>
        </div>
        <div className="ranking-meta">
          <span>RATING CYCLE</span>
          <strong>MONSOON '26</strong>
          <small>{data.length} active members</small>
        </div>
      </header>

      {/* Table: RANK | NAME (with profile pic) | ATTENDED | SCORE */}
      <div className="table-scroll leaderboard-table">
        <table>
          <thead>
            <tr>
              <th style={{ width: "110px" }}>Rank</th>
              <th>Name</th>
              <th style={{ width: "200px" }}>Attended</th>
              <th style={{ width: "120px", textAlign: "right" }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-12 text-[#777] font-mono text-sm">
                  No ranked members found in university standings.
                </td>
              </tr>
            ) : (
              data.map((x) => {
                const change = (x.previous_rank ?? x.university_rank) - x.university_rank;
                const isYou = x.id === currentMemberId;

                return (
                  <tr
                    key={x.handle}
                    className={cn(
                      "transition-colors",
                      isYou && "bg-[var(--accent)]/5 border-l-2 border-l-[var(--accent)]"
                    )}
                  >
                    {/* 1. RANK */}
                    <td>
                      <div className="rank-cell">
                        <strong>{String(x.university_rank).padStart(2, "0")}</strong>
                        <span className={change > 0 ? "up" : change < 0 ? "down" : "flat"}>
                          {change > 0 ? <ChevronUp /> : change < 0 ? <ChevronDown /> : <Minus />}
                          {Math.abs(change) || "—"}
                        </span>
                      </div>
                    </td>

                    {/* 2. NAME with Profile Pic / Avatar */}
                    <td>
                      <div className="flex items-center gap-3">
                        <AvatarBubble item={x} />
                        <div className="competitor">
                          <div className="flex items-center gap-2">
                            <strong className="text-white hover:text-[var(--accent)] transition-colors">
                              {x.full_name || x.handle}
                            </strong>
                            {isYou && (
                              <span className="proof-seal text-[8px] py-0.5 px-1 font-mono">
                                YOU
                              </span>
                            )}
                          </div>
                          <span>@{x.handle}</span>
                        </div>
                      </div>
                    </td>

                    {/* 3. ATTENDED */}
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="attendance-meter">
                          <i
                            style={{
                              width: `${
                                (x.attendance_count / (x.attendance_total || 6)) * 100
                              }%`,
                            }}
                          />
                        </span>
                        <small>
                          {x.attendance_count}/{x.attendance_total || 6}
                        </small>
                      </div>
                    </td>

                    {/* 4. SCORE */}
                    <td className="score-value text-right font-mono font-bold text-[var(--accent)]">
                      {x.rating}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
