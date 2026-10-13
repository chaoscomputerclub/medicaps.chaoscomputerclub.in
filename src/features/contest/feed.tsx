/**
 * Contest-first activity feed. Every entry is derived from live contest data
 * coming off the contest service — no static announcements.
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Flag, Play, Trophy } from "lucide-react";
import { contestApi } from "./api";
import {
  cadenceLabel,
  formatWhen,
} from "./lifecycle";
import type { ContestSummary } from "./types";
import { ContestActivityFeedSkeleton } from "@/organization/components/skeletons";
import { MakoMascot } from "@/components/common/MakoMascot";

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
  const label = `${cadenceLabel(contest)}${contest.edition ? ` ${contest.edition}` : ""}`;
  const contestStarts = new Date(contest.starts_at).getTime();
  const contestEnds = new Date(contest.ends_at ?? contest.starts_at).getTime();
  const regOpens = contestStarts - 7 * 86400000;

  const events: FeedEvent[] = [
    {
      key: `${contest.slug}-reg`,
      kind: "registration",
      at: regOpens,
      title: `${label} — Registration Open`,
      body: `Registration is open to all Medi-Caps students for ${contest.title}.`,
      slug: contest.slug,
      icon: Flag,
    },
    {
      key: `${contest.slug}-scheduled`,
      kind: "upcoming round",
      at: contestStarts,
      title: `${label} — Scheduled Start`,
      body: `Live 90-minute competitive programming contest on ${formatWhen(contest.starts_at)}. 4 algorithmic problems.`,
      slug: contest.slug,
      icon: Play,
    },
  ];

  if (contest.status === "live") {
    events.push({
      key: `${contest.slug}-live`,
      kind: "live arena",
      at: Date.now(),
      title: `${label} is LIVE`,
      body: `The competition is currently underway! Solve 4 algorithmic challenges in the live arena.`,
      slug: contest.slug,
      icon: Trophy,
    });
  } else if (contest.status === "finished") {
    events.push({
      key: `${contest.slug}-final`,
      kind: "results",
      at: contestEnds,
      title: `${label} — Results & Ratings Published`,
      body: `Contest concluded. Official problem solutions, verified rankings, and Elo ratings updated on the university leaderboard.`,
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
    return <ContestActivityFeedSkeleton limit={limit} />;
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center border border-white/[0.08] rounded-[16px] bg-[#171717]">
        <MakoMascot variant="detective-winking" size="md" className="mb-2.5" />
        <strong className="text-xs font-sans font-bold uppercase tracking-wider text-white">
          Telemetry Monitoring Active
        </strong>
        <p className="text-[11px] text-zinc-400 font-sans max-w-sm mt-1 leading-relaxed">
          No contest activity recorded yet. Live registration updates, submission accepted bursts, and round broadcasts will stream here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => {
        const Icon = event.icon;
        return (
          <article key={event.key} className="border-b border-white/10 pb-3 last:border-b-0">
            <span className="font-sans text-[10px] uppercase text-lime-400 font-bold block tracking-wider mb-1">
              {event.kind}
            </span>
            <h3 className="font-bold text-sm text-white hover:text-lime-400 transition-colors">
              <Link to={`/contests/${event.slug}`}>
                {event.title}
              </Link>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">{event.body}</p>
            <time className="inline-flex items-center gap-1 font-sans text-[10px] text-zinc-500 mt-1">
              <Icon className="size-3 text-lime-400" />
              {formatWhen(new Date(event.at).toISOString())}
            </time>
          </article>
        );
      })}
    </div>
  );
}

export { CalendarClock as ContestFeedIcon };
