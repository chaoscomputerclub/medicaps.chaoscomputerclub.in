import { Link } from "react-router-dom";
import { ArrowRight, BookOpenCheck } from "lucide-react";
import { getPublicPortalData } from "@/organization/data/portal.functions";
import { SectionHeader, EmptyState } from "@/organization/components/ui";
import { ProblemArchiveSkeleton } from "@/organization/components/skeletons";
import { useSwrData } from "@/lib/cache/swrCache";

export function ProblemArchivePage() {
  const { data: publicData, loading } = useSwrData(
    "public:portal:data",
    () => getPublicPortalData(),
    { ttl: 5 * 60 * 1000 }
  );

  if (loading && !publicData) {
    return <ProblemArchiveSkeleton />;
  }

  const contests = publicData?.contests || [];
  const complete = contests.filter((c: any) => c.status === "finished");

  return (
    <div className="page-wrap space-y-6">
      <header className="page-header">
        <div>
          <p className="kicker">Read-only institutional record</p>
          <h1>Problem archive.</h1>
          <p>
            Official statements and editorials are released after each room closes. This portal never accepts code.
          </p>
        </div>
        <BookOpenCheck className="header-glyph" />
      </header>

      <section className="border border-[#292929] bg-[#0d0d0d] p-6 space-y-6">
        <SectionHeader kicker="Released sets" title="Completed contest problems" />

        {complete.length === 0 ? (
          <EmptyState
            title="Archive Empty"
            body="No archived problem sets released yet. Completed offline contest problems and official editorials will appear here."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {complete.flatMap((c) =>
              (c.problems || []).map((p: any) => (
                <article
                  key={`${c.slug}-${p.index}`}
                  className="flex items-center justify-between p-4 border border-[#292929] bg-neutral-900/40 hover:border-[var(--accent)] transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-lg font-bold text-[var(--accent)] w-8 text-center">
                      {p.index}
                    </span>
                    <div>
                      <small className="font-mono text-[10px] text-neutral-400 uppercase tracking-wider block">
                        {c.title}
                      </small>
                      <h2 className="text-base font-bold text-white group-hover:text-[var(--accent)] transition-colors">
                        {p.title}
                      </h2>
                      <p className="text-xs text-neutral-400">
                        {p.topic} · {p.solved_count} verified solves
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <strong className="font-mono text-sm text-neutral-300">
                      {p.points} pts
                    </strong>
                    <Link
                      to={`/portal/problems/${c.slug}--${p.index.toLowerCase()}`}
                      className="p-2 bg-neutral-800 hover:bg-[var(--accent)] text-white hover:text-black transition-colors"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}
