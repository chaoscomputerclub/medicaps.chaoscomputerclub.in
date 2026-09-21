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
import { cn } from "@/lib/utils";

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
      <SheetContent side="right" className="w-full max-w-md bg-zinc-950 border-l border-white/10 text-white p-0 flex flex-col gap-0 overflow-hidden sm:max-w-md">
        {/* Header Section */}
        <SheetHeader className="p-4 border-b border-white/10 bg-zinc-900/80 backdrop-blur-md text-left space-y-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
              <div>
                <p className="font-mono text-[10px] uppercase font-bold tracking-[0.2em] text-lime-400">
                  (05 // Peer Network)
                </p>
                <SheetTitle className="font-mono text-sm font-bold text-white uppercase tracking-tight">
                  {drawerTargetName || `@${drawerTargetHandle}`}
                </SheetTitle>
              </div>
            </div>
          </div>

          {/* Segmented Tab Switcher */}
          <div className="grid grid-cols-2 gap-1.5 p-1 mt-4 bg-zinc-900 border border-white/10 rounded-none">
            <Button
              type="button"
              variant="ghost"
              onClick={() => dispatch(setDrawerType("followers"))}
              className={cn(
                "h-auto py-1.5 text-xs font-mono font-bold uppercase rounded-none transition-all flex items-center justify-center gap-2 cursor-pointer",
                drawerType === "followers"
                  ? "bg-lime-400 text-black shadow-sm hover:bg-lime-400 hover:text-black"
                  : "text-zinc-400 hover:text-white hover:bg-white/5",
              )}
            >
              <Users size={12} />
              <span>Followers</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-none font-mono tabular-nums",
                  drawerType === "followers"
                    ? "bg-black/20 text-black font-bold"
                    : "bg-zinc-800 text-zinc-400 border border-white/10",
                )}
              >
                {displayedFollowersTabCount}
              </span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => dispatch(setDrawerType("following"))}
              className={cn(
                "h-auto py-1.5 text-xs font-mono font-bold uppercase rounded-none transition-all flex items-center justify-center gap-2 cursor-pointer",
                drawerType === "following"
                  ? "bg-lime-400 text-black shadow-sm hover:bg-lime-400 hover:text-black"
                  : "text-zinc-400 hover:text-white hover:bg-white/5",
              )}
            >
              <UserCheck size={12} />
              <span>Following</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-none font-mono tabular-nums",
                  drawerType === "following"
                    ? "bg-black/20 text-black font-bold"
                    : "bg-zinc-800 text-zinc-400 border border-white/10",
                )}
              >
                {displayedFollowingTabCount}
              </span>
            </Button>
          </div>

          {/* Monospace Filter Input */}
          <div className="relative mt-3">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
            />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => dispatch(setSocialSearchQuery(e.target.value))}
              placeholder="Search handle, name, or department..."
              className="h-9 pl-8 pr-8 text-xs font-mono bg-zinc-900 border border-white/10 rounded-none text-white placeholder:text-zinc-500 focus-visible:border-lime-400/60 transition-colors"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => dispatch(setSocialSearchQuery(""))}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-zinc-500 hover:text-white"
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
                  className="flex items-center justify-between p-3.5 border border-white/10 bg-zinc-900/50 rounded-none"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 bg-zinc-800 rounded-none" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-24 bg-zinc-800" />
                      <Skeleton className="h-2.5 w-32 bg-zinc-800" />
                      <Skeleton className="h-2 w-16 bg-zinc-800" />
                    </div>
                  </div>
                  <Skeleton className="h-7 w-20 bg-zinc-800 rounded-none" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-12 h-12 rounded-none border border-white/10 bg-zinc-900 text-zinc-500 flex items-center justify-center mx-auto mb-3">
                <Users size={20} />
              </div>
              <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                {searchQuery ? "No matching peers" : "No connections recorded"}
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono mt-1 max-w-[240px] mx-auto leading-relaxed">
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
                  className="flex items-center justify-between p-3.5 border border-white/10 bg-zinc-900/50 hover:border-white/20 hover:bg-zinc-900/80 transition-all rounded-none shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Link
                      to={`/profile/${student.handle}`}
                      onClick={() => dispatch(closeSocialDrawer())}
                      className="cursor-pointer"
                    >
                      <Avatar className="w-10 h-10 rounded-none border border-white/10 bg-zinc-800 hover:border-lime-400/50 transition-colors">
                        {student.avatar_url ? (
                          <AvatarImage
                            src={student.avatar_url}
                            alt={student.full_name || student.handle}
                            className="object-cover"
                          />
                        ) : null}
                        <AvatarFallback className="rounded-none bg-zinc-800 text-lime-400 font-mono text-xs font-bold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    </Link>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/profile/${student.handle}`}
                          onClick={() => dispatch(closeSocialDrawer())}
                          className="text-xs font-mono text-white truncate tracking-tight hover:text-lime-400 transition-colors font-semibold"
                        >
                          @{student.handle}
                        </Link>
                        <span className="text-[10px] text-lime-400 font-mono font-bold tabular-nums">
                          {student.rating}
                        </span>
                      </div>

                      <p className="text-[11px] text-zinc-400 truncate font-sans mt-0.5">
                        {student.full_name || `@${student.handle}`}
                      </p>

                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] font-mono uppercase bg-zinc-800/80 border border-white/10 text-zinc-400 px-1.5 py-0.5 rounded-none">
                          {student.department} · {student.batch}
                        </span>
                        <TierBadge>{student.tier}</TierBadge>
                      </div>
                    </div>
                  </div>

                  {student.is_self ? (
                    <span className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase bg-zinc-800/80 text-zinc-400 border border-white/10 rounded-none">
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
                        "font-mono text-[10px] font-bold uppercase px-3 py-1.5 border rounded-none flex items-center gap-1.5 transition-all flex-shrink-0 cursor-pointer h-auto active:scale-[0.98]",
                        isFollowing
                          ? isHovered
                            ? "bg-rose-500/10 border-rose-500/40 text-rose-400 hover:bg-rose-500/20"
                            : "bg-zinc-800/60 border-white/10 text-zinc-300 hover:text-white"
                          : "bg-lime-400/10 border-lime-400/40 text-lime-400 hover:bg-lime-400 hover:text-black shadow-sm",
                      )}
                    >
                      {isPending ? (
                        <Loader2 size={11} className="animate-spin" />
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
        <footer className="p-3 border-t border-white/10 bg-zinc-950/90 backdrop-blur-md text-center">
          <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">
            AUTHENTICATED CAMPUS SOCIAL GRAPH • MEDI-CAPS CHAPTER
          </p>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
