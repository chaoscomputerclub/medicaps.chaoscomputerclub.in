#!/usr/bin/env python3
"""
scripts/smooth_transitions_upgrade.py

Identifies and upgrades all expandable containers, panels, drawers, accordions,
collapsibles, dropdowns, dialogs, selects, and inputs across the entire application
to ensure silky smooth linear transitions without abrupt jerks or snapping.
"""

import os
import re

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT_DIR, "src")

print("=" * 60)
print("CCC Smooth Linear Transition Automation Engine")
print("=" * 60)

# ── 1. Update src/styles.css with Global Keyframes & Input Smoothness ────
styles_path = os.path.join(SRC_DIR, "styles.css")
if os.path.exists(styles_path):
    with open(styles_path, "r", encoding="utf-8") as f:
        styles = f.read()

    marker = "/* ── SMOOTH LINEAR TRANSITIONS (ACCORDION, COLLAPSIBLE, INPUTS) ── */"
    css_block = f"""{marker}
@keyframes accordion-down {{
  from {{
    height: 0;
    opacity: 0;
  }}
  to {{
    height: var(--radix-accordion-content-height);
    opacity: 1;
  }}
}}

@keyframes accordion-up {{
  from {{
    height: var(--radix-accordion-content-height);
    opacity: 1;
  }}
  to {{
    height: 0;
    opacity: 0;
  }}
}}

@keyframes collapsible-down {{
  from {{
    height: 0;
    opacity: 0;
  }}
  to {{
    height: var(--radix-collapsible-content-height);
    opacity: 1;
  }}
}}

@keyframes collapsible-up {{
  from {{
    height: var(--radix-collapsible-content-height);
    opacity: 1;
  }}
  to {{
    height: 0;
    opacity: 0;
  }}
}}

.animate-accordion-down {{
  animation: accordion-down 280ms linear forwards;
}}

.animate-accordion-up {{
  animation: accordion-up 280ms linear forwards;
}}

.animate-collapsible-down {{
  animation: collapsible-down 280ms linear forwards;
}}

.animate-collapsible-up {{
  animation: collapsible-up 280ms linear forwards;
}}

/* Universal smooth linear transition for inputs, textareas, and selects */
input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),
textarea,
select {{
  transition-property: width, height, padding, border-color, background-color, box-shadow, color;
  transition-duration: 200ms;
  transition-timing-function: linear;
}}
"""
    if marker in styles:
        # Replace existing block
        parts = styles.split(marker)
        styles = parts[0].rstrip() + "\n\n" + css_block
    else:
        styles = styles.rstrip() + "\n\n" + css_block

    with open(styles_path, "w", encoding="utf-8") as f:
        f.write(styles)
    print("✓ Configured smooth linear keyframes (280ms) and input transitions in src/styles.css")

# ── 2. Update Input Component: src/components/ui/input.tsx ───────────────
input_path = os.path.join(SRC_DIR, "components", "ui", "input.tsx")
if os.path.exists(input_path):
    with open(input_path, "r", encoding="utf-8") as f:
        code = f.read()
    orig = code
    code = code.replace("transition-colors duration-150", "transition-all duration-200 ease-linear")
    code = code.replace("transition-colors", "transition-all duration-200 ease-linear")
    if code != orig:
        with open(input_path, "w", encoding="utf-8") as f:
            f.write(code)
        print("✓ Upgraded src/components/ui/input.tsx with linear smooth transition")

# ── 3. Update Textarea Component: src/components/ui/textarea.tsx ─────────
textarea_path = os.path.join(SRC_DIR, "components", "ui", "textarea.tsx")
if os.path.exists(textarea_path):
    with open(textarea_path, "r", encoding="utf-8") as f:
        code = f.read()
    orig = code
    code = code.replace("transition-colors", "transition-all duration-200 ease-linear")
    if code != orig:
        with open(textarea_path, "w", encoding="utf-8") as f:
            f.write(code)
        print("✓ Upgraded src/components/ui/textarea.tsx with linear smooth transition")

# ── 4. Update Collapsible Component: src/components/ui/collapsible.tsx ────
collapsible_path = os.path.join(SRC_DIR, "components", "ui", "collapsible.tsx")
if os.path.exists(collapsible_path):
    new_collapsible_code = """"use client";

import * as React from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { cn } from "@/lib/utils";

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.CollapsibleContent>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleContent>
>(({ className, children, ...props }, ref) => (
  <CollapsiblePrimitive.CollapsibleContent
    ref={ref}
    className={cn(
      "overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
      className
    )}
    {...props}
  >
    {children}
  </CollapsiblePrimitive.CollapsibleContent>
));
CollapsibleContent.displayName = "CollapsibleContent";

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
"""
    with open(collapsible_path, "w", encoding="utf-8") as f:
        f.write(new_collapsible_code)
    print("✓ Upgraded src/components/ui/collapsible.tsx with smooth height animation")

# ── 5. Update Accordion Component: src/components/ui/accordion.tsx ───────
accordion_path = os.path.join(SRC_DIR, "components", "ui", "accordion.tsx")
if os.path.exists(accordion_path):
    with open(accordion_path, "r", encoding="utf-8") as f:
        code = f.read()
    orig = code
    code = code.replace(
        'className="overflow-hidden text-sm transition-all duration-200 ease-linear data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"',
        'className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"'
    )
    if code != orig:
        with open(accordion_path, "w", encoding="utf-8") as f:
            f.write(code)
        print("✓ Upgraded src/components/ui/accordion.tsx with smooth linear transition")

# ── 6. Update Problem Hints: src/components/problem/ProblemStatementView.tsx ─
ps_view_path = os.path.join(SRC_DIR, "components", "problem", "ProblemStatementView.tsx")
if os.path.exists(ps_view_path):
    with open(ps_view_path, "r", encoding="utf-8") as f:
        code = f.read()
    
    # Ensure min-h-0 and 280ms linear duration
    code = re.sub(
        r'grid transition-\[grid-template-rows,opacity\] duration-\d+ ease-linear \$\{([^}]+)\}',
        r'grid transition-[grid-template-rows,opacity] duration-280 ease-linear ${\1}',
        code
    )
    code = code.replace('<div className="overflow-hidden">', '<div className="overflow-hidden min-h-0">')
    with open(ps_view_path, "w", encoding="utf-8") as f:
        f.write(code)
    print("✓ Upgraded problem hints in ProblemStatementView.tsx with smooth 0fr->1fr height expansion")

# ── 7. Update Dialog Component: src/components/ui/dialog.tsx ─────────────
dialog_path = os.path.join(SRC_DIR, "components", "ui", "dialog.tsx")
if os.path.exists(dialog_path):
    with open(dialog_path, "r", encoding="utf-8") as f:
        code = f.read()
    code = code.replace("duration-150", "duration-250 ease-linear")
    with open(dialog_path, "w", encoding="utf-8") as f:
        f.write(code)
    print("✓ Upgraded src/components/ui/dialog.tsx with 250ms linear transition")

# ── 8. Update AlertDialog Component: src/components/ui/alert-dialog.tsx ──
alert_path = os.path.join(SRC_DIR, "components", "ui", "alert-dialog.tsx")
if os.path.exists(alert_path):
    with open(alert_path, "r", encoding="utf-8") as f:
        code = f.read()
    code = code.replace("duration-200 data-[state=open]:animate-in", "duration-250 ease-linear data-[state=open]:animate-in")
    code = code.replace("fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in", "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm duration-250 ease-linear data-[state=open]:animate-in")
    with open(alert_path, "w", encoding="utf-8") as f:
        f.write(code)
    print("✓ Upgraded src/components/ui/alert-dialog.tsx with 250ms linear transition")

# ── 9. Update Select Component: src/components/ui/select.tsx ─────────────
select_path = os.path.join(SRC_DIR, "components", "ui", "select.tsx")
if os.path.exists(select_path):
    with open(select_path, "r", encoding="utf-8") as f:
        code = f.read()
    if "duration-200 ease-linear data-[state=open]:animate-in" not in code:
        code = code.replace("data-[state=open]:animate-in", "duration-200 ease-linear data-[state=open]:animate-in")
        with open(select_path, "w", encoding="utf-8") as f:
            f.write(code)
        print("✓ Upgraded src/components/ui/select.tsx with linear smooth transition")

# ── 10. Update DropdownMenu Component: src/components/ui/dropdown-menu.tsx
dropdown_path = os.path.join(SRC_DIR, "components", "ui", "dropdown-menu.tsx")
if os.path.exists(dropdown_path):
    with open(dropdown_path, "r", encoding="utf-8") as f:
        code = f.read()
    code = code.replace("data-[state=open]:animate-in data-[state=closed]:animate-out", "duration-200 ease-linear data-[state=open]:animate-in data-[state=closed]:animate-out")
    with open(dropdown_path, "w", encoding="utf-8") as f:
        f.write(code)
    print("✓ Upgraded src/components/ui/dropdown-menu.tsx with linear smooth transition")

# ── 11. Update Popover Component: src/components/ui/popover.tsx ──────────
popover_path = os.path.join(SRC_DIR, "components", "ui", "popover.tsx")
if os.path.exists(popover_path):
    with open(popover_path, "r", encoding="utf-8") as f:
        code = f.read()
    if "duration-200 ease-linear data-[state=open]:animate-in" not in code:
        code = code.replace("data-[state=open]:animate-in", "duration-200 ease-linear data-[state=open]:animate-in")
        with open(popover_path, "w", encoding="utf-8") as f:
            f.write(code)
        print("✓ Upgraded src/components/ui/popover.tsx with linear smooth transition")

# ── 12. Update Sheet Component: src/components/ui/sheet.tsx ──────────────
sheet_path = os.path.join(SRC_DIR, "components", "ui", "sheet.tsx")
if os.path.exists(sheet_path):
    with open(sheet_path, "r", encoding="utf-8") as f:
        code = f.read()
    code = code.replace("transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500", "transition ease-linear data-[state=closed]:duration-250 data-[state=open]:duration-250")
    with open(sheet_path, "w", encoding="utf-8") as f:
        f.write(code)
    print("✓ Upgraded src/components/ui/sheet.tsx with linear smooth transition")

print("\nAll expandable containers, panels, dialogs, drawers, and inputs upgraded successfully with linear smooth transitions!")
