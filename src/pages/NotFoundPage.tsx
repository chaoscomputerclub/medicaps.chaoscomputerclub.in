import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Home, Terminal, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MakoMascot } from "@/components/common/MakoMascot";

export function NotFoundPage() {
  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-300">
      <div className="relative mb-6">
        <MakoMascot
          variant="not-found"
          size="2xl"
          className="transition-transform duration-300 hover:scale-105"
        />
      </div>

      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-3">
        <span className="size-1.5 rounded-full bg-red-400 animate-pulse" />
        <span>Error 404 · Uncharted Sector</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-display uppercase tracking-wider text-white mb-2">
        Coordinates Not Found
      </h1>

      <p className="text-xs sm:text-sm text-zinc-400 max-w-md mb-8 leading-relaxed font-sans">
        Mako couldn't locate this page in the Chaos Computer Club network. The route may have been decommissioned or the path misspelled.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          asChild
          className="h-10 px-5 text-xs font-mono font-semibold bg-[#B1FA63] text-black hover:bg-[#9fe350] rounded-xl transition-all active:scale-[0.98]"
        >
          <Link to="/" className="inline-flex items-center gap-2">
            <Home className="size-3.5" />
            <span>Dashboard</span>
          </Link>
        </Button>

        <Button
          asChild
          variant="outline"
          className="h-10 px-5 text-xs font-mono border-white/10 bg-[#1F1F1F] text-zinc-300 hover:text-white hover:border-white/20 rounded-xl transition-all active:scale-[0.98]"
        >
          <Link to="/contests" className="inline-flex items-center gap-2">
            <Trophy className="size-3.5 text-zinc-400" />
            <span>Contests</span>
          </Link>
        </Button>

        <Button
          asChild
          variant="outline"
          className="h-10 px-5 text-xs font-mono border-white/10 bg-[#1F1F1F] text-zinc-300 hover:text-white hover:border-white/20 rounded-xl transition-all active:scale-[0.98]"
        >
          <Link to="/practice" className="inline-flex items-center gap-2">
            <Terminal className="size-3.5 text-zinc-400" />
            <span>Practice</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
