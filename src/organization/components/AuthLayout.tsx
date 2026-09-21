/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { Link } from "react-router-dom";
import { type ReactNode } from "react";

export function AuthLayout({
  kicker = "Access Gate",
  index,
  title,
  description,
  children,
  footer,
}: {
  kicker?: string;
  index?: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center bg-black px-4 py-12 antialiased">
      <div className="w-full max-w-md">
        {/* Minimalist Logo & Title */}
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <img src="/logo.webp" alt="Chaos Computer Club" className="w-8 h-8 object-contain" />
          <Link to="/" className="font-mono text-sm font-bold tracking-wider text-white">
            CCC MEDI-CAPS
          </Link>
        </div>

        {/* Pure Black Card */}
        <div className="w-full rounded-xl border border-white/10 bg-black overflow-hidden shadow-none">
          <div className="border-b border-white/8 px-6 py-5 text-left">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-lime-400">
                {kicker}
              </span>
              {index && (
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 tabular-nums">
                  · {index}
                </span>
              )}
            </div>
            <h1 className="font-sans font-semibold tracking-tight text-white text-xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-1 font-sans text-xs text-zinc-400 leading-normal">
                {description}
              </p>
            ) : null}
          </div>

          <div className="p-6">{children}</div>

          {footer ? (
            <div className="border-t border-white/8 px-6 py-3.5 font-mono text-xs text-zinc-500 text-center">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
