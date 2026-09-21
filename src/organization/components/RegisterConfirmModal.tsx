/**
 * Chaos Computer Club India — Contest Registration Confirmation Modal
 * Interactive confirmation modal requiring acknowledgment of two-phase
 * contest rules, air-gapped lab integrity guidelines, and proctoring.
 * Refactored to use shadcn UI Dialog, Button, and Checkbox primitives.
 */

import { useState } from "react";
import {
  ShieldCheck,
  Users,
  MapPin,
  Loader2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { registerForContest, isAuthenticated } from "@/lib/auth";
import type { ContestRecord } from "../data/contest-system";

interface RegisterConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contest: ContestRecord;
  onSuccess: () => void;
}

export function RegisterConfirmModal({
  open,
  onOpenChange,
  contest,
  onSuccess,
}: RegisterConfirmModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(true);
  const navigate = useNavigate();

  const handleConfirmRegistration = async () => {
    if (!isAuthenticated()) {
      toast.error("Please sign in to your Medi-Caps account to register.");
      onOpenChange(false);
      navigate("/auth");
      return;
    }

    if (!agreed) {
      toast.error("You must accept the competition rules and integrity agreement.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerForContest(contest.slug);
      toast.success(res.message || `Registered successfully for ${contest.title}!`);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to register for contest. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-none bg-zinc-950 border border-white/10 text-white p-0 gap-0 overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <DialogHeader className="p-4 border-b border-white/10 bg-zinc-900/80 backdrop-blur-md flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase font-bold tracking-[0.2em] text-lime-400">
              (01 // Registration Protocol)
            </span>
            <DialogTitle className="font-mono text-sm font-bold uppercase tracking-wider text-white">
              Confirm Registration
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          <div>
            <span className="rounded-none border border-white/10 bg-zinc-800/80 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-300">
              {contest.season}
            </span>
            <h2 className="text-xl font-bold font-mono uppercase text-white mt-2 leading-snug">
              {contest.title}
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              {contest.summary}
            </p>
          </div>

          {/* Key Facts Card */}
          <div className="rounded-none border border-white/10 bg-zinc-900/60 p-4 space-y-3.5">
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-lime-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-xs font-mono uppercase text-white block">
                  Live Algorithmic Arena
                </strong>
                <p className="text-xs text-zinc-400 mt-0.5">
                  90-minute live contest. 4 algorithmic challenges testing data structures and optimization.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Users className="w-4 h-4 text-lime-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-xs font-mono uppercase text-white block">
                  Open Registration & Elo Rated
                </strong>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Open to all Medi-Caps students. Performance officially impacts your campus ranking and Elo rating.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-lime-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-xs font-mono uppercase text-white block">
                  Contest Arena
                </strong>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {contest.logistics?.venue || "Online Arena · Medi-Caps University"}
                </p>
              </div>
            </div>
          </div>

          {/* Agreement Checkbox */}
          <label className="flex items-start gap-3 p-3.5 rounded-none bg-zinc-900/40 border border-white/10 cursor-pointer text-left hover:border-white/20 transition-colors">
            <Checkbox
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
              className="mt-0.5 border-white/20 data-[state=checked]:bg-lime-400 data-[state=checked]:text-black"
            />
            <span className="text-xs text-zinc-300 leading-relaxed">
              I certify that I am an enrolled Medi-Caps University student. I agree to abide by the university competition code of conduct and fair play integrity guidelines.
            </span>
          </label>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="p-4 border-t border-white/10 bg-zinc-900/80 backdrop-blur-md flex flex-row justify-end gap-3 space-x-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="rounded-none text-zinc-300 border-white/10 font-mono text-xs font-semibold uppercase hover:border-white/20 hover:text-white active:scale-[0.98]"
          >
            Cancel
          </Button>

          <Button
            onClick={handleConfirmRegistration}
            disabled={isSubmitting || !agreed}
            className="rounded-md bg-transparent text-lime-400 border border-lime-400 hover:bg-lime-400 hover:text-black font-mono text-xs font-bold uppercase tracking-wider px-5 active:scale-[0.98] disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                Registering...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Confirm Registration
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
