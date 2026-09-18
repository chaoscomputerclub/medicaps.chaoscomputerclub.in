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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 rounded-none border border-white/10 bg-zinc-900/60 p-6 md:p-8 backdrop-blur-md shadow-xl">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-none border border-lime-400/30 bg-lime-400/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-lime-400">
            Read-only Institutional Record
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Problem Archive
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-zinc-400">
            Official algorithmic problem statements and editorials released after each contest room concludes.
          </p>
        </div>
        <div className="flex size-14 items-center justify-center rounded-none border border-white/10 bg-zinc-950/60 text-lime-400 shadow-inner">
          <BookOpenCheck className="size-7" />
        </div>
      </header>

      <section className="rounded-none border border-white/10 bg-zinc-900/60 p-6 md:p-8 space-y-6 backdrop-blur-md shadow-xl">
        <SectionHeader kicker="Released sets" title="Completed contest problems" />

        {complete.length === 0 ? (
          <EmptyState
            title="Archive Empty"
            body="No archived problem sets released yet. Completed contest problems and official editorials will appear here."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {complete.flatMap((c) =>
              (c.problems || []).map((p: any) => (
                <article
                  key={`${c.slug}-${p.index}`}
                  className="flex items-center justify-between p-5 rounded-none border border-white/10 bg-zinc-950/60 hover:border-lime-400/40 transition-all duration-200 group shadow-sm"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="font-mono text-lg font-black text-lime-400 w-8 text-center shrink-0">
                      {p.index}
                    </span>
                    <div className="min-w-0">
                      <small className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider block truncate">
                        {c.title}
                      </small>
                      <h2 className="text-base font-bold text-white group-hover:text-lime-400 transition-colors truncate">
                        {p.title}
                      </h2>
                      <p className="font-mono text-xs text-zinc-400">
                        {p.topic} · <span className="tabular-nums">{p.solved_count}</span> verified solves
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 pl-3">
                    <strong className="font-mono text-sm tabular-nums text-zinc-300">
                      {p.points} pts
                    </strong>
                    <Link
                      to={`/portal/problems/${c.slug}--${p.index.toLowerCase()}`}
                      className="p-2.5 rounded-none bg-zinc-800 hover:bg-lime-400 text-black transition-colors flex items-center justify-center"
                    >
                      <ArrowRight className="size-4" />
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
