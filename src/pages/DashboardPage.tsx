import { DashboardSkeleton } from "@/organization/components/skeletons";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useCallback } from "react";
import { ArrowRight, MapPin, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RatingChart } from "@/organization/components/RatingChart";
import { ScoreboardMatrix } from "@/organization/components/ScoreboardMatrix";
import {
  SectionHeader,
  StatusDot,
  formatContestDate,
} from "@/organization/components/ui";
import { type FullProfilePayload } from "@/organization/data/queries";
import { getPublicPortalData, getMemberProfileData } from "@/organization/data/portal.functions";
import { ContestActivityFeed } from "@/features/contest/feed";
import { isAuthenticated } from "@/lib/auth";
import { useSwrData, globalSwrStore } from "@/lib/cache/swrCache";
import { markNavigationMount, markNavigationContentReady } from "@/lib/navigationTelemetry";
import { useRealtimeEvents } from "@/lib/realtime";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContestsThunk } from "@/store/slices/contestSlice";
import { syncSocialCounts } from "@/store/slices/socialSlice";
import type { ContestSummary } from "@/features/contest/types";
import { getFirstName } from "@/lib/utils";
import type { OfflineContest, AnnouncementFeedItem } from "@/organization/data/types";

export function DashboardPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const currentMember = useAppSelector((s) => s.auth.member);

  const { contests: rawContests, isLoading: contestsLoading } = useAppSelector((state) => state.contest);
  const cachedContests = (globalSwrStore.get<any>("contests:list")?.data ?? []) as ContestSummary[];
  const contests = rawContests && rawContests.length > 0 ? rawContests : cachedContests;

  const authed = isAuthenticated();
  const { data: profile, loading: profileLoading, revalidate: revalidateProfile } = useSwrData<FullProfilePayload | null>(
    authed ? "member:profile:full" : null,
    () => getMemberProfileData(false) as Promise<FullProfilePayload>,
    { ttl: 5 * 60 * 1000, staleTime: 30 * 1000, enabled: authed }
  );

  const { data: publicDataRaw, loading: publicLoading, revalidate: revalidatePublic } = useSwrData<{
    contests: OfflineContest[];
    announcements: AnnouncementFeedItem[];
    standings: any[];
    problems: any[];
  }>(
    "portal:public_data",
    () => getPublicPortalData(false),
    { ttl: 5 * 60 * 1000, staleTime: 30 * 1000 }
  );

  useEffect(() => {
    markNavigationMount("/", profile ? "hit" : "miss");
    markNavigationContentReady("/");
  }, []);

  useEffect(() => {
    dispatch(fetchContestsThunk(false));
  }, [dispatch]);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      revalidateProfile();
      revalidatePublic();
      dispatch(fetchContestsThunk(true));
    }, 500);
  }, [dispatch, revalidateProfile, revalidatePublic]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  useRealtimeEvents(
    null,
    (event) => {
      if (
        event.event === "contest_concluded" ||
        event.event === "contest_status_changed" ||
        event.event === "contest_finished" ||
        event.event === "contest_created" ||
        event.event === "contest_updated" ||
        event.event === "top30_qualified" ||
        event.event === "assessment_finished"
      ) {
        handleRefresh();
      }
    }
  );

  useEffect(() => {
    const handleConcluded = () => {
      handleRefresh();
    };
    window.addEventListener("contest:concluded", handleConcluded);
    window.addEventListener("contest:cache_invalidated", handleConcluded);
    window.addEventListener("contest:status_changed", handleConcluded);
    return () => {
      window.removeEventListener("contest:concluded", handleConcluded);
      window.removeEventListener("contest:cache_invalidated", handleConcluded);
      window.removeEventListener("contest:status_changed", handleConcluded);
    };
  }, [handleRefresh]);

  const publicData = publicDataRaw || { contests: [], announcements: [], standings: [], problems: [] };

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/auth");
    }
  }, [navigate]);

  useEffect(() => {
    if (profile) {
      const p = profile as any;
      const fc = p?.member?.followers_count ?? p?.stats?.followers_count;
      const fgc = p?.member?.following_count ?? p?.stats?.following_count;
      if (typeof fc === "number" || typeof fgc === "number") {
        dispatch(
          syncSocialCounts({
            ...(typeof fc === "number" ? { followersCount: fc } : {}),
            ...(typeof fgc === "number" ? { followingCount: fgc } : {}),
          })
        );
      }
    }
  }, [dispatch, profile]);

  if (
    (profileLoading || publicLoading || (contestsLoading && contests.length === 0)) &&
    !profile &&
    !publicDataRaw &&
    contests.length === 0
  ) {
    return <DashboardSkeleton />;
  }

  const member = {
    ...(profile?.member || {}),
    ...(currentMember ? {
      full_name: currentMember.full_name || profile?.member?.full_name,
      handle: currentMember.handle || profile?.member?.handle,
      rating: currentMember.rating ?? profile?.member?.rating,
      department: currentMember.department || profile?.member?.department,
      tier: (profile?.member as any)?.tier,
      followers_count: (profile?.member as any)?.followers_count ?? currentMember.followers_count,
      following_count: (profile?.member as any)?.following_count ?? currentMember.following_count,
    } : {}),
  };
  const history = profile?.ratingHistory || [];
  const live = contests.find((c) => c.status === "live");
  const next = contests
    .filter((c) => c.status === "upcoming")
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];
  const greetingName = getFirstName(member?.full_name, member?.handle);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 min-w-0 overflow-x-hidden">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-white/8 pb-4 sm:pb-5 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-lime-400">
              (01 // Command Center)
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-semibold text-white font-sans tracking-tight truncate">
            Dashboard
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5 truncate">
            Welcome back, {greetingName}. Medi-Caps competitive programming arena.
          </p>
        </div>
      </div>

      {/* Telemetry Bento Strip (4 Columns) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 min-w-0">
        <div className="p-4 rounded-lg border border-white/8 bg-black shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.04)] hover:border-white/18 transition-colors duration-150 min-w-0 overflow-hidden">
          <span className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider truncate">Campus Standings</span>
          <strong className="block text-xl sm:text-2xl font-mono font-bold text-white mt-1 tabular-nums truncate">
            {member?.is_ranked && member?.university_rank ? `#${member.university_rank}` : "Unranked"}
          </strong>
          <span className="block text-[10px] font-mono text-zinc-500 mt-1 truncate">
            {member?.is_ranked && member?.standing ? `${member.standing} · Medi-Caps` : "Attend 1 contest to rank"}
          </span>
        </div>

        <div className="p-4 rounded-lg border border-white/8 bg-black shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.04)] hover:border-white/18 transition-colors duration-150 min-w-0 overflow-hidden">
          <span className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider truncate">Global Rating</span>
          <strong className="block text-xl sm:text-2xl font-mono font-bold text-lime-400 mt-1 tabular-nums truncate">
            {member?.rating ?? 1200}
          </strong>
          <span className="block text-[10px] font-mono text-lime-400/80 mt-1 truncate">{member?.tier || "1★ Explorer"}</span>
        </div>

        <div className="p-4 rounded-lg border border-white/8 bg-black shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.04)] hover:border-white/18 transition-colors duration-150 min-w-0 overflow-hidden">
          <span className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider truncate">Contests Logged</span>
          <strong className="block text-xl sm:text-2xl font-mono font-bold text-white mt-1 tabular-nums truncate">
            {member?.attendance_count ?? 0}
          </strong>
          <span className="block text-[10px] font-mono text-zinc-500 mt-1 truncate">
            {(member?.attendance_count ?? 0) === 1 ? "1 Verified Tournament" : `${member?.attendance_count ?? 0} Verified Tournaments`}
          </span>
        </div>

        <div className="p-4 rounded-lg border border-white/8 bg-black shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.04)] hover:border-white/18 transition-colors duration-150 min-w-0 overflow-hidden">
          <span className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider truncate">Accepted Solutions</span>
          <strong className="block text-xl sm:text-2xl font-mono font-bold text-white mt-1 tabular-nums truncate">
            {(member as any)?.solved_count || 0}
          </strong>
          <span className="block text-[10px] font-mono text-zinc-500 mt-1 truncate">Problem Archive</span>
        </div>
      </div>

      {/* Live Contest Banner or Next Contest Alert */}
      {live ? (
        <section className="rounded-lg border border-lime-400/40 bg-black p-4 sm:p-6 relative overflow-hidden min-w-0 shadow-[0_4px_20px_rgba(204,255,0,0.08),0_0_0_1px_rgba(204,255,0,0.2)]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 min-w-0">
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <StatusDot status="live" />
                <span className="font-mono text-xs text-lime-400 uppercase tracking-wider">Tournament Live</span>
              </div>
              <h2 className="text-xl md:text-2xl font-semibold text-white font-sans break-words">{live.title}</h2>
              <p className="text-xs text-zinc-400 max-w-2xl leading-normal break-words">{live.summary}</p>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono text-zinc-500 pt-1">
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <MapPin className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                  <span className="truncate">{live.venue}</span>
                </span>
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">Division {live.division || "Open"}</span>
                </span>
                <span className="text-zinc-500">
                  {live.problem_count}&nbsp;Problems · {live.registered_count}&nbsp;Registered
                </span>
              </div>
            </div>
            <div className="shrink-0 w-full sm:w-auto">
              <Button asChild variant="outline" className="w-full sm:w-auto justify-center group/btn active:scale-[0.98]">
                <Link to={`/contests/${live.slug}`}>
                  <span>Enter Live Arena</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform duration-150 group-hover/btn:translate-x-0.5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      ) : next ? (
        <section className="rounded-lg border border-white/8 bg-black p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-5 min-w-0 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.04)]">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <StatusDot status="upcoming" />
              <span className="font-mono text-xs text-zinc-400 uppercase tracking-wider">Next Campus Tournament</span>
            </div>
            <h2 className="text-lg md:text-xl font-semibold text-white font-sans break-words">{next.title}</h2>
            <p className="text-xs text-zinc-400 max-w-xl break-words">{next.summary}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 font-mono text-xs shrink-0 w-full md:w-auto justify-between md:justify-end">
            <div>
              <span className="block text-[10px] text-zinc-500 uppercase tracking-wider">Scheduled Start</span>
              <strong className="block text-zinc-200 text-xs mt-0.5 tabular-nums">{formatContestDate(next.starts_at)}</strong>
            </div>
            <Button asChild variant="outline" className="w-full sm:w-auto justify-center group/btn active:scale-[0.98]">
              <Link to={`/contests/${next.slug}`}>
                <span>View Contest</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform duration-150 group-hover/btn:translate-x-0.5" />
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      {/* Rating Analytics */}
      <section className="p-4 sm:p-5 rounded-lg border border-white/8 bg-black min-w-0 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.04)]">
        <SectionHeader
          kicker="01 // Rating Trajectory"
          index="PROGRESS"
          title="University Elo Progression"
          action={
            <Link to="/profile" className="text-xs font-mono font-medium text-lime-400 hover:underline">
              Profile Dossier →
            </Link>
          }
        />
        <div className="w-full min-w-0 overflow-hidden">
          <RatingChart data={history} />
        </div>
      </section>

      {/* Live Tournament Scoreboard Radar */}
      <section className="p-4 sm:p-5 rounded-lg border border-white/8 bg-black min-w-0 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.04)]">
        <SectionHeader
          kicker="02 // Tournament Radar"
          index="LIVE"
          title="Tournament Scoreboard"
          action={
            <div className="flex items-center gap-3">
              <Link to="/contests" className="text-xs font-mono font-medium text-zinc-400 hover:text-white transition-colors">
                All Contests →
              </Link>
              <Link to="/leaderboard" className="text-xs font-mono font-medium text-lime-400 hover:underline">
                Campus Leaderboard →
              </Link>
            </div>
          }
        />
        <div className="w-full min-w-0 overflow-hidden">
          <ScoreboardMatrix entries={publicData.standings} problems={publicData.problems} />
        </div>
      </section>

      {/* Live Campus Activity Stream */}
      <section className="p-4 sm:p-5 rounded-lg border border-white/8 bg-black min-w-0 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.04)]">
        <SectionHeader
          kicker="03 // Network Feed"
          index="TELEMETRY"
          title="Live Activity Stream"
        />
        <div className="w-full min-w-0">
          <ContestActivityFeed limit={6} />
        </div>
      </section>
    </div>
  );
}
