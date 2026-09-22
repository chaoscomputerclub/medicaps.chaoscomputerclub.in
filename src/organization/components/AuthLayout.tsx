/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Strix-inspired Minimalist Auth Layout — CCC Lime Edition.
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { Link } from "react-router-dom";
import { type ReactNode } from "react";

export function AuthLayout({
  title,
  subtitle,
  bottomAction,
  children,
}: {
  /** Legacy props — ignored, kept for backward compat */
  kicker?: string;
  index?: string;
  footer?: ReactNode;
  brand?: ReactNode;
  description?: ReactNode;
  /** Primary heading rendered above the card */
  title: ReactNode;
  /** Secondary subtitle rendered above the card (if any) */
  subtitle?: ReactNode;
  /** Action rendered outside and below the card (e.g. Change email) */
  bottomAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-between bg-black px-4 py-12 antialiased selection:bg-[#CCFF00]/30 selection:text-white">
      {/* ── Centered auth shell ── */}
      <div className="flex w-full flex-1 flex-col items-center justify-center">

        {/* Brand Logo — Standalone CCC Emblem */}
        <Link
          to="/"
          className="mb-6 inline-flex transition-opacity hover:opacity-80"
          aria-label="Chaos Computer Club Home"
        >
          <img
            src="/logo.webp"
            alt="Chaos Computer Club"
            className="h-9 w-9 object-contain"
          />
        </Link>

        {/* Page title with smooth cross-fade */}
        <h1
          key={typeof title === "string" ? title : "auth-title"}
          className="auth-title-transition mb-2 text-[24px] font-semibold tracking-tight text-white"
        >
          {title}
        </h1>

        {/* Subtitle (only rendered if provided) */}
        {subtitle && (
          <p className="auth-title-transition mb-7 max-w-xs text-center text-[13px] leading-snug text-zinc-400">
            {subtitle}
          </p>
        )}

        {!subtitle && <div className="mb-7" />}

        {/* Obsidian card — Sleek Rectangle Geometry */}
        <div className="w-full max-w-[440px] overflow-hidden rounded-[24px] border border-white/[0.08] border-t-white/[0.15] bg-gradient-to-b from-[#1a1a1d] to-[#141416] p-8 shadow-[0_24px_70px_-12px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.03)] sm:p-9">
          {children}
        </div>

        {/* Action outside & below the card */}
        {bottomAction && (
          <div className="mt-6 text-center">
            {bottomAction}
          </div>
        )}
      </div>

      {/* ── Viewport bottom footer ── */}
      <footer className="mt-10">
        <Link
          to="/terms"
          className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Terms of Service
        </Link>
      </footer>
    </main>
  );
}
