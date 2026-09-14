import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Round 1 lives in the dedicated full-screen coding workspace.
 * This path is kept so older links keep working.
 */
export const Route = createFileRoute("/portal/contests/$contestSlug/assessment")({
  validateSearch: (search: Record<string, unknown>): { state?: string } => ({
    state: search["state"] ? String(search["state"]) : "default",
  }),
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/assessments/$contestSlug", params: { contestSlug: params.contestSlug } });
  },
});
