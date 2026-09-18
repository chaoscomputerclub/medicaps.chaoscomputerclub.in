import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { CalendarClock, MapPin, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  FINALIST_SEATS,
  assessmentClosesAt,
  assessmentOpensAt,
  cadenceLabel,
  formatCountdown,
  formatWhen,
} from "./lifecycle";
import type { ContestPhase, ContestSummary } from "./types";

const PHASE_COPY: Record<ContestPhase, string> = {
  registration_open: "Registration open",
  assessment_open: "Round 1 open",
  assessment_submitted: "Submitted",
  assessment_closed: "Round 1 closed",
  final_live: "Campus final live",
  complete: "Completed",
};
export function PhaseBadge({ phase }: { phase: ContestPhase }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-none px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider",
        phase === "assessment_open" || phase === "final_live"
          ? "border-lime-400/40 bg-lime-400/10 text-lime-400 shadow-sm"
          : "border-white/10 bg-zinc-800/60 text-zinc-400",
      )}
    >
      {PHASE_COPY[phase]}
    </Badge>
  );
}

export function useTick(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function Countdown({ target, label }: { target: string | Date; label: string }) {
  const now = useTick();
  const ms = new Date(target).getTime() - now;
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
        {label}
      </span>
      <span className="font-mono text-2xl font-bold tabular-nums text-lime-400">
        {ms <= 0 ? "00:00:00" : formatCountdown(ms)}
      </span>
    </div>
  );
}

export function RoundsTimeline({
  contest,
  phase,
}: {
  contest: ContestSummary;
  phase: ContestPhase;
}) {
  const rounds = [
    {
      title: "Round 1 · Online assessment",
      body: `${formatWhen(assessmentOpensAt(contest).toISOString())} → ${formatWhen(
        assessmentClosesAt(contest).toISOString(),
      )}`,
      note: "One 2-hour attempt · automatic submission when time ends",
      done: phase !== "registration_open",
      active: phase === "assessment_open",
    },
    {
      title: `Round 2 · Offline final (Top ${FINALIST_SEATS})`,
      body: `${formatWhen(contest.starts_at)} · ${contest.venue}`,
      note: "QR campus pass required at the door",
      done: phase === "complete",
      active: phase === "final_live",
    },
  ];

  return (
    <ol className="relative space-y-2 before:absolute before:bottom-8 before:left-5 before:top-8 before:w-px before:bg-white/10">
      {rounds.map((round, index) => (
        <li
          key={round.title}
          className={cn(
            "relative grid grid-cols-[40px_minmax(0,1fr)] gap-4 rounded-none border border-transparent p-3.5 transition-all",
            round.active && "border-lime-400/30 bg-lime-400/10",
          )}
        >
          <div
            className={cn(
              "relative z-10 grid size-10 place-items-center rounded-none border bg-zinc-900 font-mono text-sm font-bold shadow-sm",
              round.active || round.done
                ? "border-lime-400/40 text-lime-400"
                : "border-white/10 text-zinc-400",
            )}
          >
            {round.done ? "✓" : index + 1}
          </div>
          <div className="min-w-0 py-0.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm font-semibold text-white">{round.title}</strong>
              <Badge
                variant="outline"
                className="rounded-none border-white/10 bg-zinc-800/60 font-mono text-[10px] uppercase tracking-widest text-zinc-400"
              >
                {round.active ? "Live now" : round.done ? "Complete" : "Upcoming"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-zinc-400 font-mono">{round.body}</p>
            <p className="mt-1 text-xs text-zinc-500 font-mono">{round.note}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ContestCard({
  contest,
  phase,
  featured = false,
}: {
  contest: ContestSummary;
  phase: ContestPhase;
  featured?: boolean;
}) {
  const fill = contest.seat_capacity
    ? Math.min(100, Math.round((contest.registered_count / contest.seat_capacity) * 100))
    : 0;

  return (
    <Card
      className={cn(
        "rounded-none border border-white/10 bg-zinc-900/60 backdrop-blur-md shadow-xl transition-all hover:border-white/20 hover:bg-zinc-900/80 flex flex-col justify-between",
        featured && "border-lime-400/40 shadow-lime-400/5",
      )}
    >
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <PhaseBadge phase={phase} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
            {cadenceLabel(contest)}
            {contest.edition ? ` ${contest.edition}` : ""}
          </span>
        </div>
        <CardTitle className="text-lg font-bold leading-snug text-white">
          {contest.title}
        </CardTitle>
        <p className="text-sm leading-relaxed text-zinc-400">{contest.summary}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 font-mono text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-3.5 text-zinc-500" />
            <span>{formatWhen(assessmentOpensAt(contest).toISOString())}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="size-3.5 text-zinc-500" />
            <span className="truncate">{contest.venue}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="size-3.5 text-zinc-500" />
            <span><span className="text-white font-bold tabular-nums">{contest.registered_count}</span> registered</span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="size-3.5 text-lime-400" />
            <span>Top <span className="text-white font-bold tabular-nums">{FINALIST_SEATS}</span> advance</span>
          </div>
        </dl>
        <div className="space-y-1">
          <Progress value={fill} className="h-1.5 rounded-none bg-zinc-800" />
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
            <span className="text-white font-bold tabular-nums">{fill}%</span> of {contest.seat_capacity} workstation seats reserved
          </p>
        </div>
      </CardContent>

      <CardFooter className="justify-between gap-3 border-t border-white/5 pt-4">
        <Button asChild variant="outline" className="rounded-none border-white/10 bg-zinc-900/60 font-mono text-xs uppercase text-zinc-300 hover:border-white/20 hover:text-white active:scale-[0.98]">
          <Link to={`/portal/contests/${contest.slug}`}>
            Contest details
          </Link>
        </Button>
        <Button asChild variant="ghost" className="rounded-none font-mono text-xs uppercase text-zinc-400 hover:text-white active:scale-[0.98]">
          <Link to={`/portal/contests/${contest.slug}/results`}>
            Ranking
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
