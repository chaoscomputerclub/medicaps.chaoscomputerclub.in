#!/usr/bin/env python3
"""
standardize_tabs_architecture.py
Finds all tab implementations across the codebase and standardizes them
to use the animate-ui base tabs architecture:
  import {
    Tabs,
    TabsPanel,
    TabsPanels,
    TabsList,
    TabsTab,
  } from '@/components/animate-ui/components/base/tabs';
"""

import os
import re

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT_DIR, "src")

# 1. Update src/components/ui/tabs.tsx to export the animate-ui tabs architecture
ui_tabs_path = os.path.join(SRC_DIR, "components", "ui", "tabs.tsx")
ui_tabs_content = '''"use client";

import * as React from "react";
import {
  Tabs,
  TabsList,
  TabsTab,
  TabsPanels,
  TabsPanel,
  useTabs,
  type TabsProps,
  type TabsListProps,
  type TabsTabProps,
  type TabsPanelsProps,
  type TabsPanelProps,
} from "@/components/animate-ui/components/base/tabs";

// Backward-compatible aliases for shadcn standard names
const TabsTrigger = TabsTab;
const TabsContent = TabsPanel;

export {
  Tabs,
  TabsList,
  TabsTab,
  TabsPanels,
  TabsPanel,
  TabsTrigger,
  TabsContent,
  useTabs,
  type TabsProps,
  type TabsListProps,
  type TabsTabProps,
  type TabsPanelsProps,
  type TabsPanelProps,
};
'''
with open(ui_tabs_path, "w") as f:
    f.write(ui_tabs_content)
print(f"Standardized {os.path.relpath(ui_tabs_path, ROOT_DIR)} with base tabs architecture")

# 2. Update RecentSubmissionsCard.tsx
card_path = os.path.join(SRC_DIR, "components", "profile", "RecentSubmissionsCard.tsx")
if os.path.exists(card_path):
    with open(card_path, "r") as f:
        card_content = f.read()

    # Add tabs import
    if "from \"@/components/animate-ui/components/base/tabs\"" not in card_content:
        import_stmt = '''import {
  Tabs,
  TabsPanel,
  TabsPanels,
  TabsList,
  TabsTab,
} from "@/components/animate-ui/components/base/tabs";\n'''
        card_content = import_stmt + card_content

    # Target the tabs header and body
    old_tabs_structure = '''      {/* Tabs Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5 text-xs">
        <div className="flex items-center gap-1.5 bg-[#171717] p-1 rounded-[12px] border border-white/[0.08]">
          <button
            type="button"
            onClick={() => setActiveTab("recent_ac")}
            className={`px-3 py-1.5 rounded-[8px] flex items-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "recent_ac"
                ? "bg-[#B1FA63] text-black font-extrabold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <CheckCircle2 className={`size-3.5 ${activeTab === "recent_ac" ? "text-black" : "text-[#B1FA63]"}`} />
            <span>Recent AC</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-[8px] flex items-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "all"
                ? "bg-[#B1FA63] text-black font-extrabold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <History className="size-3.5" />
            <span>All Submissions</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tournaments")}
            className={`px-3 py-1.5 rounded-[8px] flex items-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "tournaments"
                ? "bg-[#B1FA63] text-black font-extrabold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Trophy className="size-3.5" />
            <span>Tournaments</span>
          </button>
        </div>

        <Link
          to={activeTab === "tournaments" ? "/contests" : "/practice"}
          className="text-zinc-400 hover:text-[#B1FA63] text-xs font-heading font-bold uppercase tracking-wider transition-colors flex items-center gap-1 self-end sm:self-auto"
        >
          <span>{activeTab === "tournaments" ? "All contests" : "Practice arena"}</span>
          <ChevronRight className="size-3" />
        </Link>
      </div>'''

    new_tabs_header = '''      {/* Tabs System */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "recent_ac" | "all" | "tournaments")}
        className="w-full gap-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5 text-xs">
          <TabsList className="bg-[#171717] border border-white/[0.08] p-1 rounded-[12px] gap-1">
            <TabsTab value="recent_ac" className="flex items-center gap-1.5 px-3 py-1.5 text-xs">
              <CheckCircle2 className="size-3.5" />
              <span>Recent AC</span>
            </TabsTab>
            <TabsTab value="all" className="flex items-center gap-1.5 px-3 py-1.5 text-xs">
              <History className="size-3.5" />
              <span>All Submissions</span>
            </TabsTab>
            <TabsTab value="tournaments" className="flex items-center gap-1.5 px-3 py-1.5 text-xs">
              <Trophy className="size-3.5" />
              <span>Tournaments</span>
            </TabsTab>
          </TabsList>

          <Link
            to={activeTab === "tournaments" ? "/contests" : "/practice"}
            className="text-zinc-400 hover:text-[#B1FA63] text-xs font-heading font-bold uppercase tracking-wider transition-colors flex items-center gap-1 self-end sm:self-auto"
          >
            <span>{activeTab === "tournaments" ? "All contests" : "Practice arena"}</span>
            <ChevronRight className="size-3" />
          </Link>
        </div>

        <TabsPanels className="w-full">'''

    if old_tabs_structure in card_content:
        card_content = card_content.replace(old_tabs_structure, new_tabs_header)

        # Replace conditional blocks with TabsPanel
        card_content = card_content.replace(
            '{/* Tab Body: Recent AC */}\n      {activeTab === "recent_ac" && (',
            '{/* Tab Body: Recent AC */}\n          <TabsPanel value="recent_ac">'
        )
        card_content = card_content.replace(
            '      {/* Tab Body: All Submissions */}\n      {activeTab === "all" && (',
            '</TabsPanel>\n\n          {/* Tab Body: All Submissions */}\n          <TabsPanel value="all">'
        )
        card_content = card_content.replace(
            '      {/* Tab Body: Tournaments */}\n      {activeTab === "tournaments" && (',
            '</TabsPanel>\n\n          {/* Tab Body: Tournaments */}\n          <TabsPanel value="tournaments">'
        )

        # Close the last panel and TabsPanels + Tabs at the end before outer closing </div>
        # Find the last closing tag of tournaments block
        last_block = '''              ))
            )}
          </div>
        )}
      </div>
    );
  }'''
        new_last_block = '''              ))
            )}
          </div>
        </TabsPanel>
      </TabsPanels>
    </Tabs>
  </div>
);
}'''
        if last_block in card_content:
            card_content = card_content.replace(last_block, new_last_block)
        else:
            # Flexible replacement of ending of card
            pattern = re.compile(r'(\s*\)\s*\}\s*</div>\s*\}\s*</div>\s*\);\s*\})', re.MULTILINE)
            card_content = pattern.sub('\n            </TabsPanel>\n          </TabsPanels>\n        </Tabs>\n      </div>\n    );\n  }', card_content)

        with open(card_path, "w") as f:
            f.write(card_content)
        print(f"Standardized {os.path.relpath(card_path, ROOT_DIR)} with Tabs architecture")

# 3. Update ContestArenaPage.tsx Settings Tabs
arena_path = os.path.join(SRC_DIR, "pages", "ContestArenaPage.tsx")
if os.path.exists(arena_path):
    with open(arena_path, "r") as f:
        arena_content = f.read()

    old_settings_tabs = '''          {/* Settings Tabs */}
          <div className="flex items-center gap-1 border-b border-white/10 pb-2 pt-1">
            <button
              type="button"
              onClick={() => setActiveSettingsTab("editor")}
              className={`px-3 py-1 rounded-md font-sans text-sm font-semibold transition-colors cursor-pointer ${
                activeSettingsTab === "editor"
                  ? "bg-[#242424] text-white border border-lime-400/40"
                  : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              Code Editor
            </button>
            <button
              type="button"
              onClick={() => setActiveSettingsTab("shortcuts")}
              className={`px-3 py-1 rounded-md font-sans text-sm font-semibold transition-colors cursor-pointer ${
                activeSettingsTab === "shortcuts"
                  ? "bg-[#242424] text-white border border-lime-400/40"
                  : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              Shortcuts
            </button>
            <button
              type="button"
              onClick={() => setActiveSettingsTab("timer")}
              className={`px-3 py-1 rounded-md font-sans text-sm font-semibold transition-colors cursor-pointer ${
                activeSettingsTab === "timer"
                  ? "bg-[#242424] text-white border border-lime-400/40"
                  : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              Contest Clock
            </button>
          </div>

          <div className="py-3 text-xs font-sans">
            {activeSettingsTab === "editor" && ('''

    new_settings_tabs = '''          {/* Settings Tabs (animate-ui Base Tabs Architecture) */}
          <Tabs
            value={activeSettingsTab}
            onValueChange={(val) => setActiveSettingsTab(val as "editor" | "shortcuts" | "timer")}
            className="w-full gap-2"
          >
            <TabsList className="w-full grid grid-cols-3 bg-[#171717] border border-white/10 p-1 rounded-[10px] gap-1">
              <TabsTab value="editor" className="py-1 text-xs">Code Editor</TabsTab>
              <TabsTab value="shortcuts" className="py-1 text-xs">Shortcuts</TabsTab>
              <TabsTab value="timer" className="py-1 text-xs">Contest Clock</TabsTab>
            </TabsList>

            <TabsPanels className="py-2 text-xs font-sans">
              <TabsPanel value="editor">'''

    if old_settings_tabs in arena_content:
        arena_content = arena_content.replace(old_settings_tabs, new_settings_tabs)
        arena_content = arena_content.replace(
            '            {activeSettingsTab === "shortcuts" && (',
            '</TabsPanel>\n              <TabsPanel value="shortcuts">'
        )
        arena_content = arena_content.replace(
            '            {activeSettingsTab === "timer" && (',
            '</TabsPanel>\n              <TabsPanel value="timer">'
        )
        arena_content = arena_content.replace(
            '              </div>\n            )}\n          </div>\n\n          <DialogFooter>',
            '              </div>\n              </TabsPanel>\n            </TabsPanels>\n          </Tabs>\n\n          <DialogFooter>'
        )

        with open(arena_path, "w") as f:
            f.write(arena_content)
        print(f"Standardized {os.path.relpath(arena_path, ROOT_DIR)} Settings Tabs with Tabs architecture")

# 4. Update SocialDrawer.tsx imports to use animate-ui base tabs
social_path = os.path.join(SRC_DIR, "organization", "components", "SocialDrawer.tsx")
if os.path.exists(social_path):
    with open(social_path, "r") as f:
        social_content = f.read()

    social_content = social_content.replace(
        'from "@/components/ui/animated-tabs"',
        'from "@/components/animate-ui/components/base/tabs"'
    )
    with open(social_path, "w") as f:
        f.write(social_content)
    print(f"Standardized {os.path.relpath(social_path, ROOT_DIR)} tabs import")

print("\nAll tabs across the project successfully standardized to animate-ui Base Tabs architecture!")
