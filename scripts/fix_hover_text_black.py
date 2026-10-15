#!/usr/bin/env python3
"""
scripts/fix_hover_text_black.py

1. Removes any destructive CSS contrast overrides from src/styles.css.
2. Enforces the canonical Edit Button Design System across:
   - src/components/ui/button.tsx
   - src/components/animate-ui/components/buttons/button.tsx
   - Base button styles in src/styles.css
3. Sweeps all components and pages across src/ to ensure buttons match the Edit Button styling:
   - Outline / Secondary: rounded-[10px] bg-[#171717] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.08] hover:text-white hover:border-white/20 font-heading font-bold uppercase tracking-wider text-xs
   - Primary / Default / Lime: rounded-[10px] bg-[#B1FA63] text-black font-heading font-extrabold uppercase tracking-wider text-xs hover:bg-[#a0ee4e]
   - Destructive: transparent text-red-400 border border-red-500/40 hover:bg-red-500/20 hover:text-red-300
   - Prevents dark buttons from turning text to black on hover.
"""

import os
import re

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT_DIR, "src")

# 1. Clean src/styles.css
styles_path = os.path.join(SRC_DIR, "styles.css")
if os.path.exists(styles_path):
    with open(styles_path, "r", encoding="utf-8") as f:
        styles_content = f.read()

    marker = "/* LIME HOVER TEXT CONTRAST FIX */"
    if marker in styles_content:
        parts = styles_content.split(marker)
        styles_content = parts[0].rstrip() + "\n"

    # Ensure button tag rule in styles.css uses font-heading font-bold
    styles_content = re.sub(
        r'button\s*\{[^}]*font-family:[^}]*\}',
        'button {\n  font-family: var(--font-heading), var(--font-sans);\n  font-weight: 700;\n}',
        styles_content
    )

    with open(styles_path, "w", encoding="utf-8") as f:
        f.write(styles_content)
    print("✓ Successfully verified src/styles.css")

# 2. Standardize src/components/ui/button.tsx
btn_path = os.path.join(SRC_DIR, "components", "ui", "button.tsx")
if os.path.exists(btn_path):
    btn_code = """import * as React from "react";
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
"""
    with open(btn_path, "w", encoding="utf-8") as f:
        f.write(btn_code)
    print("✓ Successfully standardized src/components/ui/button.tsx to Edit button design tokens")

# 3. Standardize src/components/animate-ui/components/buttons/button.tsx
anim_path = os.path.join(SRC_DIR, "components", "animate-ui", "components", "buttons", "button.tsx")
if os.path.exists(anim_path):
    anim_code = """'use client';

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
"""
    with open(anim_path, "w", encoding="utf-8") as f:
        f.write(anim_code)
    print("✓ Successfully standardized src/components/animate-ui/components/buttons/button.tsx")

# 4. Clean all page components
replacements = [
    # General full pattern replacement for lime hover turning text black on dark buttons
    (
        r'hover:bg-\[#B1FA63\]\s+hover:text-black\s+hover:border-\[#B1FA63\](?:\s+hover:\[&_\*\]:!text-black)?(?:\s+hover:\[&_svg\]:!text-black)?(?:\s+\[&:hover_svg\]:text-black)?',
        'hover:bg-white/[0.08] hover:text-white hover:border-white/20'
    ),
    (
        r'hover:bg-lime-400\s+hover:text-black\s+hover:border-lime-400(?:\s+hover:\[&_\*\]:!text-black)?(?:\s+hover:\[&_svg\]:!text-black)?(?:\s+\[&:hover_svg\]:text-black)?',
        'hover:bg-white/[0.08] hover:text-white hover:border-white/20'
    ),
    (
        r'hover:bg-lime-400\s+hover:text-black(?:\s+hover:\[&_\*\]:!text-black)?(?:\s+hover:\[&_svg\]:!text-black)?',
        'hover:bg-white/[0.08] hover:text-white'
    ),
    (
        r'hover:\[&_\*\]:!text-black\s*',
        ''
    ),
    (
        r'hover:\[&_svg\]:!text-black\s*',
        ''
    ),
    (
        r'\[&:hover_svg\]:text-black\s*',
        ''
    )
]

files_updated = 0
for root, _, files in os.walk(SRC_DIR):
    for fname in files:
        if not fname.endswith((".tsx", ".jsx", ".ts")):
            continue
        fpath = os.path.join(root, fname)
        with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        orig = content
        for pat, repl in replacements:
            content = re.sub(pat, repl, content)

        if content != orig:
            with open(fpath, "w", encoding="utf-8") as f:
                f.write(content)
            files_updated += 1
            print(f"✓ Updated: {os.path.relpath(fpath, ROOT_DIR)}")

print(f"\nDone! Enforced Edit button styling and cleaned {files_updated} source files.")
