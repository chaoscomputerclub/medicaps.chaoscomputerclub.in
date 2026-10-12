import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getTierBadgeAsset } from "@/lib/profileAssets";

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
        "rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] p-6 sm:p-8 flex flex-col md:flex-row md:items-end justify-between gap-5 sm:gap-6 shadow-[0_4px_24px_rgba(0,0,0,0.5)]",
        className
      )}
    >
      <div className="space-y-2 max-w-2xl min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-heading font-extrabold text-xs uppercase tracking-wider text-[#B1FA63]">
            {formattedKicker}
          </span>
          {index && (
            <span className="font-mono text-xs uppercase tracking-wider text-zinc-400 tabular-nums">
              · {index}
            </span>
          )}
          {badge}
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-display uppercase tracking-wide text-white leading-none">
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
    <div className={cn("flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-4 border-b border-white/[0.08] pb-3 mb-5 min-w-0", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-heading font-bold tracking-wider text-[#B1FA63] uppercase">
            {formattedKicker}
          </p>
          {index && (
            <span className="text-xs font-mono tracking-wider text-zinc-400 uppercase tabular-nums">
              · {index}
            </span>
          )}
        </div>
        <h2 className="text-2xl sm:text-3xl font-display uppercase tracking-wide text-white mt-1 break-words">
          {title}
        </h2>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatusDot({ status }: { status: "live" | "upcoming" | "finished" }) {
  const styles = {
    live: "text-black bg-[#B1FA63] border-[#B1FA63]",
    upcoming: "text-zinc-300 bg-[#171717] border-white/15",
    finished: "text-zinc-400 bg-[#171717] border-white/[0.08]",
  }[status];

  const dotColor = {
    live: "bg-black animate-pulse",
    upcoming: "bg-zinc-400",
    finished: "bg-zinc-600",
  }[status];

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-heading font-bold uppercase tracking-wider border", styles)}>
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
    <div className={cn("p-5 rounded-[20px] sm:rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] shadow-[0_4px_20px_rgba(0,0,0,0.35)] hover:border-[#B1FA63]/30 transition-all duration-200", className)}>
      <span className="block text-xs font-heading font-bold text-zinc-400 uppercase tracking-wider truncate">{label}</span>
      <strong className="block text-3xl sm:text-4xl font-display text-white mt-1 tabular-nums truncate tracking-wide">{value}</strong>
      {detail && <small className="block text-xs font-mono text-zinc-500 mt-1 truncate">{detail}</small>}
    </div>
  );
}

export function TierBadge({
  children,
  className,
  tier,
  rating,
}: {
  children?: ReactNode;
  className?: string;
  tier?: string | null;
  rating?: number | null;
}) {
  const tierText = typeof children === "string" ? children : tier || "";
  const badgeAsset = getTierBadgeAsset(tierText, rating);

  return (
    <Badge
      variant="default"
      className={cn(
        "rounded-full font-heading text-[11px] font-bold uppercase tracking-wider bg-[#B1FA63]/15 border-[#B1FA63]/30 text-[#B1FA63] inline-flex items-center gap-1.5 px-2.5 py-0.5",
        className
      )}
    >
      <img
        src={badgeAsset.src}
        alt={badgeAsset.name}
        className="size-3.5 object-contain inline-block shrink-0"
        onError={(e) => {
          (e.target as HTMLElement).style.display = "none";
        }}
      />
      <span>{children ?? badgeAsset.name}</span>
    </Badge>
  );
}

export function MonoTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Badge variant="secondary" className={cn("rounded-[8px] font-mono text-[11px] font-medium tracking-wide bg-[#171717] border-white/10 text-zinc-300", className)}>
      {children}
    </Badge>
  );
}

export function EmptyState({
  title,
  body,
  action,
  className,
  imageSrc,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
  imageSrc?: string;
}) {
  const t = title.toLowerCase();
  const resolvedImage =
    imageSrc ||
    (t.includes("duel") || t.includes("contest") || t.includes("tournament") || t.includes("match")
      ? "/matiks-assets/empty-states/no_duels_to_flex.png"
      : t.includes("friend") || t.includes("peer") || t.includes("connection") || t.includes("follower")
      ? "/matiks-assets/empty-states/no_Friends.webp"
      : t.includes("leaderboard") || t.includes("standing") || t.includes("rank") || t.includes("cadet")
      ? "/matiks-assets/empty-states/empty_leaderboard.png"
      : t.includes("feed") || t.includes("post") || t.includes("announcement")
      ? "/matiks-assets/empty-states/no_feed.webp"
      : "/matiks-assets/empty-states/no_duels_to_flex.png");

  return (
    <div className={cn("flex flex-col items-center justify-center p-8 sm:p-12 text-center border border-white/[0.08] rounded-[24px] bg-[#1F1F1F] my-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)]", className)}>
      <div className="size-20 mb-3 flex items-center justify-center">
        <img
          src={resolvedImage}
          alt={title}
          className="size-full object-contain drop-shadow"
          onError={(e) => {
            (e.target as HTMLElement).style.display = "none";
          }}
        />
      </div>
      <h3 className="text-xl font-display uppercase tracking-wide text-white">{title}</h3>
      <p className="text-xs text-zinc-400 max-w-md mt-1.5 leading-relaxed font-sans">{body}</p>
      {action && <div className="mt-5">{action}</div>}
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
