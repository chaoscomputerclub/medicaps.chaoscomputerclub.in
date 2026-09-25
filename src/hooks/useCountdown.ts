import { useState, useEffect, useRef } from "react";

export interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  totalSeconds: number;
}

/**
 * High-performance, resilient countdown hook.
 * Uses ref-stabilized expiration callback to avoid infinite re-render loops (Maximum update depth exceeded).
 */
export function useCountdown(
  targetIsoDate: string | null | undefined,
  onExpire?: () => void
): CountdownResult {
  const [timeLeft, setTimeLeft] = useState<CountdownResult>(() => {
    if (!targetIsoDate) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, totalSeconds: 0 };
    }
    const target = new Date(targetIsoDate).getTime();
    if (isNaN(target)) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, totalSeconds: 0 };
    }
    const diff = Math.max(0, target - Date.now());
    const totalSeconds = Math.floor(diff / 1000);
    return {
      days: Math.floor(totalSeconds / 86400),
      hours: Math.floor((totalSeconds % 86400) / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
      isExpired: totalSeconds <= 0,
      totalSeconds,
    };
  });

  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  // Keep latest onExpire ref without triggering effect re-runs
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  // Reset fired state when target date changes
  useEffect(() => {
    firedRef.current = false;
  }, [targetIsoDate]);

  useEffect(() => {
    if (!targetIsoDate) return;

    const calc = () => {
      const target = new Date(targetIsoDate).getTime();
      if (isNaN(target)) return;
      const now = Date.now();
      const diff = Math.max(0, target - now);
      const totalSeconds = Math.floor(diff / 1000);
      const isExpired = totalSeconds <= 0;

      setTimeLeft((prev) => {
        // Prevent unnecessary state updates if totalSeconds hasn't changed
        if (prev.totalSeconds === totalSeconds && prev.isExpired === isExpired) {
          return prev;
        }
        return {
          days: Math.floor(totalSeconds / 86400),
          hours: Math.floor((totalSeconds % 86400) / 3600),
          minutes: Math.floor((totalSeconds % 3600) / 60),
          seconds: totalSeconds % 60,
          isExpired,
          totalSeconds,
        };
      });

      if (isExpired && !firedRef.current && onExpireRef.current) {
        firedRef.current = true;
        onExpireRef.current();
      }
    };

    // Calculate immediately on effect mount / targetIsoDate change
    calc();

    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [targetIsoDate]);

  return timeLeft;
}
