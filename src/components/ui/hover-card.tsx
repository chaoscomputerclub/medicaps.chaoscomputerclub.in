"use client";

import * as React from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { motion, type Transition } from "motion/react";
import { cn } from "@/lib/utils";

const HoverCard = HoverCardPrimitive.Root;
const HoverCardTrigger = HoverCardPrimitive.Trigger;

/* ─── Animated HoverCardContent ──────────────────────────────── */
// Key design decision: use `asChild` (Radix controls mounting/unmounting).
// We get a smooth entrance animation via motion.div. No forceMount/AnimatePresence
// so Radix's pointer-leave tracking works correctly — the card stays open
// as long as the cursor is over trigger OR content (including the gap covered
// by the invisible bridge Radix creates).
interface HoverCardContentProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>,
    "asChild"
  > {
  transition?: Transition;
}

const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  HoverCardContentProps
>(
  (
    {
      className,
      align = "center",
      sideOffset = 6,
      transition,
      children,
      ...props
    },
    ref
  ) => {
    const spring: Transition = transition ?? {
      type: "spring",
      stiffness: 320,
      damping: 28,
    };

    return (
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Content
          ref={ref}
          align={align}
          sideOffset={sideOffset}
          asChild
          {...props}
        >
          <motion.div
            className={cn(
              "z-50 rounded-xl border border-white/10 bg-zinc-950 shadow-2xl shadow-black/70 outline-none",
              "origin-[var(--radix-hover-card-content-transform-origin)]",
              className
            )}
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={spring}
          >
            {children}
          </motion.div>
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    );
  }
);
HoverCardContent.displayName = "HoverCardContent";

export { HoverCard, HoverCardTrigger, HoverCardContent };
