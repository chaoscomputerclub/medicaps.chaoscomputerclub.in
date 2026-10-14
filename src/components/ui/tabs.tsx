"use client";

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
