/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * src/organization/components/SocialFollowStats.tsx
 *
 * Single Unified Global Social Metrics Pod
 * Connects directly to global Redux social state and renders Followers and
 * Following stats with clean, iconless, background-free production-grade typography.
 */

import React from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { openSocialDrawer } from "@/store/slices/socialSlice";
import { cn } from "@/lib/utils";

export interface SocialFollowStatsProps {
  targetId?: string | null;
  targetHandle?: string | null;
  targetName?: string | null;
  initialFollowersCount?: number | null;
  initialFollowingCount?: number | null;
  isSelf?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export const SocialFollowStats: React.FC<SocialFollowStatsProps> = ({
  targetId,
  targetHandle,
  targetName,
  initialFollowersCount,
  initialFollowingCount,
  isSelf,
  className,
  size = "md",
}) => {
  const dispatch = useAppDispatch();
  const currentMember = useAppSelector((s) => s.auth.member);
  const myFollowersCount = useAppSelector((s) => s.social.myFollowersCount);
  const myFollowingCount = useAppSelector((s) => s.social.myFollowingCount);
  const hasSyncedMyCounts = useAppSelector((s) => s.social.hasSyncedMyCounts);
  const cadetSocialCounts = useAppSelector((s) => s.social.cadetSocialCounts);
  const followingIds = useAppSelector((s) => s.social.followingIds);
  const hasFetchedFollowing = useAppSelector((s) => s.social.hasFetchedFollowing);

  const cleanTargetHandle = (targetHandle || "").replace(/^@+/, "").trim().toLowerCase();
  const currentHandle = (currentMember?.handle || "").replace(/^@+/, "").trim().toLowerCase();

  const isSelfUser =
    Boolean(isSelf) ||
    !cleanTargetHandle ||
    cleanTargetHandle === "me" ||
    (Boolean(currentHandle) && cleanTargetHandle === currentHandle) ||
    (Boolean(targetId && currentMember?.id) && targetId === currentMember?.id);

  // Derive authoritative follower count from global store
  let followersCount: number;
  if (isSelfUser) {
    followersCount = myFollowersCount;
  } else {
    const cadetStats = cleanTargetHandle ? cadetSocialCounts[cleanTargetHandle] : null;
    if (cadetStats && typeof cadetStats.followersCount === "number") {
      followersCount = cadetStats.followersCount;
    } else if (typeof initialFollowersCount === "number") {
      followersCount = initialFollowersCount;
    } else {
      followersCount = 0;
    }
  }

  // Derive authoritative following count from global store
  let followingCount: number;
  if (isSelfUser) {
    if (hasSyncedMyCounts) {
      followingCount = myFollowingCount;
    } else if (hasFetchedFollowing) {
      followingCount = followingIds.length;
    } else {
      followingCount = myFollowingCount;
    }
  } else {
    const cadetStats = cleanTargetHandle ? cadetSocialCounts[cleanTargetHandle] : null;
    if (cadetStats && typeof cadetStats.followingCount === "number") {
      followingCount = cadetStats.followingCount;
    } else if (typeof initialFollowingCount === "number") {
      followingCount = initialFollowingCount;
    } else {
      followingCount = 0;
    }
  }

  const effectiveHandle = cleanTargetHandle || currentHandle || "cadet";
  const effectiveName = targetName || currentMember?.full_name || effectiveHandle;

  const handleOpenFollowers = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(
      openSocialDrawer({
        targetId: targetId || null,
        targetHandle: effectiveHandle,
        targetName: effectiveName,
        followersCount,
        followingCount,
        type: "followers",
        isSelf: isSelfUser,
      })
    );
  };

  const handleOpenFollowing = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(
      openSocialDrawer({
        targetId: targetId || null,
        targetHandle: effectiveHandle,
        targetName: effectiveName,
        followersCount,
        followingCount,
        type: "following",
        isSelf: isSelfUser,
      })
    );
  };

  const isSmall = size === "sm";

  return (
    <div className={cn("inline-flex items-center gap-2.5 font-sans flex-nowrap shrink-0", className)}>
      {/* Followers Stat */}
      <button
        type="button"
        onClick={handleOpenFollowers}
        aria-label={`${followersCount} followers. Click to view student network.`}
        className={cn(
          "group inline-flex items-baseline gap-1 cursor-pointer select-none bg-transparent border-0 p-0 text-left",
          "hover:opacity-95 active:scale-[0.98] transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B1FA63] focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-sm"
        )}
      >
        <span
          className={cn(
            "font-semibold text-white tabular-nums tracking-tight group-hover:text-[#B1FA63] transition-colors",
            isSmall ? "text-xs" : "text-sm"
          )}
        >
          {followersCount}
        </span>
        <span
          className={cn(
            "text-zinc-400 group-hover:text-zinc-200 transition-colors lowercase",
            isSmall ? "text-[11px]" : "text-xs sm:text-sm"
          )}
        >
          followers
        </span>
      </button>

      <span className="text-zinc-600 select-none text-xs" aria-hidden="true">·</span>

      {/* Following Stat */}
      <button
        type="button"
        onClick={handleOpenFollowing}
        aria-label={`${followingCount} following. Click to view followed students.`}
        className={cn(
          "group inline-flex items-baseline gap-1 cursor-pointer select-none bg-transparent border-0 p-0 text-left",
          "hover:opacity-95 active:scale-[0.98] transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B1FA63] focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-sm"
        )}
      >
        <span
          className={cn(
            "font-semibold text-white tabular-nums tracking-tight group-hover:text-[#B1FA63] transition-colors",
            isSmall ? "text-xs" : "text-sm"
          )}
        >
          {followingCount}
        </span>
        <span
          className={cn(
            "text-zinc-400 group-hover:text-zinc-200 transition-colors lowercase",
            isSmall ? "text-[11px]" : "text-xs sm:text-sm"
          )}
        >
          following
        </span>
      </button>
    </div>
  );
};
