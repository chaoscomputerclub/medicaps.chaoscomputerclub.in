/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * src/organization/components/SocialFollowStats.tsx
 *
 * Single Unified Global Social Metrics Pod
 * Connects directly to global Redux social state and renders Followers and
 * Following telemetry badges with zero local isolated drift, zero text truncation,
 * and instant drawer activation.
 */

import React from "react";
import { Users, UserCheck } from "lucide-react";
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
    <div className={cn("inline-flex items-center gap-2 flex-nowrap shrink-0", className)}>
      {/* Followers Pod */}
      <button
        type="button"
        onClick={handleOpenFollowers}
        aria-label={`${followersCount} Followers. Click to view student network.`}
        className={cn(
          "group relative inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-black/60",
          "hover:bg-white/[0.04] hover:border-lime-400/40 text-zinc-400 hover:text-white",
          "transition-[transform,border-color,background-color,box-shadow] duration-150 ease-out",
          "hover:-translate-y-0.5 active:scale-[0.98] hover:shadow-[0_4px_20px_-4px_rgba(163,230,53,0.15)]",
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 shrink-0 select-none whitespace-nowrap",
          isSmall ? "px-2 py-1 text-xs" : "px-3 py-1.5"
        )}
      >
        <div
          className={cn(
            "rounded-md bg-lime-400/10 border border-lime-400/20 flex items-center justify-center text-lime-400",
            "group-hover:bg-lime-400/20 group-hover:border-lime-400/40 transition-[background-color,border-color] duration-150 shrink-0",
            isSmall ? "size-4" : "size-5"
          )}
        >
          <Users size={isSmall ? 10 : 11} />
        </div>
        <div className="flex items-baseline gap-1.5 font-sans whitespace-nowrap">
          <strong
            className={cn(
              "font-mono font-bold text-white tabular-nums tracking-tight group-hover:text-lime-400 transition-colors",
              isSmall ? "text-xs" : "text-sm"
            )}
          >
            {followersCount}
          </strong>
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold whitespace-nowrap">
            Followers
          </span>
        </div>
        <span className="size-1 rounded-full bg-lime-400/40 group-hover:bg-lime-400 transition-colors shrink-0" />
      </button>

      {/* Following Pod */}
      <button
        type="button"
        onClick={handleOpenFollowing}
        aria-label={`${followingCount} Following. Click to view followed cadets.`}
        className={cn(
          "group relative inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-black/60",
          "hover:bg-white/[0.04] hover:border-lime-400/40 text-zinc-400 hover:text-white",
          "transition-[transform,border-color,background-color,box-shadow] duration-150 ease-out",
          "hover:-translate-y-0.5 active:scale-[0.98] hover:shadow-[0_4px_20px_-4px_rgba(163,230,53,0.15)]",
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 shrink-0 select-none whitespace-nowrap",
          isSmall ? "px-2 py-1 text-xs" : "px-3 py-1.5"
        )}
      >
        <div
          className={cn(
            "rounded-md bg-lime-400/10 border border-lime-400/20 flex items-center justify-center text-lime-400",
            "group-hover:bg-lime-400/20 group-hover:border-lime-400/40 transition-[background-color,border-color] duration-150 shrink-0",
            isSmall ? "size-4" : "size-5"
          )}
        >
          <UserCheck size={isSmall ? 10 : 11} />
        </div>
        <div className="flex items-baseline gap-1.5 font-sans whitespace-nowrap">
          <strong
            className={cn(
              "font-mono font-bold text-white tabular-nums tracking-tight group-hover:text-lime-400 transition-colors",
              isSmall ? "text-xs" : "text-sm"
            )}
          >
            {followingCount}
          </strong>
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold whitespace-nowrap">
            Following
          </span>
        </div>
        <span className="size-1 rounded-full bg-lime-400/40 group-hover:bg-lime-400 transition-colors shrink-0" />
      </button>
    </div>
  );
};
