/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { useId, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight code editor: gutter line numbers, tab-aware textarea, mono type.
 * Deliberately not Monaco — no execution engine exists yet and the portal's
 * animation/weight budget rules out shipping an editor bundle for a mock flow.
 */
export function CodeEditor({
  value,
  onChange,
  language,
  label,
  id,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  language: string;
  label: string;
  id?: string;
  className?: string;
}) {
  const generated = useId();
  const inputId = id ?? generated;
  const ref = useRef<HTMLTextAreaElement>(null);
  const lineCount = useMemo(() => Math.max(value.split("\n").length, 12), [value]);

  return (
    <div className={cn("border border-border bg-surface", className)}>
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <label
          htmlFor={inputId}
          className="font-mono text-[0.625rem] tracking-[0.18em] text-muted-foreground uppercase"
        >
          {label}
        </label>
        <span className="font-mono text-[0.625rem] text-subtle-foreground">{language}</span>
      </div>
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)]">
        <ol
          aria-hidden
          className="select-none border-r border-border py-3 text-right font-mono text-[0.6875rem] leading-6 text-index"
        >
          {Array.from({ length: lineCount }).map((_, i) => (
            <li key={i} className="pr-2">
              {i + 1}
            </li>
          ))}
        </ol>
        <textarea
          id={inputId}
          ref={ref}
          value={value}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Tab" || e.shiftKey) return;
            e.preventDefault();
            const el = e.currentTarget;
            const { selectionStart: s, selectionEnd: end } = el;
            const next = `${value.slice(0, s)}  ${value.slice(end)}`;
            onChange(next);
            requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
          }}
          rows={lineCount}
          className="resize-y bg-transparent px-3 py-3 font-mono text-[0.8125rem] leading-6 text-foreground outline-none placeholder:text-index focus-visible:bg-surface-raised/40"
          placeholder="// your attempt"
        />
      </div>
      <p className="border-t border-border px-3 py-2 font-mono text-[0.625rem] text-subtle-foreground">
        Tab inserts two spaces. Submissions are queued — nothing is executed yet.
      </p>
    </div>
  );
}
