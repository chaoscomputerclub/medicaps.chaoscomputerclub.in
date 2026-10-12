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
        <Link to="/problems" className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-white transition-colors">
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
        to="/problems"
        className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-white transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Problem archive
      </Link>

      <PageHeader
        kicker="05 // Problem Statement"
        index={`PROBLEM ${problem.index} · ${problem.points} PTS`}
        title={problem.title}
        description={`${contest.title} · ${problem.topic} · ${problem.solved_count} verified solves.`}
        badge={
          <span className="font-mono text-xs font-semibold text-lime-400 border border-lime-400/30 rounded px-2.5 py-0.5 bg-lime-400/10">
            PROBLEM {problem.index}
          </span>
        }
      />

      <div className="flex items-start gap-3.5 p-5 rounded-[18px] border border-white/[0.08] bg-[#1F1F1F] text-zinc-300">
        <Ban className="size-4 shrink-0 mt-0.5 text-zinc-500" />
        <div className="space-y-0.5 text-xs">
          <strong className="text-white block font-heading font-bold uppercase tracking-wider">Archived Reference Only</strong>
          <p className="text-zinc-400 font-sans">
            This challenge is preserved for post-contest analysis. Live submission is closed.
          </p>
        </div>
      </div>

      <article className="rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] p-6 sm:p-8 space-y-6 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
        <SectionHeader
          kicker="01 // Official Editorial"
          index={`ANALYSIS · ${problem.points} PTS`}
          title="Solution Breakdown"
        />

        <p className="text-zinc-300 text-sm font-sans leading-relaxed whitespace-pre-wrap">
          {problem.editorial}
        </p>

        <div className="space-y-2">
          <h3 className="text-xs font-heading font-bold text-white uppercase tracking-wider">
            Complexity Boundary
          </h3>
          <pre className="rounded-[14px] p-4 bg-[#171717] border border-white/[0.08] font-mono text-xs text-[#B1FA63] overflow-x-auto">
            <code>{`complexity: O(n log n)\nspace: O(n)\nverdict: accepted`}</code>
          </pre>
        </div>

        <div className="pt-4 border-t border-white/[0.06] flex items-center gap-2 text-xs font-sans text-zinc-400">
          <CheckCircle2 className="size-3.5 text-[#B1FA63] shrink-0" />
          <span>Solve metrics reconciled against official campus judge replay.</span>
        </div>
      </article>
    </div>
  );
}
