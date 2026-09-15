import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Ban, CheckCircle2 } from "lucide-react";
import { getPublicPortalData } from "@/organization/data/portal.functions";
import { ProblemDetailSkeleton } from "@/organization/components/skeletons";

export function ProblemDetailPage() {
  const { problemSlug } = useParams<{ problemSlug: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ contest: any; problem: any } | null>(null);

  useEffect(() => {
    let active = true;
    if (!problemSlug) {
      setLoading(false);
      return;
    }

    const [slug, index] = problemSlug.split("--");
    getPublicPortalData()
      .then((portalData) => {
        if (!active) return;
        const contest = portalData.contests?.find((c: any) => c.slug === slug);
        const problem =
          contest?.status === "finished"
            ? contest.problems?.find((p: any) => p.index.toLowerCase() === index?.toLowerCase())
            : undefined;

        if (contest && problem) {
          setData({ contest, problem });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load problem detail:", err);
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [problemSlug]);

  if (loading) {
    return <ProblemDetailSkeleton />;
  }

  if (!data) {
    return (
      <div className="page-wrap p-6 max-w-4xl mx-auto py-16 space-y-4">
        <Link to="/portal/problems" className="inline-flex items-center gap-2 text-xs font-mono text-neutral-400 hover:text-white">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to problem archive
        </Link>
        <h1 className="text-2xl font-mono font-bold text-white uppercase">Archived problem not found</h1>
        <p className="text-neutral-400 text-sm">
          The requested problem is either unreleased, ongoing, or invalid.
        </p>
      </div>
    );
  }

  const { contest, problem } = data;

  return (
    <div className="page-wrap p-6 max-w-4xl mx-auto space-y-8">
      <Link
        to="/portal/problems"
        className="inline-flex items-center gap-2 text-xs font-mono text-neutral-400 hover:text-[var(--accent)] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Problem archive
      </Link>

      <header className="border-b border-[#292929] pb-6 flex items-start gap-5">
        <span className="font-mono text-3xl font-black text-[var(--accent)] border border-[var(--accent)] px-3 py-1 bg-[var(--accent)]/10">
          {problem.index}
        </span>
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-neutral-400">
            {contest.title} · {problem.points} points
          </p>
          <h1 className="text-2xl sm:text-3xl font-mono font-bold text-white uppercase mt-1">
            {problem.title}
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            {problem.topic} · {problem.solved_count} verified solves
          </p>
        </div>
      </header>

      <div className="flex items-start gap-4 p-4 border border-yellow-500/30 bg-yellow-950/20 text-yellow-300">
        <Ban className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <strong className="font-mono text-sm block">No online submission surface</strong>
          <p className="text-xs text-neutral-300 mt-0.5">
            This statement is preserved for study. Official attempts were accepted only from assigned campus workstations during the contest window.
          </p>
        </div>
      </div>

      <article className="border border-[#292929] bg-[#0d0d0d] p-6 space-y-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--accent)] font-semibold mb-1">
            Official editorial
          </p>
          <h2 className="text-xl font-mono font-bold text-white uppercase">
            Post-contest analysis
          </h2>
        </div>

        <p className="text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap">
          {problem.editorial}
        </p>

        <div className="space-y-2">
          <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
            Core observation
          </h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Model the invariant before choosing a data structure. The intended solution maintains a monotonic decision boundary and proves every discarded state cannot improve the final answer.
          </p>
          <pre className="p-3 bg-black border border-[#292929] font-mono text-xs text-[var(--accent)]">
            <code>{`complexity: O(n log n)\nspace: O(n)\nverdict source: sealed judge replay`}</code>
          </pre>
        </div>

        <div className="pt-4 border-t border-[#292929] flex items-center gap-2 text-xs text-neutral-400">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>The solve count and first-accept timing were reconciled against workstation logs before publication.</span>
        </div>
      </article>
    </div>
  );
}
