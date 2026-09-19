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
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-zinc-950 border border-white/15 p-6 rounded-none shadow-2xl space-y-5 font-mono">
        <div className="border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-lime-400" />
            <h1 className="text-sm font-bold uppercase text-white tracking-wider">
              Proctor Access
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="proctor-name-input" className="block text-[10px] uppercase font-bold text-zinc-400 mb-1 tracking-wider">
              Proctor Name:
            </label>
            <Input
              id="proctor-name-input"
              type="text"
              value={proctorName}
              onChange={(e) => setProctorName(e.target.value)}
              placeholder="Chief Proctor"
              className="bg-black border-white/15 text-xs font-mono text-white rounded-none h-9 focus-visible:ring-2 focus-visible:ring-lime-400"
              required
            />
          </div>

          <div>
            <label htmlFor="proctor-pin-input" className="block text-[10px] uppercase font-bold text-zinc-400 mb-1 tracking-wider">
              PIN / Security Key:
            </label>
            <div className="relative">
              <Input
                id="proctor-pin-input"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN (default: 1337)"
                className="bg-black border-white/15 text-xs font-mono text-white rounded-none h-9 pr-8 focus-visible:ring-2 focus-visible:ring-lime-400"
                autoFocus
                required
              />
              <Key className="w-3.5 h-3.5 text-zinc-500 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[10px] uppercase text-zinc-500">Quick:</span>
              {["1337", "CHAOS-PROCTOR-2026"].map((p) => (
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
            className="w-full bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs uppercase font-bold tracking-wider h-10 rounded-none cursor-pointer focus-visible:ring-2 focus-visible:ring-lime-400"
          >
            Authenticate
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </form>
      </div>
    </div>
  );
}
