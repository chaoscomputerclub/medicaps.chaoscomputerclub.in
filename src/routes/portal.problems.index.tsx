import { ProblemsSkeleton } from "@/organization/components/skeletons";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpenCheck } from "lucide-react";
import { portalQueries } from "@/organization/data/queries";
import { SectionHeader, EmptyState } from "@/organization/components/ui";
const q = portalQueries.contests();
export const Route = createFileRoute("/portal/problems/")({
  head: () => ({
    meta: [
      { title: "Problem Archive — CCC Medi-Caps" },
      {
        name: "description",
        content:
          "Read-only archive of completed offline CCC Medi-Caps contest sets and editorials.",
      },
      { property: "og:title", content: "CCC Medi-Caps Problem Archive" },
      {
        property: "og:description",
        content: "Official post-contest problem records. No browser submissions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  pendingComponent: ProblemsSkeleton,
  component: Archive,
});
function Archive() {
  const { data } = useSuspenseQuery(q);
  const complete = data.filter((c) => c.status === "finished");
  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="kicker">Read-only institutional record</p>
          <h1>Problem archive.</h1>
          <p>
            Official statements and editorials are released after each room closes. This portal
            never accepts code.
          </p>
        </div>
        <BookOpenCheck className="header-glyph" />
      </header>
      <section className="panel">
        <SectionHeader kicker="Released sets" title="Completed contest problems" />
        <div className="archive-list">
          {complete.length === 0 ? (
            <EmptyState
              title="Archive Empty"
              body="No archived problem sets released yet. Completed offline contest problems and official editorials will appear here."
            />
          ) : (
            complete.flatMap((c) =>
              c.problems.map((p) => (
                <article key={`${c.slug}-${p.index}`}>
                  <span>{p.index}</span>
                  <div>
                    <small>{c.title}</small>
                    <h2>{p.title}</h2>
                    <p>
                      {p.topic} · {p.solved_count} verified solves
                    </p>
                  </div>
                  <strong>{p.points}</strong>
                  <Link
                    to="/portal/problems/$problemSlug"
                    params={{ problemSlug: `${c.slug}--${p.index.toLowerCase()}` }}
                  >
                    <ArrowRight />
                  </Link>
                </article>
              )),
            )
          )}
        </div>
      </section>
    </div>
  );
}
