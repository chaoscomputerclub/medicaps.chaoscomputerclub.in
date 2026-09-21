import { Link } from "react-router-dom";
import { ArrowRight, BookOpenCheck } from "lucide-react";
import { getPublicPortalData } from "@/organization/data/portal.functions";
import { SectionHeader, PageHeader, EmptyState } from "@/organization/components/ui";
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <PageHeader
        kicker="03 // Problem Repository"
        index="ARCHIVE"
        badge={
          <span className="inline-flex items-center gap-1.5 rounded border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-lime-400">
            Institutional Archive
          </span>
        }
        title="Problem Archive"
        description="Official competitive programming problem statements and editorials from concluded tournaments."
        action={
          <div className="flex size-12 items-center justify-center rounded-lg border border-white/8 bg-black text-lime-400">
            <BookOpenCheck className="size-6" />
          </div>
        }
      />

      <section className="rounded-lg border border-white/8 bg-black p-5 sm:p-6 space-y-5">
        <SectionHeader kicker="01 // Released Sets" index="PROBLEMS" title="Concluded Contest Challenges" />

        {complete.length === 0 ? (
          <EmptyState
            title="Archive Empty"
            body="No archived problem sets released yet. Concluded contest problems and official editorials will appear here."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {complete.flatMap((c) =>
              (c.problems || []).map((p: any) => {
                const pIndex = p.problem_index || p.index || "—";
                const pSlug = (pIndex === "—" ? "" : pIndex).toLowerCase();
                return (
                  <article
                    key={`${c.slug}-${pIndex}-${p.id || ""}`}
                    className="flex items-center justify-between p-4 rounded-lg border border-white/8 bg-black hover:border-white/20 transition-colors group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="font-mono text-base font-semibold text-lime-400 w-7 text-center shrink-0">
                        {pIndex}
                      </span>
                      <div className="min-w-0 space-y-0.5">
                        <small className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider block truncate">
                          {c.title}
                        </small>
                        <h2 className="text-sm font-semibold text-white group-hover:text-lime-400 transition-colors truncate">
                          {p.title}
                        </h2>
                        <p className="font-mono text-[11px] text-zinc-500">
                          {p.topic} · <span className="tabular-nums text-zinc-400">{p.solved_count ?? 0}</span> solves
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 pl-3">
                      <strong className="font-mono text-xs tabular-nums text-zinc-400 font-semibold">
                        {p.points ?? 0} pts
                      </strong>
                      <Link
                        to={`/problems/${c.slug}--${pSlug}`}
                        className="size-8 rounded-md bg-transparent border border-white/20 hover:bg-lime-400 hover:text-black hover:border-lime-400 text-white transition-colors flex items-center justify-center [&_svg]:transition-colors"
                      >
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}
      </section>
    </div>
  );
}
