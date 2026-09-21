import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded border px-2 py-0.5 text-xs font-sans font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-lime-400",
  {
    variants: {
      variant: {
        default: "border-lime-400/30 bg-lime-400/10 text-lime-400",
        secondary: "border-white/10 bg-black text-zinc-400",
        destructive: "border-red-500/30 bg-red-500/10 text-red-400",
        outline: "border-white/15 text-white bg-black",
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
