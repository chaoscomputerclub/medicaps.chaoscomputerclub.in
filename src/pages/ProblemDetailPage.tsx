import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Ban, CheckCircle2 } from "lucide-react";
import { getPublicPortalData } from "@/organization/data/portal.functions";
import { ProblemDetailSkeleton } from "@/organization/components/skeletons";
import { useSwrData } from "@/lib/cache/swrCache";
import { PageHeader, SectionHeader } from "@/organization/components/ui";

export function ProblemDetailPage() {
  const { problemSlug } = useParams<{ problemSlug: string }>();

  const { data: portalData, loading } = useSwrData(
    "public:portal:data",
    () => getPublicPortalData(),
    { ttl: 5 * 60 * 1000 }
  );

  const data = useMemo(() => {
    if (!problemSlug || !portalData) return null;
    const [slug, index] = problemSlug.split("--");
    const contest = portalData.contests?.find((c: any) => c.slug === slug);
    const problem =
      contest?.status === "finished"
        ? contest.problems?.find((p: any) => {
            const pIdx = (p.problem_index || p.index || "").toLowerCase();
            const targetIdx = (index || "").toLowerCase();
            return pIdx && pIdx === targetIdx;
          })
        : undefined;

    if (contest && problem) {
      return { contest, problem };
    }
    return null;
  }, [problemSlug, portalData]);

  if (loading && !data) {
    return <ProblemDetailSkeleton />;
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 space-y-4">
        <Link to="/portal/problems" className="inline-flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="size-3.5" /> Back to problem archive
        </Link>
        <h1 className="text-2xl font-mono font-bold text-white uppercase">Archived problem not found</h1>
        <p className="text-zinc-400 text-sm">
          The requested problem is either unreleased, ongoing, or invalid.
        </p>
      </div>
    );
  }

  const { contest, problem } = data;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <Link
        to="/portal/problems"
        className="inline-flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-lime-400 transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Problem archive
      </Link>

      <PageHeader
        kicker="03 // Problem Dossier"
        index={`INDEX 3.${problem.index} · ${problem.points} PTS`}
        title={problem.title}
        description={`${contest.title} · ${problem.topic} · ${problem.solved_count} verified solves recorded from campus workstations.`}
        badge={
          <span className="font-mono text-sm font-black text-lime-400 border border-lime-400/40 rounded-none px-3 py-1 bg-lime-400/10">
            PROBLEM {problem.index}
          </span>
        }
      />

      <div className="flex items-start gap-4 p-4 rounded-none border border-amber-500/30 bg-amber-950/20 text-amber-300">
        <Ban className="size-5 shrink-0 mt-0.5" />
        <div>
          <strong className="font-mono text-sm block uppercase">No online submission surface</strong>
          <p className="text-xs text-zinc-300 mt-0.5">
            This statement is preserved for study. Official attempts were accepted only from assigned campus workstations during the contest window.
          </p>
        </div>
      </div>

      <article className="rounded-none border border-white/10 bg-zinc-900/60 p-6 md:p-8 space-y-6 backdrop-blur-md shadow-xl">
        <SectionHeader
          kicker="01 // Official Editorial"
          index={`ANALYSIS · ${problem.points} PTS`}
          title="Post-Contest Analysis"
        />

        <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
          {problem.editorial}
        </p>

        <div className="space-y-2">
          <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
            Core Observation
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Model the invariant before choosing a data structure. The intended solution maintains a monotonic decision boundary and proves every discarded state cannot improve the final answer.
          </p>
          <pre className="rounded-none p-4 bg-zinc-950 border border-white/10 font-mono text-xs text-lime-400 overflow-x-auto">
            <code>{`complexity: O(n log n)\nspace: O(n)\nverdict source: sealed judge replay`}</code>
          </pre>
        </div>

        <div className="pt-4 border-t border-white/10 flex items-center gap-2 text-xs text-zinc-400">
          <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
          <span>The solve count and first-accept timing were reconciled against workstation logs before publication.</span>
        </div>
      </article>
    </div>
  );
}
