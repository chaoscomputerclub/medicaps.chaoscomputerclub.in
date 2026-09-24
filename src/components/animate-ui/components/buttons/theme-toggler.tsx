'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';

import {
  ThemeToggler as ThemeTogglerPrimitive,
  type ThemeTogglerProps as ThemeTogglerPrimitiveProps,
  type ThemeSelection,
  type Resolved,
  type Direction,
} from '@/components/animate-ui/primitives/effects/theme-toggler';
import { cn } from '@/lib/utils';

const getIcon = (
  effective: ThemeSelection,
  resolved: Resolved,
  modes: ThemeSelection[],
) => {
  const theme = modes.includes('system') ? effective : resolved;
  return theme === 'system' ? (
    <Monitor className="h-4 w-4" />
  ) : theme === 'dark' ? (
    <Moon className="h-4 w-4" />
  ) : (
    <Sun className="h-4 w-4" />
  );
};

const getNextTheme = (
  effective: ThemeSelection,
  modes: ThemeSelection[] = ['dark', 'light'],
): ThemeSelection => {
  const i = modes.indexOf(effective);
  if (i === -1) return modes[0] || 'dark';
  return modes[(i + 1) % modes.length];
};

interface ThemeTogglerButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  modes?: ThemeSelection[];
  onImmediateChange?: ThemeTogglerPrimitiveProps['onImmediateChange'];
  direction?: Direction;
}

function ThemeTogglerButton({
  modes = ['dark', 'light'],
  direction = 'ltr',
  onImmediateChange,
  onClick,
  className,
  ...props
}: ThemeTogglerButtonProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <ThemeTogglerPrimitive
      theme={(theme as ThemeSelection) || 'dark'}
      resolvedTheme={(resolvedTheme as Resolved) || 'dark'}
      setTheme={setTheme}
      direction={direction}
      onImmediateChange={onImmediateChange}
    >
      {({ effective, resolved, toggleTheme }) => (
        <button
          type="button"
          data-slot="theme-toggler-button"
          aria-label={`Current theme: ${effective}. Click to cycle theme.`}
          title={`Theme: ${effective} (click to toggle)`}
          className={cn(
            "inline-flex items-center justify-center p-2 rounded-md transition-colors text-zinc-400 hover:text-white hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lime-400 cursor-pointer",
            className,
          )}
          onClick={(e) => {
            onClick?.(e);
            toggleTheme(getNextTheme(effective, modes));
          }}
          {...props}
        >
          {getIcon(effective, resolved, modes)}
        </button>
      )}
    </ThemeTogglerPrimitive>
  );
}

interface ThemeTogglerDemoProps {
  direction?: Direction;
}

const ThemeTogglerDemo = ({ direction = 'ltr' }: ThemeTogglerDemoProps) => {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <ThemeTogglerPrimitive
      theme={(theme as ThemeSelection) || 'dark'}
      resolvedTheme={(resolvedTheme as Resolved) || 'dark'}
      setTheme={setTheme}
      direction={direction}
    >
      {({ effective, toggleTheme }) => {
        const nextTheme =
          effective === 'dark'
            ? 'light'
            : effective === 'system'
              ? 'dark'
              : 'system';

        return (
          <button
            type="button"
            className="inline-flex items-center justify-center p-2 rounded-md transition-colors text-zinc-400 hover:text-white hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lime-400 cursor-pointer"
            onClick={() => toggleTheme(nextTheme)}
            aria-label={`Toggle theme from ${effective}`}
          >
            {effective === 'system' ? (
              <Monitor className="h-4 w-4" />
            ) : effective === 'dark' ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>
        );
      }}
    </ThemeTogglerPrimitive>
  );
};

export {
  ThemeTogglerButton,
  ThemeTogglerDemo,
  type ThemeTogglerButtonProps,
  type ThemeTogglerDemoProps,
  type ThemeSelection,
  type Resolved,
  type Direction,
};
