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
      <DialogContent className="rounded-none border border-white/10 bg-zinc-950 text-white sm:max-w-lg p-6 shadow-2xl backdrop-blur-xl space-y-4">
        <DialogHeader className="space-y-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-lime-400 font-bold">
            How a CCC contest works · {step + 1} of {STEPS.length}
          </span>
          <DialogTitle className="flex items-center gap-2.5 text-lg font-bold uppercase tracking-tight text-white">
            <Icon className="size-5 text-lime-400" />
            {current.title}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-zinc-400">
            {current.body}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1.5 py-1" aria-hidden>
          {STEPS.map((s, index) => (
            <span
              key={s.title}
              className={
                index <= step
                  ? "h-1 flex-1 rounded-none bg-lime-400"
                  : "h-1 flex-1 rounded-none bg-zinc-800"
              }
            />
          ))}
        </div>

        <DialogFooter className="gap-2 sm:justify-between pt-2">
          <Button
            variant="outline"
            onClick={dismiss}
            className="rounded-md font-mono text-xs uppercase bg-transparent text-white border border-white/20 hover:bg-lime-400 hover:text-black hover:border-lime-400 transition-colors [&_svg]:transition-colors"
          >
            Skip
          </Button>
          <Button
            onClick={() => (isLast ? dismiss() : setStep(step + 1))}
            className="rounded-md bg-transparent text-white border border-white/20 font-mono text-xs font-bold uppercase tracking-wider hover:bg-lime-400 hover:text-black hover:border-lime-400 active:scale-[0.98] transition-colors [&_svg]:transition-colors"
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
