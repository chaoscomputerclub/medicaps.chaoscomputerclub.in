import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import LightRays from "./LightRays";

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

export function ContestsHubPage() {
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
  const [leaderboardScope, setLeaderboardScope] = useState<"campus" | "global">("campus");
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

  const upcomingWeekly = useMemo(() => upcomingContests[0] || null, [upcomingContests]);

  const weeklyCountdown = useCountdown(upcomingWeekly?.starts_at, () =>
    refreshHubData(true)
  );

  const liveContest = useMemo(
    () => contests.find((c) => c.status === "live") ?? null,
    [contests]
  );
  useCountdown(liveContest?.ends_at ?? null, () => refreshHubData(true));

  const formatCountdownPill = (cd: ReturnType<typeof useCountdown>) => {
    if (cd.isExpired) return "Live Now";
    const { days, hours, minutes, seconds } = cd;
    if (days > 0) {
      return `${days}d ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

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

  // Top 3 Podium
  const rank1 = leaders[0] || null;
  const rank2 = leaders[1] || null;
  const rank3 = leaders[2] || null;
  const otherRankers = leaders.slice(3, 10);

  if (isLoading && contests.length === 0) return <ContestsHubSkeleton />;

  return (
    <div className="relative min-h-screen text-zinc-100 pb-16">
      {/* ─── CONTEST ROOT PAGE BACKGROUND (LIGHT RAYS) ─── */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-8 flex justify-center overflow-hidden z-0"
        style={{ width: "100%", height: "600px", position: "absolute" }}
        aria-hidden="true"
      >
        <div style={{ width: "100%", height: "600px", position: "relative" }}>
          <LightRays
            raysOrigin="top-center"
            raysColor="#CBFF00"
            raysSpeed={0.5}
            lightSpread={0.8}
            rayLength={1.3}
            followMouse={true}
            mouseInfluence={0}
            noiseAmount={0.1}
            distortion={0.05}
            className="custom-rays"
          />
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 space-y-10">

        {/* ─── HERO SECTION ─────────────────────────────── */}
        <div className="flex flex-col items-center text-center space-y-3 pt-2 pb-4">
          <div className="relative">
            <img
              src="/trophy.png"
              alt="Medi-Caps Contest Trophy"
              className="w-24 h-28 sm:w-28 sm:h-32 object-contain filter drop-shadow-[0_12px_30px_rgba(203,255,0,0.22)] select-none pointer-events-none transition-transform hover:scale-105 duration-300"
            />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
              CCC Medi-Caps Contest
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 font-sans max-w-md mx-auto">
              Contest every week. Compete, solve algorithmic problems, and see your ranking!
            </p>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 bg-white/[0.03] border border-white/8 rounded-full px-3 py-1 mt-1">
              <Trophy className="size-3 text-lime-400" />
              <span>Official Medi-Caps Chapter Championship Trophy</span>
            </div>
          </div>

          {/* ─── UPCOMING CONTEST HERO CARDS ───────────── */}
          <div className="w-full pt-4 max-w-4xl mx-auto">
            {upcomingContests.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-zinc-950/70 backdrop-blur-xl p-8 text-center space-y-2">
                <Trophy className="size-8 text-zinc-600 mx-auto" />
                <p className="text-sm font-semibold text-white">No Upcoming Rounds Scheduled</p>
                <p className="text-xs text-zinc-500">
                  New official rounds will be announced shortly. Practice in the Problem Archive in the meantime.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-3 text-xs">
                  <Link to="/problems">Problem Archive</Link>
                </Button>
              </div>
            ) : (
              <div
                className={`grid gap-6 ${
                  upcomingContests.length > 1
                    ? "grid-cols-1 md:grid-cols-2"
                    : "grid-cols-1 max-w-lg mx-auto"
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
                      className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-zinc-950/80 backdrop-blur-xl overflow-hidden shadow-2xl transition-all duration-300 hover:border-lime-400/40 hover:shadow-[0_0_30px_rgba(203,255,0,0.06)]"
                    >
                      {/* Top Tactical Banner Area */}
                      <div className="relative h-44 w-full p-5 flex flex-col justify-between bg-gradient-to-br from-zinc-900 via-black to-zinc-950 overflow-hidden border-b border-white/8">
                        {/* Mesh grid backdrop */}
                        <div
                          className="absolute inset-0 opacity-20 pointer-events-none"
                          style={{
                            backgroundImage:
                              "radial-gradient(circle at 1px 1px, #CBFF00 1px, transparent 0)",
                            backgroundSize: "24px 24px",
                          }}
                        />

                        {/* Top Row: Type Pill & Live Countdown Badge */}
                        <div className="relative z-10 flex items-center justify-between w-full">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-lime-400">
                            {isLive ? (
                              <>
                                <span className="size-1.5 rounded-full bg-red-500 animate-ping" />
                                <span>LIVE NOW</span>
                              </>
                            ) : (
                              <>
                                <Flame className="size-3 text-lime-400" />
                                <span>RATED ROUND</span>
                              </>
                            )}
                          </span>

                          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/70 backdrop-blur-md px-3 py-1 text-xs font-mono font-semibold text-white tabular-nums shadow-sm">
                            <Clock className="size-3 text-lime-400" />
                            <span>{formatCountdownPill(weeklyCountdown)}</span>
                          </div>
                        </div>

                        {/* Center Visual Art / Typography */}
                        <div className="relative z-10 my-auto py-2">
                          <div className="flex items-center gap-3">
                            <div className="flex size-11 items-center justify-center rounded-xl border border-lime-400/30 bg-lime-400/10 text-lime-400 font-mono text-base font-bold shadow-inner">
                              #{contest.edition ?? idx + 1}
                            </div>
                            <div>
                              <div className="text-xl font-bold tracking-tight text-white group-hover:text-lime-400 transition-colors font-sans">
                                {contest.title}
                              </div>
                              <p className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5 mt-0.5">
                                <Users className="size-3 text-zinc-500" />
                                <span>{contest.registered_count} cadets registered</span>
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Banner bottom accent bar */}
                        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-lime-400/40 to-transparent" />
                      </div>

                      {/* Card Lower Info & Action Bar */}
                      <div className="p-4 sm:p-5 flex items-center justify-between gap-4 bg-black/40">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-400 truncate">
                            <Calendar className="size-3 text-zinc-500 shrink-0" />
                            <span className="truncate">{startsAtFormatted}</span>
                          </div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mt-0.5">
                            4 Algorithmic Challenges · 90 Mins
                          </span>
                        </div>

                        {/* Action CTA */}
                        <div className="shrink-0">
                          {isLive ? (
                            <Button
                              asChild
                              size="sm"
                              className="bg-lime-400 text-black hover:bg-lime-300 font-mono text-xs font-bold px-4 rounded-xl shadow-lg shadow-lime-400/20"
                            >
                              <Link to={`/contests/${contest.slug}/lobby`}>
                                <Play className="size-3.5 mr-1 fill-black" /> Enter Live
                              </Link>
                            </Button>
                          ) : isRegistered ? (
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-lime-400/30 bg-lime-400/10 font-mono text-xs font-semibold text-lime-400">
                                <Check className="size-3.5 stroke-[2.5]" /> Registered
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUnregister(contest.slug)}
                                disabled={registeringSlug === contest.slug}
                                title="Cancel registration"
                                className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                              >
                                {registeringSlug === contest.slug ? "..." : "Cancel"}
                              </button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleRegister(contest.slug)}
                              disabled={registeringSlug === contest.slug}
                              className="bg-lime-400 text-black hover:bg-lime-300 font-mono text-xs font-bold px-4 rounded-xl shadow-lg shadow-lime-400/20 active:scale-95 transition-all"
                            >
                              <Bell className="size-3.5 mr-1.5" />
                              {registeringSlug === contest.slug
                                ? "Registering..."
                                : "Register"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sub-hero note */}
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-zinc-500 mt-6">
              <Sparkles className="size-3.5 text-lime-400" />
              <span>Campus Competitive Programming Arena • Medi-Caps University Cadets</span>
            </div>
          </div>
        </div>

        {/* ─── TWO-COLUMN SPLIT SECTION (LEETCODE PHILOSOPHY) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* ─── LEFT COLUMN: UNIVERSITY LEADERBOARD CARD (5 COLS) ─ */}
          <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-zinc-950/70 backdrop-blur-xl p-5 sm:p-6 shadow-2xl space-y-6">
            {/* Header: Segmented Pill Toggle */}
            <div className="flex items-center justify-between border-b border-white/8 pb-4">
              <div className="flex items-center gap-2">
                <Trophy className="size-4 text-lime-400" />
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                  University Standings
                </h3>
              </div>

              {/* Segmented Campus / Global Toggle */}
              <div className="inline-flex rounded-full bg-black border border-white/10 p-0.5 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setLeaderboardScope("campus")}
                  className={`rounded-full px-3 py-0.5 transition-all ${
                    leaderboardScope === "campus"
                      ? "bg-lime-400 font-bold text-black shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  CAMPUS
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLeaderboardScope("global");
                    toast.info("Global Inter-University standings will open for national rounds.");
                  }}
                  className={`rounded-full px-3 py-0.5 transition-all ${
                    leaderboardScope === "global"
                      ? "bg-lime-400 font-bold text-black shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  GLOBAL
                </button>
              </div>
            </div>

            {/* ─── TOP 3 PODIUM DISPLAY ───────────────── */}
            <div className="grid grid-cols-3 gap-2 items-end pt-4 pb-2 border-b border-white/6">
              {/* Rank 2 (Left) */}
              <div className="flex flex-col items-center text-center space-y-1.5">
                <div className="relative">
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-sm">
                    🥈
                  </div>
                  <Avatar className="size-14 border-2 border-zinc-400/80 ring-2 ring-black">
                    <AvatarImage src={resolveAvatarUrl(rank2?.avatar_url)} />
                    <AvatarFallback className="bg-zinc-900 text-zinc-300 font-mono text-xs font-bold">
                      {rank2?.handle?.slice(0, 2).toUpperCase() || "02"}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="w-full px-1">
                  <p className="text-xs font-bold text-white truncate" title={rank2?.handle || "Cadet 2"}>
                    {rank2?.handle || "Cadet 2"}
                  </p>
                  <span className="inline-block mt-0.5 rounded bg-zinc-800/80 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-zinc-300">
                    {rank2?.rating ?? 1200}
                  </span>
                </div>
              </div>

              {/* Rank 1 (Center - Elevated with Crown & Lime Glow) */}
              <div className="flex flex-col items-center text-center space-y-1.5 -translate-y-2">
                <div className="relative">
                  <Crown className="size-5 text-amber-400 fill-amber-400 absolute -top-4 left-1/2 -translate-x-1/2 drop-shadow-[0_2px_8px_rgba(251,191,36,0.6)]" />
                  <Avatar className="size-18 border-2 border-lime-400 ring-4 ring-lime-400/20 shadow-[0_0_20px_rgba(203,255,0,0.3)]">
                    <AvatarImage src={resolveAvatarUrl(rank1?.avatar_url)} />
                    <AvatarFallback className="bg-black text-lime-400 font-mono text-sm font-bold">
                      {rank1?.handle?.slice(0, 2).toUpperCase() || "01"}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="w-full px-1">
                  <p className="text-xs font-bold text-white truncate font-sans" title={rank1?.handle || "Cadet 1"}>
                    {rank1?.handle || "Cadet 1"}
                  </p>
                  <span className="inline-block mt-0.5 rounded-full border border-lime-400/40 bg-lime-400/15 px-2.5 py-0.5 font-mono text-[11px] font-bold tabular-nums text-lime-400 shadow-sm">
                    {rank1?.rating ?? 1200}
                  </span>
                </div>
              </div>

              {/* Rank 3 (Right) */}
              <div className="flex flex-col items-center text-center space-y-1.5">
                <div className="relative">
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-sm">
                    🥉
                  </div>
                  <Avatar className="size-14 border-2 border-amber-600/70 ring-2 ring-black">
                    <AvatarImage src={resolveAvatarUrl(rank3?.avatar_url)} />
                    <AvatarFallback className="bg-zinc-900 text-amber-500 font-mono text-xs font-bold">
                      {rank3?.handle?.slice(0, 2).toUpperCase() || "03"}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="w-full px-1">
                  <p className="text-xs font-bold text-white truncate" title={rank3?.handle || "Cadet 3"}>
                    {rank3?.handle || "Cadet 3"}
                  </p>
                  <span className="inline-block mt-0.5 rounded bg-zinc-800/80 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-amber-400/90">
                    {rank3?.rating ?? 1200}
                  </span>
                </div>
              </div>
            </div>

            {/* ─── RANKS 4 TO 10 LIST ───────────────── */}
            <div className="divide-y divide-white/5 space-y-0.5">
              {otherRankers.length === 0 ? (
                <p className="py-4 text-center text-xs font-mono text-zinc-500">
                  Compete in weekly rounds to claim ranks 4–10.
                </p>
              ) : (
                otherRankers.map((leader, idx) => {
                  const rankNum = idx + 4;
                  return (
                    <div
                      key={leader.handle}
                      className="flex items-center justify-between py-2 px-2.5 rounded-xl hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 border border-white/10 font-mono text-[10px] font-bold text-zinc-400">
                          {rankNum}
                        </span>

                        <Avatar className="size-7 shrink-0 border border-white/10">
                          <AvatarImage src={resolveAvatarUrl(leader.avatar_url)} />
                          <AvatarFallback className="bg-black text-lime-400 font-mono text-[9px] font-bold">
                            {leader.handle.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-white">
                            {leader.handle}
                          </p>
                          <p className="truncate font-mono text-[10px] text-zinc-500">
                            {leader.department} · {leader.tier}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono text-xs font-bold tabular-nums text-white">
                          {leader.rating}
                        </span>
                        <span className="block font-mono text-[9px] text-zinc-500">
                          {leader.attendance_count ?? 0} rounds
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer: Show Full Leaderboard */}
            <div className="pt-2 text-center border-t border-white/6">
              <Link
                to="/leaderboard"
                className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-zinc-400 hover:text-lime-400 transition-colors"
              >
                <span>View Full University Leaderboard</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>

          {/* ─── RIGHT COLUMN: CONTESTS LIST CARD (7 COLS) ───── */}
          <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-zinc-950/70 backdrop-blur-xl p-5 sm:p-6 shadow-2xl space-y-5">
            {/* Header: Tabs & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/8 pb-4">
              {/* Segmented Tabs */}
              <div className="inline-flex rounded-xl bg-black border border-white/10 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setSearchParams({ tab: "past" });
                    setCurrentPage(1);
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                    activeTab === "past"
                      ? "bg-zinc-800 text-white shadow-sm border border-white/10"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Past Contests
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchParams({ tab: "my" });
                    setCurrentPage(1);
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                    activeTab === "my"
                      ? "bg-zinc-800 text-white shadow-sm border border-white/10"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  My Contests{" "}
                  {myParticipations.length > 0 && `(${myParticipations.length})`}
                </button>
              </div>

              {/* Search Filter */}
              <div className="relative w-full sm:w-56">
                <Search className="size-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Filter rounds..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 pl-8 pr-3 text-xs bg-black/70 border-white/10 focus-visible:ring-1 focus-visible:ring-lime-400 font-mono"
                />
              </div>
            </div>

            {/* Tab 1: Past Contests */}
            {activeTab === "past" && (
              <div className="space-y-2">
                {paginatedPastContests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-white/6 bg-black/30 space-y-3">
                    <div className="flex size-10 items-center justify-center rounded-lg border border-white/10 bg-zinc-900">
                      <Code2 className="size-5 text-zinc-500" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-white font-sans">
                        No Concluded Rounds Yet
                      </p>
                      <p className="text-[11px] font-mono text-zinc-500 max-w-xs">
                        Past weekly round challenges and editorial solutions will appear here for practice.
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="text-xs font-mono">
                      <Link to="/problems">Explore Problem Archive</Link>
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
                        className="group flex items-center justify-between gap-4 p-3.5 rounded-xl border border-white/6 bg-black/40 hover:bg-white/[0.03] hover:border-white/15 transition-all"
                      >
                        {/* Left: Thumbnail Icon Cube */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-zinc-800 to-zinc-950 font-mono text-xs font-bold text-lime-400 shadow-sm group-hover:border-lime-400/40 transition-colors">
                            <Trophy className="size-5 text-lime-400/80 group-hover:text-lime-400" />
                          </div>

                          <div className="min-w-0">
                            <Link
                              to={`/contests/${contest.slug}`}
                              className="text-xs sm:text-sm font-semibold text-white group-hover:text-lime-400 transition-colors truncate block font-sans"
                            >
                              {contest.title}
                            </Link>
                            <p className="text-[10px] font-mono text-zinc-500 mt-0.5 truncate">
                              {formattedDate} · {contest.registered_count} cadets
                            </p>
                          </div>
                        </div>

                        {/* Right: Solved Status & Virtual Action */}
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span
                            className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums border ${
                              cadetSolved !== null && cadetSolved > 0
                                ? "bg-lime-400/15 border-lime-400/30 text-lime-400"
                                : "bg-zinc-900 border-white/10 text-zinc-400"
                            }`}
                          >
                            {cadetSolved !== null ? `${cadetSolved}/4` : "0/4"}
                          </span>

                          <Button
                            asChild
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs font-mono font-semibold text-zinc-300 hover:text-white hover:bg-white/10 border border-white/10 rounded-lg px-3"
                          >
                            <Link to={`/contests/${contest.slug}`}>
                              Virtual
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Tab 2: My Contests */}
            {activeTab === "my" && (
              <div className="space-y-2">
                {!member ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-white/6 bg-black/30 space-y-2">
                    <p className="text-xs font-semibold text-white">Login Required</p>
                    <p className="text-[11px] font-mono text-zinc-500">
                      Sign in to view your contest participation history and ratings.
                    </p>
                    <Button asChild size="sm" className="bg-lime-400 text-black hover:bg-lime-300 font-mono text-xs">
                      <Link to="/auth">Sign In</Link>
                    </Button>
                  </div>
                ) : paginatedMyParticipations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-white/6 bg-black/30 space-y-2">
                    <p className="text-xs font-semibold text-white">No Participations Yet</p>
                    <p className="text-[11px] font-mono text-zinc-500">
                      You haven't participated in any contests yet. Register for Weekly Contest 1 above!
                    </p>
                  </div>
                ) : (
                  paginatedMyParticipations.map((record) => (
                    <div
                      key={record.contest_slug}
                      className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-white/6 bg-black/40 hover:bg-white/[0.03] transition-all"
                    >
                      <div className="min-w-0">
                        <Link
                          to={`/contests/${record.contest_slug}`}
                          className="text-xs sm:text-sm font-semibold text-white hover:text-lime-400 transition-colors truncate block"
                        >
                          {record.contest_title}
                        </Link>
                        <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                          Score: {record.score ?? 0} pts · Rank: #{record.rank ?? "--"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {record.outcome === "qualified" && (
                          <span className="rounded-full border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-lime-400">
                            Qualified
                          </span>
                        )}
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs font-mono text-zinc-300 hover:text-white border border-white/10 rounded-lg px-2.5"
                        >
                          <Link to={`/contests/${record.contest_slug}`}>
                            Results
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 pt-3 border-t border-white/6">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="size-7 p-0 text-zinc-400 hover:text-white disabled:opacity-30"
                >
                  <ChevronLeft className="size-4" />
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <Button
                    key={pg}
                    size="sm"
                    variant={pg === currentPage ? "default" : "ghost"}
                    onClick={() => setCurrentPage(pg)}
                    className={`size-7 p-0 text-xs font-mono font-bold rounded-lg ${
                      pg === currentPage
                        ? "bg-lime-400 text-black hover:bg-lime-300"
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
                  className="size-7 p-0 text-zinc-400 hover:text-white disabled:opacity-30"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ─── ABOUT THE CHAMPIONSHIP TROPHY ─────────────── */}
        <div className="rounded-2xl border border-white/8 bg-zinc-950/60 backdrop-blur-md p-6 text-center max-w-2xl mx-auto space-y-2 mt-8">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold text-lime-400 uppercase tracking-widest">
            <Trophy className="size-4" /> About the Medi-Caps Chapter Trophy
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed font-sans">
            The Chaos Computer Club Championship Trophy is awarded to the highest-ranking cadet at Medi-Caps University across rated competitive programming rounds. It recognizes campus leadership in algorithms, data structures, and speed.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ContestsHubPage;
