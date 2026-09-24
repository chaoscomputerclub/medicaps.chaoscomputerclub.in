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
  const [activeSiteKey, setActiveSiteKey] = useState<string>(
    siteKey ||
    (import.meta.env["VITE_CLOUDFLARE_TURNSTILE_SITE_KEY"] as string | undefined) ||
    ""
  );
  const [retryCount, setRetryCount] = useState(0);

  // Latest callbacks live in a ref so inline arrow functions from the parent
  // don't destroy and re-create the widget on every render.
  const callbacksRef = useRef({ onSuccess, onError, onExpire });
  callbacksRef.current = { onSuccess, onError, onExpire };

  // Dynamically fetch public Turnstile site key from backend if not baked at build-time
  useEffect(() => {
    if (activeSiteKey) return;
    let isCancelled = false;

    fetch("/api/auth/security-config")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch security config");
        return res.json();
      })
      .then((data) => {
        if (isCancelled) return;
        if (data.turnstile_enabled === false) {
          setStatus("verified");
          callbacksRef.current.onSuccess("dev-bypass");
          return;
        }
        if (data.turnstile_site_key) {
          setActiveSiteKey(data.turnstile_site_key);
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setStatus("error");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [activeSiteKey, retryCount]);

  useEffect(() => {
    if (!activeSiteKey) return;

    let isMounted = true;
    let scriptEl: HTMLElement | null = null;

    // Safety timeout: if widget hangs in "loading" state for > 6s, fail gracefully
    const timeoutId = setTimeout(() => {
      if (isMounted && status === "loading") {
        setStatus("error");
        callbacksRef.current.onError?.(new Error("Turnstile load timeout"));
      }
    }, 6000);

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
            clearTimeout(timeoutId);
            setStatus("verified");
            callbacksRef.current.onSuccess(token);
          },
          "error-callback": (err) => {
            if (!isMounted) return;
            clearTimeout(timeoutId);
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
        clearTimeout(timeoutId);
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
          clearTimeout(timeoutId);
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
      clearTimeout(timeoutId);
      scriptEl?.removeEventListener("load", renderWidget);
      removeWidget();
    };
  }, [activeSiteKey, retryCount]);

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
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-[12px] text-zinc-500">
          <Loader2 className="size-3.5 animate-spin" />
          <span>Verifying security…</span>
        </div>
      )}

      {/* Error state with retry action */}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-between px-4 text-[12px] text-zinc-400">
          <span>Security check unavailable</span>
          <button
            type="button"
            onClick={() => {
              setStatus("loading");
              setActiveSiteKey("");
              setRetryCount((c) => c + 1);
            }}
            className="text-[12px] font-medium text-lime-400 hover:underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* -1px offsets push the iframe's own square border outside the clip */}
      <div
        ref={containerRef}
        className="relative -m-px w-[calc(100%+2px)]"
      />
    </div>
  );
}