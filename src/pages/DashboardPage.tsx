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
import { ContestActivityFeed } from "@/features/contest/feed";
import { isAuthenticated } from "@/lib/auth";
import { useSwrData } from "@/lib/cache/swrCache";
import { useAppSelector } from "@/store/hooks";
import { getFirstName } from "@/lib/utils";
import type { OfflineContest, AnnouncementFeedItem } from "@/organization/data/types";

export function DashboardPage() {
  const navigate = useNavigate();
  const currentMember = useAppSelector((s) => s.auth.member);

  const { data: profile, loading: profileLoading } = useSwrData<FullProfilePayload | null>(
    "member:profile:full",
    () => fetchFullProfileData(),
    { ttl: 5 * 60 * 1000 }
  );

  const { data: publicDataRaw, loading: publicLoading } = useSwrData<{
    contests: OfflineContest[];
    announcements: AnnouncementFeedItem[];
    standings: any[];
    problems: any[];
  }>(
    "public:portal:data",
    () => getPublicPortalData(),
    { ttl: 5 * 60 * 1000 }
  );

  const publicData = publicDataRaw || { contests: [], announcements: [], standings: [], problems: [] };

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/auth");
    }
  }, [navigate]);

  if ((profileLoading || publicLoading) && !profile && !publicDataRaw) {
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
    } : {}),
  };
  const contests = publicData.contests || [];
  const history = profile?.ratingHistory || [];
  const pass = profile?.campusPass;
  const isRealPass = Boolean(
    pass &&
    pass.pass_code &&
    pass.pass_code !== "NONE" &&
    pass.pass_code !== "CCC-PASS-0001" &&
    pass.status !== "expired" &&
    pass.seat &&
    pass.seat !== "LAB-04-WS-12" &&
    pass.seat !== "Assigned Physical Lab" &&
    pass.seat !== "Unassigned"
  );

  const live = contests.find((c) => c.status === "live");
  const next = contests.find((c) => c.status === "upcoming");
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
            Welcome back, {greetingName}. Verified Medi-Caps competitive programming operations.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded-md border border-white/8 bg-black">
          <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
          <span className="font-mono text-xs text-zinc-300 uppercase tracking-wider">System Operational</span>
        </div>
      </div>

      {/* Telemetry Bento Strip (4 Columns) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border border-white/8 bg-black">
          <span className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Campus Standings</span>
          <strong className="block text-2xl font-mono font-bold text-white mt-1 tabular-nums">
            #{member?.university_rank || 1}
          </strong>
          <span className="block text-[10px] font-mono text-zinc-600 mt-1">Medi-Caps University</span>
        </div>

        <div className="p-4 rounded-lg border border-white/8 bg-black">
          <span className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Global Rating</span>
          <strong className="block text-2xl font-mono font-bold text-lime-400 mt-1 tabular-nums">
            {member?.rating ?? 1200}
          </strong>
          <span className="block text-[10px] font-mono text-lime-400/80 mt-1">{member?.tier || "1★ Explorer"}</span>
        </div>

        <div className="p-4 rounded-lg border border-white/8 bg-black">
          <span className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Contests Logged</span>
          <strong className="block text-2xl font-mono font-bold text-white mt-1 tabular-nums">
            {history.length || (member as any)?.contests_count || 0}
          </strong>
          <span className="block text-[10px] font-mono text-zinc-600 mt-1">Verified Tournaments</span>
        </div>

        <div className="p-4 rounded-lg border border-white/8 bg-black">
          <span className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Accepted Solutions</span>
          <strong className="block text-2xl font-mono font-bold text-white mt-1 tabular-nums">
            {(member as any)?.solved_count || 0}
          </strong>
          <span className="block text-[10px] font-mono text-zinc-600 mt-1">Problem Archive</span>
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
                  Division {live.division}
                </span>
                <span className="text-zinc-500">
                  {live.problem_count} Problems · {live.registered_count}/{live.seat_capacity} Seated
                </span>
              </div>
            </div>
            <div className="shrink-0">
              <Button asChild className="w-full sm:w-auto font-mono text-xs uppercase tracking-wider font-semibold rounded-md bg-lime-400 text-black hover:bg-lime-300">
                <Link to={`/portal/contests/${live.slug}`}>
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
              <strong className="block text-zinc-200 text-xs mt-0.5">{formatContestDate(next.check_in_opens_at)}</strong>
            </div>
            <Button asChild variant="outline" className="text-xs">
              <Link to={`/portal/contests/${next.slug}`}>
                View Contest <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      {/* Grid: Rating Analytics & Pass Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 p-5 rounded-lg border border-white/8 bg-black">
          <SectionHeader
            kicker="Rating Trajectory"
            index="Telemetry"
            title="University Elo Progression"
            action={
              <Link to="/portal/profile" className="text-xs font-mono font-medium text-lime-400 hover:underline">
                Profile Dossier →
              </Link>
            }
          />
          <RatingChart data={history} />
        </section>

        <section className="p-5 rounded-lg border border-white/8 bg-black flex flex-col justify-between">
          <div>
            <SectionHeader kicker="Hardware Station" index="Pass" title="Lab Workstation" />
            {isRealPass && pass ? (
              <div className="p-4 rounded-md border border-lime-400/30 bg-black font-mono space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-lime-400">CCC / MCU</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-lime-400/8 text-lime-400 border border-lime-400/25 uppercase font-medium">
                    {pass.status.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Assigned Event</span>
                  <strong className="text-xs text-white block mt-0.5 truncate">{pass.contest_title}</strong>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/8">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Seat</span>
                    <strong className="text-xs text-white block mt-0.5">{pass.seat}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Pass Code</span>
                    <strong className="text-xs text-lime-400 block mt-0.5 truncate">{pass.pass_code}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-md border border-white/8 bg-black font-mono space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400">CCC / MCU</span>
                  <span className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-zinc-500 uppercase font-mono">
                    Open Arena
                  </span>
                </div>
                <div className="py-1">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Workstation Access</span>
                  <strong className="text-xs text-zinc-300 block mt-0.5">Campus Arena Direct Access</strong>
                  <p className="text-[11px] text-zinc-500 mt-1 leading-normal">
                    Contests are open to all enrolled Medi-Caps University students without screening gates.
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="pt-4">
            <Button asChild variant="outline" className="w-full text-xs font-mono">
              <Link to="/portal/contests">Browse Tournaments</Link>
            </Button>
          </div>
        </section>
      </div>

      {/* Campus Scoreboard Radar */}
      <section className="p-5 rounded-lg border border-white/8 bg-black">
        <SectionHeader
          kicker="Standings Radar"
          index="Live"
          title="Campus Scoreboard"
          action={
            <Link to="/portal/leaderboard" className="text-xs font-mono font-medium text-lime-400 hover:underline">
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
          action={
            <Link to="/portal/verify" className="text-xs font-mono font-medium text-lime-400 hover:underline">
              Verify Proofs →
            </Link>
          }
        />
        <ContestActivityFeed limit={6} />
      </section>
    </div>
  );
}
