/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * Tactical Cyber-Terminal Route Loading Fallback
 * Compliant with DESIGN.md, Taste Skill v2, and Vercel Web Interface Guidelines.
 */

import React from "react";

export function TacticalRouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading platform route"
      className="relative flex min-h-[60vh] w-full flex-col items-center justify-center overflow-hidden bg-zinc-950 p-6"
    >
      {/* Background Matrix Grid Pattern */}
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px]"
        aria-hidden="true"
      />

      {/* Center Tactical Telemetry Module */}
      <div className="relative z-10 flex flex-col items-center gap-4 rounded-none border border-white/10 bg-zinc-900/80 p-8 shadow-2xl backdrop-blur-md">
        {/* Radar Pulse Node */}
        <div className="relative flex size-10 items-center justify-center">
          <span
            className="absolute size-full animate-ping rounded-none bg-lime-400/20 opacity-75 duration-1000"
            aria-hidden="true"
          />
          <div className="size-3.5 rounded-none border border-lime-400/60 bg-lime-400 shadow-[0_0_12px_rgba(163,230,53,0.5)]" />
        </div>

        {/* Status Telemetry */}
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-2 font-mono text-xs font-black uppercase tracking-widest text-lime-400">
            <span className="size-1.5 rounded-none bg-lime-400" />
            SYSTEM // HYDRATING ROUTE…
          </div>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-zinc-400">
            Fetching secure code chunk & telemetry state
          </p>
        </div>

        {/* Shimmer Progress Track */}
        <div
          className="relative h-1 w-48 overflow-hidden rounded-none bg-zinc-800"
          aria-hidden="true"
        >
          <div className="absolute inset-0 h-full w-1/2 animate-[shimmer_1.4s_infinite_linear] bg-gradient-to-r from-transparent via-lime-400/60 to-transparent" />
        </div>
      </div>
    </div>
  );
}
