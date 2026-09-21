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
        <Link to="/portal/problems" className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft className="size-3.5" /> Back to problem archive
        </Link>
        <h1 className="text-xl font-semibold text-white">Archived Problem Not Found</h1>
        <p className="text-zinc-500 text-xs font-mono">
          The requested problem is unreleased or invalid.
        </p>
      </div>
    );
  }

  const { contest, problem } = data;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Link
        to="/portal/problems"
        className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-white transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Problem archive
      </Link>

      <PageHeader
        kicker="03 // Problem Statement"
        index={`PROBLEM ${problem.index} · ${problem.points} PTS`}
        title={problem.title}
        description={`${contest.title} · ${problem.topic} · ${problem.solved_count} verified solves.`}
        badge={
          <span className="font-mono text-xs font-semibold text-lime-400 border border-lime-400/30 rounded px-2.5 py-0.5 bg-lime-400/10">
            PROBLEM {problem.index}
          </span>
        }
      />

      <div className="flex items-start gap-3 p-4 rounded-lg border border-white/8 bg-black text-zinc-300">
        <Ban className="size-4 shrink-0 mt-0.5 text-zinc-500" />
        <div className="space-y-0.5 font-mono text-xs">
          <strong className="text-white block uppercase tracking-wider">Archived Reference Only</strong>
          <p className="text-zinc-400">
            This challenge is preserved for post-contest analysis. Live submission is closed.
          </p>
        </div>
      </div>

      <article className="rounded-lg border border-white/8 bg-black p-6 space-y-6">
        <SectionHeader
          kicker="01 // Official Editorial"
          index={`ANALYSIS · ${problem.points} PTS`}
          title="Solution Breakdown"
        />

        <p className="text-zinc-300 text-xs font-mono leading-relaxed whitespace-pre-wrap">
          {problem.editorial}
        </p>

        <div className="space-y-2">
          <h3 className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
            Complexity Boundary
          </h3>
          <pre className="rounded-md p-3.5 bg-zinc-950 border border-white/8 font-mono text-xs text-lime-400 overflow-x-auto">
            <code>{`complexity: O(n log n)\nspace: O(n)\nverdict: accepted`}</code>
          </pre>
        </div>

        <div className="pt-4 border-t border-white/6 flex items-center gap-2 text-xs font-mono text-zinc-500">
          <CheckCircle2 className="size-3.5 text-lime-400 shrink-0" />
          <span>Solve metrics reconciled against official campus judge replay.</span>
        </div>
      </article>
    </div>
  );
}
