import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  kicker,
  title,
  action,
}: {
  kicker: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-4 mb-6">
      <div>
        <p className="text-[10px] font-mono font-bold tracking-wider text-orange-500 uppercase">{kicker}</p>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white mt-1">{title}</h2>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function StatusDot({ status }: { status: "live" | "upcoming" | "finished" }) {
  const styles = {
    live: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    upcoming: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    finished: "text-zinc-400 bg-zinc-800/80 border-white/10",
  }[status];

  const dotColor = {
    live: "bg-emerald-400 animate-pulse",
    upcoming: "bg-amber-400",
    finished: "bg-zinc-500",
  }[status];

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold uppercase tracking-wider border", styles)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
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
    <div className="p-4 rounded-lg border border-white/8 bg-zinc-900/60 backdrop-blur-sm">
      <span className="block text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      <strong className="block text-2xl font-mono font-bold text-white mt-1.5 tabular-nums">{value}</strong>
      {detail && <small className="block text-xs font-mono text-slate-500 mt-1">{detail}</small>}
    </div>
  );
}

export function TierBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold uppercase tracking-wider bg-orange-500/10 border border-orange-500/30 text-orange-400">
      {children}
    </span>
  );
}

export function MonoTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium tracking-wide bg-zinc-800/80 border border-white/8 text-slate-300", className)}>
      {children}
    </span>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-white/10 rounded-xl bg-zinc-900/30 my-6">
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
