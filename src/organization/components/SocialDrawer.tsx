/**
 * Chaos Computer Club India — Cyber Social Drawer
 * Manages student followers and following with live interactive follow actions.
 * Built strictly with CCC brutalist dark design tokens, shadcn UI Sheet, and Redux Toolkit.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  Loader2,
  Search,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn, resolveAvatarUrl } from "@/lib/utils";
import { Tabs, TabsList, TabsTab } from "@/components/ui/animated-tabs";

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
    drawerType === "followers"
      ? (loadingList ? "..." : studentsList.length)
      : followersCount;

  const displayedFollowingTabCount =
    drawerType === "following"
      ? (loadingList ? "..." : studentsList.length)
      : followingCount;

  return (
    <Sheet
      open={drawerOpen}
      onOpenChange={(open) => {
        if (!open) dispatch(closeSocialDrawer());
      }}
    >
      <SheetContent side="right" className="w-full max-w-md bg-black border-l border-white/[0.08] text-white p-0 flex flex-col gap-0 overflow-hidden sm:max-w-md shadow-[0_0_80px_rgba(0,0,0,0.95)]">
        {/* Top ambient accent highlight */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-lime-400/50 to-transparent pointer-events-none z-20" />

        {/* Header Section */}
        <SheetHeader className="p-4 sm:p-5 border-b border-white/[0.08] bg-black/90 backdrop-blur-xl text-left space-y-0 relative z-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-lime-400" />
              </span>
              <div>
                <p className="font-sans text-[10px] uppercase font-bold tracking-[0.2em] text-lime-400">
                  (05 // Peer Network)
                </p>
                <SheetTitle className="font-sans text-sm sm:text-base font-bold text-white uppercase tracking-tight mt-0.5">
                  {drawerTargetName || `@${drawerTargetHandle}`}
                </SheetTitle>
              </div>
            </div>
          </div>

          {/* Animated Tab Switcher */}
          <Tabs
            value={drawerType}
            onValueChange={(v) => dispatch(setDrawerType(v as "followers" | "following"))}
            className="mt-4 gap-0"
          >
            <TabsList className="w-full grid grid-cols-2 p-1 bg-white/[0.03] border border-white/[0.08] rounded-xl gap-1">
              <TabsTab
                value="followers"
                className="w-full py-2 text-xs"
              >
                <Users size={13} className="shrink-0" />
                <span>Followers</span>
                <span
                  className={cn(
                    "text-[10px] min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-md font-sans tabular-nums font-bold transition-colors duration-150 shrink-0",
                    drawerType === "followers"
                      ? "bg-black/20 text-black font-bold"
                      : "bg-white/[0.06] text-zinc-400 border border-white/[0.08]",
                  )}
                >
                  {displayedFollowersTabCount}
                </span>
              </TabsTab>
              <TabsTab
                value="following"
                className="w-full py-2 text-xs"
              >
                <UserCheck size={13} className="shrink-0" />
                <span>Following</span>
                <span
                  className={cn(
                    "text-[10px] min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-md font-sans tabular-nums font-bold transition-colors duration-150 shrink-0",
                    drawerType === "following"
                      ? "bg-black/20 text-black font-bold"
                      : "bg-white/[0.06] text-zinc-400 border border-white/[0.08]",
                  )}
                >
                  {displayedFollowingTabCount}
                </span>
              </TabsTab>
            </TabsList>
          </Tabs>

          {/* Filter Input */}
          <div className="relative mt-3">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none transition-colors duration-150"
            />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => dispatch(setSocialSearchQuery(e.target.value))}
              placeholder="Search handle, name, or department..."
              className="h-9 pl-8.5 pr-8 text-xs font-sans bg-black/80 border border-white/[0.08] rounded-xl text-white placeholder:text-zinc-500 focus-visible:border-lime-400/60 focus-visible:ring-1 focus-visible:ring-lime-400/30 transition-[border-color,box-shadow] duration-150"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => dispatch(setSocialSearchQuery(""))}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.05] transition-colors duration-150"
              >
                <X size={12} />
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Student Cards Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loadingList ? (
            <div className="space-y-2.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3.5 border border-white/[0.08] bg-black/40 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 bg-zinc-900 rounded-lg" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-24 bg-zinc-900" />
                      <Skeleton className="h-2.5 w-32 bg-zinc-900" />
                      <Skeleton className="h-2 w-16 bg-zinc-900" />
                    </div>
                  </div>
                  <Skeleton className="h-7 w-20 bg-zinc-900 rounded-lg" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="size-14 rounded-full border border-lime-400/20 bg-lime-400/5 text-lime-400 flex items-center justify-center mx-auto mb-3 shadow-[0_0_30px_rgba(163,230,53,0.1)]">
                <Users size={22} />
              </div>
              <h3 className="font-sans text-xs font-bold text-white uppercase tracking-wider">
                {searchQuery ? "No matching peers" : "No connections recorded"}
              </h3>
              <p className="text-[11px] text-zinc-400 font-sans mt-1.5 max-w-[240px] mx-auto leading-relaxed">
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
                  className="group flex items-center justify-between p-3 sm:p-3.5 border border-white/[0.08] bg-black/40 hover:bg-white/[0.03] hover:border-lime-400/35 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.5)] transition-[transform,background-color,border-color,box-shadow] duration-150 ease-out hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Link
                      to={`/profile/${student.handle}`}
                      onClick={() => dispatch(closeSocialDrawer())}
                      className="cursor-pointer shrink-0"
                    >
                      <Avatar className="size-10 rounded-lg border border-white/10 bg-black group-hover:border-lime-400/40 transition-[border-color] duration-150 overflow-hidden">
                        {student.avatar_url ? (
                          <AvatarImage
                            src={resolveAvatarUrl(student.avatar_url)}
                            alt={student.full_name || student.handle}
                            className="object-cover"
                          />
                        ) : null}
                        <AvatarFallback className="rounded-lg bg-lime-400/10 text-lime-400 font-sans text-xs font-bold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    </Link>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/profile/${student.handle}`}
                          onClick={() => dispatch(closeSocialDrawer())}
                          className="text-xs font-sans text-white truncate tracking-tight hover:text-lime-400 transition-colors font-semibold"
                        >
                          @{student.handle}
                        </Link>
                        <span className="text-[10px] text-lime-400 font-sans font-bold tabular-nums bg-lime-400/10 border border-lime-400/20 px-1.5 py-0.5 rounded-md">
                          {student.rating}
                        </span>
                      </div>

                      <p className="text-[11px] text-zinc-400 truncate font-sans">
                        {student.full_name || `@${student.handle}`}
                      </p>

                      <div className="flex items-center gap-1.5 pt-0.5">
                        <TierBadge>{student.tier}</TierBadge>
                      </div>
                    </div>
                  </div>

                  {student.is_self ? (
                    <span className="px-2.5 py-1 text-[10px] font-sans font-semibold uppercase bg-white/[0.04] text-zinc-400 border border-white/[0.08] rounded-lg shrink-0">
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
                      className={cn(
                        "font-sans text-[11px] font-semibold uppercase px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-[transform,background-color,border-color,color,box-shadow] duration-150 flex-shrink-0 cursor-pointer h-auto active:scale-95",
                        isFollowing
                          ? isHovered
                            ? "bg-white/[0.08] border border-white/30 text-white"
                            : "bg-black border border-white/15 text-zinc-300 hover:text-white hover:border-white/25"
                          : "bg-transparent border border-lime-400/40 text-lime-400 hover:bg-lime-400 hover:text-black font-semibold hover:shadow-[0_0_15px_rgba(163,230,53,0.25)]",
                      )}
                    >
                      {isPending ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : isFollowing ? (
                        isHovered ? (
                          <>
                            <UserMinus size={11} className="text-zinc-300" />
                            <span>Unfollow</span>
                          </>
                        ) : (
                          <>
                            <Check size={11} className="text-lime-400" />
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
        <footer className="p-3.5 border-t border-white/[0.08] bg-black/90 backdrop-blur-md text-center">
          <p className="text-[9px] text-zinc-500 font-sans uppercase tracking-widest">
            AUTHENTICATED CAMPUS SOCIAL GRAPH · MEDI-CAPS CHAPTER
          </p>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
