import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Trophy,
  Calendar,
  Clock,
  Users,
  ArrowRight,
  ExternalLink,
  Code2,
  Sparkles,
  Flame,
  Search,
  Bell,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crown,
  Medal,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContestsThunk, registerContestThunk, unregisterContestThunk } from "@/store/slices/contestSlice";
import { contestApi } from "@/features/contest/api";
import { invalidateSwrCache } from "@/lib/cache/swrCache";
import type { ContestSummary, ParticipationRecord } from "@/features/contest/types";
import { getUniversityLeaderboardData } from "@/organization/data/portal.functions";
import type { LeaderboardEntry } from "@/organization/data/types";
import { ContestsHubSkeleton } from "@/organization/components/skeletons";
import { useRealtimeEvents } from "@/lib/realtime";
import { toast } from "sonner";
import { resolveAvatarUrl } from "@/lib/utils";
import { CadetProfileHoverCard } from "@/components/ui/CadetProfileHoverCard";
import LightRays from "./LightRays";
import { Tabs, TabsList, TabsTab, TabsPanels, TabsPanel } from "@/components/ui/animated-tabs";

function useCountdown(
  targetIsoDate: string | null | undefined,
  onExpire?: () => void
) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
    totalSeconds: number;
  }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: true,
    totalSeconds: 0,
  });

  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    firedRef.current = false;
  }, [targetIsoDate]);

  useEffect(() => {
    if (!targetIsoDate) return;
    const calc = () => {
      const target = new Date(targetIsoDate).getTime();
      const now = Date.now();
      const diff = Math.max(0, target - now);
      const totalSeconds = Math.floor(diff / 1000);
      const expired = totalSeconds <= 0;
      setTimeLeft({
        days: Math.floor(totalSeconds / 86400),
        hours: Math.floor((totalSeconds % 86400) / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
        isExpired: expired,
        totalSeconds,
      });
      if (expired && !firedRef.current && onExpireRef.current) {
        firedRef.current = true;
        onExpireRef.current();
      }
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [targetIsoDate]);

  return timeLeft;
}

function ContestCountdownBadge({ targetIsoDate, isLive }: { targetIsoDate?: string | null; isLive?: boolean }) {
  const cd = useCountdown(targetIsoDate);
  if (isLive || cd.isExpired) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-xs font-mono font-semibold text-red-400 shadow-sm animate-pulse">
        <span className="size-1.5 rounded-full bg-red-500" />
        <span>LIVE NOW</span>
      </div>
    );
  }
  const { days, hours, minutes, seconds } = cd;
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/75 backdrop-blur-md px-3 py-1 text-xs font-mono font-semibold text-white tabular-nums shadow-sm transition-colors group-hover:border-lime-400/40">
      <Clock className="size-3 text-lime-400 transition-transform duration-300 group-hover:rotate-45" />
      <span>
        {days > 0 ? `${days}d ` : ""}
        {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </span>
    </div>
  );
}

export function ContestsHubPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { contests, isLoading } = useAppSelector((state) => state.contest);
  const member = useAppSelector((state) => state.auth.member);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as "past" | "my") || "past";
  const [searchQuery, setSearchQuery] = useState("");
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [myParticipations, setMyParticipations] = useState<ParticipationRecord[]>([]);
  const [isLoadingParticipations, setIsLoadingParticipations] = useState(false);
  const [registeringSlug, setRegisteringSlug] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 8;

  const refreshHubData = useCallback(
    (force = false) => {
      if (force) {
        invalidateSwrCache("contests:*");
        invalidateSwrCache("contest:*");
        invalidateSwrCache("passes:*");
      }
      dispatch(fetchContestsThunk(force));
      getUniversityLeaderboardData().then((res) => setLeaders(res || []));
      if (member) {
        contestApi
          .participated(force)
          .then((res: ParticipationRecord[]) => setMyParticipations(res || []))
          .catch(() => {});
      }
    },
    [dispatch, member]
  );

  useEffect(() => {
    dispatch(fetchContestsThunk(false));
    getUniversityLeaderboardData().then((res) => setLeaders(res || []));
    if (member) {
      if (myParticipations.length === 0) {
        setIsLoadingParticipations(true);
      }
      contestApi
        .participated(false)
        .then((res: ParticipationRecord[]) => setMyParticipations(res || []))
        .catch(() => {})
        .finally(() => setIsLoadingParticipations(false));
    }
  }, [dispatch, member]);

  const hasLiveContests = useMemo(
    () => contests.some((c) => c.status === "live"),
    [contests]
  );

  useRealtimeEvents(
    null,
    (event) => {
      if (
        event.event === "contest_status_changed" ||
        event.event === "top30_qualified" ||
        event.event === "pass_checked_in"
      ) {
        refreshHubData(true);
      }
    },
    undefined,
    hasLiveContests
  );

  useEffect(() => {
    const handleSync = () => {
      refreshHubData(true);
    };

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === "ccc:assessment_updated" ||
        e.key === "ccc_member" ||
        e.key?.startsWith("contests")
      ) {
        refreshHubData(true);
      }
    };

    window.addEventListener("focus", handleSync);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("assessment:status_changed" as any, handleSync);

    return () => {
      window.removeEventListener("focus", handleSync);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("assessment:status_changed" as any, handleSync);
    };
  }, [refreshHubData]);

  const upcomingContests = useMemo(
    () =>
      contests
        .filter((c) => c.status !== "finished")
        .sort(
          (a, b) =>
            new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
        ),
    [contests]
  );

  const pastContests = useMemo(
    () =>
      contests
        .filter((c) => c.status === "finished")
        .sort(
          (a, b) =>
            new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
        ),
    [contests]
  );

  const handleRegister = async (slug: string) => {
    if (!member) {
      toast.error("Please login to register.");
      return;
    }
    try {
      setRegisteringSlug(slug);
      await dispatch(registerContestThunk(slug)).unwrap();
      toast.success("Successfully registered for the contest!");
      refreshHubData(true);
    } catch (err: any) {
      toast.error(err || "Registration failed");
    } finally {
      setRegisteringSlug(null);
    }
  };

  const handleUnregister = async (slug: string) => {
    if (!member) {
      toast.error("Please login.");
      return;
    }
    try {
      setRegisteringSlug(slug);
      await dispatch(unregisterContestThunk(slug)).unwrap();
      toast.success("Successfully unregistered from the contest.");
      refreshHubData(true);
    } catch (err: any) {
      toast.error(err || "Failed to unregister");
    } finally {
      setRegisteringSlug(null);
    }
  };

  const filteredPastContests = useMemo(() => {
    return pastContests.filter((c) => {
      const matchesQuery =
        searchQuery === "" ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(c.edition ?? "").includes(searchQuery);
      return matchesQuery;
    });
  }, [pastContests, searchQuery]);

  const filteredMyParticipations = useMemo(() => {
    return myParticipations.filter((p) => {
      return (
        searchQuery === "" ||
        p.contest_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.contest_slug.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [myParticipations, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      (activeTab === "past"
        ? filteredPastContests.length
        : filteredMyParticipations.length) / itemsPerPage
    )
  );

  const paginatedPastContests = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredPastContests.slice(start, start + itemsPerPage);
  }, [filteredPastContests, currentPage]);

  const paginatedMyParticipations = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMyParticipations.slice(start, start + itemsPerPage);
  }, [filteredMyParticipations, currentPage]);

  // Top 3 Podium & Cadet Standing
  const rank1 = leaders[0] || null;
  const rank2 = leaders[1] || null;
  const rank3 = leaders[2] || null;
  const otherRankers = leaders.slice(3, 10);

  const myStanding = useMemo(() => {
    if (!member) return null;
    const idx = leaders.findIndex(
      (l) =>
        (member.handle && l.handle?.toLowerCase() === member.handle.toLowerCase()) ||
        (member.id && (l as any).id === member.id)
    );
    if (idx === -1) return null;
    return {
      rank: idx + 1,
      entry: leaders[idx],
    };
  }, [leaders, member]);

  if (isLoading && contests.length === 0) return <ContestsHubSkeleton />;

  return (
    <div className="relative min-h-screen text-zinc-100 pb-16">
      {/* ─── CONTEST ROOT PAGE BACKGROUND (LIGHT RAYS) ─── */}
      <div
        className="pointer-events-none absolute -top-4 md:-top-8 -left-4 md:-left-8 w-[calc(100%+2rem)] md:w-[calc(100%+4rem)] h-[520px] overflow-hidden z-0"
        style={{
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 35%, rgba(0,0,0,0) 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 35%, rgba(0,0,0,0) 100%)'
        }}
        aria-hidden="true"
      >
        <LightRays
          raysOrigin="top-center"
          raysColor="#CBFF00"
          raysSpeed={1.0}
          lightSpread={2.4}
          rayLength={1.1}
          followMouse={true}
          mouseInfluence={0}
          noiseAmount={0.08}
          distortion={0.04}
          className="custom-rays w-full h-full"
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 space-y-10">

        {/* ─── HERO SECTION ─────────────────────────────── */}
        <div className="flex flex-col items-center text-center space-y-3 pt-2 pb-2">
          {/* Interactive Floating Trophy */}
          <div className="relative group cursor-pointer">
            <div className="absolute -inset-4 rounded-full bg-lime-400/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <img
              src="/trophy.png"
              alt="Medi-Caps Contest Trophy"
              className="relative w-28 h-32 sm:w-32 sm:h-36 object-contain filter drop-shadow-[0_12px_30px_rgba(203,255,0,0.22)] select-none pointer-events-none transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1 group-hover:drop-shadow-[0_16px_36px_rgba(203,255,0,0.4)]"
            />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-sans">
              CCC Medi-Caps Contest
            </h1>
            <p className="text-sm sm:text-base text-zinc-400 font-sans max-w-lg mx-auto">
              Weekly competitive programming arena. Solve algorithmic challenges, elevate your rating, and claim the championship!
            </p>
            <div className="group inline-flex items-center gap-2 text-xs font-mono text-zinc-400 bg-white/[0.03] border border-white/8 hover:border-lime-400/30 rounded-full px-3.5 py-1.5 mt-1 transition-all duration-200">
              <Trophy className="size-3.5 text-lime-400 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12" />
              <span>Official Medi-Caps Chapter Championship Trophy</span>
            </div>
          </div>

          {/* ─── UPCOMING CONTEST HERO CARDS (LEETCODE STYLE - LARGER SIZE) ───────────── */}
          <div className="w-full pt-4 max-w-5xl mx-auto">
            {upcomingContests.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-zinc-950/80 backdrop-blur-xl p-10 text-center space-y-3 group hover:border-white/20 transition-all duration-200">
                <Trophy className="size-10 text-zinc-600 mx-auto transition-transform duration-300 group-hover:scale-110 group-hover:text-lime-400" />
                <p className="text-base font-semibold text-white">No Upcoming Rounds Scheduled</p>
                <p className="text-xs sm:text-sm text-zinc-500 max-w-md mx-auto">
                  New official rounds will be announced shortly. Practice in the Problem Archive in the meantime.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-3 text-xs sm:text-sm font-mono group/btn h-9 px-4">
                  <Link to="/problems" className="flex items-center gap-1.5">
                    <span>Problem Archive</span>
                    <ArrowRight className="size-3.5 transition-transform duration-200 group-hover/btn:translate-x-1" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div
                className={`grid gap-6 ${
                  upcomingContests.length > 1
                    ? "grid-cols-1 md:grid-cols-2"
                    : "grid-cols-1 max-w-xl mx-auto"
                }`}
              >
                {upcomingContests.map((contest, idx) => {
                  const isRegistered = Boolean(
                    contest.registered ||
                      myParticipations.some((p) => p.contest_slug === contest.slug)
                  );
                  const isLive = contest.status === "live";
                  const startsAtFormatted = new Date(contest.starts_at).toLocaleString(
                    "en-IN",
                    {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZoneName: "short",
                    }
                  );

                  return (
                    <div
                      key={contest.slug}
                      data-testid="hero-contest-card"
                      onClick={() => navigate(`/contests/${contest.slug}`)}
                      className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-zinc-950/90 backdrop-blur-xl overflow-hidden shadow-2xl transition-all duration-300 hover:border-lime-400/40 hover:shadow-[0_0_30px_rgba(203,255,0,0.08)] cursor-pointer"
                    >
                      {/* Top Tactical Banner Area - Larger Height & Spacious Padding */}
                      <div className="relative h-52 sm:h-56 w-full p-6 sm:p-7 flex flex-col justify-between bg-gradient-to-br from-zinc-900/90 via-black to-zinc-950 overflow-hidden border-b border-white/8">
                        {/* Mesh grid backdrop */}
                        <div
                          className="absolute inset-0 opacity-20 pointer-events-none"
                          style={{
                            backgroundImage:
                              "radial-gradient(circle at 1px 1px, #CBFF00 1px, transparent 0)",
                            backgroundSize: "24px 24px",
                          }}
                        />

                        {/* Top Row: Live Indicator & Countdown Badge */}
                        <div className={`relative z-10 flex items-center ${isLive ? "justify-between" : "justify-end"} w-full`}>
                          {isLive && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[11px] font-mono font-semibold uppercase tracking-wider text-red-400">
                              <span className="size-2 rounded-full bg-red-500 animate-ping" />
                              <span>LIVE NOW</span>
                            </span>
                          )}

                          <ContestCountdownBadge targetIsoDate={contest.starts_at} isLive={isLive} />
                        </div>

                        {/* Center Typography */}
                        <div className="relative z-10 my-auto py-2">
                          <div className="min-w-0">
                            <Link
                              to={`/contests/${contest.slug}`}
                              className="text-2xl sm:text-3xl font-bold tracking-tight text-white group-hover:text-lime-400 transition-colors font-sans flex items-center gap-2.5 truncate"
                            >
                              <span className="truncate">{contest.title}</span>
                              <ArrowRight className="size-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 text-lime-400 shrink-0" />
                            </Link>
                            <p className="text-xs font-mono text-zinc-400 flex items-center gap-2 mt-1.5">
                              <Users className="size-3.5 text-zinc-500 transition-transform duration-200 group-hover:scale-110 group-hover:text-zinc-300" />
                              <span>{contest.registered_count} cadets registered</span>
                              <span className="text-zinc-600">·</span>
                              <span className="text-lime-400/90 font-semibold">Medi-Caps Arena</span>
                            </p>
                          </div>
                        </div>

                        {/* Banner bottom accent bar */}
                        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-lime-400/40 to-transparent" />
                      </div>

                      {/* Card Lower Info & Action Bar - Spacious & Click-Friendly */}
                      <div className="p-5 sm:p-6 flex items-center justify-between gap-4 bg-black/60 border-t border-white/6">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 font-mono text-xs sm:text-sm text-zinc-400 truncate">
                            <Calendar className="size-4 text-zinc-500 shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:text-lime-400" />
                            <span className="truncate">{startsAtFormatted}</span>
                          </div>
                          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 block mt-1">
                            4 Algorithmic Challenges · 90 Mins · Live Gate
                          </span>
                        </div>

                        {/* Action CTA: Single Toggle Button (isolated from card click) */}
                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                          {isLive ? (
                            <Button
                              asChild
                              size="default"
                              className="bg-lime-400 text-black hover:bg-lime-300 font-mono text-xs sm:text-sm font-bold h-10 sm:h-11 px-5 rounded-xl shadow-lg shadow-lime-400/20 group/btn transition-all duration-200 active:scale-95"
                            >
                              <Link to={`/contests/${contest.slug}/lobby`} className="flex items-center gap-1.5">
                                <Play className="size-4 fill-black transition-transform duration-200 group-hover/btn:scale-125 group-hover/btn:translate-x-0.5" />
                                <span>Enter Live</span>
                              </Link>
                            </Button>
                          ) : isRegistered ? (
                            <Button
                              type="button"
                              size="default"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnregister(contest.slug);
                              }}
                              disabled={registeringSlug === contest.slug}
                              className="group/btn border-lime-400/30 bg-lime-400/10 text-lime-400 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400 font-mono text-xs sm:text-sm font-semibold h-10 sm:h-11 px-4 sm:px-5 rounded-xl transition-all cursor-pointer active:scale-95 shadow-sm"
                              title="Click to cancel registration"
                            >
                              {registeringSlug === contest.slug ? (
                                "Canceling..."
                              ) : (
                                <>
                                  <span className="flex items-center gap-1.5 group-hover/btn:hidden">
                                    <Check className="size-4 stroke-[2.5]" /> Registered
                                  </span>
                                  <span className="hidden items-center gap-1.5 group-hover/btn:flex text-red-400">
                                    <X className="size-4 stroke-[2.5]" /> Cancel
                                  </span>
                                </>
                              )}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="default"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRegister(contest.slug);
                              }}
                              disabled={registeringSlug === contest.slug}
                              className="bg-lime-400 text-black hover:bg-lime-300 font-mono text-xs sm:text-sm font-bold h-10 sm:h-11 px-5 rounded-xl shadow-lg shadow-lime-400/20 active:scale-95 transition-all group/btn cursor-pointer"
                            >
                              <Bell className="size-4 mr-1.5 transition-transform duration-200 group-hover/btn:rotate-12 group-hover/btn:scale-110" />
                              <span>{registeringSlug === contest.slug ? "Registering..." : "Register"}</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sub-hero note with animated sparkles */}
            <div className="group flex items-center justify-center gap-2 text-xs sm:text-sm font-mono text-zinc-500 mt-6 cursor-default">
              <Sparkles className="size-4 text-lime-400 transition-transform duration-300 group-hover:rotate-45 group-hover:scale-125" />
              <span className="group-hover:text-zinc-400 transition-colors">
                Campus Competitive Programming Arena • Medi-Caps University Cadets
              </span>
            </div>
          </div>
        </div>

        {/* ─── TWO-COLUMN SPLIT SECTION (LARGER BOXES & PADDING) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* ─── LEFT COLUMN: UNIVERSITY LEADERBOARD CARD (5 COLS - LARGER) ─ */}
          <div className="lg:col-span-5 rounded-3xl border border-white/10 bg-zinc-950/90 backdrop-blur-xl p-6 sm:p-7 shadow-2xl space-y-6">
            {/* Header */}
            <div className="flex items-center gap-2.5 border-b border-white/8 pb-4 cursor-default group">
              <Trophy className="size-5 text-lime-400 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12" />
              <h3 className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
                University Standings
              </h3>
            </div>

            {/* ─── CADET'S PERSONAL STANDING STRIP (LARGER BOX) ── */}
            {myStanding && myStanding.entry && (
              <div className="p-4 sm:p-5 rounded-2xl border border-lime-400/30 bg-lime-400/[0.04] flex items-center justify-between gap-3 group hover:border-lime-400/60 transition-all duration-200">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-400/15 border border-lime-400/40 font-mono text-base font-bold text-lime-400 shadow-sm">
                    #{myStanding.rank}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm sm:text-base font-semibold text-white truncate font-sans">
                      Your University Standing
                    </p>
                    <p className="font-mono text-xs sm:text-sm text-zinc-400 mt-0.5">
                      Rating: <span className="text-lime-400 font-bold tabular-nums">{myStanding.entry.rating}</span> · {myStanding.entry.tier || "Active"}
                    </p>
                  </div>
                </div>
                <CadetProfileHoverCard
                  handle={myStanding.entry.handle}
                  profile={myStanding.entry}
                  side="bottom"
                  align="end"
                >
                  <Link
                    to={myStanding.entry.handle ? `/profile/${myStanding.entry.handle}` : "/profile"}
                    className="inline-flex items-center gap-1.5 font-mono text-xs sm:text-sm font-semibold text-lime-400 hover:text-lime-300 shrink-0"
                  >
                    <span>Profile</span>
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </CadetProfileHoverCard>
              </div>
            )}

            {/* ─── TOP 3 PODIUM DISPLAY (FIXED OVERLAP & CIRCULAR AVATARS) ───────────────── */}
            <div className="grid grid-cols-3 gap-3 items-end pt-6 pb-4 border-b border-white/6">
              {/* Rank 2 (Left - Silver, Larger Box) */}
              {rank2 ? (
                <CadetProfileHoverCard
                  handle={rank2.handle}
                  profile={rank2}
                  side="bottom"
                  align="center"
                >
                  <Link
                    to={`/profile/${rank2.handle}`}
                    className="group relative flex flex-col items-center text-center p-3.5 sm:p-4 rounded-2xl border border-white/8 bg-black/40 hover:bg-white/[0.04] hover:border-zinc-400/40 hover:-translate-y-1.5 transition-all duration-300 min-h-[225px] sm:min-h-[245px] justify-between cursor-pointer"
                  >
                    <div className="relative pt-4 pb-2 flex flex-col items-center">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-400/60 shadow-lg font-mono text-[10px] font-bold text-zinc-200 transition-transform duration-300 group-hover:scale-110 whitespace-nowrap">
                        <Medal className="size-3 text-zinc-300 transition-transform duration-300 group-hover:rotate-12" />
                        <span>#2</span>
                      </div>
                      <Avatar className="size-16 sm:size-18 rounded-full border-2 border-zinc-400/80 ring-2 ring-black transition-transform duration-300 group-hover:scale-105 shadow-xl overflow-hidden">
                        <AvatarImage src={resolveAvatarUrl(rank2?.avatar_url)} className="rounded-full object-cover" />
                        <AvatarFallback className="rounded-full bg-zinc-900 text-zinc-300 font-mono text-sm font-bold">
                          {rank2?.handle?.slice(0, 2).toUpperCase() || "02"}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="w-full px-1 pt-2 flex flex-col items-center">
                      <p className="text-xs sm:text-sm font-bold text-white group-hover:text-zinc-200 transition-colors truncate font-sans max-w-full" title={rank2?.handle || "Cadet 2"}>
                        {rank2?.handle || "Cadet 2"}
                      </p>
                      <span className="inline-block mt-1.5 rounded-lg bg-zinc-800/90 border border-white/10 px-2.5 py-0.5 font-mono text-[11px] font-bold tabular-nums text-zinc-300 group-hover:border-zinc-400/40 transition-colors">
                        {rank2?.rating ?? 1200}
                      </span>
                      <span className="block font-mono text-[10px] text-zinc-500 mt-1">
                        {rank2?.attendance_count ?? 0} rounds
                      </span>
                    </div>
                  </Link>
                </CadetProfileHoverCard>
              ) : (
                <div className="flex flex-col items-center justify-center p-4 rounded-2xl border border-white/5 bg-black/20 min-h-[225px] opacity-40">
                  <span className="font-mono text-xs text-zinc-600">Rank #2</span>
                </div>
              )}

              {/* Rank 1 (Center - Elevated Champion, Proper Z-Index & Breathing Room) */}
              {rank1 ? (
                <CadetProfileHoverCard
                  handle={rank1.handle}
                  profile={rank1}
                  side="bottom"
                  align="center"
                >
                  <Link
                    to={`/profile/${rank1.handle}`}
                    className="group relative flex flex-col items-center text-center p-3.5 sm:p-5 -mt-5 rounded-2xl border border-lime-400/40 bg-lime-400/[0.04] hover:bg-lime-400/[0.08] hover:border-lime-400/70 hover:-translate-y-2 transition-all duration-300 shadow-[0_0_30px_rgba(203,255,0,0.12)] min-h-[245px] sm:min-h-[270px] justify-between cursor-pointer"
                  >
                    <div className="relative pt-6 pb-3 flex flex-col items-center">
                      <Crown className="size-6 text-amber-400 fill-amber-400 absolute top-0 left-1/2 -translate-x-1/2 drop-shadow-[0_2px_10px_rgba(251,191,36,0.6)] transition-transform duration-300 group-hover:scale-125 group-hover:-translate-y-1 z-20" />
                      <Avatar className="size-18 sm:size-22 rounded-full border-2 border-lime-400 ring-4 ring-lime-400/25 shadow-[0_0_30px_rgba(203,255,0,0.35)] transition-transform duration-300 group-hover:scale-105 overflow-hidden">
                        <AvatarImage src={resolveAvatarUrl(rank1?.avatar_url)} className="rounded-full object-cover" />
                        <AvatarFallback className="rounded-full bg-black text-lime-400 font-mono text-base font-bold">
                          {rank1?.handle?.slice(0, 2).toUpperCase() || "01"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center px-2.5 py-0.5 rounded-full bg-lime-400 text-black font-mono text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider shadow-md transition-transform duration-300 group-hover:scale-110 whitespace-nowrap">
                        #1 CHAMPION
                      </div>
                    </div>
                    <div className="w-full px-1 pt-4 flex flex-col items-center">
                      <p className="text-xs sm:text-sm font-bold text-white group-hover:text-lime-400 transition-colors truncate font-sans max-w-full" title={rank1?.handle || "Cadet 1"}>
                        {rank1?.handle || "Cadet 1"}
                      </p>
                      <span className="inline-block mt-1.5 rounded-full border border-lime-400/50 bg-lime-400/15 px-3 py-0.5 font-mono text-xs font-bold tabular-nums text-lime-400 shadow-sm group-hover:bg-lime-400/25 transition-colors">
                        {rank1?.rating ?? 1200}
                      </span>
                      <span className="block font-mono text-[10px] text-lime-400/80 mt-1">
                        {rank1?.attendance_count ?? 0} rounds
                      </span>
                    </div>
                  </Link>
                </CadetProfileHoverCard>
              ) : (
                <div className="flex flex-col items-center justify-center p-4 rounded-2xl border border-white/5 bg-black/20 min-h-[245px] opacity-40">
                  <span className="font-mono text-xs text-zinc-600">Rank #1</span>
                </div>
              )}

              {/* Rank 3 (Right - Bronze, Larger Box) */}
              {rank3 ? (
                <CadetProfileHoverCard
                  handle={rank3.handle}
                  profile={rank3}
                  side="bottom"
                  align="center"
                >
                  <Link
                    to={`/profile/${rank3.handle}`}
                    className="group relative flex flex-col items-center text-center p-3.5 sm:p-4 rounded-2xl border border-white/8 bg-black/40 hover:bg-white/[0.04] hover:border-amber-600/40 hover:-translate-y-1.5 transition-all duration-300 min-h-[225px] sm:min-h-[245px] justify-between cursor-pointer"
                  >
                    <div className="relative pt-4 pb-2 flex flex-col items-center">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950 border border-amber-600/60 shadow-lg font-mono text-[10px] font-bold text-amber-400 transition-transform duration-300 group-hover:scale-110 whitespace-nowrap">
                        <Medal className="size-3 text-amber-500 transition-transform duration-300 group-hover:rotate-12" />
                        <span>#3</span>
                      </div>
                      <Avatar className="size-14 sm:size-16 rounded-full border-2 border-amber-600/80 ring-2 ring-black transition-transform duration-300 group-hover:scale-105 shadow-xl overflow-hidden">
                        <AvatarImage src={resolveAvatarUrl(rank3?.avatar_url)} className="rounded-full object-cover" />
                        <AvatarFallback className="rounded-full bg-zinc-900 text-amber-500 font-mono text-sm font-bold">
                          {rank3?.handle?.slice(0, 2).toUpperCase() || "03"}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="w-full px-1 pt-2 flex flex-col items-center">
                      <p className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-400 transition-colors truncate font-sans max-w-full" title={rank3?.handle || "Cadet 3"}>
                        {rank3?.handle || "Cadet 3"}
                      </p>
                      <span className="inline-block mt-1.5 rounded-lg bg-zinc-800/90 border border-white/10 px-2.5 py-0.5 font-mono text-[11px] font-bold tabular-nums text-amber-400/90 group-hover:border-amber-600/40 transition-colors">
                        {rank3?.rating ?? 1200}
                      </span>
                      <span className="block font-mono text-[10px] text-zinc-500 mt-1">
                        {rank3?.attendance_count ?? 0} rounds
                      </span>
                    </div>
                  </Link>
                </CadetProfileHoverCard>
              ) : (
                <div className="flex flex-col items-center justify-center p-4 rounded-2xl border border-white/5 bg-black/20 min-h-[225px] opacity-40">
                  <span className="font-mono text-xs text-zinc-600">Rank #3</span>
                </div>
              )}
            </div>

            {/* ─── RANKS 4 TO 10 LIST (LARGER ROWS & AVATARS) ───────────────── */}
            <div className="divide-y divide-white/5 space-y-1">
              {otherRankers.length === 0 ? (
                <p className="py-6 text-center text-xs sm:text-sm font-mono text-zinc-500">
                  Compete in weekly rounds to claim ranks 4–10.
                </p>
              ) : (
                otherRankers.map((leader, idx) => {
                  const rankNum = idx + 4;
                  return (
                    <CadetProfileHoverCard
                      key={leader.handle}
                      handle={leader.handle}
                      profile={leader}
                      side="top"
                      align="start"
                    >
                      <Link
                        to={`/profile/${leader.handle}`}
                        className="group flex items-center justify-between py-3.5 px-4 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/[0.04] transition-all duration-200 min-h-[64px] cursor-pointer"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 border border-white/10 font-mono text-xs sm:text-sm font-bold text-zinc-400 tabular-nums transition-all duration-200 group-hover:border-lime-400/40 group-hover:text-lime-400">
                            {String(rankNum).padStart(2, "0")}
                          </span>

                          <Avatar className="size-10 sm:size-11 shrink-0 rounded-full border border-white/10 transition-transform duration-200 group-hover:scale-105 overflow-hidden">
                            <AvatarImage src={resolveAvatarUrl(leader.avatar_url)} className="rounded-full object-cover" />
                            <AvatarFallback className="rounded-full bg-black text-lime-400 font-mono text-xs font-bold">
                              {leader.handle.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          <div className="min-w-0">
                            <p className="truncate text-xs sm:text-sm font-semibold text-white group-hover:text-lime-400 transition-colors font-sans">
                              {leader.handle}
                            </p>
                            <p className="truncate font-mono text-[11px] sm:text-xs text-zinc-500 mt-0.5">
                              {leader.department || "Medi-Caps"} · <span className="text-zinc-400">{leader.tier || "Active"}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="font-mono text-xs sm:text-sm font-bold tabular-nums text-white group-hover:text-lime-400 transition-colors">
                              {leader.rating}
                            </span>
                            <span className="block font-mono text-[10px] sm:text-[11px] text-zinc-500">
                              {leader.attendance_count ?? 0} rounds
                            </span>
                          </div>
                          <ChevronRight className="size-4 text-zinc-600 transition-transform duration-200 group-hover:text-lime-400 group-hover:translate-x-1" />
                        </div>
                      </Link>
                    </CadetProfileHoverCard>
                  );
                })
              )}
            </div>

            {/* Footer: Show Full Leaderboard */}
            <div className="pt-3 text-center border-t border-white/6">
              <Link
                to="/leaderboard"
                className="group inline-flex items-center gap-1.5 font-mono text-xs sm:text-sm font-semibold text-zinc-400 hover:text-lime-400 transition-colors"
              >
                <span>View Full University Leaderboard</span>
                <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1.5" />
              </Link>
            </div>
          </div>

          {/* ─── RIGHT COLUMN: CONTESTS LIST CARD (7 COLS - LARGER BOXES) ───── */}
          <div className="lg:col-span-7 rounded-3xl border border-white/10 bg-zinc-950/90 backdrop-blur-xl p-6 sm:p-7 shadow-2xl space-y-6">
            {/* Header: Animated Tabs & Search */}
            <Tabs
              value={activeTab}
              onValueChange={(v) => {
                setSearchParams({ tab: v });
                setCurrentPage(1);
              }}
              className="gap-0"
            >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/8 pb-4">
              <TabsList>
                <TabsTab value="past" id="tab-past-contests">Past Contests</TabsTab>
                <TabsTab value="my" id="tab-my-contests">
                  My Contests{myParticipations.length > 0 && ` (${myParticipations.length})`}
                </TabsTab>
              </TabsList>

              {/* Search Filter */}
              <div className="relative w-full sm:w-64 group">
                <Search className="size-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-200 group-hover:text-lime-400" />
                <Input
                  type="text"
                  placeholder="Filter rounds..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-10 pl-9 pr-3 text-xs sm:text-sm bg-black/70 border-white/10 focus-visible:ring-1 focus-visible:ring-lime-400 font-mono rounded-xl"
                />
              </div>
            </div>

            <TabsPanels className="pt-4">
              {/* Panel 1: Past Contests */}
              <TabsPanel value="past">
              <div className="space-y-3.5">
                {paginatedPastContests.length === 0 ? (
                  <div className="group flex flex-col items-center justify-center py-14 text-center rounded-2xl border border-white/6 bg-black/30 space-y-3.5 hover:border-white/15 transition-all">
                    <div className="flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-zinc-900 transition-transform duration-300 group-hover:scale-110">
                      <Code2 className="size-7 text-zinc-500 group-hover:text-lime-400 transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-white font-sans">
                        No Concluded Rounds Yet
                      </p>
                      <p className="text-xs sm:text-sm font-mono text-zinc-500 max-w-sm">
                        Past weekly round challenges and editorial solutions will appear here for practice.
                      </p>
                    </div>
                    <Button asChild size="default" variant="outline" className="text-xs sm:text-sm font-mono group/btn h-10 px-5 rounded-xl">
                      <Link to="/problems" className="flex items-center gap-1.5">
                        <span>Explore Problem Archive</span>
                        <ArrowRight className="size-4 transition-transform duration-200 group-hover/btn:translate-x-1" />
                      </Link>
                    </Button>
                  </div>
                ) : (
                  paginatedPastContests.map((contest) => {
                    const formattedDate = new Date(contest.starts_at).toLocaleString("en-IN", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    // Check if cadet participated
                    const record = myParticipations.find((p) => p.contest_slug === contest.slug);
                    const cadetSolved = record?.score !== null && record?.score !== undefined ? Math.round(Number(record.score) / 25) : null;

                    return (
                      <div
                        key={contest.slug}
                        className="group flex items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl border border-white/8 bg-black/50 hover:bg-white/[0.03] hover:border-lime-400/30 transition-all duration-200 min-h-[92px]"
                      >
                        {/* Left: Thumbnail Icon Cube with animated SVG - Larger Cube */}
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="flex size-14 sm:size-15 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-800 to-zinc-950 font-mono text-sm font-bold text-lime-400 shadow-sm transition-all duration-200 group-hover:scale-105 group-hover:border-lime-400/40">
                            <Trophy className="size-6 text-lime-400/80 group-hover:text-lime-400 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-6" />
                          </div>

                          <div className="min-w-0">
                            <Link
                              to={`/contests/${contest.slug}`}
                              className="text-base sm:text-lg font-bold text-white group-hover:text-lime-400 transition-colors truncate flex items-center gap-2 font-sans"
                            >
                              <span className="truncate">{contest.title}</span>
                              <ArrowRight className="size-4 opacity-0 -translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 text-lime-400 shrink-0" />
                            </Link>
                            <p className="text-xs sm:text-sm font-mono text-zinc-500 mt-1 truncate">
                              {formattedDate} · {contest.registered_count} cadets
                            </p>
                          </div>
                        </div>

                        {/* Right: Solved Status & Virtual Action */}
                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`rounded-full px-3.5 py-1.5 font-mono text-xs sm:text-sm font-semibold tabular-nums border ${
                              cadetSolved !== null && cadetSolved > 0
                                ? "bg-lime-400/15 border-lime-400/30 text-lime-400"
                                : "bg-zinc-900 border-white/10 text-zinc-400"
                            }`}
                          >
                            {cadetSolved !== null ? `${cadetSolved}/4 Solved` : "4 Problems"}
                          </span>

                          <Button
                            asChild
                            size="sm"
                            variant="ghost"
                            className="h-9 sm:h-10 text-xs sm:text-sm font-mono font-semibold text-zinc-300 hover:text-black hover:bg-lime-400 border border-white/10 hover:border-lime-400 rounded-xl px-4 transition-all duration-200 group-hover:shadow-sm"
                          >
                            <Link to={`/contests/${contest.slug}`} className="flex items-center gap-1.5">
                              <Play className="size-3.5 fill-current transition-transform duration-200 group-hover:scale-110" />
                              <span>Virtual</span>
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              </TabsPanel>

              {/* Panel 2: My Contests */}
              <TabsPanel value="my">
              <div className="space-y-3.5">
                {!member ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center rounded-2xl border border-white/6 bg-black/30 space-y-3.5">
                    <p className="text-base font-semibold text-white">Login Required</p>
                    <p className="text-xs sm:text-sm font-mono text-zinc-500 max-w-sm">
                      Sign in to view your contest participation history and ratings.
                    </p>
                    <Button asChild size="default" className="bg-lime-400 text-black hover:bg-lime-300 font-mono text-xs sm:text-sm rounded-xl group/btn h-10 px-5">
                      <Link to="/auth" className="flex items-center gap-1.5">
                        <span>Sign In</span>
                        <ArrowRight className="size-3.5 transition-transform duration-200 group-hover/btn:translate-x-1" />
                      </Link>
                    </Button>
                  </div>
                ) : paginatedMyParticipations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center rounded-2xl border border-white/6 bg-black/30 space-y-3.5">
                    <p className="text-base font-semibold text-white">No Participations Yet</p>
                    <p className="text-xs sm:text-sm font-mono text-zinc-500 max-w-sm">
                      You haven't participated in any contests yet. Register for Weekly Contest 1 above!
                    </p>
                  </div>
                ) : (
                  paginatedMyParticipations.map((record) => (
                    <div
                      key={record.contest_slug}
                      className="group flex items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl border border-white/8 bg-black/50 hover:bg-white/[0.03] hover:border-lime-400/30 transition-all duration-200 min-h-[92px]"
                    >
                      <div className="min-w-0">
                        <Link
                          to={`/contests/${record.contest_slug}`}
                          className="text-base sm:text-lg font-bold text-white hover:text-lime-400 transition-colors truncate flex items-center gap-2 font-sans"
                        >
                          <span className="truncate">{record.contest_title}</span>
                          <ArrowRight className="size-4 opacity-0 -translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 text-lime-400 shrink-0" />
                        </Link>
                        <p className="text-xs sm:text-sm font-mono text-zinc-500 mt-1">
                          Score: {record.score ?? 0} pts · Rank: #{record.rank ?? "--"}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {record.outcome === "qualified" && (
                          <span className="rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 font-mono text-xs font-bold uppercase text-lime-400">
                            Qualified
                          </span>
                        )}
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="h-9 sm:h-10 text-xs sm:text-sm font-mono text-zinc-300 hover:text-white hover:bg-white/10 border border-white/10 rounded-xl px-4 transition-all"
                        >
                          <Link to={`/contests/${record.contest_slug}`} className="flex items-center gap-1.5">
                            <span>Results</span>
                            <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              </TabsPanel>
            </TabsPanels>
            </Tabs>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4 border-t border-white/6">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="group size-8 p-0 text-zinc-400 hover:text-white disabled:opacity-30 rounded-xl"
                >
                  <ChevronLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <Button
                    key={pg}
                    size="sm"
                    variant={pg === currentPage ? "default" : "ghost"}
                    onClick={() => setCurrentPage(pg)}
                    className={`size-8 p-0 text-xs sm:text-sm font-mono font-bold rounded-xl transition-all ${
                      pg === currentPage
                        ? "bg-lime-400 text-black hover:bg-lime-300 shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {pg}
                  </Button>
                ))}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="group size-8 p-0 text-zinc-400 hover:text-white disabled:opacity-30 rounded-xl"
                >
                  <ChevronRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ─── ABOUT THE CHAMPIONSHIP TROPHY ─────────────── */}
        <div className="group rounded-2xl border border-white/8 bg-zinc-950/60 backdrop-blur-md p-7 sm:p-8 text-center max-w-3xl mx-auto space-y-2.5 mt-8 hover:border-white/15 transition-all duration-200">
          <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-mono font-bold text-lime-400 uppercase tracking-widest">
            <Trophy className="size-4 sm:size-5 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12" />
            <span>About the Medi-Caps Chapter Trophy</span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-sans max-w-2xl mx-auto">
            The Chaos Computer Club Championship Trophy is awarded to the highest-ranking cadet at Medi-Caps University across rated competitive programming rounds. It recognizes campus leadership in algorithms, data structures, and speed.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ContestsHubPage;
