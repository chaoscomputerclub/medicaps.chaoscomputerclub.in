/**
 * Contest-first activity feed. Every entry is derived from live contest data
 * coming off the contest service — no static announcements.
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Flag, ListOrdered, Play, Trophy } from "lucide-react";
import { contestApi } from "./api";
import {
  FINALIST_SEATS,
  assessmentClosesAt,
  assessmentOpensAt,
  cadenceLabel,
  formatWhen,
} from "./lifecycle";
import type { ContestSummary } from "./types";

type FeedEvent = {
  key: string;
  kind: string;
  at: number;
  title: string;
  body: string;
  slug: string;
  icon: typeof Play;
};

function eventsFor(contest: ContestSummary): FeedEvent[] {
  const opens = assessmentOpensAt(contest);
  const closes = assessmentClosesAt(contest);
  const label = `${cadenceLabel(contest)}${contest.edition ? ` ${contest.edition}` : ""}`;

  const events: FeedEvent[] = [
    {
      key: `${contest.slug}-reg`,
      kind: "registration open",
      at: new Date(contest.check_in_opens_at ?? contest.starts_at).getTime() - 7 * 86400000,
      title: `${label} — registration open`,
      body: `${contest.registered_count} of ${contest.seat_capacity} seats claimed for ${contest.title}.`,
      slug: contest.slug,
      icon: Flag,
    },
    {
      key: `${contest.slug}-r1`,
      kind: "round 1 window",
      at: opens.getTime(),
      title: `${label} — Round 1 opens`,
      body: `Online assessment window ${formatWhen(opens.toISOString())} → ${formatWhen(
        closes.toISOString()
      )}. One 2-hour attempt.`,
      slug: contest.slug,
      icon: Play,
    },
    {
      key: `${contest.slug}-cut`,
      kind: "results",
      at: closes.getTime(),
      title: `${label} — Top ${FINALIST_SEATS} announced`,
      body: "Round 1 ranking is verified and QR campus passes are issued to qualifiers.",
      slug: contest.slug,
      icon: ListOrdered,
    },
  ];

  if (contest.status !== "upcoming") {
    events.push({
      key: `${contest.slug}-final`,
      kind: contest.status === "live" ? "final live" : "final complete",
      at: new Date(contest.starts_at).getTime(),
      title:
        contest.status === "live"
          ? `${label} — final live at ${contest.venue}`
          : `${label} — final results published`,
      body:
        contest.status === "live"
          ? "The campus final is running. Finalists check in with their QR pass."
          : `Verified standings from ${contest.venue} are available.`,
      slug: contest.slug,
      icon: Trophy,
    });
  }

  return events;
}

export function ContestActivityFeed({ limit = 6 }: { limit?: number }) {
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    contestApi.list()
      .then((data) => {
        if (active) {
          setContests(data || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load contest feed:", err);
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const now = Date.now();

  const events = contests
    .flatMap(eventsFor)
    .filter((event) => event.at <= now + 14 * 86400000)
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);

  if (loading) {
    return (
      <p className="py-8 text-center font-mono text-xs text-[var(--muted)] animate-pulse">
        Loading contest activity…
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <p className="py-8 text-center font-mono text-xs text-[var(--muted)]">
        No contest activity yet. New editions appear here as soon as they are scheduled.
      </p>
    );
  }

  return (
    <div className="feed-list space-y-4">
      {events.map((event) => {
        const Icon = event.icon;
        return (
          <article key={event.key} className="border-b border-[#292929] pb-3 last:border-b-0">
            <span className="font-mono text-[10px] uppercase text-[var(--accent)] block tracking-wider mb-1">
              {event.kind}
            </span>
            <h3 className="font-bold text-sm text-white hover:text-[var(--accent)] transition-colors">
              <Link to={`/portal/contests/${event.slug}`}>
                {event.title}
              </Link>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">{event.body}</p>
            <time className="inline-flex items-center gap-1 font-mono text-[10px] text-neutral-500 mt-1">
              <Icon className="size-3" />
              {formatWhen(new Date(event.at).toISOString())}
            </time>
          </article>
        );
      })}
    </div>
  );
}

export { CalendarClock as ContestFeedIcon };
