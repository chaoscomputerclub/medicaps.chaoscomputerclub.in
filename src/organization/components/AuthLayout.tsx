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
  children,
}: {
  /** Legacy prop — ignored, kept for backward compat */
  kicker?: string;
  index?: string;
  footer?: ReactNode;
  brand?: ReactNode;
  description?: ReactNode;
  /** Primary heading rendered above the card */
  title: ReactNode;
  /** Secondary subtitle rendered above the card (below title) */
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-between bg-black px-4 py-12 antialiased">
      {/* ── Centered auth shell ── */}
      <div className="flex w-full flex-1 flex-col items-center justify-center">

        {/* Brand wordmark */}
        <Link
          to="/"
          className="mb-6 text-2xl font-bold tracking-tight text-white transition-opacity hover:opacity-80"
        >
          CCC Medi-Caps
        </Link>

        {/* Page title */}
        <h1 className="mb-1.5 text-[22px] font-semibold tracking-tight text-white">
          {title}
        </h1>

        {/* Subtitle (e.g. "We sent a 6-digit code to…") */}
        {subtitle && (
          <p className="mb-7 max-w-xs text-center text-sm leading-snug text-zinc-400">
            {subtitle}
          </p>
        )}

        {!subtitle && <div className="mb-7" />}

        {/* Obsidian card */}
        <div className="w-full max-w-[400px] rounded-2xl border border-white/[0.07] bg-[#161618] p-7 shadow-2xl shadow-black/70 sm:p-8">
          {children}
        </div>
      </div>

      {/* ── Viewport bottom footer ── */}
      <footer className="mt-10">
        <Link
          to="/terms"
          className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
        >
          Terms of Service
        </Link>
      </footer>
    </main>
  );
}
