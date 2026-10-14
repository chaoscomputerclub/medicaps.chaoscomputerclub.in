#!/usr/bin/env python3
"""
fix_lime_hover_buttons.py
Identifies and fixes all buttons and clickable elements across the codebase
where hovering changes the background to solid lime (#B1FA63 / lime-400),
but lime-colored text or SVG icons do not turn black, causing invisibility.
"""

import os
import re

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT_DIR, "src")

# 1. Update src/components/ui/button.tsx
button_path = os.path.join(SRC_DIR, "components", "ui", "button.tsx")
if os.path.exists(button_path):
    with open(button_path, "r") as f:
        btn_code = f.read()

    # Add hover:[&_*]:!text-black hover:[&_svg]:!text-black to outline, secondary, ghost, and default variants
    replacements = [
        (
            '"bg-[#171717] text-white border border-white/10 hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63] shadow-none"',
            '"bg-[#171717] text-white border border-white/10 hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63] hover:[&_*]:!text-black hover:[&_svg]:!text-black shadow-none"',
        ),
        (
            '"bg-[#242424] text-zinc-200 border border-white/10 hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63] shadow-none"',
            '"bg-[#242424] text-zinc-200 border border-white/10 hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63] hover:[&_*]:!text-black hover:[&_svg]:!text-black shadow-none"',
        ),
        (
            '"bg-transparent text-zinc-400 hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63] border border-transparent"',
            '"bg-transparent text-zinc-400 hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63] hover:[&_*]:!text-black hover:[&_svg]:!text-black border border-transparent"',
        ),
        (
            '"bg-[#B1FA63] text-black font-extrabold border border-[#B1FA63] hover:bg-[#C2FF78] hover:border-[#C2FF78] "',
            '"bg-[#B1FA63] text-black font-extrabold border border-[#B1FA63] hover:bg-[#C2FF78] hover:border-[#C2FF78] hover:text-black hover:[&_*]:!text-black hover:[&_svg]:!text-black "',
        ),
    ]
    for old, new in replacements:
        if old in btn_code:
            btn_code = btn_code.replace(old, new)
            print(f"Updated variant in {button_path}")

    with open(button_path, "w") as f:
        f.write(btn_code)

# 2. Update src/components/animate-ui/components/buttons/button.tsx
animate_btn_path = os.path.join(SRC_DIR, "components", "animate-ui", "components", "buttons", "button.tsx")
if os.path.exists(animate_btn_path):
    with open(animate_btn_path, "r") as f:
        anim_code = f.read()

    anim_replacements = [
        (
            "'bg-transparent text-white border border-white/10 hover:bg-lime-400 hover:text-black hover:border-lime-400 active:bg-lime-300 shadow-none transition-colors duration-150 [&_svg]:transition-colors'",
            "'bg-transparent text-white border border-white/10 hover:bg-lime-400 hover:text-black hover:border-lime-400 hover:[&_*]:!text-black hover:[&_svg]:!text-black active:bg-lime-300 shadow-none transition-colors duration-150 [&_svg]:transition-colors'",
        ),
        (
            "'bg-[#242424] text-zinc-200 border border-white/10 hover:bg-lime-400 hover:text-black hover:border-lime-400 shadow-none transition-colors duration-150 [&_svg]:transition-colors'",
            "'bg-[#242424] text-zinc-200 border border-white/10 hover:bg-lime-400 hover:text-black hover:border-lime-400 hover:[&_*]:!text-black hover:[&_svg]:!text-black shadow-none transition-colors duration-150 [&_svg]:transition-colors'",
        ),
        (
            "'bg-transparent text-zinc-400 hover:bg-lime-400 hover:text-black hover:border-lime-400 border border-transparent transition-colors duration-150 [&_svg]:transition-colors'",
            "'bg-transparent text-zinc-400 hover:bg-lime-400 hover:text-black hover:border-lime-400 hover:[&_*]:!text-black hover:[&_svg]:!text-black border border-transparent transition-colors duration-150 [&_svg]:transition-colors'",
        ),
        (
            "'bg-lime-400 text-black border border-lime-400 hover:bg-lime-300 hover:border-lime-300 active:bg-lime-400 shadow-none transition-colors duration-150 [&_svg]:transition-colors'",
            "'bg-lime-400 text-black border border-lime-400 hover:bg-lime-300 hover:border-lime-300 hover:text-black hover:[&_*]:!text-black hover:[&_svg]:!text-black active:bg-lime-400 shadow-none transition-colors duration-150 [&_svg]:transition-colors'",
        ),
    ]
    for old, new in anim_replacements:
        if old in anim_code:
            anim_code = anim_code.replace(old, new)
            print(f"Updated variant in {animate_btn_path}")

    with open(animate_btn_path, "w") as f:
        f.write(anim_code)

# 3. Add global CSS safety net rule in src/styles.css
styles_path = os.path.join(SRC_DIR, "styles.css")
if os.path.exists(styles_path):
    with open(styles_path, "r") as f:
        styles_code = f.read()

    css_marker = "/* LIME HOVER TEXT CONTRAST FIX */"
    if css_marker not in styles_code:
        css_rules = f"""
{css_marker}
/* Automatically invert text and SVG icons to black whenever solid lime hover is active */
button[class*="hover:bg-lime-400"]:hover:not([class*="hover:bg-lime-400/"]),
button[class*="hover:bg-lime-300"]:hover:not([class*="hover:bg-lime-300/"]),
button[class*="hover:bg-[#B1FA63]"]:hover:not([class*="hover:bg-[#B1FA63]/"]),
button[class*="hover:bg-[#C2FF78]"]:hover:not([class*="hover:bg-[#C2FF78]/"]),
a[class*="hover:bg-lime-400"]:hover:not([class*="hover:bg-lime-400/"]),
a[class*="hover:bg-lime-300"]:hover:not([class*="hover:bg-lime-300/"]),
a[class*="hover:bg-[#B1FA63]"]:hover:not([class*="hover:bg-[#B1FA63]/"]),
a[class*="hover:bg-[#C2FF78]"]:hover:not([class*="hover:bg-[#C2FF78]/"]) {{
  color: #000000 !important;
}}

button[class*="hover:bg-lime-400"]:hover:not([class*="hover:bg-lime-400/"]) *,
button[class*="hover:bg-lime-300"]:hover:not([class*="hover:bg-lime-300/"]) *,
button[class*="hover:bg-[#B1FA63]"]:hover:not([class*="hover:bg-[#B1FA63]/"]) *,
button[class*="hover:bg-[#C2FF78]"]:hover:not([class*="hover:bg-[#C2FF78]/"]) *,
a[class*="hover:bg-lime-400"]:hover:not([class*="hover:bg-lime-400/"]) *,
a[class*="hover:bg-lime-300"]:hover:not([class*="hover:bg-lime-300/"]) *,
a[class*="hover:bg-[#B1FA63]"]:hover:not([class*="hover:bg-[#B1FA63]/"]) *,
a[class*="hover:bg-[#C2FF78]"]:hover:not([class*="hover:bg-[#C2FF78]/"]) * {{
  color: #000000 !important;
}}
"""
        styles_code += css_rules
        with open(styles_path, "w") as f:
            f.write(styles_code)
        print(f"Added CSS contrast rule to {styles_path}")

# 4. Scan and fix explicit hover button classes across all TSX files
tsx_files = []
for root, _, files in os.walk(SRC_DIR):
    for f in files:
        if f.endswith((".tsx", ".jsx")):
            tsx_files.append(os.path.join(root, f))

modified_count = 0
for path in tsx_files:
    with open(path, "r", errors="ignore") as f:
        content = f.read()

    orig_content = content

    # Fix buttons/links with hover:bg-[#B1FA63] or hover:bg-lime-400 without hover:[&_*]:!text-black
    # Example: hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63]
    pattern1 = re.compile(
        r'(hover:bg-(?:\[#B1FA63\]|lime-400)\s+hover:text-black\s+hover:border-(?:\[#B1FA63\]|lime-400))(?!.*?hover:\[&_\*\]:!text-black)'
    )
    content = pattern1.sub(r'\1 hover:[&_*]:!text-black hover:[&_svg]:!text-black', content)

    # Fix buttons/links with hover:bg-lime-400 hover:text-black (without border)
    pattern2 = re.compile(
        r'(hover:bg-(?:\[#B1FA63\]|lime-400)\s+hover:text-black)(?!.*?hover:\[&_\*\]:!text-black)'
    )
    content = pattern2.sub(r'\1 hover:[&_*]:!text-black hover:[&_svg]:!text-black', content)

    if content != orig_content:
        with open(path, "w") as f:
            f.write(content)
        modified_count += 1
        print(f"Fixed hover contrast classes in: {os.path.relpath(path, ROOT_DIR)}")

print(f"\nDone! Updated {modified_count} source files with automatic text-black contrast on lime hover.")
