import React, { useState, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus, UserMinus, Loader2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import { resolveAvatarUrl } from "@/lib/utils";
import { toggleFollowThunk, closeSocialDrawer } from "@/store/slices/socialSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { getStudentProfileData } from "@/organization/data/portal.functions";
import { swrFetch } from "@/lib/cache/swrCache";
import { toast } from "sonner";
import { prefetchProfileRoute } from "@/AppRoutes";

export interface CadetProfileSummary {
  id?: string | undefined;
  handle?: string | undefined;
  full_name?: string | null | undefined;
  avatar_url?: string | null | undefined;
  rating?: number | undefined;
  peak_rating?: number | null | undefined;
  tier?: string | undefined;
  university_rank?: number | null | undefined;
  attendance_count?: number | undefined;
  ratings?: number[] | undefined;
  department?: string | undefined;
  batch?: string | undefined;
  is_following?: boolean | undefined;
  is_self?: boolean | undefined;
}

export interface CadetProfileHoverCardProps {
  handle: string;
  profile?: CadetProfileSummary;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  className?: string;
  asChild?: boolean;
  openDelay?: number;
  closeDelay?: number;
  onProfileClick?: () => void;
}

function Spark({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${i * 18},${22 - ((v - min) / range) * 18}`)
    .join(" ");
  return (
    <svg
      viewBox="0 0 90 26"
      className="h-6 w-[80px] stroke-lime-400 fill-none stroke-[1.5]"
      aria-hidden="true"
    >
      <polyline points={pts} />
    </svg>
  );
}

function getInitials(fullName?: string | null, handle?: string): string {
  if (fullName) {
    const parts = fullName.split(" ").filter(Boolean);
    const first = parts[0] || "";
    const second = parts[1] || "";
    if (first && second && first[0] && second[0]) {
      return (first[0] + second[0]).toUpperCase();
    }
    if (first.length >= 2) {
      return first.slice(0, 2).toUpperCase();
    }
    if (first) {
      return first.toUpperCase();
    }
  }
  return (handle || "??").replace(/^@/, "").slice(0, 2).toUpperCase();
}

export function CadetProfileHoverCard({
  handle,
  profile,
  children,
  align = "start",
  side = "top",
  sideOffset = 8,
  className,
  asChild = true,
  openDelay = 120,
  closeDelay = 150,
  onProfileClick,
}: CadetProfileHoverCardProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const cleanHandle = (handle || profile?.handle || "").replace(/^@/, "").trim();
  const currentMember = useAppSelector((s) => s.auth.member);
  const followingIds = useAppSelector((s) => s.social.followingIds);
  const actionPendingId = useAppSelector((s) => s.social.actionPendingId);

  const [fetchedData, setFetchedData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUnfollowHovered, setIsUnfollowHovered] = useState(false);

  // Check if we need to fetch additional profile details on hover
  const hasFullData =
    Boolean(profile?.rating !== undefined && profile?.university_rank !== undefined);

  const fetchProfileDetails = useCallback(async () => {
    if (!cleanHandle || hasFullData || fetchedData) return;
    setIsLoading(true);
    try {
      const data = await swrFetch(
        `student:profile:${cleanHandle}`,
        () => getStudentProfileData(cleanHandle),
        { ttl: 5 * 60 * 1000, staleTime: 60 * 1000 }
      );
      if (data) {
        setFetchedData(data);
      }
    } catch (err) {
      console.warn("Failed to fetch student profile on hover:", err);
    } finally {
      setIsLoading(false);
    }
  }, [cleanHandle, hasFullData, fetchedData]);

  const handleOpenChange = (open: boolean) => {
    if (open && !hasFullData && !fetchedData) {
      fetchProfileDetails();
    }
  };

  if (!cleanHandle) {
    return <>{children}</>;
  }

  // Merge profile prop with any fetched data
  const memberObj = fetchedData?.member;
  const ratingHistory = fetchedData?.ratingHistory || fetchedData?.history || [];

  const effectiveId = profile?.id || memberObj?.id;
  const fullName = profile?.full_name ?? memberObj?.full_name ?? null;
  const avatarUrl = profile?.avatar_url ?? memberObj?.avatar_url ?? null;
  const rating = profile?.rating ?? memberObj?.rating ?? 1200;
  const peakRating = profile?.peak_rating ?? memberObj?.peak_rating ?? null;
  const tier = profile?.tier ?? memberObj?.tier ?? "Active";
  const universityRank = profile?.university_rank ?? memberObj?.university_rank ?? null;
  const attendanceCount =
    profile?.attendance_count ??
    memberObj?.attendance_count ??
    (fetchedData?.battles?.length || 0);

  const ratingsList =
    profile?.ratings ??
    (ratingHistory.length > 0 ? ratingHistory.map((h: any) => h.rating || 1200) : []);

  const initials = getInitials(fullName, cleanHandle);

  const isYou =
    profile?.is_self ||
    Boolean(
      currentMember &&
        ((effectiveId && currentMember.id === effectiveId) ||
          (currentMember.handle &&
            currentMember.handle.toLowerCase() === cleanHandle.toLowerCase()))
    );

  const isFollowing =
    profile?.is_following ??
    Boolean(
      effectiveId
        ? followingIds.includes(effectiveId) || followingIds.includes(cleanHandle)
        : followingIds.includes(cleanHandle)
    );

  const isPending = effectiveId ? actionPendingId === effectiveId : false;

  const handleFollowClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentMember) {
      toast.info("Please sign in to follow cadets", {
        action: {
          label: "Sign In",
          onClick: () => navigate("/auth"),
        },
      });
      return;
    }

    try {
      const res = await dispatch(
        toggleFollowThunk({
          targetId: effectiveId || cleanHandle,
          targetHandle: cleanHandle,
        })
      ).unwrap();

      if (res.isFollowing) {
        toast.success(`Following @${cleanHandle}`);
      } else {
        toast.info(`Unfollowed @${cleanHandle}`);
      }
    } catch (err: any) {
      toast.error(typeof err === "string" ? err : "Action failed");
    }
  };

  const handleProfileNavigation = () => {
    dispatch(closeSocialDrawer());
    if (onProfileClick) {
      onProfileClick();
    }
  };

  return (
    <HoverCard
      openDelay={openDelay}
      closeDelay={closeDelay}
      onOpenChange={handleOpenChange}
    >
      <HoverCardTrigger asChild={asChild}>{children}</HoverCardTrigger>

      <HoverCardContent
        className={`w-72 p-0 overflow-hidden z-[100] bg-zinc-950 border border-white/10 shadow-2xl shadow-black/90 rounded-xl pointer-events-auto ${
          className || ""
        }`}
        sideOffset={sideOffset}
        align={align}
        side={side}
      >
        {/* Top luminous accent */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-lime-400/60 to-transparent" />

        {/* Profile Header */}
        <div className="p-4 pb-3 flex items-start gap-3.5">
          <Avatar className="size-14 shrink-0 rounded-full border-2 border-lime-400/30 overflow-hidden ring-2 ring-black">
            <AvatarImage
              src={resolveAvatarUrl(avatarUrl)}
              alt={fullName || cleanHandle}
              className="object-cover"
            />
            <AvatarFallback className="bg-zinc-900 text-lime-400 font-mono text-base font-bold rounded-full">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="font-sans text-base font-bold text-white leading-tight truncate">
              {fullName || `@${cleanHandle}`}
            </p>
            <p className="font-mono text-xs text-zinc-400 mt-0.5 truncate">
              @{cleanHandle}
            </p>
            <p className="font-mono text-xs text-lime-400 tabular-nums mt-1 truncate">
              Rank&nbsp;
              <span className="font-bold">
                {universityRank ? `#${universityRank}` : "—"}
              </span>
              &nbsp;·&nbsp;
              <span className="text-zinc-400">{tier}</span>
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 divide-x divide-white/6 border-t border-white/6 text-center">
          <div className="py-2.5 px-2">
            <p className="text-[9px] font-mono uppercase text-zinc-500 tracking-wider">
              Rating
            </p>
            {isLoading && !hasFullData ? (
              <div className="h-4 w-10 bg-white/10 rounded animate-pulse mx-auto mt-1" />
            ) : (
              <p className="font-mono text-sm font-bold text-lime-400 tabular-nums mt-0.5">
                {rating}
              </p>
            )}
          </div>

          <div className="py-2.5 px-2">
            <p className="text-[9px] font-mono uppercase text-zinc-500 tracking-wider">
              Peak
            </p>
            {isLoading && !hasFullData ? (
              <div className="h-4 w-10 bg-white/10 rounded animate-pulse mx-auto mt-1" />
            ) : (
              <p className="font-mono text-sm font-bold text-white tabular-nums mt-0.5">
                {peakRating ?? "—"}
              </p>
            )}
          </div>

          <div className="py-2.5 px-2">
            <p className="text-[9px] font-mono uppercase text-zinc-500 tracking-wider">
              Rounds
            </p>
            {isLoading && !hasFullData ? (
              <div className="h-4 w-10 bg-white/10 rounded animate-pulse mx-auto mt-1" />
            ) : (
              <p className="font-mono text-sm font-bold text-white tabular-nums mt-0.5">
                {attendanceCount}
              </p>
            )}
          </div>
        </div>

        {/* Trend Sparkline */}
        {ratingsList.length >= 2 && (
          <div className="px-4 py-2 border-t border-white/6 flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase text-zinc-500 tracking-wider shrink-0">
              Trend
            </span>
            <Spark data={ratingsList} />
          </div>
        )}

        {/* CTA Actions Row */}
        <div className="p-3 border-t border-white/6 flex items-center gap-2">
          {!isYou && (
            <button
              type="button"
              disabled={isPending}
              onMouseEnter={() => setIsUnfollowHovered(true)}
              onMouseLeave={() => setIsUnfollowHovered(false)}
              onClick={handleFollowClick}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-mono text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${
                isFollowing
                  ? isUnfollowHovered
                    ? "border border-red-500/40 text-red-400 bg-red-500/10"
                    : "border border-white/15 text-zinc-300 hover:text-white hover:border-white/25 bg-transparent"
                  : "bg-lime-400 text-black hover:bg-lime-300 shadow-sm shadow-lime-400/20"
              }`}
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : isFollowing ? (
                isUnfollowHovered ? (
                  <>
                    <UserMinus className="size-3.5 text-red-400" />
                    <span>Unfollow</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="size-3.5" />
                    <span>Following</span>
                  </>
                )
              ) : (
                <>
                  <UserPlus className="size-3.5" />
                  <span>+ Follow</span>
                </>
              )}
            </button>
          )}

          <Link
            to={`/profile/${cleanHandle}`}
            onClick={handleProfileNavigation}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg font-mono text-xs font-semibold border border-white/10 text-zinc-300 hover:text-white hover:border-white/25 hover:bg-white/[0.04] transition-all duration-150 ${
              isYou ? "flex-1" : "px-4"
            }`}
          >
            View Profile
          </Link>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
