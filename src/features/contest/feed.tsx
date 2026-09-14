/**
 * Contest-first activity feed. Every entry is derived from live contest data
 * coming off the contest service — no static announcements.
 */

import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarClock, Flag, ListOrdered, Play, Trophy } from "lucide-react";
import { contestQueries } from "./queries";
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
        closes.toISOString(),
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
  const { data: contests } = useSuspenseQuery(contestQueries.list());
  const now = Date.now();

  const events = contests
    .flatMap(eventsFor)
    .filter((event) => event.at <= now + 14 * 86400000)
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);

  if (events.length === 0) {
    return (
      <p className="py-8 text-center font-mono text-xs text-[var(--muted)]">
        No contest activity yet. New editions appear here as soon as they are scheduled.
      </p>
    );
  }

  return (
    <div className="feed-list">
      {events.map((event) => {
        const Icon = event.icon;
        return (
          <article key={event.key}>
            <span>{event.kind}</span>
            <h3>
              <Link
                to="/portal/contests/$contestSlug"
                params={{ contestSlug: event.slug }}
                search={{ state: "default" }}
              >
                {event.title}
              </Link>
            </h3>
            <p>{event.body}</p>
            <time className="inline-flex items-center gap-1">
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
