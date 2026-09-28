import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-sans font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-lime-400/10 text-lime-400 border-lime-400/30",
        success: "bg-lime-400/10 text-lime-400 border-lime-400/30",
        warning: "bg-amber-400/10 text-amber-400 border-amber-400/30",
        danger: "bg-red-400/10 text-red-400 border-red-400/30",
        info: "bg-cyan-400/10 text-cyan-400 border-cyan-400/30",
        neutral: "bg-zinc-900 text-zinc-400 border-white/10",
        outline: "bg-transparent text-white border-white/20",
        subtle: "bg-white/5 text-zinc-300 border-white/10",
      },
      size: {
        default: "px-2.5 py-1 text-xs",
        sm: "px-2 py-0.5 text-[10px]",
        lg: "px-3 py-1.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size, className }))} {...props} />;
}

export { Badge, badgeVariants };
export type { BadgeProps };