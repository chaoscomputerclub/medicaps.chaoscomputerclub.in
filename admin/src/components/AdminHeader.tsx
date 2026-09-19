import { useState, useEffect } from "react";
import { LogOut, RefreshCw, Shield, Wifi, WifiOff, Terminal, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-IN", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Asia/Kolkata",
        }) + " IST"
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="border-b border-white/10 bg-[#09090d]/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between font-mono">
        {/* Left: Brand & Status Telemetry */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-lime-400/10 border border-lime-400/40 flex items-center justify-center text-lime-400 shadow-[0_0_12px_rgba(204,255,0,0.15)]">
              <Shield className="w-4 h-4 text-lime-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm tracking-wider">
                  CCC <span className="text-lime-400">//</span> COMMAND CENTER
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-zinc-900 border border-white/10 text-zinc-400 uppercase tracking-widest hidden sm:inline-block">
                  v2.6.4 PROCTOR
                </span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-white/10">
            <span
              className={`w-2 h-2 ${
                isStreamConnected ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" : "bg-amber-400 animate-ping"
              }`}
            />
            <span className="text-[11px] text-zinc-400 flex items-center gap-1.5">
              {isStreamConnected ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span className="text-zinc-300 font-semibold">AIR-GAP LAN LINK ACTIVE</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-amber-400" />
                  <span className="text-amber-400">RECONNECTING SSE STREAM...</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Center: Realtime Clock */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-black/60 border border-white/10 text-xs">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-zinc-400 text-[10px] uppercase tracking-wider">OFFICIAL TOURNAMENT CLOCK:</span>
          <span className="text-white font-bold tabular-nums text-xs">{timeStr || "LOADING..."}</span>
        </div>

        {/* Right: Proctor Session & Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-zinc-950 border border-white/10">
            <Terminal className="w-3 h-3 text-lime-400" />
            <span className="text-xs text-zinc-300 truncate max-w-[180px]">
              {proctorName}
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshAll}
            disabled={isRefreshing}
            className="h-8 border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white font-mono text-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-lime-400"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin text-lime-400" : "text-zinc-400"}`}
            />
            <span>Sync</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="h-8 border-rose-500/30 bg-zinc-900/80 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 font-mono text-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <LogOut className="w-3.5 h-3.5 mr-1" />
            <span>Exit</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
