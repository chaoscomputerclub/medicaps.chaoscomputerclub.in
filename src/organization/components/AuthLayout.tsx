/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** Instrumental auth chrome: hairline frame, mono metadata, no cinematic motion. */
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
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="group inline-flex items-center gap-3 font-mono text-[0.5625rem] tracking-[0.2em] text-muted-foreground uppercase transition-colors duration-150 hover:text-accent"
        >
          <img
            src="/logo.png"
            alt="Chaos Computer Club Logo"
            className="size-8 shrink-0 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] transition-transform duration-200 group-hover:scale-105"
          />
          <div className="flex flex-col leading-tight">
            <span className="font-bold tracking-widest text-[0.6875rem] text-foreground transition-colors group-hover:text-accent">
              CHAOS COMPUTER CLUB
            </span>
            <span className="text-[0.5rem] tracking-wider text-muted-foreground">
              Medi-Caps Chapter <span className="text-accent/90">[member portal]</span>
            </span>
          </div>
        </Link>

        <div className="mt-4 border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h1 className="font-display text-xl tracking-tight text-foreground">{title}</h1>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
          <div className="p-5">{children}</div>
          {footer ? (
            <div className="border-t border-border px-5 py-4 text-[0.8125rem] text-muted-foreground">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
