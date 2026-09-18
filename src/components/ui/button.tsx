import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-semibold cursor-pointer transition-all duration-150 active:scale-[0.98] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-lime-400 text-black font-mono font-bold uppercase tracking-wider hover:bg-lime-300 active:bg-lime-500 border border-lime-400",
        destructive:
          "bg-red-600 text-white font-mono font-bold uppercase tracking-wider shadow-sm hover:bg-red-500 active:bg-red-700 border border-red-500/30",
        outline:
          "border border-white/15 bg-zinc-900/60 font-mono text-xs uppercase tracking-wider text-zinc-200 shadow-sm hover:bg-zinc-800 hover:text-white hover:border-lime-400/50",
        secondary:
          "bg-zinc-800 text-zinc-200 font-mono text-xs uppercase tracking-wider shadow-sm hover:bg-zinc-700 hover:text-white border border-white/10",
        ghost:
          "text-zinc-300 hover:bg-zinc-800/80 hover:text-white font-mono text-xs uppercase tracking-wider",
        link:
          "text-lime-400 font-mono underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-[40px] px-4 py-2 text-sm",
        sm: "min-h-[34px] px-3 py-1.5 text-xs rounded-none",
        lg: "min-h-[46px] px-6 py-2.5 text-base rounded-none",
        icon: "h-9 w-9 min-h-[36px] min-w-[36px] p-0",
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
