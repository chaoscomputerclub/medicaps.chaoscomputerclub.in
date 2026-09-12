import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { PortalShell } from "@/organization/components/PortalShell";
import { isAuthenticated } from "@/lib/auth";

export const Route = createFileRoute("/portal")({
  beforeLoad: () => {
    // Protected route — redirect unauthenticated users to /auth
    if (typeof window !== "undefined" && !isAuthenticated()) {
      throw redirect({ to: "/auth" });
    }
  },
  component: PortalShell,
});
