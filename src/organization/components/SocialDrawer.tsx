/**
 * Chaos Computer Club India — Cyber Social Drawer
 * Displays student followers and following with live interactive follow actions.
 */

import { useEffect } from "react";
import { Check, Loader2, Search, UserCheck, UserMinus, UserPlus, Users, X } from "lucide-react";
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
import { cn } from "@/lib/utils";

export function SocialDrawer() {
  const dispatch = useAppDispatch();
  const {
    drawerOpen,
    drawerType,
    drawerTargetHandle,
    drawerTargetName,
    studentsList,
    loadingList,
    actionPendingId,
    followingIds,
    searchQuery,
  } = useAppSelector((state) => state.social);

  // Load data whenever drawer opens or active tab switches
  useEffect(() => {
    if (!drawerOpen || !drawerTargetHandle) return;
    if (drawerType === "followers") {
      dispatch(fetchFollowersThunk(drawerTargetHandle));
    } else {
      dispatch(fetchFollowingThunk(drawerTargetHandle));
    }
  }, [dispatch, drawerOpen, drawerType, drawerTargetHandle]);

  if (!drawerOpen) return null;

  const filtered = studentsList.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.handle.toLowerCase().includes(q) ||
      (s.full_name && s.full_name.toLowerCase().includes(q)) ||
      (s.department && s.department.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={() => dispatch(closeSocialDrawer())} />

      {/* Drawer Container */}
      <aside className="relative z-10 w-full max-w-md h-full bg-[#0a0a0a] border-l border-[#222] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <header className="p-5 border-b border-[#222] bg-[#0e0e0e] flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] text-accent font-bold uppercase tracking-wider mb-0.5">
              [ PEER INTEL // NETWORK ]
            </p>
            <h2 className="text-base font-bold text-white uppercase tracking-tight">
              @{drawerTargetHandle}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => dispatch(closeSocialDrawer())}
            className="p-1.5 text-muted hover:text-white hover:bg-[#1a1a1a] rounded-[1px] transition-colors"
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        </header>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 border-b border-[#222] bg-[#0c0c0c] text-xs font-mono font-bold uppercase">
          <button
            type="button"
            onClick={() => dispatch(setDrawerType("followers"))}
            className={cn(
              "py-3 text-center border-b-2 transition-all",
              drawerType === "followers"
                ? "border-accent text-accent bg-[#141414]"
                : "border-transparent text-muted hover:text-white"
            )}
          >
            Followers
          </button>
          <button
            type="button"
            onClick={() => dispatch(setDrawerType("following"))}
            className={cn(
              "py-3 text-center border-b-2 transition-all",
              drawerType === "following"
                ? "border-accent text-accent bg-[#141414]"
                : "border-transparent text-muted hover:text-white"
            )}
          >
            Following
          </button>
        </div>

        {/* Search Box */}
        <div className="p-3 border-b border-[#222] bg-[#0c0c0c]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => dispatch(setSocialSearchQuery(e.target.value))}
              placeholder={`Search in ${drawerType}…`}
              className="w-full bg-[#141414] border border-[#262626] rounded-[1px] pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted font-mono focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Student List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loadingList ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 border border-[#1a1a1a] bg-[#111]">
                  <Skeleton className="w-10 h-10 rounded-[1px]" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-2.5 w-36" />
                  </div>
                  <Skeleton className="h-7 w-20" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted font-mono text-xs">
              <Users size={28} className="mx-auto text-[#333] mb-3" />
              {searchQuery ? (
                <p>No students match "{searchQuery}".</p>
              ) : (
                <p>No {drawerType} recorded yet.</p>
              )}
            </div>
          ) : (
            filtered.map((student) => {
              const isFollowing = followingIds.includes(student.id) || student.is_following;
              const isPending = actionPendingId === student.id;
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
                  className="flex items-center justify-between p-3 border border-[#202020] bg-[#121212] hover:border-[#333] transition-colors rounded-[1px]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-[1px] bg-[#181818] border border-[#2a2a2a] text-accent flex items-center justify-center font-mono text-xs font-bold flex-shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-xs font-mono text-white truncate">
                          @{student.handle}
                        </strong>
                        <span className="text-[10px] text-muted font-mono">
                          {student.rating}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted truncate">
                        {student.full_name || student.handle}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] font-mono text-muted uppercase">
                          {student.department} · {student.batch}
                        </span>
                      </div>
                    </div>
                  </div>

                  {student.is_self ? (
                    <span className="px-2 py-1 text-[10px] font-mono uppercase bg-[#1a1a1a] text-muted border border-[#2a2a2a] rounded-[1px]">
                      You
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        dispatch(toggleFollowThunk({ targetId: student.id, targetHandle: student.handle }))
                      }
                      className={cn(
                        "font-mono text-[10px] font-bold uppercase px-3 py-1.5 border rounded-[1px] flex items-center gap-1.5 transition-all flex-shrink-0",
                        isFollowing
                          ? "bg-transparent border-[#333] text-muted hover:border-danger hover:text-danger hover:bg-danger/10"
                          : "bg-accent/10 border-accent/40 text-accent hover:bg-accent hover:text-black"
                      )}
                    >
                      {isPending ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : isFollowing ? (
                        <>
                          <Check size={12} />
                          <span>Following</span>
                        </>
                      ) : (
                        <>
                          <UserPlus size={12} />
                          <span>Follow</span>
                        </>
                      )}
                    </button>
                  )}
                </article>
              );
            })
          )}
        </div>

        {/* Footer */}
        <footer className="p-3 border-t border-[#222] bg-[#0c0c0c] text-center">
          <p className="text-[10px] text-muted font-mono">
            PEER CONNECTIONS • CHAOS COMPUTER CLUB
          </p>
        </footer>
      </aside>
    </div>
  );
}
