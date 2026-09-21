import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold cursor-pointer transition-all duration-150 active:scale-[0.98] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-transparent text-lime-400 font-mono font-semibold uppercase text-xs tracking-wider border border-lime-400 hover:bg-lime-400 hover:text-black active:bg-lime-300 shadow-none transition-colors duration-150 [&_svg]:transition-colors",
        destructive:
          "bg-red-500 text-white font-mono font-semibold uppercase text-xs tracking-wider shadow-none hover:bg-red-600 active:bg-red-700 border border-red-500/30",
        outline:
          "border border-white/12 bg-black font-mono text-xs uppercase tracking-wider text-zinc-300 hover:border-white/25 hover:text-white hover:bg-zinc-900/50 shadow-none",
        secondary:
          "bg-black text-zinc-300 font-mono text-xs uppercase tracking-wider hover:bg-zinc-900/60 hover:text-white border border-white/10 shadow-none",
        ghost:
          "text-zinc-400 hover:bg-zinc-900/50 hover:text-white font-mono text-xs uppercase tracking-wider",
        link:
          "text-lime-400 font-mono underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-[38px] px-4 py-2 text-xs rounded-md",
        sm: "min-h-[32px] px-3 py-1.5 text-xs rounded-md",
        lg: "min-h-[44px] px-6 py-2.5 text-sm rounded-md",
        icon: "h-9 w-9 min-h-[36px] min-w-[36px] p-0 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
