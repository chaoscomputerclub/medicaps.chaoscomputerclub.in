'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import {
  Button as ButtonPrimitive,
  type ButtonProps as ButtonPrimitiveProps,
} from '@/components/animate-ui/primitives/buttons/button';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-heading text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B1FA63] focus-visible:ring-offset-2 focus-visible:ring-offset-[#171717] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          'bg-[#B1FA63] text-black font-extrabold border border-[#B1FA63] hover:bg-[#a0ee4e] hover:border-[#a0ee4e] active:bg-[#B1FA63] shadow-none transition-colors duration-150 [&_svg]:transition-colors',
        primary:
          'bg-[#B1FA63] text-black font-extrabold border border-[#B1FA63] hover:bg-[#a0ee4e] hover:border-[#a0ee4e] active:bg-[#B1FA63] shadow-none transition-colors duration-150 [&_svg]:transition-colors',
        lime:
          'bg-[#B1FA63] text-black font-extrabold border border-[#B1FA63] hover:bg-[#a0ee4e] hover:border-[#a0ee4e] active:bg-[#B1FA63] shadow-none transition-colors duration-150 [&_svg]:transition-colors',
        accent:
          'bg-[#B1FA63] text-black font-extrabold border border-[#B1FA63] hover:bg-[#a0ee4e] hover:border-[#a0ee4e] shadow-none transition-colors duration-150 [&_svg]:transition-colors',
        destructive:
          'bg-transparent text-red-400 border border-red-500/40 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500 active:bg-red-500/30 shadow-none transition-colors duration-150 [&_svg]:transition-colors',
        outline:
          'bg-[#171717] text-zinc-300 border border-white/[0.08] hover:bg-white/[0.08] hover:text-white hover:border-white/20 active:bg-white/[0.12] shadow-none transition-colors duration-150 [&_svg]:transition-colors',
        secondary:
          'bg-[#171717] text-zinc-300 border border-white/[0.08] hover:bg-white/[0.08] hover:text-white hover:border-white/20 shadow-none transition-colors duration-150 [&_svg]:transition-colors',
        ghost:
          'bg-transparent text-zinc-400 hover:bg-white/[0.08] hover:text-white hover:border-white/10 border border-transparent transition-colors duration-150 [&_svg]:transition-colors',
        link:
          'text-[#B1FA63] underline-offset-4 hover:underline p-0 h-auto border-none',
      },
      size: {
        default: 'min-h-[38px] px-4 py-2 text-xs rounded-[10px] gap-2',
        sm: 'min-h-[32px] px-3 py-1.5 text-xs rounded-[10px] gap-1.5',
        lg: 'min-h-[44px] px-6 py-2.5 text-sm rounded-[10px] gap-2',
        hero: 'min-h-[42px] sm:min-h-[44px] px-5 py-2.5 text-xs rounded-[10px] gap-2',
        icon: 'size-9 min-h-[36px] min-w-[36px] p-0 rounded-[10px] bg-[#171717] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.08] hover:text-white hover:border-white/20',
        'icon-sm': 'size-8 min-h-[32px] min-w-[32px] p-0 rounded-[10px] bg-[#171717] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.08] hover:text-white hover:border-white/20',
        'icon-lg': 'size-10 min-h-[40px] min-w-[40px] p-0 rounded-[10px] bg-[#171717] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.08] hover:text-white hover:border-white/20',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type ButtonProps = ButtonPrimitiveProps & VariantProps<typeof buttonVariants>;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, hoverScale = 1.02, tapScale = 0.96, ...props }, ref) => {
    return (
      <ButtonPrimitive
        ref={ref}
        hoverScale={hoverScale}
        tapScale={tapScale}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants, type ButtonProps };
