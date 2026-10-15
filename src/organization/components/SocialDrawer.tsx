/**
 * Chaos Computer Club India — Cyber Social Drawer
 * Manages student followers and following with live interactive follow actions.
 * Built strictly with CCC brutalist dark design tokens, shadcn UI Sheet, and Redux Toolkit.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Search, UserCheck, UserMinus, UserPlus, Users, X } from "lucide-react";
import { WanderingEyes } from "@/components/ui/WanderingEyes";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  closeSocialDrawer,
  setDrawerType,
  setSocialSearchQuery,
  fetchFollowersThunk,
  fetchFollowingThunk,
  toggleFollowThunk,
} from "@/store/slices/socialSlice";
import { TierBadge } from "./ui";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MakoMascot } from "@/components/common/MakoMascot";
import { toast } from "sonner";
import { cn, resolveAvatarUrl } from "@/lib/utils";
import { CadetProfileHoverCard } from "@/components/ui/CadetProfileHoverCard";
import { Tabs, TabsList, TabsTab } from "@/components/animate-ui/components/base/tabs";

export function SocialDrawer() {
  const dispatch = useAppDispatch();
  const {
    drawerOpen,
    drawerType,
    drawerTargetHandle,
    drawerTargetName,
    followersCount,
    followingCount,
    studentsList,
    loadingList,
    actionPendingId,
    followingIds,
    searchQuery,
  } = useAppSelector((state) => state.social);

  const [hoveredStudentId, setHoveredStudentId] = useState<string | null>(null);

  // Load data whenever drawer opens or active tab switches
  useEffect(() => {
    if (!drawerOpen || !drawerTargetHandle) return;
    if (drawerType === "followers") {
      dispatch(fetchFollowersThunk(drawerTargetHandle));
    } else {
      dispatch(fetchFollowingThunk(drawerTargetHandle));
    }
  }, [dispatch, drawerOpen, drawerType, drawerTargetHandle]);

  const filtered = studentsList.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (s.handle || "").toLowerCase().includes(q) ||
      (s.full_name && s.full_name.toLowerCase().includes(q)) ||
      (s.department && s.department.toLowerCase().includes(q))
    );
  });

  const displayedFollowersTabCount =
    drawerType === "followers" ? (loadingList ? "..." : studentsList.length) : followersCount;

  const displayedFollowingTabCount =
    drawerType === "following" ? (loadingList ? "..." : studentsList.length) : followingCount;

  return (
    <Sheet
      open={drawerOpen}
      onOpenChange={(open) => {
        if (!open) dispatch(closeSocialDrawer());
      }}
    >
      <SheetContent
        side="right"
        className="w-full max-w-md bg-[#1F1F1F] border-l border-white/[0.08] text-white p-0 flex flex-col gap-0 overflow-hidden sm:max-w-md shadow-2xl"
      >
        {/* Top ambient accent highlight */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#B1FA63]/50 to-transparent pointer-events-none z-20" />

        {/* Header Section */}
        <SheetHeader className="p-5 sm:p-6 border-b border-white/[0.08] bg-[#1F1F1F] text-left space-y-0 relative z-10">
          <div className="pr-8">
            <SheetTitle className="text-xl sm:text-2xl font-display uppercase tracking-wide text-white leading-none">
              {drawerTargetName || `@${drawerTargetHandle}`}
            </SheetTitle>
            {drawerTargetHandle && (
              <p className="text-[11px] font-mono text-[#B1FA63] font-bold mt-1.5 tracking-wider uppercase">
                @{drawerTargetHandle.replace(/^@+/, "")}
              </p>
            )}
          </div>

          {/* Animated Tab Switcher */}
          <Tabs
            value={drawerType}
            onValueChange={(v) => dispatch(setDrawerType(v as "followers" | "following"))}
            className="mt-4 gap-0"
          >
            <TabsList className="w-full grid grid-cols-2 p-1 bg-[#171717] border border-white/[0.08] rounded-[12px] gap-1">
              <TabsTab
                value="followers"
                className="w-full py-2 text-xs font-heading font-bold uppercase tracking-wider rounded-[8px] gap-2"
              >
                <Users size={13} className="shrink-0" />
                <span>Followers</span>
                <span
                  className={cn(
                    "text-[11px] min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-[6px] font-mono tabular-nums font-bold transition-colors duration-150 shrink-0",
                    drawerType === "followers"
                      ? "bg-black/15 text-black"
                      : "bg-white/[0.06] text-zinc-400 border border-white/[0.08]",
                  )}
                >
                  {displayedFollowersTabCount}
                </span>
              </TabsTab>
              <TabsTab
                value="following"
                className="w-full py-2 text-xs font-heading font-bold uppercase tracking-wider rounded-[8px] gap-2"
              >
                <UserCheck size={13} className="shrink-0" />
                <span>Following</span>
                <span
                  className={cn(
                    "text-[11px] min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-[6px] font-mono tabular-nums font-bold transition-colors duration-150 shrink-0",
                    drawerType === "following"
                      ? "bg-black/15 text-black"
                      : "bg-white/[0.06] text-zinc-400 border border-white/[0.08]",
                  )}
                >
                  {displayedFollowingTabCount}
                </span>
              </TabsTab>
            </TabsList>
          </Tabs>

          {/* Filter Input */}
          <div className="relative mt-3.5">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none transition-colors duration-150"
            />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => dispatch(setSocialSearchQuery(e.target.value))}
              placeholder="Search handle, name, or department..."
              className="h-10 pl-9 pr-9 text-xs font-sans bg-[#171717] border border-white/[0.08] rounded-[10px] text-white placeholder:text-zinc-500 focus-visible:border-[#B1FA63] focus-visible:ring-1 focus-visible:ring-[#B1FA63]/30 transition-[border-color,box-shadow] duration-150"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => dispatch(setSocialSearchQuery(""))}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 min-h-0 min-w-0 p-0 text-zinc-500 hover:text-white border-0 bg-transparent rounded-[8px]"
              >
                <X size={13} />
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Student Cards Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {loadingList ? (
            <div className="space-y-2.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 sm:p-3.5 border border-white/[0.08] bg-[#171717] rounded-[12px]"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 bg-white/[0.05] rounded-[10px]" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3.5 w-24 bg-white/[0.05] rounded" />
                      <Skeleton className="h-3 w-32 bg-white/[0.05] rounded" />
                      <Skeleton className="h-2.5 w-16 bg-white/[0.05] rounded" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-20 bg-white/[0.05] rounded-[10px]" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 px-6 flex flex-col items-center justify-center">
              <div className="size-20 mb-3 flex items-center justify-center">
                <MakoMascot variant={searchQuery ? "search" : "welcome"} size="md" />
              </div>
              <h3 className="font-heading text-xs font-bold text-white uppercase tracking-wider">
                {searchQuery ? "No matching peers" : "No connections recorded"}
              </h3>
              <p className="text-xs text-zinc-400 font-sans mt-1.5 max-w-[260px] mx-auto leading-relaxed">
                {searchQuery
                  ? `No students found matching "${searchQuery}". Try searching by handle or department.`
                  : drawerType === "followers"
                    ? "This student does not have any campus followers yet."
                    : "This student is not following any peers yet."}
              </p>
            </div>
          ) : (
            filtered.map((student) => {
              const isFollowing =
                followingIds.includes(student.id) ||
                (student.handle ? followingIds.includes(student.handle) : false);
              const isPending =
                actionPendingId === student.id ||
                (student.handle ? actionPendingId === student.handle : false);
              const isHovered = hoveredStudentId === student.id;

              const initials = student.full_name
                ? student.full_name
                    .split(" ")
                    .map((w) => w[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()
                : student.handle.slice(0, 2).toUpperCase();

              return (
                <article
                  key={student.id}
                  className="group flex items-center justify-between p-3 sm:p-3.5 border border-white/[0.08] bg-[#171717] hover:border-white/20 rounded-[12px] transition-[border-color,background-color] duration-150"
                >
                  <CadetProfileHoverCard
                    handle={student.handle}
                    profile={{
                      id: student.id,
                      handle: student.handle,
                      full_name: student.full_name,
                      avatar_url: student.avatar_url,
                      rating: student.rating,
                      peak_rating: student.peak_rating,
                      tier: student.tier,
                      department: student.department,
                      is_following: isFollowing,
                      is_self: student.is_self,
                    }}
                    side="left"
                    align="start"
                    sideOffset={14}
                  >
                    <div className="flex items-center gap-3 min-w-0 cursor-pointer">
                      <Link
                        to={`/profile/${student.handle}`}
                        onClick={() => dispatch(closeSocialDrawer())}
                        className="cursor-pointer shrink-0"
                      >
                        <Avatar className="size-10 rounded-[10px] border border-white/[0.08] bg-[#1F1F1F] group-hover:border-white/20 transition-colors overflow-hidden">
                          {student.avatar_url ? (
                            <AvatarImage
                              src={resolveAvatarUrl(student.avatar_url)}
                              alt={student.full_name || student.handle}
                              className="object-cover"
                            />
                          ) : null}
                          <AvatarFallback className="rounded-[10px] bg-[#B1FA63]/10 text-[#B1FA63] font-display text-sm uppercase tracking-wider flex items-center justify-center">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                      </Link>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/profile/${student.handle}`}
                            onClick={() => dispatch(closeSocialDrawer())}
                            className="text-xs font-semibold text-white truncate tracking-tight hover:text-[#B1FA63] transition-colors"
                          >
                            @{student.handle}
                          </Link>
                          <span className="text-[10px] text-[#B1FA63] font-mono font-bold tabular-nums bg-[#B1FA63]/10 border border-[#B1FA63]/20 px-1.5 py-0.5 rounded-[6px]">
                            {student.rating}
                          </span>
                        </div>

                        <p className="text-[11px] text-zinc-400 truncate font-sans">
                          {student.full_name || `@${student.handle}`}
                        </p>

                        <div className="flex items-center gap-1.5 pt-0.5">
                          <TierBadge tier={student.tier} rating={student.rating} />
                        </div>
                      </div>
                    </div>
                  </CadetProfileHoverCard>

                  {student.is_self ? (
                    <span className="px-2.5 py-1 text-[10px] font-heading font-bold uppercase tracking-wider bg-white/[0.04] text-zinc-400 border border-white/[0.08] rounded-[8px] shrink-0">
                      You
                    </span>
                  ) : (
                    <Button
                      type="button"
                      disabled={isPending}
                      onMouseEnter={() => setHoveredStudentId(student.id)}
                      onMouseLeave={() => setHoveredStudentId(null)}
                      onClick={async () => {
                        try {
                          const res = await dispatch(
                            toggleFollowThunk({
                              targetId: student.id,
                              targetHandle: student.handle,
                            }),
                          ).unwrap();
                          if (res.isFollowing) {
                            toast.success(`Following @${student.handle}`);
                          } else {
                            toast.info(`Unfollowed @${student.handle}`);
                          }
                        } catch (err: any) {
                          toast.error(typeof err === "string" ? err : "Action failed");
                        }
                      }}
                      variant={isFollowing ? (isHovered ? "destructive" : "secondary") : "default"}
                      size="sm"
                      className="rounded-[10px] text-xs font-heading font-bold uppercase tracking-wider"
                    >
                      {isPending ? (
                        <WanderingEyes size="inline" className="h-3" />
                      ) : isFollowing ? (
                        isHovered ? (
                          <>
                            <UserMinus size={11} />
                            <span>Unfollow</span>
                          </>
                        ) : (
                          <>
                            <Check size={11} />
                            <span>Following</span>
                          </>
                        )
                      ) : (
                        <>
                          <UserPlus size={11} />
                          <span>Follow</span>
                        </>
                      )}
                    </Button>
                  )}
                </article>
              );
            })
          )}
        </div>

        {/* Footer */}
        <footer className="p-3.5 sm:p-4 border-t border-white/[0.08] bg-[#1F1F1F] text-center">
          <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
            AUTHENTICATED CAMPUS SOCIAL GRAPH · MEDI-CAPS CHAPTER
          </p>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
