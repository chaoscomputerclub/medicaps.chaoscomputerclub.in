/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { motion } from "framer-motion";
import type { ComponentProps, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  ContestState,
  Difficulty,
  EventState,
  ProblemStatus,
  RsvpStatus,
} from "@/organization/data/types";

/* --- motion: one curve, one duration band, mount-only ------------------ */

const EASE = [0.16, 1, 0.3, 1] as const;

/** Route-level fade + 6px lift. 180ms, runs once per mount. */
export function RouteFade({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Single stagger for list/table rows on first paint only. */
export function StaggerItem({
  index,
  children,
  className,
}: {
  index: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: EASE, delay: Math.min(index, 12) * 0.035 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* --- layout primitives -------------------------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-border pb-6">
      <div className="min-w-0">
        <h1 className="truncate font-display text-2xl tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-[0.8125rem] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({ className, children, ...rest }: ComponentProps<typeof Card>) {
  return (
    <Card
      {...rest}
      className={cn(
        "gap-0 rounded-none border-border bg-surface py-0 shadow-none transition-colors duration-150 ease-editorial",
        className,
      )}
    >
      {children}
    </Card>
  );
}

export function PanelHeader({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3">
      <h2 className="min-w-0 truncate font-mono text-[0.625rem] tracking-[0.18em] text-muted-foreground uppercase">
        {title}
      </h2>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[0.625rem] tracking-[0.18em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

/* --- data display ------------------------------------------------------- */

export function StatBlock({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: number | string;
  unit?: string;
  hint?: string;
}) {
  return (
    <Panel className="px-4 py-4 hover:border-border-strong">
      <p className="font-mono text-[0.625rem] tracking-[0.18em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-3xl tabular-nums text-foreground">{value}</span>
        {unit ? (
          <span className="font-mono text-[0.6875rem] text-subtle-foreground">{unit}</span>
        ) : null}
      </p>
      {hint ? <p className="mt-2 text-xs text-subtle-foreground">{hint}</p> : null}
    </Panel>
  );
}

const difficultyClass: Record<Difficulty, string> = {
  easy: "border-border-strong text-foreground",
  medium: "border-border-strong text-foreground",
  hard: "border-destructive/60 text-destructive",
};

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-none bg-transparent font-mono text-[0.5625rem] tracking-[0.16em] uppercase",
        difficultyClass[difficulty],
      )}
    >
      {difficulty}
    </Badge>
  );
}

export function ProblemStatusBadge({ status }: { status: ProblemStatus }) {
  const map: Record<ProblemStatus, string> = {
    solved: "border-accent/60 text-accent",
    attempted: "border-border-strong text-foreground",
    unsolved: "border-border text-subtle-foreground",
  };
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-none bg-transparent font-mono text-[0.5625rem] tracking-[0.16em] uppercase",
        map[status],
      )}
    >
      {status}
    </Badge>
  );
}

export function RsvpBadge({ status, state }: { status: RsvpStatus; state: EventState }) {
  if (status === "confirmed")
    return (
      <Badge
        variant="outline"
        className="rounded-none border-accent/60 bg-transparent font-mono text-[0.5625rem] tracking-[0.16em] text-accent uppercase"
      >
        {state === "past" ? "attended" : "confirmed"}
      </Badge>
    );
  if (status === "pending" || status === "waitlisted")
    return (
      <Badge
        variant="outline"
        className="rounded-none border-border-strong bg-transparent font-mono text-[0.5625rem] tracking-[0.16em] uppercase"
      >
        {status}
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="rounded-none border-border bg-transparent font-mono text-[0.5625rem] tracking-[0.16em] text-subtle-foreground uppercase"
    >
      {state === "closed" ? "full" : state === "past" ? "missed" : "not registered"}
    </Badge>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <li
          key={t}
          className="border border-border px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground"
        >
          {t}
        </li>
      ))}
    </ul>
  );
}

/* --- states ------------------------------------------------------------- */

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 border border-dashed border-border px-5 py-8">
      <p className="font-display text-base text-foreground">{title}</p>
      <p className="max-w-md text-[0.8125rem] leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 border border-destructive/40 px-5 py-6"
    >
      <p className="font-display text-base text-foreground">This didn&apos;t load</p>
      <p className="max-w-md text-[0.8125rem] leading-relaxed text-muted-foreground">{message}</p>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="border border-border-strong px-3 py-1.5 font-mono text-[0.625rem] tracking-[0.16em] uppercase transition-colors duration-150 ease-editorial hover:bg-accent hover:text-accent-foreground"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function StatSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Panel key={i} className="px-4 py-4">
          <Skeleton className="h-2.5 w-20 rounded-none" />
          <Skeleton className="mt-4 h-8 w-14 rounded-none" />
          <Skeleton className="mt-3 h-2.5 w-24 rounded-none" />
        </Panel>
      ))}
    </div>
  );
}

export function RowSkeletons({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-border border border-border">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3.5 w-48 rounded-none" />
            <Skeleton className="h-2.5 w-72 max-w-full rounded-none" />
          </div>
          <Skeleton className="h-5 w-16 rounded-none" />
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-3 w-24 rounded-none" />
      <Skeleton className="h-8 w-2/3 rounded-none" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-full rounded-none" />
        <Skeleton className="h-3 w-11/12 rounded-none" />
        <Skeleton className="h-3 w-4/5 rounded-none" />
      </div>
    </div>
  );
}

/* --- formatting -------------------------------------------------------- */

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 60) return `${Math.abs(mins)}m ${mins >= 0 ? "ago" : "from now"}`;
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 48) return `${Math.abs(hrs)}h ${hrs >= 0 ? "ago" : "from now"}`;
  const d = Math.round(hrs / 24);
  return `${Math.abs(d)}d ${d >= 0 ? "ago" : "from now"}`;
}

/* --- competition primitives -------------------------------------------- */

const contestStateClass: Record<ContestState, string> = {
  live: "border-accent/60 text-accent",
  upcoming: "border-border-strong text-foreground",
  finished: "border-border text-subtle-foreground",
};

export function ContestStateBadge({ state, rated }: { state: ContestState; rated?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <Badge
        variant="outline"
        className={cn(
          "rounded-none bg-transparent font-mono text-[0.5625rem] tracking-[0.16em] uppercase",
          contestStateClass[state],
        )}
      >
        {state}
      </Badge>
      {rated !== undefined ? (
        <Badge
          variant="outline"
          className="rounded-none border-border bg-transparent font-mono text-[0.5625rem] tracking-[0.16em] text-subtle-foreground uppercase"
        >
          {rated ? "rated" : "unrated"}
        </Badge>
      ) : null}
    </span>
  );
}

/** Definition list for precise metadata. Tabular figures, hairline separators. */
export function MetaList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-border">
      {items.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3 px-4 py-2.5">
          <dt className="font-mono text-[0.625rem] tracking-[0.16em] text-subtle-foreground uppercase">
            {k}
          </dt>
          <dd className="min-w-0 font-mono text-[0.75rem] tabular-nums break-words text-foreground">
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Rank movement. Neutral by default; accent only for a genuine climb. */
export function RankDelta({ rank, previous }: { rank: number; previous: number | null }) {
  if (previous === null)
    return <span className="font-mono text-[0.625rem] text-subtle-foreground">new</span>;
  const delta = previous - rank;
  if (delta === 0)
    return <span className="font-mono text-[0.625rem] text-subtle-foreground">—</span>;
  return (
    <span
      className={cn(
        "font-mono text-[0.625rem] tabular-nums",
        delta > 0 ? "text-accent" : "text-destructive",
      )}
    >
      {delta > 0 ? `+${delta}` : delta}
    </span>
  );
}

/** The one shared button surface for portal actions. */
export function ActionButton({
  children,
  emphasis = "default",
  className,
  ...rest
}: ComponentProps<"button"> & { emphasis?: "default" | "primary" | "quiet" }) {
  return (
    <button
      {...rest}
      className={cn(
        "border px-3 py-1.5 font-mono text-[0.625rem] tracking-[0.16em] uppercase transition-colors duration-150 ease-editorial disabled:cursor-not-allowed disabled:opacity-40",
        emphasis === "primary" &&
          "border-accent bg-accent text-accent-foreground hover:bg-accent/85",
        emphasis === "default" &&
          "border-border-strong text-foreground hover:bg-accent hover:text-accent-foreground",
        emphasis === "quiet" && "border-border text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Countdown-ish window label; static text, no ticking clock. */
export function TimeWindow({ startsAt, endsAt }: { startsAt: string; endsAt: string }) {
  return (
    <span className="font-mono text-[0.6875rem] tabular-nums text-subtle-foreground">
      {formatDateTime(startsAt)} →{" "}
      {new Date(endsAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}
