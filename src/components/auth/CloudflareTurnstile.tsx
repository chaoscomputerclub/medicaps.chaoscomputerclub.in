/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * src/components/auth/CloudflareTurnstile.tsx
 *
 * The real Cloudflare Turnstile widget (shows "Success!" + Cloudflare mark),
 * fitted to the auth form: full width, rounded-xl, theme-matched border.
 *
 * Notes:
 * - Turnstile renders inside a cross-origin iframe, so its inner colours and
 *   height (65px) are fixed by Cloudflare. We control the frame around it.
 * - The iframe ships with a 1px square border. We clip it with a rounded,
 *   overflow-hidden shell and draw our own border on the shell instead.
 */

import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        params: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: (error?: any) => void;
          "expired-callback"?: () => void;
          theme?: "dark" | "light" | "auto";
          size?: "normal" | "compact" | "flexible";
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface CloudflareTurnstileProps {
  siteKey?: string;
  onSuccess: (token: string) => void;
  onError?: (err?: any) => void;
  onExpire?: () => void;
  className?: string;
}

type Status = "loading" | "idle" | "verified" | "error";

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function CloudflareTurnstile({
  siteKey,
  onSuccess,
  onError,
  onExpire,
  className,
}: CloudflareTurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  // Latest callbacks live in a ref so inline arrow functions from the parent
  // don't destroy and re-create the widget on every render.
  const callbacksRef = useRef({ onSuccess, onError, onExpire });
  callbacksRef.current = { onSuccess, onError, onExpire };

  // Read strictly from environment variable — zero hardcoded credentials
  const activeSiteKey =
    siteKey ||
    (import.meta.env["VITE_CLOUDFLARE_TURNSTILE_SITE_KEY"] as string | undefined) ||
    "";

  useEffect(() => {
    let isMounted = true;
    let scriptEl: HTMLElement | null = null;

    function removeWidget() {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
      widgetIdRef.current = null;
    }

    function renderWidget() {
      if (!isMounted || !containerRef.current || !window.turnstile) return;
      removeWidget();
      setStatus("idle");

      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: activeSiteKey,
          theme: "dark",
          size: "flexible", // fills the container width instead of fixed 300px
          callback: (token) => {
            if (!isMounted) return;
            setStatus("verified");
            callbacksRef.current.onSuccess(token);
          },
          "error-callback": (err) => {
            if (!isMounted) return;
            setStatus("error");
            callbacksRef.current.onError?.(err);
          },
          "expired-callback": () => {
            if (!isMounted) return;
            setStatus("idle");
            callbacksRef.current.onExpire?.();
          },
        });
      } catch (err) {
        if (!isMounted) return;
        setStatus("error");
        callbacksRef.current.onError?.(err);
      }
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      scriptEl = document.getElementById(SCRIPT_ID);
      if (!scriptEl) {
        const script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.onerror = (e) => {
          if (!isMounted) return;
          setStatus("error");
          callbacksRef.current.onError?.(e);
        };
        document.head.appendChild(script);
        scriptEl = script;
      }
      scriptEl.addEventListener("load", renderWidget);
    }

    return () => {
      isMounted = false;
      scriptEl?.removeEventListener("load", renderWidget);
      removeWidget();
    };
  }, [activeSiteKey]);

  return (
    <div
      className={cn(
        // Shell: fixed 65px = Turnstile's height, so nothing shifts on load.
        "relative h-[65px] w-full overflow-hidden rounded-xl border bg-[#232323]",
        "transition-colors duration-200",
        status === "error"
          ? "border-amber-500/40"
          : "border-white/[0.08] hover:border-white/15",
        className,
      )}
    >
      {/* Loader sits behind the iframe and is covered once the widget paints */}
      <div className="absolute inset-0 flex items-center justify-center gap-2 text-[12px] text-zinc-500">
        <Loader2 className="size-3.5 animate-spin" />
        <span>Loading security check…</span>
      </div>

      {/* -1px offsets push the iframe's own square border outside the clip */}
      <div
        ref={containerRef}
        className="relative -m-px w-[calc(100%+2px)]"
      />
    </div>
  );
}