/**
 * Chaos Computer Club India — Strict Assessment Launch Confirmation Modal
 * Enforces explicit acknowledgment of immutable 120-minute server timer,
 * automated anti-cheat proctoring, and single-attempt qualification rules.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Clock,
  ShieldAlert,
  Play,
  Lock,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface AssessmentConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contestSlug: string;
  contestTitle?: string;
  durationMinutes?: number;
}

export function AssessmentConfirmModal({
  open,
  onOpenChange,
  contestSlug,
  contestTitle = "Phase 1 Online Screening Assessment",
  durationMinutes = 120,
}: AssessmentConfirmModalProps) {
  const [agreed, setAgreed] = useState(false);
  const navigate = useNavigate();

  const handleLaunchAssessment = () => {
    if (!agreed) return;
    onOpenChange(false);
    navigate(`/assessments/${contestSlug}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-none border border-amber-500/40 bg-[#0c0c0c] text-white p-0 gap-0 overflow-hidden shadow-2xl backdrop-blur-2xl">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-[#222] bg-[#141414] flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-none bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <AlertTriangle className="size-4" />
            </div>
            <div>
              <DialogTitle className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                Strict Assessment Confirmation
              </DialogTitle>
            </div>
          </div>
          <span className="font-mono text-[10px] uppercase font-bold text-amber-400 px-2 py-0.5 rounded-none border border-amber-500/30 bg-amber-500/10">
            Immutable Session
          </span>
        </DialogHeader>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)] font-bold">
              Medi-Caps Arena · Round 1 Screening
            </span>
            <h2 className="text-lg font-bold text-white mt-1 leading-snug">
              {contestTitle}
            </h2>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              You are about to start your single proctored assessment attempt. Please review the mandatory integrity protocols before proceeding.
            </p>
          </div>

          {/* 4 Strict Rule Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono text-xs">
            <div className="p-3 rounded-none border border-[#262626] bg-[#141414] space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px] uppercase">
                <Clock className="size-3.5" /> {durationMinutes}-Min Immutable Clock
              </div>
              <p className="text-[11px] text-neutral-400 font-sans leading-relaxed">
                The timer is kept on the contest server and <strong>cannot be paused, restarted, or extended</strong>.
              </p>
            </div>

            <div className="p-3 rounded-none border border-[#262626] bg-[#141414] space-y-1">
              <div className="flex items-center gap-1.5 text-red-400 font-bold text-[11px] uppercase">
                <ShieldAlert className="size-3.5" /> Automated Anti-Cheat
              </div>
              <p className="text-[11px] text-neutral-400 font-sans leading-relaxed">
                Tab switches, window blur, and full-screen exits are logged as policy violations.
              </p>
            </div>

            <div className="p-3 rounded-none border border-[#262626] bg-[#141414] space-y-1">
              <div className="flex items-center gap-1.5 text-sky-400 font-bold text-[11px] uppercase">
                <Lock className="size-3.5" /> Single Attempt Only
              </div>
              <p className="text-[11px] text-neutral-400 font-sans leading-relaxed">
                Answers are auto-submitted when the clock reaches zero. No re-takes permitted.
              </p>
            </div>

            <div className="p-3 rounded-none border border-[#262626] bg-[#141414] space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] uppercase">
                <Trophy className="size-3.5" /> Top 30 Advance
              </div>
              <p className="text-[11px] text-neutral-400 font-sans leading-relaxed">
                Top 30 verified scorers receive Digital QR Campus Passes for physical lab finals.
              </p>
            </div>
          </div>

          {/* Mandatory Checkbox */}
          <label className="flex items-start gap-3 p-3.5 bg-amber-950/20 border border-amber-500/40 cursor-pointer text-left transition-colors hover:bg-amber-950/30">
            <Checkbox
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
              className="mt-0.5 rounded-none border-amber-500/50 data-[state=checked]:bg-amber-400 data-[state=checked]:text-black"
            />
            <span className="text-xs text-amber-200/90 leading-relaxed font-sans select-none">
              I understand that once I confirm, my <strong>{durationMinutes}-minute assessment begins immediately</strong> and cannot be paused or retried. I am ready to attempt the contest now.
            </span>
          </label>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-[#222] bg-[#141414] flex flex-row justify-end gap-3 space-x-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-none border-[#333] font-mono text-xs uppercase text-neutral-300 hover:bg-[#1e1e1e] hover:text-white"
          >
            Cancel / Not Ready
          </Button>

          <Button
            onClick={handleLaunchAssessment}
            disabled={!agreed}
            className="rounded-none bg-[var(--accent)] text-black hover:bg-[var(--accent)]/90 font-mono text-xs font-bold uppercase tracking-wider px-5 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[var(--accent)]/20"
          >
            <Play className="mr-1.5 size-3.5 fill-black" />
            Confirm & Launch Assessment IDE
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
