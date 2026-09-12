/**
 * Chaos Computer Club India — Cyber Social Drawer
 * Manages student followers and following with live interactive follow actions.
 * Built strictly with CCC brutalist dark design tokens and Redux Toolkit.
 */

import { useEffect, useState } from "react";
import {
  Check,
  Globe,
  Loader2,
  Search,
  ShieldCheck,
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

  const [hoveredStudentId, setHoveredStudentId] = useState<string | null>(null);

  // Keyboard shortcut: ESC to close
  useEffect(() => {
    if (!drawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dispatch(closeSocialDrawer());
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, drawerOpen]);

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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Student Connections"
      className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={() => dispatch(closeSocialDrawer())} />

      {/* Slide-over Drawer Panel */}
      <aside className="relative z-10 w-full max-w-md h-full bg-[var(--surface)] border-l border-[var(--line)] shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Header Section */}
        <header className="p-4 border-b border-[var(--line)] bg-[var(--bg)]/70 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
              <div>
                <p className="font-mono text-[10px] uppercase font-bold tracking-widest text-[var(--accent)]">
                  PEER NETWORK
                </p>
                <h2 className="font-mono text-sm font-bold text-white uppercase tracking-tight">
                  {drawerTargetName || `@${drawerTargetHandle}`}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => dispatch(closeSocialDrawer())}
              className="p-1.5 text-[var(--muted)] hover:text-white border border-transparent hover:border-[var(--line)] rounded-[1px] hover:bg-[var(--surface-2)] transition-all cursor-pointer"
              title="Close drawer (Esc)"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Segmented Tab Switcher */}
          <div className="grid grid-cols-2 gap-1.5 p-1 mt-4 bg-[var(--surface-2)] border border-[var(--line)] rounded-[1px]">
            <button
              type="button"
              onClick={() => dispatch(setDrawerType("followers"))}
              className={cn(
                "py-1.5 text-xs font-mono font-bold uppercase rounded-[1px] transition-all flex items-center justify-center gap-2 cursor-pointer",
                drawerType === "followers"
                  ? "bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm"
                  : "text-[var(--muted)] hover:text-white hover:bg-[var(--surface)]/50",
              )}
            >
              <Users size={12} />
              <span>Followers</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-[1px] font-mono",
                  drawerType === "followers"
                    ? "bg-black/20 text-black"
                    : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--line)]",
                )}
              >
                {drawerType === "followers" ? studentsList.length : "•"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => dispatch(setDrawerType("following"))}
              className={cn(
                "py-1.5 text-xs font-mono font-bold uppercase rounded-[1px] transition-all flex items-center justify-center gap-2 cursor-pointer",
                drawerType === "following"
                  ? "bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm"
                  : "text-[var(--muted)] hover:text-white hover:bg-[var(--surface)]/50",
              )}
            >
              <UserCheck size={12} />
              <span>Following</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-[1px] font-mono",
                  drawerType === "following"
                    ? "bg-black/20 text-black"
                    : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--line)]",
                )}
              >
                {drawerType === "following" ? studentsList.length : "•"}
              </span>
            </button>
          </div>

          {/* Monospace Filter Input */}
          <div className="relative mt-3">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => dispatch(setSocialSearchQuery(e.target.value))}
              placeholder="Search handle, name, or department..."
              className="w-full h-8 pl-8 pr-8 text-xs font-mono bg-[var(--surface-2)] border border-[var(--line)] rounded-[1px] text-white placeholder:text-[var(--muted)]/60 focus:outline-none focus:border-[var(--accent)]/70 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => dispatch(setSocialSearchQuery(""))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-white p-0.5"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </header>

        {/* Student Cards Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loadingList ? (
            <div className="space-y-2.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 border border-[var(--line)] bg-[var(--surface-2)] rounded-[1px]"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-9 h-9 bg-[var(--surface-3)] rounded-[1px]" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-24 bg-[var(--surface-3)]" />
                      <Skeleton className="h-2.5 w-32 bg-[var(--surface-3)]" />
                      <Skeleton className="h-2 w-16 bg-[var(--surface-3)]" />
                    </div>
                  </div>
                  <Skeleton className="h-7 w-20 bg-[var(--surface-3)] rounded-[1px]" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-12 h-12 rounded-[1px] border border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)] flex items-center justify-center mx-auto mb-3">
                <Users size={20} />
              </div>
              <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                {searchQuery ? "No matching peers" : "No connections recorded"}
              </h3>
              <p className="text-[11px] text-[var(--muted)] font-mono mt-1 max-w-[240px] mx-auto leading-relaxed">
                {searchQuery
                  ? `No students found matching "${searchQuery}". Try searching by handle or department.`
                  : drawerType === "followers"
                    ? "This student does not have any campus followers yet."
                    : "This student is not following any peers yet."}
              </p>
            </div>
          ) : (
            filtered.map((student) => {
              const isFollowing = followingIds.includes(student.id);
              const isPending = actionPendingId === student.id;
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
                  className="flex items-center justify-between p-3 border border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--line-strong,var(--line))] hover:bg-[var(--surface)] transition-all rounded-[1px]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {student.avatar_url &&
                    (student.avatar_url.startsWith("http") ||
                      student.avatar_url.startsWith("/media/") ||
                      student.avatar_url.startsWith("/")) ? (
                      <div className="w-9 h-9 rounded-[1px] bg-zinc-900 border border-[var(--line)] overflow-hidden flex-shrink-0 shadow-inner">
                        <img
                          src={student.avatar_url}
                          alt={student.full_name || student.handle}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                            e.currentTarget.parentElement!.innerText = initials;
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-[1px] bg-[var(--surface)] border border-[var(--line)] text-[var(--accent)] flex items-center justify-center font-mono text-xs font-bold flex-shrink-0 shadow-inner">
                        {initials}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-xs font-mono text-white truncate tracking-tight">
                          @{student.handle}
                        </strong>
                        <span className="text-[10px] text-[var(--accent)] font-mono font-bold">
                          {student.rating}
                        </span>
                      </div>

                      <p className="text-[11px] text-[var(--muted)] truncate font-sans mt-0.5">
                        {student.full_name || `@${student.handle}`}
                      </p>

                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] font-mono uppercase bg-[var(--surface)] border border-[var(--line)] text-[var(--muted)] px-1.5 py-0.2 rounded-[1px]">
                          {student.department} · {student.batch}
                        </span>
                        <TierBadge>{student.tier}</TierBadge>
                      </div>
                    </div>
                  </div>

                  {student.is_self ? (
                    <span className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase bg-[var(--surface)] text-[var(--muted)] border border-[var(--line)] rounded-[1px]">
                      You
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isPending}
                      onMouseEnter={() => setHoveredStudentId(student.id)}
                      onMouseLeave={() => setHoveredStudentId(null)}
                      onClick={() =>
                        dispatch(
                          toggleFollowThunk({
                            targetId: student.id,
                            targetHandle: student.handle,
                          }),
                        )
                      }
                      className={cn(
                        "font-mono text-[10px] font-bold uppercase px-3 py-1.5 border rounded-[1px] flex items-center gap-1.5 transition-all flex-shrink-0 cursor-pointer",
                        isFollowing
                          ? isHovered
                            ? "bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500/20"
                            : "bg-[var(--surface)] border-[var(--line)] text-[var(--muted)] hover:text-white"
                          : "bg-[var(--accent)]/10 border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-ink)] shadow-[0_0_10px_rgba(200,255,54,0.06)]",
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
                    </button>
                  )}
                </article>
              );
            })
          )}
        </div>

        {/* Footer */}
        <footer className="p-3 border-t border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur-md text-center">
          <p className="text-[9px] text-[var(--muted)] font-mono uppercase tracking-widest">
            AUTHENTICATED CAMPUS SOCIAL GRAPH • MEDI-CAPS CHAPTER
          </p>
        </footer>
      </aside>
    </div>
  );
}
