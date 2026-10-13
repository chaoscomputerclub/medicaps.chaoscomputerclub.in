import React from "react";
import { ArrowRight, Award, ShieldCheck, Flame, Star, Lock } from "lucide-react";

interface BadgesCardProps {
  achievements?: any[];
  tier?: string;
  rating?: number;
}

export function BadgesCard({ achievements = [], tier, rating }: BadgesCardProps) {
  const earnedList = achievements.filter((a) => a.earned !== false);
  const badgeCount = earnedList.length;
  const mostRecent = earnedList.length > 0
    ? (earnedList[earnedList.length - 1]?.name || earnedList[earnedList.length - 1]?.title)
    : "None unlocked yet";

  // Palette cycler for dynamic badges
  const getBadgeColors = (item: any, idx: number) => {
    const code = (item.code || item.id || "").toLowerCase();
    if (code.includes("elite") || code.includes("vet")) {
      return {
        border: "border-cyan-400/40",
        from: "from-cyan-400/20",
        shadow: "",
        text: "text-cyan-400",
      };
    }
    if (code.includes("podium") || code.includes("solver")) {
      return {
        border: "border-amber-400/40",
        from: "from-amber-400/20",
        shadow: "",
        text: "text-amber-400",
      };
    }
    if (code.includes("core")) {
      return {
        border: "border-emerald-400/40",
        from: "from-emerald-400/20",
        shadow: "",
        text: "text-emerald-400",
      };
    }
    return {
      border: "border-lime-400/40",
      from: "from-lime-400/20",
      shadow: "",
      text: "text-lime-400",
    };
  };

  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] p-6 h-full flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-start justify-between pb-3.5 border-b border-white/[0.08]">
        <div>
          <span className="text-xs font-heading font-bold uppercase tracking-wider text-zinc-400 block">
            Badges
          </span>
          <span className="text-3xl sm:text-4xl font-display text-white tabular-nums tracking-wide mt-1 block">
            {badgeCount}
          </span>
        </div>
        <ArrowRight className="size-4 text-zinc-500 hover:text-[#B1FA63] transition-colors cursor-pointer mt-1" />
      </div>

      {/* Badges Display Area */}
      {earnedList.length === 0 ? (
        <div className="py-6 flex flex-col items-center justify-center text-center">
          <div className="size-14 rounded-[16px] bg-[#171717] border border-white/[0.08] flex items-center justify-center mb-2">
            <img
              src="/graphics/ranks/rank-explorer.svg"
              alt="Locked Badge"
              className="size-8 object-contain opacity-40 grayscale"
            />
          </div>
          <p className="text-xs font-heading font-bold uppercase tracking-wider text-zinc-400">No badges unlocked yet</p>
          <span className="text-xs font-sans text-zinc-500 mt-1 max-w-xs leading-relaxed">
            Participate in offline contests or solve practice problems to earn chapter badges.
          </span>
        </div>
      ) : (
        <div className="py-4 flex items-center justify-center gap-5 flex-wrap">
          {earnedList.slice(0, 3).map((item, idx) => {
            const colors = getBadgeColors(item, idx);
            const code = (item.code || item.id || item.title || item.name || "").toLowerCase();
            const certSrc =
              code.includes("contest") || code.includes("tourn") || code.includes("podium")
                ? "/graphics/achievements/achievement-podium-finish.svg"
                : code.includes("survival") || code.includes("streak") || code.includes("fire")
                ? "/graphics/achievements/achievement-streak-7.svg"
                : code.includes("showdown") || code.includes("duel") || code.includes("battle")
                ? "/graphics/achievements/achievement-speed-demon.svg"
                : code.includes("novice") || code.includes("cadet") || code.includes("star")
                ? "/graphics/ranks/rank-explorer.svg"
                : "/graphics/achievements/achievement-clean-code.svg";

            return (
              <div
                key={item.id || item.code || idx}
                title={item.description || item.title}
                className="relative group flex flex-col items-center"
              >
                <div
                  className={`size-16 rounded-[16px] bg-gradient-to-br ${colors.from} via-[#171717] to-black border ${colors.border} flex items-center justify-center group-hover:scale-105 transition-transform duration-200 p-2`}
                >
                  <img
                    src={certSrc}
                    alt={item.title || item.name}
                    className="size-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
                <span className="text-[11px] font-heading font-bold text-zinc-300 mt-2 max-w-[80px] truncate text-center">
                  {item.title || item.name}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer: Most Recent Badge */}
      <div className="pt-3.5 border-t border-white/[0.08]">
        <div className="text-[10px] text-zinc-500 uppercase font-heading font-bold tracking-wider">
          Most Recent Badge
        </div>
        <div className="text-xs font-heading font-bold text-white mt-1 flex items-center gap-2">
          <span
            className={`size-2 rounded-full ${earnedList.length > 0 ? "bg-[#B1FA63]" : "bg-zinc-600"}`}
          />
          <span className="truncate">{mostRecent}</span>
        </div>
      </div>
    </div>
  );
}
