import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarClock, MapPin, Radio, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RatingChart } from "@/organization/components/RatingChart";
import { ScoreboardMatrix } from "@/organization/components/ScoreboardMatrix";
import { Metric, SectionHeader, StatusDot, TierBadge, formatContestDate } from "@/organization/components/ui";
import { portalQueries } from "@/organization/data/queries";

const queries = [
  portalQueries.member(),
  portalQueries.contests(),
  portalQueries.announcements(),
  portalQueries.ratingHistory(),
  portalQueries.campusPass(),
] as const;

import { redirect } from "@tanstack/react-router";
import { isAuthenticated } from "@/lib/auth";

export const Route = createFileRoute("/portal/")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !isAuthenticated()) {
      throw redirect({ to: "/auth" });
    }
  },
  head: () => ({
    meta: [
      { title: "Offline Contest Operations — CCC Medi-Caps" },
      {
        name: "description",
        content: "Live operations, ratings, verified results and campus contest intelligence for CCC Medi-Caps.",
      },
      { property: "og:title", content: "CCC Medi-Caps Offline Contest Operations" },
      { property: "og:description", content: "Proctored campus contests, live standings and verifiable results." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(queries[0]),
      context.queryClient.ensureQueryData(queries[1]),
      context.queryClient.ensureQueryData(queries[2]),
      context.queryClient.ensureQueryData(queries[3]),
      context.queryClient.ensureQueryData(queries[4]),
    ]),
  component: Dashboard,
});

function Dashboard() {
  if (typeof window !== "undefined" && !isAuthenticated()) {
    window.location.href = "/auth";
    return null;
  }
  const { data: member } = useSuspenseQuery(queries[0]);
  const { data: contests } = useSuspenseQuery(queries[1]);
  const { data: feed } = useSuspenseQuery(queries[2]);
  const { data: history } = useSuspenseQuery(queries[3]);
  const { data: pass } = useSuspenseQuery(queries[4]);

  const live = contests.find((c) => c.status === "live") ?? contests[0];
  const next = contests.find((c) => c.status === "upcoming");
  const greetingName = member?.full_name ? member.full_name.split(" ")[0] : member?.handle || "Cadet";

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="kicker">Member operations console</p>
          <h1>Good morning, {greetingName}.</h1>
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
              <span><MapPin size={14} />{live.venue}</span>
              <span><Radio size={14} />{live.environment}</span>
            </div>
            <div className="button-row">
              <Button asChild>
                <Link to="/portal/contests/$contestSlug" params={{ contestSlug: live.slug }}>
                  Open contest room <ArrowRight />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/portal/profile">View campus pass</Link>
              </Button>
            </div>
          </div>
          <div className="live-stats">
            <Metric label="Registered" value={`${live.registered_count}/${live.seat_capacity}`} detail="Physical seats" />
            <Metric label="Problems" value={live.problem_count} detail="Sealed set" />
            <Metric label="Your room" value={pass?.venue || "Standby"} detail={pass?.seat ? `Seat ${pass.seat}` : "Physical Lab"} />
            <Metric label="Freeze" value="12:30" detail="IST today" />
          </div>
        </section>
      ) : (
        <section className="live-command">
          <div className="live-copy">
            <StatusDot status="upcoming" />
            <p className="kicker">Status · Standby</p>
            <h2>No Active Contest Session</h2>
            <p>
              There are no live offline contests running right now. When an offline screening round or LAN battle
              is scheduled, room allocations and registration links will appear here.
            </p>
            <div className="button-row">
              <Button asChild variant="outline">
                <Link to="/portal/contests">Browse Contests <ArrowRight /></Link>
              </Button>
            </div>
          </div>
          <div className="live-stats">
            <Metric label="Registered" value="0" detail="Physical seats" />
            <Metric label="Problems" value="0" detail="Sealed set" />
            <Metric label="Your room" value="Standby" detail="Unassigned" />
            <Metric label="Freeze" value="—" detail="No active session" />
          </div>
        </section>
      )}

      <section className="metrics-grid">
        <Metric label="Current rating" value={member?.rating ?? 1200} detail={`Peak ${member?.peak_rating ?? 1200}`} />
        <Metric label="University rank" value={`#${member?.university_rank ?? 0}`} detail={`of ${member?.active_members ?? 0} active`} />
        <Metric label="Offline battles" value={member?.attendance_total ?? 0} detail={`${member?.attendance_count ?? 0} verified`} />
        <Metric label="Podium finishes" value={member?.podiums ?? 0} detail={`${member?.streak ?? 0} battle streak`} />
      </section>

      <section className="content-grid">
        <div className="panel wide">
          <SectionHeader kicker="Elo trajectory" title="Rating progression" />
          <RatingChart data={history} />
        </div>
        <div className="panel">
          <SectionHeader kicker="Operations feed" title="Chapter signals" />
          <div className="feed-list">
            {feed.length === 0 ? (
              <p className="text-xs text-[#777] font-mono py-8 text-center">No announcements published yet.</p>
            ) : (
              feed.map((item) => (
                <article key={item.id}>
                  <span>{item.kind.replace("_", " ")}</span>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                  <time>{formatContestDate(item.published_at)}</time>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      {live && live.standings && live.standings.length > 0 && (
        <section className="panel standings-panel">
          <SectionHeader
            kicker="Live telemetry"
            title="Top of the room"
            action={
              <Link to="/portal/leaderboard" className="text-link">
                Full leaderboard <ArrowRight size={14} />
              </Link>
            }
          />
          <ScoreboardMatrix entries={live.standings.slice(0, 5)} problems={live.problems} compact />
        </section>
      )}

      {next && (
        <section className="next-operation">
          <div>
            <CalendarClock />
            <span>
              <small>Next operation</small>
              <strong>{next.title}</strong>
              <em>{formatContestDate(next.starts_at)} · {next.venue}</em>
            </span>
          </div>
          <Link to="/portal/contests/$contestSlug" params={{ contestSlug: next.slug }}>
            Review brief <ArrowRight />
          </Link>
        </section>
      )}

      <footer className="trust-footer">
        <ShieldCheck />
        <p>
          <strong>Proof before prestige.</strong> Every score joins the public record only after attendance,
          workstation, and proctor logs reconcile.
        </p>
      </footer>
    </div>
  );
}
