import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Button as ButtonPrimitive,
  type ButtonProps as ButtonPrimitiveProps,
} from "@/components/animate-ui/primitives/buttons/button";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base: every Button in the app — consistent typography, focus, disable states, Matiks 10px radius (matching Profile Edit button)
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-heading text-xs font-bold uppercase tracking-wider cursor-pointer transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B1FA63] focus-visible:ring-offset-2 focus-visible:ring-offset-[#171717] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] active:translate-y-[1px] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary: Matiks signature Electric Lime button
        default:
          "bg-[#B1FA63] text-black font-extrabold border border-[#B1FA63] hover:bg-[#a0ee4e] hover:border-[#a0ee4e] shadow-none",
        primary:
          "bg-[#B1FA63] text-black font-extrabold border border-[#B1FA63] hover:bg-[#a0ee4e] hover:border-[#a0ee4e] shadow-none",
        lime:
          "bg-[#B1FA63] text-black font-extrabold border border-[#B1FA63] hover:bg-[#a0ee4e] hover:border-[#a0ee4e] shadow-none",
        accent:
          "bg-[#B1FA63] text-black font-extrabold border border-[#B1FA63] hover:bg-[#a0ee4e] hover:border-[#a0ee4e] shadow-none",
        // Destructive: transparent red border
        destructive:
          "bg-transparent text-red-400 border border-red-500/40 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500 active:bg-red-500/30 focus-visible:ring-red-500 shadow-none",
        // Outline: Matiks dark button — matches Profile Edit button exactly
        outline:
          "bg-[#171717] text-zinc-300 border border-white/[0.08] hover:bg-white/[0.08] hover:text-white hover:border-white/20 shadow-none",
        // Secondary: Matiks dark neutral surface button — matches Profile Edit button exactly
        secondary:
          "bg-[#171717] text-zinc-300 border border-white/[0.08] hover:bg-white/[0.08] hover:text-white hover:border-white/20 shadow-none",
        // Ghost: fully transparent with subtle hover
        ghost:
          "bg-transparent text-zinc-400 hover:bg-white/[0.08] hover:text-white hover:border-white/10 border border-transparent",
        // Link: lime link
        link:
          "text-[#B1FA63] underline-offset-4 hover:underline p-0 h-auto border-none",
      },
      size: {
        // default: standard action button — consistent 38px min-height
        default: "min-h-[38px] px-4 py-2 text-xs rounded-[10px] gap-2",
        // sm: compact — 32px min-height (matches Profile Edit button)
        sm: "min-h-[32px] px-3 py-1.5 text-xs rounded-[10px] gap-1.5",
        // lg: large — 44px min-height
        lg: "min-h-[44px] px-6 py-2.5 text-sm rounded-[10px] gap-2",
        // hero: responsive hero card CTA — 42px / 44px, used in ContestsHubPage cards
        hero: "min-h-[42px] sm:min-h-[44px] px-5 py-2.5 text-xs rounded-[10px] gap-2",
        // icon: square icon-only button
        icon: "size-9 min-h-[36px] min-w-[36px] p-0 rounded-[10px] bg-[#171717] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.08] hover:text-white hover:border-white/20",
        // icon-sm: smaller icon
        "icon-sm": "size-8 min-h-[32px] min-w-[32px] p-0 rounded-[10px] bg-[#171717] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.08] hover:text-white hover:border-white/20",
        // icon-lg: larger icon
        "icon-lg": "size-10 min-h-[40px] min-w-[40px] p-0 rounded-[10px] bg-[#171717] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.08] hover:text-white hover:border-white/20",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    hoverScale?: number;
    tapScale?: number;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, hoverScale = 1.02, tapScale = 0.96, ...props }, ref) => {
    return (
      <ButtonPrimitive
        ref={ref}
        hoverScale={hoverScale}
        tapScale={tapScale}
        className={cn(buttonVariants({ variant, size, className }))}
        {...(props as any)}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
