import { LogOut, RefreshCw } from "lucide-react";
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
  return (
    <header className="border-b border-white/10 bg-black sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between font-mono">
        {/* Minimal Title & Status */}
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-sm tracking-wider">
            CCC <span className="text-lime-400">//</span> PROCTOR
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <span
              className={`w-2 h-2 ${
                isStreamConnected ? "bg-lime-400" : "bg-amber-400 animate-pulse"
              }`}
            />
            <span className="hidden sm:inline">
              {isStreamConnected ? "Live" : "Connecting"}
            </span>
          </span>
        </div>

        {/* Minimal Actions */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs text-zinc-400 pr-2 border-r border-white/10">
            {proctorName}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshAll}
            disabled={isRefreshing}
            className="h-8 border-white/10 bg-zinc-900 text-zinc-300 hover:text-white font-mono text-xs rounded-none"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1 ${isRefreshing ? "animate-spin text-lime-400" : ""}`}
            />
            Sync
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="h-8 border-white/10 bg-zinc-900 text-zinc-400 hover:text-rose-400 font-mono text-xs rounded-none"
          >
            <LogOut className="w-3.5 h-3.5 mr-1" />
            Exit
          </Button>
        </div>
      </div>
    </header>
  );
}
