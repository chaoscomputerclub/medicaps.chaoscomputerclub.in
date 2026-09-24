/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * src/components/auth/CloudflareTurnstile.tsx
 *
 * Production Cloudflare Turnstile Bot Verification Component.
 * Integrates Cloudflare Client Security Challenge with the CCC dark terminal aesthetic.
 */

import React, { useEffect, useRef, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
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
    onloadTurnstileCallback?: () => void;
  }
}

interface CloudflareTurnstileProps {
  siteKey?: string;
  onSuccess: (token: string) => void;
  onError?: (err?: any) => void;
  onExpire?: () => void;
  className?: string;
}

export function CloudflareTurnstile({
  siteKey,
  onSuccess,
  onError,
  onExpire,
  className,
}: CloudflareTurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Cloudflare official testing sitekey (always passes) used as fallback if not provisioned in env
  const activeSiteKey =
    siteKey ||
    (import.meta.env["VITE_CLOUDFLARE_TURNSTILE_SITE_KEY"] as string | undefined) ||
    "1x00000000000000000000AA";

  useEffect(() => {
    let isMounted = true;

    function renderWidget() {
      if (!isMounted || !containerRef.current || !window.turnstile) return;

      // Clean up previous widget if existing
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore cleanup error
        }
        widgetIdRef.current = null;
      }

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: activeSiteKey,
          theme: "dark",
          size: "normal",
          callback: (token: string) => {
            if (isMounted) {
              setHasError(false);
              onSuccess(token);
            }
          },
          "error-callback": (err: any) => {
            if (isMounted) {
              setHasError(true);
              onError?.(err);
            }
          },
          "expired-callback": () => {
            if (isMounted) {
              onExpire?.();
            }
          },
        });
        widgetIdRef.current = id;
        setIsReady(true);
      } catch (err) {
        if (isMounted) {
          setHasError(true);
          onError?.(err);
        }
      }
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      const existingScript = document.getElementById("cf-turnstile-script");
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = "cf-turnstile-script";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.onload = () => {
          if (isMounted) renderWidget();
        };
        script.onerror = (e) => {
          if (isMounted) {
            setHasError(true);
            onError?.(e);
          }
        };
        document.head.appendChild(script);
      } else {
        existingScript.addEventListener("load", renderWidget);
      }
    }

    return () => {
      isMounted = false;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, [activeSiteKey, onSuccess, onError, onExpire]);

  return (
    <div className={cn("w-full flex flex-col items-center justify-center my-2", className)}>
      <div
        ref={containerRef}
        className="flex items-center justify-center min-h-[65px] transition-opacity duration-200"
      />
      {hasError && (
        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-amber-400 font-mono">
          <ShieldAlert className="size-3" />
          <span>Security check challenge failed. Please retry.</span>
        </div>
      )}
    </div>
  );
}
