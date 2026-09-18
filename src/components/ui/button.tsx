import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150 active:scale-[0.98] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-orange-600 text-white shadow-sm hover:bg-orange-500 active:bg-orange-700 border border-orange-500/30",
        destructive:
          "bg-red-600 text-white shadow-sm hover:bg-red-500 active:bg-red-700 border border-red-500/30",
        outline:
          "border border-white/12 bg-zinc-900/60 text-slate-200 shadow-sm hover:bg-zinc-800 hover:text-white hover:border-white/25",
        secondary:
          "bg-zinc-800 text-slate-200 shadow-sm hover:bg-zinc-700 hover:text-white border border-white/8",
        ghost:
          "text-slate-300 hover:bg-zinc-800/80 hover:text-white",
        link:
          "text-orange-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-[40px] px-4 py-2 text-sm",
        sm: "min-h-[34px] px-3 py-1.5 text-xs rounded-md",
        lg: "min-h-[46px] px-6 py-2.5 text-base rounded-xl",
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
