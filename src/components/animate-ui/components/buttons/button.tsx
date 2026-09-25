'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import {
  Button as ButtonPrimitive,
  type ButtonProps as ButtonPrimitiveProps,
} from '@/components/animate-ui/primitives/buttons/button';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-sans text-sm font-semibold cursor-pointer transition-colors duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          'bg-lime-400 text-black border border-lime-400 hover:bg-lime-300 hover:border-lime-300 active:bg-lime-400 shadow-none transition-colors duration-150 [&_svg]:transition-colors',
        primary:
          'bg-lime-400 text-black border border-lime-400 hover:bg-lime-300 hover:border-lime-300 active:bg-lime-400 shadow-none transition-colors duration-150 [&_svg]:transition-colors',
        lime:
          'bg-lime-400 text-black border border-lime-400 hover:bg-lime-300 hover:border-lime-300 active:bg-lime-400 shadow-none transition-colors duration-150 [&_svg]:transition-colors',
        accent:
          'bg-lime-400 text-black border border-lime-400 hover:bg-lime-300 hover:border-lime-300 shadow-none transition-colors duration-150 [&_svg]:transition-colors',
        destructive:
          'bg-transparent text-red-400 border border-red-500/40 hover:bg-red-500 hover:text-white hover:border-red-500 active:bg-red-600 shadow-none transition-colors duration-150 [&_svg]:transition-colors',
        outline:
          'bg-transparent text-white border border-white/20 hover:bg-lime-400 hover:text-black hover:border-lime-400 active:bg-lime-300 shadow-none transition-colors duration-150 [&_svg]:transition-colors',
        secondary:
          'bg-zinc-900 text-zinc-200 border border-white/10 hover:bg-lime-400 hover:text-black hover:border-lime-400 active:bg-lime-300 shadow-none transition-colors duration-150 [&_svg]:transition-colors',
        ghost:
          'bg-transparent text-zinc-400 hover:bg-lime-400 hover:text-black hover:border-lime-400 border border-transparent transition-colors duration-150 [&_svg]:transition-colors',
        link:
          'text-lime-400 underline-offset-4 hover:underline p-0 h-auto border-none',
      },
      size: {
        default: 'min-h-[38px] px-4 py-2 text-sm rounded-md gap-2',
        sm: 'min-h-[32px] px-3 py-1.5 text-sm rounded-md gap-1.5',
        lg: 'min-h-[44px] px-6 py-2.5 text-sm rounded-md gap-2',
        icon: 'h-9 w-9 min-h-[36px] min-w-[36px] p-0 rounded-md',
        'icon-sm': 'size-8 min-h-[32px] min-w-[32px] p-0 rounded-md',
        'icon-lg': 'size-10 min-h-[40px] min-w-[40px] p-0 rounded-md',
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
