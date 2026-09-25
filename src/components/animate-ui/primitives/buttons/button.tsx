'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

type WithAsChild<Base extends object> =
  | (Base & { asChild: true; children: React.ReactElement })
  | (Base & { asChild?: false | undefined; children?: React.ReactNode });

type ButtonProps = WithAsChild<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    hoverScale?: number;
    tapScale?: number;
  }
>;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      hoverScale = 1.02,
      tapScale = 0.96,
      asChild = false,
      className,
      style,
      ...props
    },
    ref,
  ) => {
    const Component = asChild ? Slot : 'button';

    return (
      <Component
        ref={ref}
        className={className}
        style={style}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, type ButtonProps };
