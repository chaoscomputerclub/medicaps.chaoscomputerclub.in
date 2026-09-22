/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Strix-inspired Minimalist Auth Layout.
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { Link } from "react-router-dom";
import { type ReactNode } from "react";

export function AuthLayout({
  title,
  description,
  children,
  brand,
}: {
  kicker?: string;
  index?: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  brand?: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-between bg-black px-4 py-12 antialiased selection:bg-zinc-800 selection:text-white">
      {/* Centered Auth Shell */}
      <div className="w-full flex-1 flex flex-col items-center justify-center my-auto">
        {/* Brand & Title Block */}
        <div className="mb-7 flex flex-col items-center text-center">
          {brand ? (
            brand
          ) : (
            <Link
              to="/"
              className="text-2xl sm:text-[28px] font-bold tracking-tight text-white hover:opacity-90 transition-opacity"
            >
              CCC Medi-Caps
            </Link>
          )}

          <h1 className="mt-5 text-xl sm:text-[22px] font-medium tracking-tight text-white">
            {title}
          </h1>

          {description && (
            <p className="mt-2 max-w-sm text-xs sm:text-sm text-zinc-400">
              {description}
            </p>
          )}
        </div>

        {/* Obsidian Card Container */}
        <div className="w-full max-w-[400px] rounded-2xl bg-[#161618] border border-white/[0.08] shadow-2xl shadow-black/80 p-7 sm:p-8">
          {children}
        </div>
      </div>

      {/* Viewport Bottom Footer */}
      <footer className="mt-12 text-center">
        <Link
          to="/terms"
          className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
        >
          Terms of Service
        </Link>
      </footer>
    </main>
  );
}
