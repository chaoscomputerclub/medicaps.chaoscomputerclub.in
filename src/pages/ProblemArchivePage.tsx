import { useState, useMemo, useTransition, useDeferredValue } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpenCheck, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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

  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const deferredFilter = useDeferredValue(searchQuery);

  const contests = publicData?.contests || [];
  const complete = useMemo(() => contests.filter((c: any) => c.status === "finished"), [contests]);

  const allProblems = useMemo(() => {
    return complete.flatMap((c: any) =>
      (c.problems || []).map((p: any) => {
        const pIndex = p.problem_index || p.index || "—";
        const pSlug = (pIndex === "—" ? "" : pIndex).toLowerCase();
        return {
          ...p,
          contestSlug: c.slug,
          contestTitle: c.title,
          pIndex,
          pSlug,
        };
      })
    );
  }, [complete]);

  const filteredProblems = useMemo(() => {
    const q = deferredFilter.trim().toLowerCase();
    if (!q) return allProblems;
    return allProblems.filter((p: any) =>
      (p.title || "").toLowerCase().includes(q) ||
      (p.pIndex || "").toLowerCase().includes(q) ||
      (p.topic || "").toLowerCase().includes(q) ||
      (p.contestTitle || "").toLowerCase().includes(q)
    );
  }, [allProblems, deferredFilter]);

  if (loading && !publicData) {
    return <ProblemArchiveSkeleton />;
  }

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
        <SectionHeader
          kicker="01 // Released Sets"
          index="PROBLEMS"
          title="Concluded Contest Challenges"
          action={
            <div className="relative w-48 sm:w-64">
              <Search className="size-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="text"
                placeholder="Filter problems…"
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  startTransition(() => {
                    setSearchQuery(val);
                  });
                }}
                className="h-8 pl-8 pr-2.5 text-xs bg-zinc-950 border-white/10 font-mono rounded focus-visible:ring-1 focus-visible:ring-lime-400"
              />
            </div>
          }
        />

        {complete.length === 0 ? (
          <EmptyState
            title="Archive Empty"
            body="No archived problem sets released yet. Concluded contest problems and official editorials will appear here."
          />
        ) : filteredProblems.length === 0 ? (
          <EmptyState
            title="No Problems Found"
            body={`No archived challenges matching "${deferredFilter}". Try another keyword or clear filter.`}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredProblems.map((p: any) => {
              return (
                <article
                  key={`${p.contestSlug}-${p.pIndex}-${p.id || ""}`}
                  className="flex items-center justify-between p-4 rounded-lg border border-white/8 bg-black hover:border-white/20 transition-colors group content-auto-card"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="font-mono text-base font-semibold text-lime-400 w-7 text-center shrink-0">
                      {p.pIndex}
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <Link
                        to={`/contests/${p.contestSlug}`}
                        className="font-mono text-[9px] text-zinc-500 hover:text-zinc-300 uppercase tracking-wider block truncate transition-colors"
                      >
                        {p.contestTitle}
                      </Link>
                      <h2 className="text-sm font-semibold text-white group-hover:text-lime-400 transition-colors truncate">
                        <Link to={`/problems/${p.contestSlug}--${p.pSlug}`} className="hover:underline">
                          {p.title}
                        </Link>
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
                      to={`/problems/${p.contestSlug}--${p.pSlug}`}
                      className="size-8 rounded-md bg-zinc-950 border border-white/8 hover:bg-lime-400 hover:text-black text-zinc-400 transition-colors flex items-center justify-center"
                    >
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
