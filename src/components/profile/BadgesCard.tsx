import React from "react";
import { ArrowRight } from "lucide-react";
import { getChapterBadgeAsset, isOfficialChapterBadge } from "@/lib/profileAssets";

interface BadgesCardProps {
  achievements?: any[];
  tier?: string;
  rating?: number;
}

export function BadgesCard({ achievements = [], tier, rating }: BadgesCardProps) {
  // Strictly filter only authorized, earned chapter badges (discarding legacy ones)
  const earnedList = achievements.filter(
    (a) => a.earned === true && isOfficialChapterBadge(a)
  );
  const badgeCount = earnedList.length;
  const mostRecent = earnedList.length > 0
    ? (earnedList[earnedList.length - 1]?.title || earnedList[earnedList.length - 1]?.name)
    : "None unlocked yet";

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
          <div className="size-16 rounded-[16px] bg-[#171717] border border-white/[0.08] flex items-center justify-center mb-2.5 p-3">
            <img
              src="/matiks-assets/badges/badge.webp"
              alt=""
              className="size-10 object-contain opacity-30 grayscale"
            />
          </div>
          <p className="text-xs font-heading font-bold uppercase tracking-wider text-zinc-300">No badges unlocked yet</p>
          <span className="text-xs font-sans text-zinc-500 mt-1 max-w-xs leading-relaxed">
            Attain official contest ratings in campus tournaments to unlock chapter badges.
          </span>
        </div>
      ) : (
        <div className="py-4 flex items-center justify-center gap-4 flex-wrap">
          {earnedList.map((item, idx) => {
            const badgeSrc = item.image_url || item.badge_url || getChapterBadgeAsset(item.title || item.name || item.code);
            const title = item.title || item.name || "Badge";

            return (
              <div
                key={item.id || item.code || idx}
                title={`${title}${item.description ? ` — ${item.description}` : ""}`}
                className="relative group flex flex-col items-center"
              >
                <img
                  src={badgeSrc}
                  alt={title}
                  className="size-16 object-contain filter drop-shadow-[0_2px_8px_rgba(177,250,99,0.25)] group-hover:scale-105 transition-transform duration-200 select-none"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/matiks-assets/badges/badge.webp";
                  }}
                />
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

