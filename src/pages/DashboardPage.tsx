import { DashboardSkeleton } from "@/organization/components/skeletons";
import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ArrowRight, MapPin, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RatingChart } from "@/organization/components/RatingChart";
import { ScoreboardMatrix } from "@/organization/components/ScoreboardMatrix";
import {
  SectionHeader,
  StatusDot,
  formatContestDate,
} from "@/organization/components/ui";
import { fetchFullProfileData, type FullProfilePayload } from "@/organization/data/queries";
import { getPublicPortalData } from "@/organization/data/portal.functions";
import { isAuthenticated } from "@/lib/auth";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { syncSocialCounts } from "@/store/slices/socialSlice";
import {
  useGetFullProfileQuery,
  useGetPublicPortalDataQuery,
  useGetContestsQuery,
} from "@/store/api";
import { getFirstName } from "@/lib/utils";
import type { OfflineContest, AnnouncementFeedItem } from "@/organization/data/types";
import { ContestActivityFeed } from "@/features/contest/feed";

export function DashboardPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const currentMember = useAppSelector((s) => s.auth.member);

  const authed = isAuthenticated();

  // Centralized RTK Query Server-State Caches
  const { data: profileData, isLoading: profileLoading } = useGetFullProfileQuery(undefined, {
    skip: !authed,
  });
  const { data: publicDataRaw, isLoading: publicLoading } = useGetPublicPortalDataQuery();
  const { data: contestsData, isLoading: contestsLoading } = useGetContestsQuery();

  const profile = profileData ?? null;
  const contests = contestsData ?? [];
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
      attendance_count: profile?.member?.attendance_count ?? currentMember.attendance_count ?? 0,
      university_rank: profile?.member?.university_rank ?? currentMember.university_rank ?? null,
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
        <div className="p-4 rounded-lg border border-white/8 bg-black">
          <span className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Campus Standings</span>
          <strong className="block text-2xl font-mono font-bold text-white mt-1 tabular-nums">
            {(member?.attendance_count ?? 0) > 0 && member?.university_rank ? `#${member.university_rank}` : "#—"}
          </strong>
          <span className="block text-[10px] font-mono text-zinc-400 mt-1">
            {(member?.attendance_count ?? 0) > 0 && member?.university_rank ? "Medi-Caps University" : "Unranked"}
          </span>
        </div>

        <div className="p-4 rounded-lg border border-white/8 bg-black">
          <span className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Global Rating</span>
          <strong className="block text-2xl font-mono font-bold text-lime-400 mt-1 tabular-nums">
            {member?.rating ?? 1200}
          </strong>
          <span className="block text-[10px] font-mono text-lime-400/80 mt-1">{member?.tier || "1★ Explorer"}</span>
        </div>

        <div className="p-4 rounded-lg border border-white/8 bg-black">
          <span className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Contests Logged</span>
          <strong className="block text-2xl font-mono font-bold text-white mt-1 tabular-nums">
            {member?.attendance_count ?? (member as any)?.contests_count ?? 0}
          </strong>
          <span className="block text-[10px] font-mono text-zinc-400 mt-1">Verified Tournaments</span>
        </div>

        <div className="p-4 rounded-lg border border-white/8 bg-black">
          <span className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Accepted Solutions</span>
          <strong className="block text-2xl font-mono font-bold text-white mt-1 tabular-nums">
            {(member as any)?.solved_count || 0}
          </strong>
          <span className="block text-[10px] font-mono text-zinc-400 mt-1">Problem Archive</span>
        </div>
      </div>

      {/* Live Contest Banner or Next Contest Alert */}
      {live ? (
        <section className="rounded-lg border border-lime-400/40 bg-black p-6 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <StatusDot status="live" />
                <span className="font-mono text-xs text-lime-400 uppercase tracking-wider">Tournament Live</span>
              </div>
              <h2 className="text-xl md:text-2xl font-semibold text-white font-sans">{live.title}</h2>
              <p className="text-xs text-zinc-400 max-w-2xl leading-normal">{live.summary}</p>
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-500 pt-1">
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
        </section>
      ) : next ? (
        <section className="rounded-lg border border-white/8 bg-black p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <StatusDot status="upcoming" />
              <span className="font-mono text-xs text-zinc-400 uppercase tracking-wider">Next Campus Tournament</span>
            </div>
            <h2 className="text-lg md:text-xl font-semibold text-white font-sans">{next.title}</h2>
            <p className="text-xs text-zinc-400 max-w-xl">{next.summary}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 font-mono text-xs shrink-0">
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
        </section>
      ) : null}

      {/* Rating Analytics */}
      <section className="p-5 rounded-lg border border-white/8 bg-black">
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
      </section>

      {/* Campus Scoreboard Radar */}
      <section className="p-5 rounded-lg border border-white/8 bg-black">
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
      </section>

      {/* Live Campus Activity Stream */}
      <section className="p-5 rounded-lg border border-white/8 bg-black">
        <SectionHeader
          kicker="Network Feed"
          index="Telemetry"
          title="Live Activity Stream"
        />
        <ContestActivityFeed limit={6} />
      </section>
    </div>
  );
}
