/**
 * First-contest explainer — a short, skippable guided moment that teaches the
 * two-round format before a candidate commits to anything. Shown once per
 * browser; the "seen" flag is written only after the user dismisses it.
 */

import { useEffect, useState } from "react";
import { ArrowRight, Check, Clock, Laptop, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FINALIST_SEATS } from "./lifecycle";

const STORAGE_KEY = "ccc.contest.explainer.seen";

const STEPS = [
  {
    icon: Clock,
    title: "Round 1 opens for 24 hours",
    body: "Register, then start the online assessment any time inside the 24-hour window before contest day.",
  },
  {
    icon: Laptop,
    title: "You get one 2-hour attempt",
    body: "The clock starts when you press Start and keeps running — closing the tab, refreshing, or losing connection does not pause it. The timer is kept by the server, not your browser.",
  },
  {
    icon: Trophy,
    title: `Top ${FINALIST_SEATS} go to the campus final`,
    body: "Ranking is by score, then by time taken. Qualifiers get a QR pass with the date, venue, and what to bring.",
  },
] as const;

export function FirstContestExplainer() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== "1") setOpen(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  const current = STEPS[step]!;
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : dismiss())}>
      <DialogContent className="rounded-none border-[var(--line)] bg-[var(--surface-1)] sm:max-w-lg">
        <DialogHeader>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">
            How a CCC contest works · {step + 1} of {STEPS.length}
          </span>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold uppercase tracking-tight text-white">
            <Icon className="size-5 text-[var(--accent)]" />
            {current.title}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-[var(--muted)]">
            {current.body}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1" aria-hidden>
          {STEPS.map((s, index) => (
            <span
              key={s.title}
              className={
                index <= step
                  ? "h-0.5 flex-1 bg-[var(--accent)]"
                  : "h-0.5 flex-1 bg-[var(--line)]"
              }
            />
          ))}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={dismiss}
            className="rounded-none font-mono text-xs uppercase"
          >
            Skip
          </Button>
          <Button
            onClick={() => (isLast ? dismiss() : setStep(step + 1))}
            className="rounded-none font-mono text-xs font-bold uppercase tracking-wider"
          >
            {isLast ? (
              <>
                Got it
                <Check className="ml-2 size-4" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="ml-2 size-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
