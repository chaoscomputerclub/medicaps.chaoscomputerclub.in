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
        shadow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
        text: "text-cyan-400",
      };
    }
    if (code.includes("podium") || code.includes("solver")) {
      return {
        border: "border-amber-400/40",
        from: "from-amber-400/20",
        shadow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]",
        text: "text-amber-400",
      };
    }
    if (code.includes("core")) {
      return {
        border: "border-purple-400/40",
        from: "from-purple-400/20",
        shadow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
        text: "text-purple-400",
      };
    }
    return {
      border: "border-lime-400/40",
      from: "from-lime-400/20",
      shadow: "shadow-[0_0_20px_rgba(204,255,0,0.15)]",
      text: "text-lime-400",
    };
  };

  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.03)] h-full flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-white/6">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
            Badges
          </span>
          <span className="text-2xl font-bold text-white font-mono tabular-nums mt-0.5 block">
            {badgeCount}
          </span>
        </div>
        <ArrowRight className="size-4 text-zinc-500 hover:text-white transition-colors cursor-pointer mt-1" />
      </div>

      {/* Badges Display Area */}
      {earnedList.length === 0 ? (
        <div className="py-6 flex flex-col items-center justify-center text-center">
          <div className="size-12 rounded-xl bg-zinc-900/80 border border-white/10 flex items-center justify-center text-zinc-600 mb-2">
            <Lock className="size-5" />
          </div>
          <p className="text-xs font-mono text-zinc-400">No badges unlocked yet</p>
          <span className="text-[11px] font-sans text-zinc-500 mt-0.5 max-w-xs">
            Participate in offline contests or solve practice problems to earn chapter badges.
          </span>
        </div>
      ) : (
        <div className="py-4 flex items-center justify-center gap-5 flex-wrap">
          {earnedList.slice(0, 3).map((item, idx) => {
            const colors = getBadgeColors(item, idx);
            return (
              <div
                key={item.id || item.code || idx}
                title={item.description || item.title}
                className="relative group flex flex-col items-center"
              >
                <div
                  className={`size-16 rounded-xl bg-gradient-to-br ${colors.from} via-zinc-900 to-black border ${colors.border} flex items-center justify-center ${colors.shadow} group-hover:scale-105 transition-transform duration-200`}
                >
                  {item.icon ? (
                    <span className="text-2xl select-none">{item.icon}</span>
                  ) : (
                    <Award className={`size-8 ${colors.text}`} />
                  )}
                </div>
                <span className="text-[10px] font-mono text-zinc-400 mt-2 font-medium max-w-[76px] truncate text-center">
                  {item.title || item.name}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer: Most Recent Badge */}
      <div className="pt-3 border-t border-white/6 font-sans">
        <div className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">
          Most Recent Badge
        </div>
        <div className="text-xs font-semibold text-white mt-0.5 flex items-center gap-1.5">
          <span
            className={`size-1.5 rounded-full ${earnedList.length > 0 ? "bg-lime-400" : "bg-zinc-600"}`}
          />
          <span className="truncate">{mostRecent}</span>
        </div>
      </div>
    </div>
  );
}
