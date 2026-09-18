/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { Link } from "react-router-dom";
import { type ReactNode } from "react";

/** Instrumental auth chrome: single unified box card with high-impact typography. */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center bg-black px-4 py-12 sm:py-8 overflow-hidden">
      {/* Ambient background grid & lighting */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(204,255,0,0.09)_0%,transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      {/* Main Sign-in Container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Emblem Logo Badge */}
        <div className="mb-6 flex justify-center">
          <Link
            to="/"
            className="group flex size-20 items-center justify-center rounded-none border border-white/10 bg-zinc-900/80 p-3 shadow-2xl transition-all duration-300 hover:scale-105 hover:border-lime-400 hover:shadow-[0_0_24px_rgba(204,255,0,0.25)]"
          >
            <img
              src="/logo.png"
              alt="Chaos Computer Club Logo"
              className="size-full object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] transition-transform duration-300 group-hover:scale-110"
            />
          </Link>
        </div>

        {/* Main Box Card */}
        <div className="relative z-10 w-full rounded-none border border-white/10 bg-zinc-900/60 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="border-b border-white/10 px-6 py-6 text-center sm:text-left">
            <h1 className="font-mono font-black uppercase tracking-tight text-white text-3xl sm:text-4xl leading-tight">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 font-sans text-xs sm:text-sm leading-relaxed text-zinc-400">
                {description}
              </p>
            ) : null}
          </div>

          <div className="p-6">{children}</div>

          {footer ? (
            <div className="border-t border-white/10 px-6 py-4 font-mono text-xs text-zinc-400 text-center">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
