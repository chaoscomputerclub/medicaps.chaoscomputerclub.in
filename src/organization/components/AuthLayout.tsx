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
          className="font-mono text-[0.5625rem] tracking-[0.2em] text-muted-foreground uppercase transition-colors duration-150 hover:text-accent"
        >
          Chaos Computer Club <span className="text-index">[member portal]</span>
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
