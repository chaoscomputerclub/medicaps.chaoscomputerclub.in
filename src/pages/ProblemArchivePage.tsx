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
        badge={
          <span className="inline-flex items-center gap-1.5 rounded border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-lime-400">
            Institutional Archive
          </span>
        }
        title="Problem Archive"
        description="Official competitive programming problem statements and editorials from concluded tournaments."
        action={
          <div className="flex size-12 items-center justify-center rounded-[12px] border border-white/[0.08] bg-[#171717] text-[#B1FA63]">
            <BookOpenCheck className="size-6" />
          </div>
        }
      />

      <section className="rounded-[24px] border border-white/10 bg-[#1F1F1F] p-5 sm:p-6 space-y-5">
        <SectionHeader
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
                className="h-10 pl-8 pr-2.5 text-sm bg-[#171717] border-white/10 font-sans rounded-[10px] focus-visible:ring-1 focus-visible:ring-[#B1FA63]"
              />
            </div>
          }
        />

        {complete.length === 0 ? (
          <EmptyState
            title="Archive Empty"
            body="No archived problem sets released yet. Concluded contest problems and official editorials will appear here."
            makoVariant="learning"
          />
        ) : filteredProblems.length === 0 ? (
          <EmptyState
            title="No Problems Found"
            body={`No archived challenges matching "${deferredFilter}". Try another keyword or clear filter.`}
            makoVariant="search"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredProblems.map((p: any) => {
              return (
                <article
                  key={`${p.contestSlug}-${p.pIndex}-${p.id || ""}`}
                  className="flex items-center justify-between p-4 rounded-[16px] border border-white/10 bg-[#171717] hover:border-[#B1FA63]/50 transition-all duration-150 group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="font-heading font-bold text-base text-[#B1FA63] w-7 text-center shrink-0">
                      {p.pIndex}
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <Link
                        to={`/contests/${p.contestSlug}`}
                        className="font-heading text-[10px] text-zinc-500 hover:text-zinc-300 uppercase tracking-wider block truncate transition-colors"
                      >
                        {p.contestTitle}
                      </Link>
                      <h2 className="text-sm font-semibold text-white group-hover:text-[#B1FA63] transition-colors truncate">
                        <Link to={`/problems/${p.contestSlug}--${p.pSlug}`} className="hover:underline">
                          {p.title}
                        </Link>
                      </h2>
                      <p className="font-sans text-[11px] text-zinc-500">
                        {p.topic} · <span className="tabular-nums text-zinc-400 font-sans">{p.solved_count ?? 0}</span>&nbsp;solves
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 pl-3">
                    <strong className="font-heading text-xs tabular-nums text-zinc-400 font-bold">
                      {p.points ?? 0}&nbsp;pts
                    </strong>
                    <Link
                      to={`/problems/${p.contestSlug}--${p.pSlug}`}
                      className="size-8 rounded-[10px] bg-[#1F1F1F] border border-white/10 hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63] hover:[&_*]:!text-black hover:[&_svg]:!text-black text-zinc-400 transition-colors flex items-center justify-center active:scale-[0.96]"
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
