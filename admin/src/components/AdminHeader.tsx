import { useEffect, useState } from "react";
import { ShieldAlert, Radio, Clock, Cpu, LogOut, RefreshCw, Terminal, CheckCircle2 } from "lucide-react";
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
    <header className="border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Branding & Console Identifier */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 flex-shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest font-black text-white">
                CHAOS COMPUTER CLUB
              </span>
              <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-[10px] font-mono uppercase px-1.5 py-0">
                PROCTOR CONSOLE
              </Badge>
            </div>
            <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-2">
              <span>Medi-Caps Chapter</span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-400 font-medium">Air-Gapped Lab Command Center</span>
            </div>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
          {/* SSE Stream Status */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800">
            <Radio className={`w-3.5 h-3.5 ${isStreamConnected ? "text-emerald-400 animate-pulse" : "text-amber-400"}`} />
            <span className="text-zinc-400">REALTIME STREAM:</span>
            <span className={isStreamConnected ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
              {isStreamConnected ? "LIVE PUSH (SSE)" : "CONNECTING..."}
            </span>
          </div>

          {/* Clocks */}
          <div className="flex items-center gap-3 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-white font-medium">{timeIst}</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">{timeUtc}</span>
          </div>
        </div>

        {/* Proctor Profile & Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshAll}
            disabled={isRefreshing}
            className="h-8 border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 font-mono text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Sync
          </Button>

          <div className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 hidden sm:flex items-center gap-1.5">
            <span className="text-zinc-500">PROCTOR:</span>
            <span className="text-red-400 font-bold">{proctorName}</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="h-8 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 font-mono text-xs"
          >
            <LogOut className="w-3.5 h-3.5 mr-1" />
            Exit
          </Button>
        </div>
      </div>
    </header>
  );
}
