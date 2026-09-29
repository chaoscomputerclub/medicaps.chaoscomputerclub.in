import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none font-sans text-sm font-semibold cursor-pointer transition-colors duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-lime-400 text-black border border-lime-400 hover:bg-lime-300 hover:border-lime-300 active:bg-lime-400 shadow-none",
        primary: "bg-lime-400 text-black border border-lime-400 hover:bg-lime-300 hover:border-lime-300 active:bg-lime-400 shadow-none",
        destructive: "bg-transparent text-red-400 border border-red-500/40 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500 active:bg-red-500/30 focus-visible:ring-red-500 shadow-none",
        outline: "bg-transparent text-white border border-white/20 hover:bg-lime-400 hover:text-black hover:border-lime-400 active:bg-lime-300 shadow-none",
        secondary: "bg-zinc-900 text-zinc-200 border border-white/10 hover:bg-lime-400 hover:text-black hover:border-lime-400 active:bg-lime-300 shadow-none",
        ghost: "bg-transparent text-zinc-400 hover:bg-lime-400 hover:text-black hover:border-lime-400 border border-transparent",
        link: "text-lime-400 underline-offset-4 hover:underline p-0 h-auto border-none",
      },
      size: {
        default: "min-h-[38px] px-4 py-2 text-sm rounded-none gap-2",
        sm: "min-h-[32px] px-3 py-1.5 text-sm rounded-none gap-1.5",
        lg: "min-h-[44px] px-6 py-2.5 text-sm rounded-none gap-2",
        hero: "min-h-[40px] sm:min-h-[44px] px-5 py-2.5 text-sm rounded-none gap-2",
        icon: "size-9 min-h-[36px] min-w-[36px] p-0 rounded-none",
        "icon-sm": "size-8 min-h-[32px] min-w-[32px] p-0 rounded-none",
        "icon-lg": "size-10 min-h-[40px] min-w-[40px] p-0 rounded-none",
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
    const Comp = asChild ? React.Fragment : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };