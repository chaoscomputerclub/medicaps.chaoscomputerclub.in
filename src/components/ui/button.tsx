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
          "bg-transparent text-white font-sans font-semibold uppercase text-xs tracking-wider border border-white/20 hover:bg-lime-400 hover:text-black hover:border-lime-400 active:bg-lime-300 shadow-none transition-colors duration-150 [&_svg]:transition-colors",
        destructive:
          "bg-transparent text-red-400 font-sans font-semibold uppercase text-xs tracking-wider border border-red-500/40 hover:bg-red-500 hover:text-white hover:border-red-500 active:bg-red-600 shadow-none transition-colors duration-150 [&_svg]:transition-colors",
        outline:
          "bg-transparent text-white font-sans font-semibold uppercase text-xs tracking-wider border border-white/20 hover:bg-lime-400 hover:text-black hover:border-lime-400 active:bg-lime-300 shadow-none transition-colors duration-150 [&_svg]:transition-colors",
        secondary:
          "bg-transparent text-white font-sans font-semibold uppercase text-xs tracking-wider border border-white/20 hover:bg-lime-400 hover:text-black hover:border-lime-400 active:bg-lime-300 shadow-none transition-colors duration-150 [&_svg]:transition-colors",
        ghost:
          "bg-transparent text-zinc-400 hover:bg-lime-400 hover:text-black hover:border-lime-400 border border-transparent font-sans text-xs uppercase tracking-wider transition-colors duration-150 [&_svg]:transition-colors",
        link:
          "text-lime-400 font-sans underline-offset-4 hover:underline",
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
