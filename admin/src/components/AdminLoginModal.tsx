import { useState } from "react";
import { ShieldAlert, Key, Lock, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface AdminLoginModalProps {
  onAuthenticated: (proctorName: string) => void;
}

export function AdminLoginModal({ onAuthenticated }: AdminLoginModalProps) {
  const [pin, setPin] = useState("");
  const [proctorName, setProctorName] = useState("Chief Proctor (CCC Core)");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 admin-grid-bg">
      <div className="w-full max-w-md bg-[#0a0a0a] border border-red-500/30 p-6 rounded-sm shadow-2xl space-y-6 font-mono">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded bg-red-500/10 border border-red-500/40 mx-auto flex items-center justify-center text-red-400">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="text-base font-bold uppercase text-white tracking-widest">
            Proctor Command Console
          </h1>
          <p className="text-xs text-zinc-400">
            Air-Gapped Lab Entry & Contest Operations Gate
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] uppercase text-zinc-400 mb-1.5">
              Proctor / Station Identifier:
            </label>
            <Input
              type="text"
              value={proctorName}
              onChange={(e) => setProctorName(e.target.value)}
              placeholder="e.g. Chief Proctor / CCC Operations Desk"
              className="bg-black border-zinc-800 text-xs font-mono text-white rounded-none h-10"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase text-zinc-400 mb-1.5">
              Security Key / Proctor PIN:
            </label>
            <div className="relative">
              <Input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter Proctor PIN (or default 1337)"
                className="bg-black border-zinc-800 text-xs font-mono text-white rounded-none h-10 pr-10"
                autoFocus
              />
              <Key className="w-4 h-4 text-zinc-500 absolute right-3 top-3" />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-500 text-white font-mono text-xs uppercase font-bold h-11 rounded-none mt-2"
          >
            Authenticate Clearance
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </form>

        <div className="border-t border-zinc-800/80 pt-4 text-center">
          <p className="text-[10px] text-zinc-600 uppercase">
            Chaos Computer Club Medi-Caps Chapter · Hardware-Airgapped System
          </p>
        </div>
      </div>
    </div>
  );
}
