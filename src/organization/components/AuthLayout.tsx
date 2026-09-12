/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { Link } from "@tanstack/react-router";
import { type ReactNode } from "react";

/** Instrumental auth chrome: single unified box card with high-impact typography. */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: ReactNode;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center bg-background px-4 py-12 sm:py-8 overflow-hidden">
      {/* Ambient background grid & lighting */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/[0.05] via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#1f1f1f15_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      {/* Main Sign-in Container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Emblem Logo Badge — Outside the Box Card */}
        <div className="mb-6 flex justify-center">
          <Link
            to="/"
            className="group flex size-20 items-center justify-center rounded-full border border-border/80 bg-surface p-2.5 shadow-[0_0_28px_rgba(0,0,0,0.8)] transition-all duration-300 hover:scale-105 hover:border-accent/60 hover:shadow-[0_0_24px_rgba(200,255,54,0.2)]"
          >
            <img
              src="/logo.png"
              alt="Chaos Computer Club Logo"
              className="size-full object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] transition-transform duration-300 group-hover:scale-110"
            />
          </Link>
        </div>

        {/* Main Box Card */}
        <div className="relative z-10 w-full border border-border bg-surface shadow-2xl">
          <div className="border-b border-border px-5 py-6 sm:px-6 text-center sm:text-left">
            <h1 className="font-display font-[850] uppercase tracking-tight text-foreground text-[3.15rem] leading-[0.95] sm:text-[3.4rem] sm:leading-[1]">
              {title}
            </h1>
            <p className="mt-2.5 font-sans text-xs sm:text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>

          <div className="p-5 sm:p-6">{children}</div>

          {footer ? (
            <div className="border-t border-border px-5 py-3 sm:px-6 sm:py-4 font-mono text-xs text-muted-foreground text-center">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
