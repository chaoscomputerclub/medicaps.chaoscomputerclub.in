import { DashboardSkeleton } from "@/organization/components/skeletons";
import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ArrowRight, MapPin, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RatingChart } from "@/organization/components/RatingChart";
import { ScoreboardMatrix } from "@/organization/components/ScoreboardMatrix";
import {
  Metric,
  PageHeader,
  SectionHeader,
  StatusDot,
  TierBadge,
  formatContestDate,
} from "@/organization/components/ui";
import { fetchFullProfileData, type FullProfilePayload } from "@/organization/data/queries";
import { getPublicPortalData } from "@/organization/data/portal.functions";
import { ContestActivityFeed } from "@/features/contest/feed";
import { isAuthenticated } from "@/lib/auth";
import { useSwrData } from "@/lib/cache/swrCache";
import type { OfflineContest, AnnouncementFeedItem } from "@/organization/data/types";

export function DashboardPage() {
  const navigate = useNavigate();

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

  const member = profile?.member;
  const contests = publicData.contests || [];
  const history = profile?.ratingHistory || [];
  const pass = profile?.campusPass;

  const live = contests.find((c) => c.status === "live");
  const next = contests.find((c) => c.status === "upcoming");
  const greetingName = member?.full_name
    ? member.full_name.split(" ")[0]
    : member?.handle && member.handle.toLowerCase() !== "cadet"
      ? member.handle
      : "";

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header Profile Summary */}
      <PageHeader
        kicker="00 // Operations"
        index="INDEX 0.0 · CADET OPS"
        title={`Good morning${greetingName ? `, ${greetingName}.` : "."}`}
        description="Your official competitive record is sealed inside verified Medi-Caps workstation laboratories."
        action={
          <div className="flex flex-col items-start md:items-end gap-1.5 p-4 rounded-none border border-white/10 bg-zinc-950/60 backdrop-blur-xs min-w-[200px]">
            <TierBadge>{member?.tier || "1★ Explorer"}</TierBadge>
            <strong className="text-3xl md:text-4xl font-mono font-bold text-white tracking-tight tabular-nums">
              {member?.rating ?? 1200}
            </strong>
            <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">
              University Rank #{member?.university_rank ?? 0}
            </span>
          </div>
        }
      />

      {/* Live Contest Command or Upcoming Briefing */}
      {live ? (
        <section className="relative rounded-none border border-lime-400/30 bg-zinc-900/90 overflow-hidden shadow-lg shadow-black">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-lime-400" />
          <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
            <div className="p-6 md:p-8 lg:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <StatusDot status="live" />
                <span className="font-mono text-xs font-semibold text-lime-400 uppercase tracking-wider">
                  Live Arena Now Active
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-mono font-bold text-white uppercase">{live.title}</h2>
              <p className="text-sm text-slate-300 max-w-xl leading-relaxed">{live.summary}</p>
              <div className="flex flex-wrap items-center gap-6 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-lime-400" />
                  {live.venue}
                </span>
                <span className="flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-cyan-400" />
                  Division {live.division}
                </span>
              </div>
              <div className="pt-2">
                <Button asChild className="bg-lime-400 hover:bg-lime-300 text-black font-bold px-6">
                  <Link to={`/portal/contests/${live.slug}`}>
                    Enter Live Arena <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="p-6 md:p-8 flex flex-col justify-center gap-4 bg-zinc-950/40">
              <Metric label="Workstations Seated" value={`${live.registered_count}/${live.seat_capacity}`} />
              <Metric label="Problems Unsealed" value={live.problem_count} />
              <Metric label="Workstation Pass" value={pass?.seat ?? "Desk Assigned"} />
            </div>
          </div>
        </section>
      ) : next ? (
        <section className="rounded-none border border-white/10 bg-zinc-900/60 p-6 md:p-8 backdrop-blur-md shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <StatusDot status="upcoming" />
              <span className="font-mono text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Next Campus Contest
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-mono font-bold text-white uppercase">{next.title}</h2>
            <p className="text-sm text-slate-400 max-w-xl">{next.summary}</p>
          </div>
          <div className="flex flex-wrap items-center gap-6 font-mono text-xs">
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider">Check-in Opens</span>
              <strong className="block text-slate-200 text-sm mt-0.5">{formatContestDate(next.check_in_opens_at)}</strong>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider">Venue</span>
              <strong className="block text-slate-200 text-sm mt-0.5">{next.venue}</strong>
            </div>
            <Button asChild variant="outline" className="border-white/15 hover:bg-zinc-800">
              <Link to={`/portal/contests/${next.slug}`}>
                Contest Briefing <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      {/* Grid: Rating Analytics & Pass Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 p-6 rounded-none border border-white/8 bg-zinc-900/50 backdrop-blur-sm">
          <SectionHeader
            kicker="01 // Rating Progression"
            index="INDEX 0.1"
            title="University Contest Rating"
            action={
              <Link to="/portal/profile" className="text-xs font-mono font-medium text-lime-400 hover:text-lime-300">
                Full Battle Log →
              </Link>
            }
          />
          <RatingChart data={history} />
        </section>

        <section className="p-6 rounded-none border border-white/8 bg-zinc-900/50 backdrop-blur-sm flex flex-col justify-between">
          <div>
            <SectionHeader kicker="02 // Hardware Pass" index="INDEX 0.2" title="Lab Workstation" />
            <div className="p-5 rounded-none border border-white/10 bg-zinc-950/80 font-mono space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-lime-400">CCC / MCU</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-slate-300 border border-white/8 uppercase">
                  {pass?.status?.toUpperCase() ?? "STANDBY"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Assigned Event</span>
                <strong className="text-sm text-white block mt-0.5 truncate">{pass?.contest_title ?? "Weekly Championship"}</strong>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/8">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Seat</span>
                  <strong className="text-sm text-white block mt-0.5">{pass?.seat ?? "LAB-04-WS-12"}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Pass Code</span>
                  <strong className="text-xs text-lime-400 block mt-0.5 truncate">{pass?.pass_code ?? "CCC-PASS-0001"}</strong>
                </div>
              </div>
            </div>
          </div>
          <div className="pt-4">
            <Button asChild variant="outline" className="w-full border-white/10 hover:bg-zinc-800 text-xs font-mono">
              <Link to="/portal/contests">View Tournament Schedule</Link>
            </Button>
          </div>
        </section>
      </div>

      {/* Campus Scoreboard Radar */}
      <section className="p-6 rounded-none border border-white/8 bg-zinc-900/50 backdrop-blur-sm">
        <SectionHeader
          kicker="03 // Standings Radar"
          index="INDEX 0.3"
          title="Verified Campus Scoreboard"
          action={
            <Link to="/portal/leaderboard" className="text-xs font-mono font-medium text-lime-400 hover:text-lime-300">
              University Rankings →
            </Link>
          }
        />
        <ScoreboardMatrix entries={publicData.standings} problems={publicData.problems} />
      </section>

      {/* Live Campus Activity Stream */}
      <section className="p-6 rounded-none border border-white/8 bg-zinc-900/50 backdrop-blur-sm">
        <SectionHeader
          kicker="04 // Network Feed"
          index="INDEX 0.4"
          title="Live Activity Stream"
          action={
            <Link to="/portal/verify" className="text-xs font-mono font-medium text-lime-400 hover:text-lime-300">
              Verify Proof Log →
            </Link>
          }
        />
        <ContestActivityFeed limit={6} />
      </section>
    </div>
  );
}
