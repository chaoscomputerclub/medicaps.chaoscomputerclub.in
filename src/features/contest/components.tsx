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
        "rounded-sm text-xs font-medium",
        phase === "assessment_open" || phase === "final_live"
          ? "border-primary text-primary"
          : "border-border text-muted-foreground",
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
      <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
        {label}
      </span>
      <span className="font-mono text-2xl font-bold tabular-nums text-[var(--accent)]">
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
    <ol className="relative space-y-2 before:absolute before:bottom-8 before:left-5 before:top-8 before:w-px before:bg-border">
      {rounds.map((round, index) => (
        <li
          key={round.title}
          className={cn(
            "relative grid grid-cols-[40px_minmax(0,1fr)] gap-4 rounded-md border border-transparent p-3",
            round.active && "border-primary/30 bg-primary/5",
          )}
        >
          <div
            className={cn(
              "relative z-10 grid size-10 place-items-center rounded-full border bg-card font-display text-sm font-bold",
              round.active || round.done
                ? "border-primary text-primary"
                : "border-border text-muted-foreground",
            )}
          >
            {round.done ? "✓" : index + 1}
          </div>
          <div className="min-w-0 py-0.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm font-semibold text-foreground">{round.title}</strong>
              <Badge
                variant="outline"
                className="rounded-sm font-mono text-[10px] uppercase tracking-widest"
              >
                {round.active ? "Live now" : round.done ? "Complete" : "Upcoming"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{round.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">{round.note}</p>
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
        "rounded-none border-[var(--line)] bg-[var(--surface-1)]",
        featured && "border-[var(--accent)]/50",
      )}
    >
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <PhaseBadge phase={phase} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            {cadenceLabel(contest)}
            {contest.edition ? ` ${contest.edition}` : ""}
          </span>
        </div>
        <CardTitle className="text-lg font-bold leading-snug text-foreground">
          {contest.title}
        </CardTitle>
        <p className="text-sm leading-relaxed text-[var(--muted)]">{contest.summary}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 font-mono text-xs text-[var(--muted)]">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-3.5" />
            <span>{formatWhen(assessmentOpensAt(contest).toISOString())}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="size-3.5" />
            <span className="truncate">{contest.venue}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="size-3.5" />
            <span>{contest.registered_count} registered</span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="size-3.5" />
            <span>Top {FINALIST_SEATS} advance</span>
          </div>
        </dl>
        <div className="space-y-1">
          <Progress value={fill} className="h-1 rounded-none bg-[var(--surface-2)]" />
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            {fill}% of {contest.seat_capacity} workstation seats reserved
          </p>
        </div>
      </CardContent>

      <CardFooter className="justify-between gap-3">
        <Button asChild variant="outline" className="rounded-none font-mono text-xs uppercase">
          <Link to={`/portal/contests/${contest.slug}`}>
            Contest details
          </Link>
        </Button>
        <Button asChild variant="ghost" className="rounded-none font-mono text-xs uppercase">
          <Link to={`/portal/contests/${contest.slug}/results`}>
            Ranking
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
