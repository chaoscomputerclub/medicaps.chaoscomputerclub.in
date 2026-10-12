import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-heading font-bold uppercase tracking-wider transition-colors focus:outline-none focus:ring-1 focus:ring-[#B1FA63]",
  {
    variants: {
      variant: {
        default: "border-[#B1FA63]/40 bg-[#B1FA63]/15 text-[#B1FA63]",
        lime: "border-[#B1FA63]/40 bg-[#B1FA63]/15 text-[#B1FA63]",
        blitz: "border-[#B1FA63] bg-[#B1FA63] text-black font-black ",
        secondary: "border-white/10 bg-[#242424] text-zinc-300",
        destructive: "border-red-500/30 bg-red-500/10 text-red-400",
        outline: "border-white/15 text-white bg-transparent",
        math: "border-amber-400/40 bg-amber-400/15 text-amber-300",
        memory: "border-cyan-400/40 bg-cyan-400/15 text-cyan-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
