import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ArrowRight, MapPin, Radio, Trophy } from "lucide-react";
import { Button } from "@/components/design-system/Button";
import { RatingChart } from "@/organization/components/RatingChart";
import { ScoreboardMatrix } from "@/organization/components/ScoreboardMatrix";
import {
  SectionHeader,
  StatusDot,
  formatContestDate,
} from "@/organization/components/ui";
import { fetchFullProfileData, type FullProfilePayload } from "@/organization/data/queries";
import { getPublicPortalData } from "@/organization/data/portal.functions";
import { ContestActivityFeed } from "@/features/contest/feed";
import { isAuthenticated } from "@/lib/auth";
import { useSwrData, globalSwrStore } from "@/lib/cache/swrCache";
import { useRealtimeEvents } from "@/lib/realtime";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContestsThunk } from "@/store/slices/contestSlice";
import { syncSocialCounts } from "@/store/slices/socialSlice";
import type { ContestSummary } from "@/features/contest/types";
import { getFirstName } from "@/lib/utils";
import type { OfflineContest, AnnouncementFeedItem } from "@/organization/data/types";
import { Card, CardContent } from "@/components/design-system/Card";
import { Badge } from "@/components/design-system/Badge";

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
    () => fetchFullProfileData(),
    { ttl: 5 * 60 * 1000, enabled: authed }
  );

  const { data: publicDataRaw, loading: publicLoading, revalidate: revalidatePublic } = useSwrData<{
    contests: OfflineContest[];
    announcements: AnnouncementFeedItem[];
    standings: any[];
    problems: any[];
  }>(
    "public:portal:data",
    () => getPublicPortalData(),
    { ttl: 5 * 60 * 1000 }
  );

  useEffect(() => {
    dispatch(fetchContestsThunk(false));
  }, [dispatch]);

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
        revalidateProfile();
        revalidatePublic();
        dispatch(fetchContestsThunk(true));
      }
    }
  );

  useEffect(() => {
    const handleConcluded = () => {
      revalidateProfile();
      revalidatePublic();
      dispatch(fetchContestsThunk(true));
    };
    window.addEventListener("contest:concluded", handleConcluded);
    window.addEventListener("contest:cache_invalidated", handleConcluded);
    window.addEventListener("contest:status_changed", handleConcluded);
    return () => {
      window.removeEventListener("contest:concluded", handleConcluded);
      window.removeEventListener("contest:cache_invalidated", handleConcluded);
      window.removeEventListener("contest:status_changed", handleConcluded);
    };
  }, [dispatch, revalidateProfile, revalidatePublic]);

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
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/8 pb-5">
          <div className="animate-pulse space-y-2">
            <div className="h-6 w-32 bg-zinc-900 border border-white/8 rounded-none" />
            <div className="h-4 w-48 bg-zinc-900 border border-white/8 rounded-none" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-3 w-24 bg-zinc-900 border border-white/8 rounded-none mb-2" />
                <div className="h-8 w-16 bg-zinc-900 border border-white/8 rounded-none mb-1" />
                <div className="h-3 w-20 bg-zinc-900 border border-white/8 rounded-none" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="animate-pulse">
          <CardContent className="p-5 h-64" />
        </Card>
        <Card className="animate-pulse">
          <CardContent className="p-5 h-64" />
        </Card>
        <Card className="animate-pulse">
          <CardContent className="p-5 h-48" />
        </Card>
      </div>
    );
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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/8 pb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-white font-sans tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Welcome back, {greetingName}. Medi-Caps competitive programming arena.
          </p>
        </div>
      </div>

      {/* Telemetry Bento Strip (4 Columns) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <span className="mono-label">Campus Standings</span>
            <strong className="metric-value mt-1 block">#{member?.university_rank || 1}</strong>
            <span className="mono-label mt-1">Medi-Caps University</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="mono-label">Global Rating</span>
            <strong className="metric-value mt-1 block text-lime-400">{member?.rating ?? 1200}</strong>
            <span className="mono-label mt-1 text-lime-400/80">{member?.tier || "1★ Explorer"}</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="mono-label">Contests Logged</span>
            <strong className="metric-value mt-1 block">{history.length || (member as any)?.contests_count || 0}</strong>
            <span className="mono-label mt-1">Verified Tournaments</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="mono-label">Accepted Solutions</span>
            <strong className="metric-value mt-1 block">{(member as any)?.solved_count || 0}</strong>
            <span className="mono-label mt-1">Problem Archive</span>
          </CardContent>
        </Card>
      </div>

      {/* Live Contest Banner or Next Contest Alert */}
      {live ? (
        <Card className="border-lime-400/40">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <StatusDot status="live" />
                  <span className="mono-label">Tournament Live</span>
                </div>
                <h2 className="text-xl md:text-2xl font-semibold text-white font-sans">{live.title}</h2>
                <p className="text-xs text-zinc-400 max-w-2xl leading-normal">{live.summary}</p>
                <div className="flex flex-wrap items-center gap-4 mono-label pt-1">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <MapPin className="w-3.5 h-3.5 text-lime-400" />
                    {live.venue}
                  </span>
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <Radio className="w-3.5 h-3.5 text-cyan-400" />
                    Division {live.division || "Open"}
                  </span>
                  <span className="text-zinc-500">
                    {live.problem_count} Problems · {live.registered_count} Registered
                  </span>
                </div>
              </div>
              <div className="shrink-0">
                <Button asChild variant="outline">
                  <Link to={`/contests/${live.slug}`}>
                    Enter Live Arena <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : next ? (
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <StatusDot status="upcoming" />
                  <span className="mono-label">Next Campus Tournament</span>
                </div>
                <h2 className="text-lg md:text-xl font-semibold text-white font-sans">{next.title}</h2>
                <p className="text-xs text-zinc-400 max-w-xl">{next.summary}</p>
              </div>
              <div className="flex flex-wrap items-center gap-4 mono-label shrink-0">
                <div>
                  <span className="block text-[10px] text-zinc-500 uppercase tracking-wider">Scheduled Start</span>
                  <strong className="block text-zinc-200 text-xs mt-0.5">{formatContestDate(next.starts_at)}</strong>
                </div>
                <Button asChild variant="outline">
                  <Link to={`/contests/${next.slug}`}>
                    View Contest <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <Trophy className="size-10 text-zinc-600 mx-auto" />
            <p className="text-base font-semibold text-white">No Active Contests</p>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              There aren't any contests available right now. Check back soon for upcoming tournaments.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/contests" className="flex items-center gap-1.5">
                <span>Explore Contests</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Rating Analytics */}
      <Card>
        <CardContent className="p-5">
          <SectionHeader
            kicker="Rating Trajectory"
            index="Progress"
            title="University Elo Progression"
            action={
              <Link to="/profile" className="text-xs font-mono font-medium text-lime-400 hover:underline">
                Profile Dossier →
              </Link>
            }
          />
          <RatingChart data={history} />
        </CardContent>
      </Card>

      {/* Campus Scoreboard Radar */}
      <Card>
        <CardContent className="p-5">
          <SectionHeader
            kicker="Standings Radar"
            index="Live"
            title="Campus Scoreboard"
            action={
              <Link to="/leaderboard" className="text-xs font-mono font-medium text-lime-400 hover:underline">
                Full Standings →
              </Link>
            }
          />
          <ScoreboardMatrix entries={publicData.standings} problems={publicData.problems} />
        </CardContent>
      </Card>

      {/* Live Campus Activity Stream */}
      <Card>
        <CardContent className="p-5">
          <SectionHeader
            kicker="Network Feed"
            index="Telemetry"
            title="Live Activity Stream"
          />
          <ContestActivityFeed limit={6} />
        </CardContent>
      </Card>
    </div>
  );
}