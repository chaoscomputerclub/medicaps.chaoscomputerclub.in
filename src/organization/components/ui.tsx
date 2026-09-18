import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  kicker,
  index,
  title,
  description,
  action,
  badge,
  className,
}: {
  kicker: string;
  index?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  badge?: ReactNode;
  className?: string;
}) {
  const formattedKicker = kicker.startsWith("(") ? kicker : `(${kicker})`;
  return (
    <header
      className={cn(
        "rounded-none border border-white/10 bg-zinc-900/60 p-6 md:p-8 backdrop-blur-md shadow-xl flex flex-col md:flex-row md:items-end justify-between gap-6",
        className
      )}
    >
      <div className="space-y-2 max-w-2xl">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-lime-400">
            {formattedKicker}
          </span>
          {index && (
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 tabular-nums">
              {index}
            </span>
          )}
          {badge}
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white uppercase font-mono">
          {title}
        </h1>
        {description && (
          <p className="text-sm leading-relaxed text-zinc-400 font-sans">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function SectionHeader({
  kicker,
  title,
  index,
  action,
  className,
}: {
  kicker: string;
  title: ReactNode;
  index?: string;
  action?: ReactNode;
  className?: string;
}) {
  const formattedKicker = kicker.startsWith("(") ? kicker : `(${kicker})`;
  return (
    <div className={cn("flex items-end justify-between gap-4 border-b border-white/10 pb-4 mb-6", className)}>
      <div>
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-mono font-bold tracking-[0.2em] text-lime-400 uppercase">
            {formattedKicker}
          </p>
          {index && (
            <span className="text-[10px] font-mono tracking-[0.2em] text-zinc-500 uppercase tabular-nums">
              {index}
            </span>
          )}
        </div>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white mt-1 uppercase font-mono">
          {title}
        </h2>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function StatusDot({ status }: { status: "live" | "upcoming" | "finished" }) {
  const styles = {
    live: "text-lime-400 bg-lime-400/10 border-lime-400/30",
    upcoming: "text-zinc-300 bg-zinc-900 border-white/10",
    finished: "text-zinc-400 bg-zinc-900/80 border-white/10",
  }[status];

  const dotColor = {
    live: "bg-lime-400 animate-pulse",
    upcoming: "bg-zinc-400",
    finished: "bg-zinc-600",
  }[status];

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none text-xs font-mono font-semibold uppercase tracking-wider border", styles)}>
      <span className={cn("w-1.5 h-1.5 rounded-none", dotColor)} />
      {status}
    </span>
  );
}

export function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="p-4 rounded-none border border-white/8 bg-zinc-900/60 backdrop-blur-sm">
      <span className="block text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      <strong className="block text-2xl font-mono font-bold text-white mt-1.5 tabular-nums">{value}</strong>
      {detail && <small className="block text-xs font-mono text-slate-500 mt-1">{detail}</small>}
    </div>
  );
}

export function TierBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-none text-xs font-mono font-bold uppercase tracking-wider bg-lime-400/10 border border-lime-400/30 text-lime-400">
      {children}
    </span>
  );
}

export function MonoTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-none text-[11px] font-mono font-medium tracking-wide bg-zinc-900 border border-white/10 text-zinc-300", className)}>
      {children}
    </span>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-white/10 rounded-none bg-zinc-900/30 my-6">
      <span className="text-3xl text-slate-600 font-mono mb-3">∅</span>
      <h3 className="text-base font-semibold text-slate-200">{title}</h3>
      <p className="text-sm text-slate-400 max-w-md mt-1">{body}</p>
    </div>
  );
}

export function formatPenalty(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function formatContestDate(value: string) {
  return (
    new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    }).format(new Date(value)) + " IST"
  );
}
