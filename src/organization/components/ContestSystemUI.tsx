import type { ReactNode } from "react";
import { Check, Circle, LockKeyhole, Monitor, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContestLifecycle, ContestRecord, RankingEntry, Stage } from "../data/contest-system";

const lifecycleLabels: Record<ContestLifecycle, string> = {
  registration_open: "Registration open",
  assessment_live: "Assessment live",
  results_pending: "Results pending",
  qualification_announced: "Qualification announced",
  offline_complete: "Offline round complete",
};

export function LifecycleBadge({ lifecycle }: { lifecycle: ContestLifecycle }) {
  return <span className={cn("lifecycle-badge", lifecycle)}><i />{lifecycleLabels[lifecycle]}</span>;
}

export function TwoStageIndicator({ stages, compact = false }: { stages: [Stage, Stage]; compact?: boolean }) {
  return <div className={cn("two-stage", compact && "compact")} aria-label="Two-round contest format">{stages.map((stage, index) => <div className={cn("stage-node", stage.status)} key={stage.number}><span>{stage.status === "complete" ? <Check /> : stage.status === "locked" ? <LockKeyhole /> : stage.number}</span><div><small>Round {stage.number}</small><strong>{stage.title}</strong><em>{stage.mode === "online" ? <Monitor /> : <MapPin />}{stage.mode}</em></div>{index === 0 && <i className="stage-connector" />}</div>)}</div>;
}

export function StatePanel({ icon, kicker, title, children, actions }: { icon: ReactNode; kicker: string; title: string; children: ReactNode; actions?: ReactNode }) {
  return <section className="state-panel"><div className="state-icon">{icon}</div><p className="kicker">{kicker}</p><h1>{title}</h1><div className="state-copy">{children}</div>{actions && <div className="button-row">{actions}</div>}</section>;
}

export function ResultSummary({ result, state }: { result: RankingEntry; state: "qualified" | "not-qualified" | "pending" }) {
  return <section className={cn("result-summary", state)}><div><p className="kicker">Your contest standing</p><h2>{state === "pending" ? "Results are being verified" : "Performance Recorded"}</h2><p>{state === "pending" ? "Scores are sealed while final grading completes." : "You completed the algorithmic contest and earned an official university standing."}</p></div><dl><div><dt>Rank</dt><dd>{state === "pending" ? "—" : `#${result.rank}`}</dd></div><div><dt>Score</dt><dd>{state === "pending" ? "—" : `${result.score}/100`}</dd></div><div><dt>Status</dt><dd>Official</dd></div></dl></section>;
}

export function Timeline({ contest }: { contest: ContestRecord }) {
  const items: Array<[string, string]> = [
    ["Registration closes", contest.registration_closes_at],
    ["Online assessment", contest.stages[0].starts_at],
    ["Results published", contest.results_at],
    ["Offline live contest", contest.stages[1].starts_at],
  ];
  return <ol className="contest-timeline">{items.map(([label, date], index) => <li key={label}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{label}</strong><time>{new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(date))} IST</time></div>{index < items.length - 1 && <Circle />}</li>)}</ol>;
}