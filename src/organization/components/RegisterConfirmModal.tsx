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
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
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
      navigate({ to: "/auth" });
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
      <DialogContent className="max-w-lg bg-[var(--surface)] border border-[var(--line-strong)] text-white p-0 gap-0 overflow-hidden">
        {/* Modal Header */}
        <DialogHeader className="p-4 border-b border-[var(--line)] bg-[var(--surface-2)] flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[var(--accent)]" />
            <DialogTitle className="font-mono text-sm font-bold uppercase tracking-wider text-white">
              Confirm Contest Registration
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          <div>
            <span className="mono-tag">{contest.season}</span>
            <h1 className="text-xl font-bold text-white mt-1.5 leading-snug">
              {contest.title}
            </h1>
            <p className="text-xs text-[var(--muted)] mt-1">
              {contest.summary}
            </p>
          </div>

          {/* Key Facts Card */}
          <div className="border border-[var(--line)] bg-[var(--surface-2)] p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
              <div>
                <strong className="text-xs font-mono uppercase text-white block">
                  Phase 1 · Online Screening
                </strong>
                <p className="text-xs text-[#b0b0b0] mt-0.5">
                  Algorithmic problem set. Unlocks <strong>strictly 24 hours</strong> prior to live contest start.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Users className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
              <div>
                <strong className="text-xs font-mono uppercase text-white block">
                  Phase 2 · Top 30 Campus Finals
                </strong>
                <p className="text-xs text-[#b0b0b0] mt-0.5">
                  Only the 30 highest verified scores qualify for the physical, air-gapped laboratory round.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
              <div>
                <strong className="text-xs font-mono uppercase text-white block">
                  Final Venue
                </strong>
                <p className="text-xs text-[#b0b0b0] mt-0.5">
                  {contest.logistics?.venue || "Computing Complex · Lab Block 04"}
                </p>
              </div>
            </div>
          </div>

          {/* Agreement Checkbox */}
          <label className="flex items-start gap-3 p-3 bg-[var(--surface-3)] border border-[var(--line)] cursor-pointer text-left">
            <Checkbox
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
              className="mt-0.5 border-[var(--line-strong)] data-[state=checked]:bg-[var(--accent)] data-[state=checked]:text-black"
            />
            <span className="text-xs text-[#c0c0c0] leading-relaxed">
              I certify that I am an enrolled Medi-Caps University student. I acknowledge that automated proctoring, browser telemetry, and air-gapped lab integrity guidelines are strictly enforced.
            </span>
          </label>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="p-4 border-t border-[var(--line)] bg-[var(--surface-2)] flex flex-row justify-end gap-3 space-x-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="text-white border-[var(--line)] font-mono text-xs font-semibold uppercase hover:bg-[var(--surface-3)] hover:text-white"
          >
            Cancel
          </Button>

          <Button
            onClick={handleConfirmRegistration}
            disabled={isSubmitting || !agreed}
            className="bg-[var(--accent)] text-black hover:bg-[var(--accent)]/90 hover:text-black font-mono text-xs font-bold uppercase tracking-wider px-5"
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
