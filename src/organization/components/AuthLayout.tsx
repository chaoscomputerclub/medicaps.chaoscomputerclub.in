/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** Instrumental auth chrome: centered emblem logo, hairline frame, no clutter. */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4 py-16">
      {/* Subtle ambient lighting */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/[0.04] via-transparent to-transparent" />

      <div className="relative w-full max-w-md">
        {/* Centered logo only */}
        <div className="mb-6 flex justify-center">
          <Link
            to="/"
            className="group flex size-14 items-center justify-center rounded-full border border-border/80 bg-surface p-2.5 shadow-[0_0_24px_rgba(0,0,0,0.5)] transition-all duration-300 hover:scale-105 hover:border-accent/60 hover:shadow-[0_0_24px_rgba(255,255,255,0.15)]"
          >
            <img
              src="/logo.png"
              alt="Chaos Computer Club Logo"
              className="size-full object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] transition-transform duration-300 group-hover:scale-110"
            />
          </Link>
        </div>

        {/* Card */}
        <div className="border border-border bg-surface shadow-2xl">
          <div className="border-b border-border px-6 py-5">
            <h1 className="font-display text-xl font-bold tracking-tight text-foreground">{title}</h1>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
          <div className="p-6">{children}</div>
          {footer ? (
            <div className="border-t border-border px-6 py-4 text-xs text-muted-foreground">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
