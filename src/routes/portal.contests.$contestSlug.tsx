import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { contestSystemQueries } from "@/organization/data/contest-queries";
import { getContestRegistrationStatus } from "@/lib/auth";

export const Route = createFileRoute("/portal/contests/$contestSlug")({
  beforeLoad: async ({ context, params }) => {
    // Client-side route middleware: guard live contests for eligible cadets only
    if (typeof window === "undefined") return;
    try {
      const contest = await context.queryClient.ensureQueryData(
        contestSystemQueries.contest(params.contestSlug)
      );
      if (
        contest &&
        (contest.lifecycle === "assessment_live" ||
          (contest as any).status === "live")
      ) {
        const standing = await getContestRegistrationStatus(params.contestSlug).catch(() => null);
        if (
          standing &&
          standing.contest_status === "live" &&
          !standing.can_enter_live_contest &&
          !standing.is_top_30_qualified
        ) {
          throw redirect({
            to: "/portal/contests",
            search: { filter: "all", state: "default" },
          });
        }
      }
    } catch (err: any) {
      if (err?.isRedirect) throw err;
      if (err?.status === 403 || (err?.message && err.message.includes("403"))) {
        throw redirect({
          to: "/portal/contests",
          search: { filter: "all", state: "default" },
        });
      }
    }
  },
  component: () => <Outlet />,
});
