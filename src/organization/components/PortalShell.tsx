/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Swords,
  Terminal,
  Trophy,
  UserRound,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataMode } from "@/organization/data/data-mode";
import { portalQueries } from "@/organization/data/queries";

const nav = [
  { title: "Dashboard", to: "/portal", icon: LayoutDashboard },
  { title: "Events", to: "/portal/events", icon: CalendarDays },
  { title: "Problems", to: "/portal/problems", icon: Terminal },
  { title: "Contests", to: "/portal/contests", icon: Swords },
  { title: "Leaderboard", to: "/portal/leaderboard", icon: Trophy },
  { title: "Profile", to: "/portal/profile", icon: UserRound },
] as const;

function PortalSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { mode, setMode } = useDataMode();
  const { data: member, isPending } = useQuery(portalQueries.member(mode));

  const isActive = (to: string) =>
    to === "/portal" ? pathname === "/portal" : pathname.startsWith(to);

  return (
    <Sidebar collapsible="icon" className="border-border">
      <SidebarHeader className="border-b border-border">
        <Link
          to="/portal"
          className="flex items-center gap-2 px-1 py-1.5 font-mono text-[0.625rem] tracking-[0.2em] uppercase"
        >
          <span className="grid size-6 shrink-0 place-items-center border border-border-strong text-accent">
            C
          </span>
          <span className="truncate group-data-[collapsible=icon]:hidden">CCC / Portal</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[0.5625rem] tracking-[0.2em] uppercase">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.title}>
                    <Link to={item.to} className="flex items-center gap-2">
                      <item.icon className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3 border-t border-border">
        <div className="flex items-center gap-2 px-1 group-data-[collapsible=icon]:hidden">
          <Switch
            id="data-mode"
            checked={mode === "new_member"}
            onCheckedChange={(v) => setMode(v ? "new_member" : "member")}
          />
          <Label
            htmlFor="data-mode"
            className="font-mono text-[0.5625rem] tracking-[0.16em] text-muted-foreground uppercase"
          >
            New-member view
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Avatar className="size-7 shrink-0 rounded-none border border-border">
            <AvatarFallback className="rounded-none bg-surface-raised font-mono text-[0.625rem]">
              {member ? member.full_name.slice(0, 2).toUpperCase() : "··"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            {isPending || !member ? (
              <Skeleton className="h-3 w-24 rounded-none" />
            ) : (
              <>
                <p className="truncate text-xs text-foreground">{member.full_name}</p>
                <p className="truncate font-mono text-[0.625rem] text-subtle-foreground">
                  @{member.handle}
                </p>
              </>
            )}
          </div>
          <Link
            to="/login"
            aria-label="Sign out"
            className="shrink-0 p-1 text-subtle-foreground transition-colors duration-150 ease-editorial hover:text-foreground group-data-[collapsible=icon]:hidden"
          >
            <LogOut className="size-4" aria-hidden />
          </Link>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

/** The single layout chrome for every portal screen. */
export function PortalShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <PortalSidebar />
        <SidebarInset className="min-w-0 bg-background">
          <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur-md">
            <SidebarTrigger className="rounded-none" />
            <span className="font-mono text-[0.5625rem] tracking-[0.2em] text-subtle-foreground uppercase">
              Member portal
            </span>
          </header>
          <main className="min-w-0 px-4 py-6 md:px-8 md:py-10">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
