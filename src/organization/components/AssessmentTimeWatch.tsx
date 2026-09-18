/**
 * Chaos Computer Club India — Assessment Time Watch (Countdown Timer)
 * High-tech precision countdown clock tracking the 24-hour unlock gate
 * and contest live start window.
 */

import { useEffect, useState } from "react";
import { Clock, Lock, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssessmentTimeWatchProps {
  startsAt: string;
  endsAt: string;
  isRegistered?: boolean;
  className?: string;
  onUnlockChange?: (isUnlocked: boolean) => void;
}

interface TimeRemaining {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  totalMs: number;
}

function getTimeRemaining(targetMs: number): TimeRemaining {
  const totalMs = Math.max(0, targetMs - Date.now());
  const totalSecs = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  return {
    days: String(days).padStart(2, "0"),
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
    totalMs,
  };
}

export function AssessmentTimeWatch({
  startsAt,
  endsAt,
  isRegistered = false,
  className = "",
  onUnlockChange,
}: AssessmentTimeWatchProps) {
  const startsMs = new Date(startsAt).getTime();
  const endsMs = new Date(endsAt).getTime();
  const unlockMs = startsMs - 24 * 60 * 60 * 1000; // 24 hours prior

  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (onUnlockChange) {
        onUnlockChange(current >= unlockMs && current <= endsMs);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [unlockMs, endsMs, onUnlockChange]);

  const isLocked = now < unlockMs;
  const isUnlocked = now >= unlockMs && now <= endsMs;
  const isLive = now >= startsMs && now <= endsMs;
  const isConcluded = now > endsMs;

  // Determine countdown target
  let targetMs = startsMs;
  let targetLabel = "Screening Live Start";
  let statusBadge = "LOCKED";
  let badgeClass = "badge-locked";

  if (isLocked) {
    targetMs = unlockMs;
    targetLabel = "24h Unlock Window";
    statusBadge = "LOCKED · OPENS 24H PRIOR";
    badgeClass = "badge-locked";
  } else if (isUnlocked && !isLive) {
    targetMs = startsMs;
    targetLabel = "Live Contest Start";
    statusBadge = "UNLOCKED · PRE-SCREENING";
    badgeClass = "badge-unlocked";
  } else if (isLive) {
    targetMs = endsMs;
    targetLabel = "Contest Closes In";
    statusBadge = "LIVE NOW";
    badgeClass = "badge-live";
  } else {
    statusBadge = "CONCLUDED";
    badgeClass = "badge-concluded";
  }

  const remaining = getTimeRemaining(targetMs);

  const formattedStart = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(startsAt));

  const formattedUnlock = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(unlockMs));

  return (
    <div className={cn("rounded-none border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-md shadow-xl space-y-4", className)}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase font-bold tracking-widest text-lime-400">
          <Clock className="w-3.5 h-3.5 text-lime-400" />
          <span>PHASE 1 SCREENING CLOCK</span>
        </div>
        <span
          className={cn(
            "rounded-none border px-2.5 py-0.5 font-mono text-[9px] uppercase font-bold tracking-wider inline-flex items-center gap-1.5",
            isLocked && "border-amber-500/30 bg-amber-950/30 text-amber-400",
            isUnlocked && !isLive && "border-emerald-500/30 bg-emerald-950/30 text-emerald-400",
            isLive && "border-lime-400/40 bg-lime-400/10 text-lime-400 animate-pulse",
            isConcluded && "border-white/10 bg-zinc-800/60 text-zinc-400",
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {statusBadge}
        </span>
      </div>

      <div className="flex items-center justify-between gap-1 sm:gap-2 rounded-none border border-white/10 bg-zinc-950/60 p-4 font-mono shadow-inner">
        <div className="flex flex-col items-center flex-1">
          <span className="text-2xl sm:text-3xl font-black tabular-nums text-white tracking-tight">{remaining.days}</span>
          <span className="text-[9px] uppercase tracking-widest text-zinc-400 mt-0.5">DAYS</span>
        </div>
        <span className="text-xl font-bold text-zinc-600 self-center -mt-3">:</span>
        <div className="flex flex-col items-center flex-1">
          <span className="text-2xl sm:text-3xl font-black tabular-nums text-white tracking-tight">{remaining.hours}</span>
          <span className="text-[9px] uppercase tracking-widest text-zinc-400 mt-0.5">HOURS</span>
        </div>
        <span className="text-xl font-bold text-zinc-600 self-center -mt-3">:</span>
        <div className="flex flex-col items-center flex-1">
          <span className="text-2xl sm:text-3xl font-black tabular-nums text-white tracking-tight">{remaining.minutes}</span>
          <span className="text-[9px] uppercase tracking-widest text-zinc-400 mt-0.5">MINS</span>
        </div>
        <span className="text-xl font-bold text-zinc-600 self-center -mt-3">:</span>
        <div className="flex flex-col items-center flex-1">
          <span className="text-2xl sm:text-3xl font-black tabular-nums text-lime-400 tracking-tight">{remaining.seconds}</span>
          <span className="text-[9px] uppercase tracking-widest text-zinc-400 mt-0.5">SECS</span>
        </div>
      </div>

      <div className="space-y-1.5 pt-2 border-t border-white/10 font-mono text-xs text-zinc-400">
        <div className="flex justify-between items-center">
          <span>Target:</span>
          <strong className="text-white">{targetLabel}</strong>
        </div>
        <div className="flex justify-between items-center">
          <span>Live Start:</span>
          <strong className="text-white">{formattedStart} IST</strong>
        </div>
        <div className="flex justify-between items-center">
          <span>Assessment Unlocks:</span>
          <strong className="text-white">{formattedUnlock} IST</strong>
        </div>
      </div>

      <div className="pt-1">
        {isLocked && (
          <p className="rounded-none border border-amber-500/30 bg-amber-950/20 p-3 text-xs font-mono text-amber-300 leading-relaxed">
            <Lock className="w-3.5 h-3.5 inline mr-1.5 text-amber-400" />
            Assessment unlocks <strong>strictly 24 hours</strong> before live contest. Questions remain sealed.
          </p>
        )}
        {isUnlocked && !isLive && (
          <p className="rounded-none border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs font-mono text-emerald-300 leading-relaxed">
            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5 text-emerald-400" />
            Assessment option is <strong>unlocked</strong> for registered cadets!
          </p>
        )}
        {isLive && (
          <p className="rounded-none border border-lime-400/30 bg-lime-950/20 p-3 text-xs font-mono text-lime-300 leading-relaxed">
            <Sparkles className="w-3.5 h-3.5 inline mr-1.5 text-lime-400" />
            Contest screening is <strong>live</strong>. All submissions actively scored.
          </p>
        )}
        {isConcluded && (
          <p className="rounded-none border border-white/10 bg-zinc-800/40 p-3 text-xs font-mono text-zinc-400 leading-relaxed">
            <AlertCircle className="w-3.5 h-3.5 inline mr-1.5 text-zinc-400" />
            Assessment window has ended.
          </p>
        )}
      </div>
    </div>
  );
}
