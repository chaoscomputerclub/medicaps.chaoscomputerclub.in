import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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
        "rounded-lg border border-white/8 bg-black p-5 sm:p-6 md:p-7 flex flex-col md:flex-row md:items-end justify-between gap-5 sm:gap-6 shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.04)]",
        className
      )}
    >
      <div className="space-y-1.5 max-w-2xl min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-lime-400">
            {formattedKicker}
          </span>
          {index && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 tabular-nums">
              · {index}
            </span>
          )}
          {badge}
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white font-sans">
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm leading-relaxed text-zinc-400 font-sans">
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
    <div className={cn("flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-4 border-b border-white/8 pb-3 mb-5 min-w-0", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[10px] font-mono font-semibold tracking-wider text-lime-400 uppercase">
            {formattedKicker}
          </p>
          {index && (
            <span className="text-[10px] font-mono tracking-wider text-zinc-400 uppercase tabular-nums">
              · {index}
            </span>
          )}
        </div>
        <h2 className="text-base sm:text-lg font-semibold tracking-tight text-white mt-1 font-sans break-words">
          {title}
        </h2>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatusDot({ status }: { status: "live" | "upcoming" | "finished" }) {
  const styles = {
    live: "text-lime-400 bg-lime-400/8 border-lime-400/30",
    upcoming: "text-zinc-300 bg-black border-white/12",
    finished: "text-zinc-500 bg-black border-white/8",
  }[status];

  const dotColor = {
    live: "bg-lime-400 animate-pulse",
    upcoming: "bg-zinc-400",
    finished: "bg-zinc-600",
  }[status];

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-medium uppercase tracking-wider border", styles)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
      {status}
    </span>
  );
}

export function Metric({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: string | number;
  detail?: string;
  className?: string;
}) {
  return (
    <div className={cn("p-4 rounded-lg border border-white/8 bg-black shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.04)]", className)}>
      <span className="block text-[10px] font-mono font-medium text-zinc-400 uppercase tracking-wider truncate">{label}</span>
      <strong className="block text-xl sm:text-2xl font-mono font-bold text-white mt-1 tabular-nums truncate">{value}</strong>
      {detail && <small className="block text-[10px] font-mono text-zinc-500 mt-1 truncate">{detail}</small>}
    </div>
  );
}

export function TierBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Badge variant="default" className={cn("rounded font-mono text-xs font-medium uppercase tracking-wider bg-lime-400/10 border-lime-400/30 text-lime-400", className)}>
      {children}
    </Badge>
  );
}

export function MonoTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Badge variant="secondary" className={cn("rounded font-mono text-[11px] font-medium tracking-wide bg-black border-white/10 text-zinc-300", className)}>
      {children}
    </Badge>
  );
}

export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-10 sm:p-12 text-center border border-white/8 rounded-lg bg-black my-6 shadow-[0_1px_2px_rgba(0,0,0,0.4)]", className)}>
      <div className="size-10 rounded-md border border-white/10 bg-white/[0.02] flex items-center justify-center mb-3">
        <span className="text-xl text-zinc-500 font-mono select-none">∅</span>
      </div>
      <h3 className="text-sm font-semibold text-white tracking-tight">{title}</h3>
      <p className="text-xs text-zinc-400 max-w-md mt-1.5 leading-relaxed">{body}</p>
      {action && <div className="mt-4">{action}</div>}
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
