/**
 * Chaos Computer Club India — Assessment Time Watch (Countdown Timer)
 * High-tech precision countdown clock tracking the 24-hour unlock gate
 * and contest live start window.
 */

import { useEffect, useState } from "react";
import { Clock, Lock, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";

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
    <div className={`time-watch-card ${className}`}>
      <div className="time-watch-top">
        <div className="time-watch-kicker">
          <Clock className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>PHASE 1 SCREENING CLOCK</span>
        </div>
        <span className={`time-watch-pill ${badgeClass}`}>
          <i className="pill-dot" />
          {statusBadge}
        </span>
      </div>

      <div className="time-watch-digits">
        <div className="time-digit-unit">
          <span className="digit-val">{remaining.days}</span>
          <span className="digit-sub">DAYS</span>
        </div>
        <span className="digit-colon">:</span>
        <div className="time-digit-unit">
          <span className="digit-val">{remaining.hours}</span>
          <span className="digit-sub">HOURS</span>
        </div>
        <span className="digit-colon">:</span>
        <div className="time-digit-unit">
          <span className="digit-val">{remaining.minutes}</span>
          <span className="digit-sub">MINS</span>
        </div>
        <span className="digit-colon">:</span>
        <div className="time-digit-unit digit-seconds">
          <span className="digit-val">{remaining.seconds}</span>
          <span className="digit-sub">SECS</span>
        </div>
      </div>

      <div className="time-watch-info">
        <div className="info-row">
          <span>Target:</span>
          <strong>{targetLabel}</strong>
        </div>
        <div className="info-row">
          <span>Live Start:</span>
          <strong>{formattedStart} IST</strong>
        </div>
        <div className="info-row">
          <span>Assessment Unlocks:</span>
          <strong>{formattedUnlock} IST</strong>
        </div>
      </div>

      <div className="time-watch-notice">
        {isLocked && (
          <p className="notice-locked">
            <Lock className="w-3.5 h-3.5 inline mr-1 text-[var(--warning)]" />
            Assessment unlocks <strong>strictly 24 hours</strong> before live contest. Questions remain sealed.
          </p>
        )}
        {isUnlocked && !isLive && (
          <p className="notice-unlocked">
            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-[var(--accent)]" />
            Assessment option is <strong>unlocked</strong> for registered cadets!
          </p>
        )}
        {isLive && (
          <p className="notice-live">
            <Sparkles className="w-3.5 h-3.5 inline mr-1 text-[var(--accent)]" />
            Contest screening is <strong>live</strong>. All submissions actively scored.
          </p>
        )}
        {isConcluded && (
          <p className="notice-concluded">
            <AlertCircle className="w-3.5 h-3.5 inline mr-1 text-[var(--muted)]" />
            Assessment window has ended.
          </p>
        )}
      </div>
    </div>
  );
}
