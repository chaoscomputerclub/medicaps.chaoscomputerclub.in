import { Outlet, createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "@/organization/components/PortalShell";
import { DataModeProvider } from "@/organization/data/data-mode";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Member portal — Chaos Computer Club" },
      {
        name: "description",
        content:
          "The Chaos Computer Club member portal: your events, problems, contributions and profile.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalLayout,
});

function PortalLayout() {
  return (
    <DataModeProvider>
      <PortalShell>
        <Outlet />
      </PortalShell>
    </DataModeProvider>
  );
}
