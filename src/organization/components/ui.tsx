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
  kicker?: string;
  index?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] p-6 sm:p-8 flex flex-col md:flex-row md:items-end justify-between gap-5 sm:gap-6",
        className
      )}
    >
      <div className="space-y-2 max-w-2xl min-w-0">
        {badge && (
          <div className="flex items-center gap-2.5 flex-wrap">
            {badge}
          </div>
        )}
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
  kicker?: string;
  title: ReactNode;
  index?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-4 border-b border-white/[0.08] pb-3 mb-5 min-w-0", className)}>
      <div className="min-w-0 flex-1">
        <h2 className="text-2xl sm:text-3xl font-display uppercase tracking-wide text-white break-words">
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
    <div className={cn("p-5 rounded-[20px] sm:rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] hover:border-[#B1FA63]/30 transition-all duration-200", className)}>
      <span className="block text-xs font-heading font-bold text-zinc-400 uppercase tracking-wider truncate">{label}</span>
      <strong className="block text-3xl sm:text-4xl font-display text-white mt-1 tabular-nums truncate tracking-wide">{value}</strong>
      {detail && <small className="block text-xs font-sans text-zinc-500 mt-1 truncate">{detail}</small>}
    </div>
  );
}

export function TierBadge({
  children,
  className,
  tier,
  rating,
  attendanceCount,
}: {
  children?: ReactNode;
  className?: string;
  tier?: string | null;
  rating?: number | null;
  attendanceCount?: number | null;
}) {
  const isUnranked = attendanceCount === 0 || rating === 0;

  if (isUnranked) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "rounded-full font-mono text-[11px] font-medium tracking-wide bg-white/[0.03] border-white/10 text-zinc-400 inline-flex items-center gap-1.5 px-2.5 py-0.5",
          className
        )}
      >
        <span className="size-1.5 rounded-full bg-zinc-500 inline-block shrink-0" />
        <span>Unranked</span>
      </Badge>
    );
  }

  const rawText = (typeof children === "string" ? children : tier || "").trim();
  const badgeAsset = getTierBadgeAsset(rawText, rating);

  // Format clean division name: never output raw slugs like "1_star" or "2_star"
  let label = rawText;
  if (!label || label.includes("_star") || label === "—" || label.toLowerCase().includes("explorer")) {
    label = badgeAsset.name;
  }

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
      <span>{label}</span>
    </Badge>
  );
}

export function MonoTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Badge variant="secondary" className={cn("rounded-[8px] font-sans text-[11px] font-medium tracking-wide bg-[#171717] border-white/10 text-zinc-300", className)}>
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
  makoVariant,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
  imageSrc?: string;
  makoVariant?: import("@/components/common/MakoMascot").MakoVariant;
}) {
  const t = title.toLowerCase();
  const resolvedVariant: import("@/components/common/MakoMascot").MakoVariant =
    makoVariant ||
    (t.includes("search") || t.includes("find") || t.includes("filter")
      ? "search"
      : t.includes("not found") || t.includes("missing") || t.includes("empty")
      ? "not-found"
      : t.includes("scheduled") || t.includes("offline") || t.includes("concluded")
      ? "sleeping"
      : t.includes("duel") || t.includes("contest") || t.includes("tournament") || t.includes("match")
      ? "ready"
      : t.includes("friend") || t.includes("peer") || t.includes("connection") || t.includes("follower")
      ? "welcome"
      : t.includes("task") || t.includes("submission") || t.includes("checklist") || t.includes("participation")
      ? "tasks"
      : t.includes("leaderboard") || t.includes("standing") || t.includes("rank")
      ? "superhero"
      : t.includes("archive") || t.includes("practice") || t.includes("problem")
      ? "learning"
      : t.includes("error") || t.includes("fail") || t.includes("denied")
      ? "error"
      : t.includes("verification") || t.includes("judging")
      ? "loading"
      : "coder");

  return (
    <div className={cn("flex flex-col items-center justify-center p-8 sm:p-12 text-center border border-white/[0.08] rounded-[24px] bg-[#1F1F1F] my-6", className)}>
      <div className="mb-4 flex items-center justify-center">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={title}
            className="size-20 object-contain"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
            }}
          />
        ) : (
          <img
            src={`/mako/mako-${resolvedVariant}.webp`}
            alt={title}
            loading="lazy"
            decoding="async"
            className="w-24 h-24 sm:w-28 sm:h-28 object-contain select-none pointer-events-none"
          />
        )}
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
