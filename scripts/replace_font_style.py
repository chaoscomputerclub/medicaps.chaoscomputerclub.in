#!/usr/bin/env python3
"""
Simple script to find and replace font styles (e.g. font-mono -> font-sans)
across the entire frontend application at once.

Usage:
    # 1. Preview changes (Dry Run):
    python3 scripts/replace_font_style.py

    # 2. Execute replacement at once across all files:
    python3 scripts/replace_font_style.py --apply
"""

import os
import sys
import re
import argparse

def main():
    parser = argparse.ArgumentParser(
        description="Search and replace font styles across the entire application in one pass."
    )
    parser.add_argument(
        "--dir",
        default="src",
        help="Root directory to search (default: src)"
    )
    parser.add_argument(
        "--from-font",
        default="font-mono",
        help="Font class/style to search for (default: font-mono)"
    )
    parser.add_argument(
        "--to-font",
        default="font-sans",
        help="Font class/style to replace with (default: font-sans)"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply changes in-place. If omitted, performs a dry-run preview."
    )
    parser.add_argument(
        "--exclude-css",
        action="store_true",
        default=True,
        help="Exclude styles.css root font variables (default: True)"
    )

    args = parser.parse_args()

    # Match exact word boundaries for the font class (e.g. font-mono, not font-monochrome)
    pattern = re.compile(rf"\b{re.escape(args.from_font)}\b")
    
    extensions = (".tsx", ".ts", ".jsx", ".js", ".html")
    if not args.exclude_css:
        extensions += (".css",)

    target_dir = os.path.abspath(args.dir)
    if not os.path.isdir(target_dir):
        print(f"Error: Directory '{target_dir}' does not exist.")
        sys.exit(1)

    matched_files = []
    total_replacements = 0

    for root, _, files in os.walk(target_dir):
        for file in files:
            if file.endswith(extensions):
                # Skip styles.css if exclude-css is enabled
                if args.exclude_css and file == "styles.css":
                    continue
                
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = f.read()
                except Exception as e:
                    print(f"Warning: Could not read {filepath}: {e}")
                    continue

                matches = pattern.findall(content)
                if matches:
                    count = len(matches)
                    total_replacements += count
                    matched_files.append((filepath, count, content))

    print("=" * 65)
    print(f"🔍 FONT STYLE REPLACEMENT: '{args.from_font}' -> '{args.to_font}'")
    print(f"📁 Target Directory: {target_dir}")
    print(f"📊 Results: Found {total_replacements} occurrences in {len(matched_files)} files")
    print("=" * 65)

    if not matched_files:
        print("No matching font styles found.")
        return

    if not args.apply:
        print("\n[DRY RUN PREVIEW - No files were modified]")
        print("Files that contain this font style:")
        for path, count, _ in matched_files:
            rel_path = os.path.relpath(path)
            print(f"  • {rel_path} ({count} match{'es' if count > 1 else ''})")
        print("\n👉 To apply these changes across all files at once, run:")
        print(f"   python3 scripts/replace_font_style.py --apply\n")
        return

    # In-place batch replacement
    modified_count = 0
    for path, count, original_content in matched_files:
        new_content = pattern.sub(args.to_font, original_content)
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)
        modified_count += 1
        rel_path = os.path.relpath(path)
        print(f"  ✔ Updated: {rel_path} ({count} replaced)")

    print("=" * 65)
    print(f"✅ Success! Replaced {total_replacements} occurrences in {modified_count} files.")
    print("=" * 65)

if __name__ == "__main__":
    main()
