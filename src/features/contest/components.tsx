import { Link } from "@tanstack/react-router";
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

const PHASE_COPY: Record<ContestPhase, { label: string; tone: string }> = {
  registration_open: { label: "Registration open", tone: "border-sky-500/40 text-sky-300" },
  assessment_open: { label: "Round 1 live", tone: "border-[var(--accent)] text-[var(--accent)]" },
  assessment_submitted: { label: "Round 1 submitted", tone: "border-violet-500/40 text-violet-300" },
  assessment_closed: { label: "Round 1 closed", tone: "border-amber-500/40 text-amber-300" },
  final_live: { label: "Final live on campus", tone: "border-rose-500/40 text-rose-300" },
  complete: { label: "Completed", tone: "border-[var(--line)] text-[var(--muted)]" },
};

export function PhaseBadge({ phase }: { phase: ContestPhase }) {
  const { label, tone } = PHASE_COPY[phase];
  return (
    <Badge variant="outline" className={cn("rounded-none font-mono text-[10px] uppercase tracking-widest", tone)}>
      {label}
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
      <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">{label}</span>
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
      note: "2-hour immutable session · code judged on hidden tests",
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
    <ol className="space-y-3">
      {rounds.map((round) => (
        <li
          key={round.title}
          className={cn(
            "border border-[var(--line)] bg-[var(--surface-2)] p-4",
            round.active && "border-[var(--accent)]/60",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-sm font-semibold text-white">{round.title}</strong>
            <Badge
              variant="outline"
              className="rounded-none font-mono text-[10px] uppercase tracking-widest"
            >
              {round.active ? "In progress" : round.done ? "Done" : "Scheduled"}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-xs text-[var(--muted)]">{round.body}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{round.note}</p>
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
        <CardTitle className="text-lg font-bold leading-snug text-white">{contest.title}</CardTitle>
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
          <Link to="/portal/contests/$contestSlug" params={{ contestSlug: contest.slug }} search={{ state: "default" }}>
            Contest details
          </Link>
        </Button>
        <Button asChild variant="ghost" className="rounded-none font-mono text-xs uppercase">
          <Link
            to="/portal/contests/$contestSlug/results"
            params={{ contestSlug: contest.slug }}
            search={{ state: "default", query: "", filter: "all", sort: "rank" }}
          >
            Ranking
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
