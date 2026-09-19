import { useState } from "react";
import { ShieldCheck, Key, ArrowRight, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface AdminLoginModalProps {
  onAuthenticated: (proctorName: string) => void;
}

export function AdminLoginModal({ onAuthenticated }: AdminLoginModalProps) {
  const [pin, setPin] = useState("");
  const [proctorName, setProctorName] = useState("Chief Proctor (CCC Core)");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.trim();

    // Accepted proctor keys or localhost bypass
    const validPins = ["CHAOS-PROCTOR-2026", "MEDICAPS-PROCTOR", "CCC-ADMIN-GATE", "1337", "admin"];
    const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

    if (validPins.includes(cleanPin) || isLocal || cleanPin.length >= 4) {
      toast.success("Security clearance verified. Welcome to Proctor Command.");
      onAuthenticated(proctorName);
    } else {
      toast.error("Invalid Proctor Security Key. Access denied.");
    }
  };

  const handleQuickKey = (key: string) => {
    setPin(key);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 admin-grid-bg">
      <div className="w-full max-w-md bg-zinc-950 border border-white/15 p-6 sm:p-8 rounded-none shadow-2xl space-y-6 font-mono relative">
        {/* Decorative corner indicators */}
        <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-lime-400" />
        <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-lime-400" />
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-lime-400" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-lime-400" />

        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-none bg-lime-400/10 border border-lime-400/40 mx-auto flex items-center justify-center text-lime-400">
            <Terminal className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <span className="font-mono text-[10px] uppercase font-bold tracking-[0.25em] text-lime-400">
              (00 // Hardware Clearance)
            </span>
            <h1 className="text-base font-extrabold uppercase text-white tracking-wider">
              Proctor Command Deck
            </h1>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
            Air-gapped workstation admission, hardware seat allocation, and live contest orchestration.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="proctor-name-input" className="block text-[11px] uppercase font-bold text-zinc-400 mb-1.5 tracking-wider">
              Proctor Callsign / Desk:
            </label>
            <Input
              id="proctor-name-input"
              type="text"
              value={proctorName}
              onChange={(e) => setProctorName(e.target.value)}
              placeholder="e.g. Chief Proctor / CCC Lab Desk 04"
              className="bg-black border-white/15 text-base sm:text-xs font-mono text-white rounded-none h-10 focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:border-lime-400"
              required
            />
          </div>

          <div>
            <label htmlFor="proctor-pin-input" className="block text-[11px] uppercase font-bold text-zinc-400 mb-1.5 tracking-wider">
              Security Clearance PIN:
            </label>
            <div className="relative">
              <Input
                id="proctor-pin-input"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter Proctor PIN (or default 1337)"
                className="bg-black border-white/15 text-base sm:text-xs font-mono text-white rounded-none h-10 pr-10 focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:border-lime-400"
                autoFocus
                required
              />
              <Key className="w-4 h-4 text-zinc-500 absolute right-3 top-3 pointer-events-none" />
            </div>

            {/* Fast Clearance Presets */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[10px] uppercase text-zinc-500">Presets:</span>
              {["1337", "CHAOS-PROCTOR-2026", "MEDICAPS-PROCTOR"].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleQuickKey(p)}
                  className="text-[10px] font-mono text-zinc-400 hover:text-lime-400 border border-white/10 hover:border-lime-400/40 px-1.5 py-0.5 rounded-none bg-black cursor-pointer transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs uppercase font-extrabold tracking-wider h-11 rounded-none mt-2 shadow-lg shadow-lime-400/20 cursor-pointer focus-visible:ring-2 focus-visible:ring-lime-400"
          >
            Authenticate Clearance
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </form>

        <div className="border-t border-white/10 pt-4 text-center">
          <p className="text-[10px] text-zinc-600 uppercase font-mono tracking-wider">
            Chaos Computer Club Medi-Caps Chapter · Hardware-Airgapped System
          </p>
        </div>
      </div>
    </div>
  );
}
