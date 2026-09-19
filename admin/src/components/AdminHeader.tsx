import { useState, useEffect } from "react";
import { LogOut, RefreshCw, Clock } from "lucide-react";
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
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-[#0a0a0a]/90 backdrop-blur-md">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 md:px-8 h-20 flex items-center justify-between">
        {/* Left: Official CCC Branding matching chaoscomputerclub.in */}
        <div className="flex items-center gap-4 sm:gap-6">
          <a
            href="#top"
            className="group flex items-center gap-3 font-mono text-[#eaeaea] hover:text-[#ccff00] transition-colors select-none shrink-0"
          >
            <img
              src="/logo.png"
              alt="Chaos Computer Club Logo"
              width="44"
              height="44"
              className="h-10 w-10 sm:h-11 sm:w-11 object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.18)]"
            />
            <div className="flex flex-col font-mono text-[0.62rem] sm:text-[0.68rem] font-bold tracking-[0.2em] uppercase leading-[1.12] text-[#eaeaea] group-hover:text-[#ccff00] transition-colors">
              <span>CHAOS</span>
              <span>COMPUTER</span>
              <span>CLUB</span>
            </div>
          </a>

          {/* Subtitle / Chapter & Console Badge */}
          <div className="hidden sm:flex flex-col border-l border-white/[0.08] pl-4">
            <span className="font-mono text-[0.65rem] tracking-[0.16em] uppercase font-bold text-white">
              Medi-Caps Command Center
            </span>
            <span className="font-mono text-[0.55rem] tracking-[0.2em] text-[#8e8e93] uppercase">
              EST. 2026 // AIR-GAP SECURE LAN
            </span>
          </div>
        </div>

        {/* Center: Live Tournament Telemetry Clock */}
        <div className="hidden lg:flex items-center gap-2.5 px-3.5 py-1.5 bg-[#111111] border border-white/[0.08] font-mono text-xs">
          <Clock className="w-3.5 h-3.5 text-[#00e5ff]" />
          <span className="text-[0.6rem] tracking-[0.2em] text-[#8e8e93] uppercase">
            SYNCED TOURNAMENT CLOCK:
          </span>
          <span className="text-white font-bold tabular-nums text-xs tracking-wider">
            {timeStr || "LOADING…"}
          </span>
          <span className="w-1.5 h-1.5 bg-[#10b981] ml-1 animate-pulse" />
        </div>

        {/* Right: Proctor Identity & Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#111111] border border-white/[0.08] font-mono">
            <span className="w-1.5 h-1.5 bg-[#ccff00]" />
            <span className="text-[0.65rem] tracking-[0.14em] uppercase text-[#eaeaea] font-medium truncate max-w-[160px]">
              {proctorName}
            </span>
          </div>

          <button
            type="button"
            onClick={onRefreshAll}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center rounded-none border border-white/[0.08] bg-[#111111] hover:bg-[#161616] hover:border-white/20 text-[#eaeaea] font-mono text-[0.62rem] tracking-[0.16em] uppercase font-medium transition-colors cursor-pointer select-none h-9 px-3.5 gap-1.5 focus-visible:outline-none"
            title="Synchronize real-time state with server"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[#ccff00]" : "text-[#8e8e93]"}`}
            />
            <span className="hidden sm:inline">Sync</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex h-9 items-center justify-center border border-rose-500/30 bg-[#111111] hover:bg-rose-500/10 hover:border-rose-500/60 px-3.5 font-mono text-[0.62rem] tracking-[0.16em] uppercase text-rose-300 font-semibold transition-colors cursor-pointer select-none"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5 text-rose-400" />
            <span>Exit</span>
          </button>
        </div>
      </div>
    </header>
  );
}
