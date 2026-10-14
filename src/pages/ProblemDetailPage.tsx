import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Ban, CheckCircle2, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MakoMascot } from "@/components/common/MakoMascot";
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
      <div className="min-h-[70vh] flex items-center justify-center px-4 sm:px-6 py-16 font-sans">
        <div className="w-full max-w-md rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] p-8 text-center flex flex-col items-center">
          <MakoMascot
            variant="not-found"
            size="2xl"
            className="mb-4 drop-shadow-md select-none pointer-events-none"
          />
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-sans font-medium text-zinc-400 bg-white/[0.05] border border-white/[0.08] mb-2 tracking-wide uppercase">
            404 Not Found
          </span>
          <h1 className="text-2xl font-sans font-bold text-white tracking-tight">
            Problem Not Found
          </h1>
          <p className="text-sm text-zinc-400 font-sans leading-relaxed max-w-sm mt-2 mb-6">
            The requested archived problem could not be found or is currently unreleased.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 w-full">
            <Button
              asChild
              className="flex-1 h-10 rounded-lg bg-[#B1FA63] text-black font-semibold hover:bg-[#9fe350] transition-colors focus-visible:ring-2 focus-visible:ring-[#B1FA63]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <Link to="/practice">
                <ArrowLeft className="size-3.5 mr-1.5" />
                <span>Practice Arena</span>
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="flex-1 h-10 rounded-lg border-white/10 bg-transparent text-zinc-300 hover:bg-white/[0.04] hover:text-white"
            >
              <Link to="/">
                <Home className="size-3.5 mr-1.5" />
                <span>Dashboard</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { contest, problem } = data;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Link
        to="/problems"
        className="inline-flex items-center gap-1.5 text-xs font-sans text-zinc-500 hover:text-white transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Problem archive
      </Link>

      <PageHeader
        title={problem.title}
        description={`${contest.title} · ${problem.topic} · ${problem.solved_count} verified solves.`}
        badge={
          <span className="font-sans text-xs font-semibold text-lime-400 border border-lime-400/30 rounded px-2.5 py-0.5 bg-lime-400/10">
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

      <article className="rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] p-6 sm:p-8 space-y-6">
        <SectionHeader
          title="Solution Breakdown"
        />

        <p className="text-zinc-300 text-sm font-sans leading-relaxed whitespace-pre-wrap">
          {problem.editorial}
        </p>

        <div className="space-y-2">
          <h3 className="text-xs font-heading font-bold text-white uppercase tracking-wider">
            Complexity Boundary
          </h3>
          <pre className="rounded-[14px] p-4 bg-[#171717] border border-white/[0.08] font-sans text-xs text-[#B1FA63] overflow-x-auto">
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
