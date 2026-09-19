import { useEffect, useState } from "react";
import { ShieldAlert, Radio, Clock, LogOut, RefreshCw, Terminal, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AdminHeaderProps {
  proctorName: string;
  isStreamConnected: boolean;
  onLogout: () => void;
  onRefreshAll: () => void;
  isRefreshing: boolean;
}

export function AdminHeader({
  proctorName,
  isStreamConnected,
  onLogout,
  onRefreshAll,
  isRefreshing,
}: AdminHeaderProps) {
  const [timeUtc, setTimeUtc] = useState("");
  const [timeIst, setTimeIst] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeUtc(now.toUTCString().slice(17, 25) + " UTC");
      setTimeIst(
        now.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }) + " IST"
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="border-b border-white/10 bg-black/95 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-4">
        {/* Branding & Console Identifier */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-none bg-lime-400/10 border border-lime-400/30 flex items-center justify-center text-lime-400 shrink-0">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase font-bold tracking-[0.2em] text-lime-400">
                (99 // Proctor Command)
              </span>
              <Badge
                variant="outline"
                className="bg-lime-400/10 text-lime-400 border-lime-400/30 text-[10px] font-mono font-bold uppercase px-2 py-0 rounded-none tracking-wider"
              >
                PROCTOR CONSOLE
              </Badge>
            </div>
            <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-2">
              <span className="text-white font-bold tracking-wider">CHAOS COMPUTER CLUB</span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-400 font-medium">Medi-Caps Air-Gapped Lab</span>
            </div>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
          {/* SSE Stream Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-none bg-zinc-950 border border-white/10">
            <Radio className={`w-3.5 h-3.5 ${isStreamConnected ? "text-emerald-400 animate-pulse" : "text-amber-400"}`} />
            <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-wider">REALTIME STREAM:</span>
            <span className={`text-[11px] font-bold tabular-nums ${isStreamConnected ? "text-emerald-400" : "text-amber-400"}`}>
              {isStreamConnected ? "LIVE PUSH (SSE)" : "RECONNECTING…"}
            </span>
          </div>

          {/* Clocks */}
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-none bg-zinc-950 border border-white/10 text-zinc-400">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-white font-bold tabular-nums">{timeIst}</span>
            <span className="text-zinc-700">|</span>
            <span className="text-zinc-400 tabular-nums">{timeUtc}</span>
          </div>
        </div>

        {/* Proctor Profile & Actions */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshAll}
            disabled={isRefreshing}
            className="h-8 border-white/10 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white font-mono text-xs font-bold uppercase tracking-wider rounded-none cursor-pointer focus-visible:ring-2 focus-visible:ring-lime-400"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin text-lime-400" : ""}`} />
            Sync
          </Button>

          {/* Proctor Identifier Tag */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-white/10 text-xs font-mono">
            <span className="w-2 h-2 rounded-none bg-lime-400" />
            <span className="text-zinc-400 text-[10px] uppercase">OPERATOR:</span>
            <span className="text-white font-bold truncate max-w-[140px]" title={proctorName}>
              {proctorName}
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="h-8 border-white/10 bg-zinc-900/40 hover:bg-rose-950/40 hover:border-rose-500/40 text-zinc-400 hover:text-rose-400 font-mono text-xs font-bold uppercase tracking-wider rounded-none cursor-pointer transition-colors"
            title="Exit Proctor Command session"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Exit
          </Button>
        </div>
      </div>
    </header>
  );
}
