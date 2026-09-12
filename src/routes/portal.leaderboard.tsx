/**
 * Chaos Computer Club India — Global Ranking
 * Strictly formatted as: Rank | Name with profile pic | Region | Attended | Score
 * Built with CCC brutalist dark theme, top-pinned "(You)" card, and zero filters.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/store/hooks";
import { LeaderboardSkeleton } from "@/organization/components/skeletons";
import { portalQueries } from "@/organization/data/queries";
import type { LeaderboardEntry } from "@/organization/data/types";
import { cn } from "@/lib/utils";

const q = portalQueries.leaderboard();

export const Route = createFileRoute("/portal/leaderboard")({
  head: () => ({
    meta: [
      { title: "Global Ranking — CCC Medi-Caps" },
      {
        name: "description",
        content: "Official university-wide global ranking standings based on proctored offline battles.",
      },
      { property: "og:title", content: "Global Ranking — CCC Medi-Caps" },
      {
        property: "og:description",
        content: "Verified university contest rankings across CSE, IT, AIDS and Cyber Security.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  pendingComponent: LeaderboardSkeleton,
  component: GlobalRankingPage,
});

const EMBLEM_MAP: Record<string, { icon: string; bg: string; border: string; text: string }> = {
  volt: { icon: "⚡", bg: "bg-lime-950/60", border: "border-lime-500/50", text: "text-lime-400" },
  binary: { icon: "👾", bg: "bg-cyan-950/60", border: "border-cyan-500/50", text: "text-cyan-400" },
  quantum: { icon: "⚛️", bg: "bg-purple-950/60", border: "border-purple-500/50", text: "text-purple-400" },
  matrix: { icon: "💻", bg: "bg-emerald-950/60", border: "border-emerald-500/50", text: "text-emerald-400" },
  grandmaster: { icon: "🏆", bg: "bg-amber-950/60", border: "border-amber-500/50", text: "text-amber-400" },
  cipher: { icon: "🛡️", bg: "bg-rose-950/60", border: "border-rose-500/50", text: "text-rose-400" },
};

function AvatarBubble({ item, isYou }: { item: LeaderboardEntry; isYou?: boolean }) {
  const emblem = item.avatar_url && EMBLEM_MAP[item.avatar_url];

  if (emblem) {
    return (
      <div
        className={cn(
          "w-8 h-8 rounded-full border flex items-center justify-center text-sm flex-shrink-0 shadow-sm",
          emblem.bg,
          emblem.border,
          emblem.text
        )}
      >
        <span>{emblem.icon}</span>
      </div>
    );
  }

  if (item.avatar_url && item.avatar_url.startsWith("http")) {
    return (
      <div className="w-8 h-8 rounded-full border border-zinc-700 overflow-hidden flex-shrink-0 bg-zinc-800">
        <img src={item.avatar_url} alt={item.full_name || item.handle} className="w-full h-full object-cover" />
      </div>
    );
  }

  const initials = item.full_name
    ? item.full_name
        .split(" ")
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : item.handle.slice(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        "w-8 h-8 rounded-full border flex items-center justify-center font-mono text-[11px] font-bold flex-shrink-0 shadow-sm",
        isYou
          ? "bg-[var(--accent)]/15 border-[var(--accent)]/50 text-[var(--accent)]"
          : "bg-zinc-800/80 border-zinc-700 text-zinc-300"
      )}
    >
      {initials}
    </div>
  );
}

function GlobalRankingPage() {
  const { data } = useSuspenseQuery(q);
  const currentMember = useAppSelector((s) => s.auth.member);
  const currentMemberId = currentMember?.id;

  // Find current user in the global standings
  const currentUserRow = data.find(
    (x) => (currentMemberId && x.id === currentMemberId) || (currentMember?.handle && x.handle === currentMember.handle)
  );

  return (
    <div className="page-wrap max-w-5xl mx-auto px-4 py-8">
      {/* Page Title & Subtitle */}
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Global Ranking
        </h1>
        <p className="text-xs sm:text-sm text-[var(--muted)] font-mono mt-1.5">
          Total Participants: {data.length.toLocaleString()}
        </p>
      </header>

      {/* Pinned "You" Row Card (Matching LeetCode Highlight) */}
      {currentUserRow && (
        <section aria-label="Your Position" className="mb-5">
          <div className="grid grid-cols-[55px_1fr_90px_80px_85px] sm:grid-cols-[70px_1fr_130px_100px_105px] items-center px-4 sm:px-5 py-3.5 bg-[var(--surface-2)] border border-[var(--accent)]/50 rounded-xl shadow-[0_0_20px_rgba(200,255,54,0.08)] transition-all">
            {/* Rank */}
            <div className="font-mono font-bold text-sm sm:text-base text-white">
              {currentUserRow.university_rank.toLocaleString()}
            </div>

            {/* Name with Profile Pic */}
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <AvatarBubble item={currentUserRow} isYou={true} />
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <span className="font-semibold text-sm sm:text-base text-white truncate font-sans">
                  {currentUserRow.full_name || currentUserRow.handle}
                </span>
                <span className="text-xs">⚡</span>
                <span className="text-xs font-mono font-bold text-[var(--accent)]">
                  (You)
                </span>
              </div>
            </div>

            {/* Region */}
            <div className="flex items-center justify-center gap-1.5 font-mono text-xs sm:text-sm text-zinc-300">
              <span className="text-sm">🇮🇳</span>
              <span className="truncate">{currentUserRow.department}</span>
            </div>

            {/* Attended */}
            <div className="text-right font-mono text-xs sm:text-sm text-zinc-200 pr-1">
              {currentUserRow.attendance_count}
            </div>

            {/* Score */}
            <div className="text-right font-mono text-sm sm:text-base font-bold text-white">
              {currentUserRow.rating.toLocaleString()}
            </div>
          </div>
        </section>
      )}

      {/* Global Ranking Table Headers */}
      <div className="grid grid-cols-[55px_1fr_90px_80px_85px] sm:grid-cols-[70px_1fr_130px_100px_105px] items-center px-4 sm:px-5 py-2.5 text-xs text-[var(--muted)] font-medium select-none uppercase tracking-wider">
        <span>Rank</span>
        <span>Name</span>
        <span className="text-center">Region</span>
        <span className="text-right pr-1">Attended</span>
        <span className="text-right">Score</span>
      </div>

      {/* Global Ranking Rows Stream */}
      <div className="space-y-2">
        {data.length === 0 ? (
          <div className="text-center py-16 px-4 bg-[var(--surface)] border border-[var(--line)] rounded-xl">
            <p className="font-mono text-sm text-[var(--muted)]">
              No ranked participants in university standings yet.
            </p>
          </div>
        ) : (
          data.map((x) => {
            const isYou =
              (currentMemberId && x.id === currentMemberId) ||
              (currentMember?.handle && x.handle === currentMember.handle);

            return (
              <div
                key={x.handle}
                className={cn(
                  "grid grid-cols-[55px_1fr_90px_80px_85px] sm:grid-cols-[70px_1fr_130px_100px_105px] items-center px-4 sm:px-5 py-3 rounded-xl border transition-all duration-150",
                  isYou
                    ? "bg-[var(--surface-2)] border-[var(--accent)]/40 shadow-sm"
                    : "bg-[var(--surface)] hover:bg-[var(--surface-2)] border-[var(--line)] hover:border-zinc-700"
                )}
              >
                {/* Rank Badge / Number */}
                <div className="flex items-center">
                  {x.university_rank === 1 ? (
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#facc15] text-black font-bold font-mono text-xs sm:text-sm flex items-center justify-center shadow-md shadow-amber-500/20">
                      1
                    </div>
                  ) : x.university_rank === 2 ? (
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#cbd5e1] text-black font-bold font-mono text-xs sm:text-sm flex items-center justify-center shadow-md shadow-slate-400/20">
                      2
                    </div>
                  ) : x.university_rank === 3 ? (
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#ea580c] text-white font-bold font-mono text-xs sm:text-sm flex items-center justify-center shadow-md shadow-orange-600/20">
                      3
                    </div>
                  ) : (
                    <span className="font-mono text-xs sm:text-sm font-semibold text-zinc-400 pl-1">
                      {x.university_rank.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Name with Profile Pic */}
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <AvatarBubble item={x} isYou={Boolean(isYou)} />
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <span className="font-medium text-xs sm:text-sm text-white truncate font-sans">
                      {x.full_name || x.handle}
                    </span>
                    {x.university_rank <= 3 && (
                      <span className="text-xs">⚡</span>
                    )}
                    {isYou && (
                      <span className="text-[11px] font-mono font-bold text-[var(--accent)] ml-0.5">
                        (You)
                      </span>
                    )}
                  </div>
                </div>

                {/* Region */}
                <div className="flex items-center justify-center gap-1.5 font-mono text-xs text-zinc-400">
                  <span className="text-sm">🇮🇳</span>
                  <span className="truncate">{x.department}</span>
                </div>

                {/* Attended */}
                <div className="text-right font-mono text-xs sm:text-sm text-zinc-300 pr-1">
                  {x.attendance_count}
                </div>

                {/* Score */}
                <div className="text-right font-mono text-xs sm:text-sm font-bold text-white">
                  {x.rating.toLocaleString()}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
