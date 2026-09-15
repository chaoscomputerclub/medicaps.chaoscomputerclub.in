import { DashboardSkeleton } from "@/organization/components/skeletons";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarClock, MapPin, Radio, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RatingChart } from "@/organization/components/RatingChart";
import { ScoreboardMatrix } from "@/organization/components/ScoreboardMatrix";
import {
  Metric,
  SectionHeader,
  StatusDot,
  TierBadge,
  formatContestDate,
} from "@/organization/components/ui";
import { fetchFullProfileData, type FullProfilePayload } from "@/organization/data/queries";
import { getPublicPortalData } from "@/organization/data/portal.functions";
import { ContestActivityFeed } from "@/features/contest/feed";
import { isAuthenticated } from "@/lib/auth";
import type { OfflineContest, AnnouncementFeedItem } from "@/organization/data/types";

export function DashboardPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<FullProfilePayload | null>(null);
  const [publicData, setPublicData] = useState<{
    contests: OfflineContest[];
    announcements: AnnouncementFeedItem[];
    standings: any[];
    problems: any[];
  }>({ contests: [], announcements: [], standings: [], problems: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/auth");
      return;
    }

    Promise.all([
      fetchFullProfileData().catch(() => null),
      getPublicPortalData().catch(() => ({ contests: [], announcements: [], standings: [], problems: [] })),
    ]).then(([prof, pub]) => {
      if (prof) setProfile(prof);
      if (pub) setPublicData(pub);
      setLoading(false);
    });
  }, [navigate]);

  if (loading && !profile) {
    return <DashboardSkeleton />;
  }

  const member = profile?.member;
  const contests = publicData.contests || [];
  const feed = publicData.announcements || [];
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
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="kicker">Member operations console</p>
          <h1>Good morning{greetingName ? `, ${greetingName}.` : "."}</h1>
          <p>Your competitive record is only written inside a verified Medi-Caps contest room.</p>
        </div>
        <div className="member-rating">
          <TierBadge>{member?.tier || "1★ Explorer"}</TierBadge>
          <strong>{member?.rating ?? 1200}</strong>
          <span>UNIVERSITY RANK #{member?.university_rank ?? 0}</span>
        </div>
      </header>

      {live ? (
        <section className="live-command">
          <div className="live-copy">
            <StatusDot status="live" />
            <p className="kicker">Now running · {live.season}</p>
            <h2>{live.title}</h2>
            <p>{live.summary}</p>
            <div className="event-facts">
              <span>
                <MapPin size={14} />
                {live.venue}
              </span>
              <span>
                <Radio size={14} />
                Division {live.division}
              </span>
            </div>
            <div className="action-row">
              <Button asChild className="primary-btn">
                <Link to={`/portal/contests/${live.slug}`}>
                  Enter live room <ArrowRight size={15} />
                </Link>
              </Button>
            </div>
          </div>
          <div className="live-telemetry">
            <Metric label="Workstations seated" value={`${live.registered_count}/${live.seat_capacity}`} />
            <Metric label="Problems unsealed" value={live.problem_count} />
            <Metric label="Campus check-in" value={pass?.seat ?? "Pass verified"} />
          </div>
        </section>
      ) : next ? (
        <section className="upcoming-briefing">
          <div>
            <StatusDot status="upcoming" />
            <p className="kicker">Next campus contest</p>
            <h2>{next.title}</h2>
            <p>{next.summary}</p>
          </div>
          <div className="briefing-meta">
            <div>
              <span>Check-in opens</span>
              <strong>{formatContestDate(next.check_in_opens_at)}</strong>
            </div>
            <div>
              <span>Venue</span>
              <strong>{next.venue}</strong>
            </div>
            <Button asChild variant="outline">
              <Link to={`/portal/contests/${next.slug}`}>
                Contest briefing <ArrowRight size={14} />
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <SectionHeader
            kicker="Performance trajectory"
            title="University contest rating"
            action={
              <Link to="/portal/profile" className="panel-link">
                Full battle log
              </Link>
            }
          />
          <RatingChart data={history} />
        </section>

        <section className="panel pass-panel">
          <SectionHeader kicker="Hardware pass" title="Offline lab entry" />
          <div className="pass-card">
            <div className="pass-chip">CCC / MCU</div>
            <p className="pass-title">{pass?.contest_title ?? "Next campus session"}</p>
            <div className="pass-grid">
              <div>
                <span>Seat</span>
                <strong>{pass?.seat ?? "Desk assign"}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong className="text-[var(--accent)]">{pass?.status?.toUpperCase() ?? "STANDBY"}</strong>
              </div>
            </div>
            <div className="pass-barcode">{pass?.pass_code ?? "CCC-AUTH-0000"}</div>
          </div>
        </section>
      </div>

      <section className="panel">
        <SectionHeader
          kicker="Division radar"
          title="Verified campus scoreboard"
          action={
            <Link to="/portal/leaderboard" className="panel-link">
              University rankings
            </Link>
          }
        />
        <ScoreboardMatrix entries={publicData.standings} problems={publicData.problems} />
      </section>

      <section className="panel">
        <SectionHeader
          kicker="Campus network"
          title="Live activity stream"
          action={
            <Link to="/portal/verify" className="panel-link">
              Verify proof log
            </Link>
          }
        />
        <ContestActivityFeed limit={6} />
      </section>
    </div>
  );
}
