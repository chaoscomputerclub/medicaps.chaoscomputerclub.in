import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CodeEditor } from "@/organization/components/CodeEditor";
import {
  DetailSkeleton,
  DifficultyBadge,
  EmptyState,
  ErrorState,
  Panel,
  PanelHeader,
  ProblemStatusBadge,
  RouteFade,
  TagList,
  formatRelative,
} from "@/organization/components/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { submitAttempt } from "@/organization/data/api";
import { useDataMode } from "@/organization/data/data-mode";
import { portalQueries } from "@/organization/data/queries";

export const Route = createFileRoute("/portal/problems/$problemSlug")({
  head: () => ({
    meta: [
      { title: "Problem — CCC Member Portal" },
      { name: "description", content: "Problem prompt, constraints and submission." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProblemDetailPage,
});

function ProblemDetailPage() {
  const { problemSlug } = Route.useParams();
  const { mode } = useDataMode();
  const qc = useQueryClient();
  const { data, isPending, isError, refetch } = useQuery(portalQueries.problem(mode, problemSlug));
  const submissionsQ = useQuery({
    ...portalQueries.submissions(mode, data?.id ?? ""),
    enabled: Boolean(data?.id),
  });

  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (data) setCode(data.starter_code);
  }, [data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = useMutation({
    mutationFn: () =>
      submitAttempt(mode, {
        problem_id: data!.id,
        language: data!.language,
        code,
        note: note.trim() || null,
      }),
    onSuccess: () => {
      setConfirmOpen(false);
      setNote("");
      void qc.invalidateQueries({ queryKey: ["portal", mode, "submissions", data?.id] });
      void qc.invalidateQueries({ queryKey: ["portal", mode, "problem", problemSlug] });
      void qc.invalidateQueries({ queryKey: ["portal", mode, "problems"] });
      toast("Attempt recorded", { description: "Queued — no judge is running yet." });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Submission failed."),
  });

  if (isPending) {
    return (
      <RouteFade>
        <DetailSkeleton />
      </RouteFade>
    );
  }
  if (isError) {
    return (
      <RouteFade>
        <ErrorState message="This problem couldn't be loaded." onRetry={() => void refetch()} />
      </RouteFade>
    );
  }
  if (!data) {
    return (
      <RouteFade>
        <ErrorState message="No problem exists at this address." />
      </RouteFade>
    );
  }

  return (
    <RouteFade>
      <Link
        to="/portal/problems"
        className="inline-flex items-center gap-1.5 font-mono text-[0.625rem] tracking-[0.16em] text-muted-foreground uppercase transition-colors duration-150 ease-editorial hover:text-accent"
      >
        <ArrowLeft className="size-3" aria-hidden /> Problems
      </Link>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <article className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <DifficultyBadge difficulty={data.difficulty} />
            <ProblemStatusBadge status={data.status} />
            <span className="font-mono text-[0.625rem] tabular-nums text-subtle-foreground">
              {data.attempts} attempts · {data.solved_by_count} solved
            </span>
          </div>
          <h1 className="mt-3 font-display text-3xl tracking-tight text-foreground">
            {data.title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{data.summary}</p>

          <div className="mt-6 space-y-4">
            {data.prompt.split("\n\n").map((para, i) => (
              <p
                key={i}
                className="text-[0.9375rem] leading-relaxed whitespace-pre-line text-foreground/90"
              >
                {para}
              </p>
            ))}
          </div>

          <Panel className="mt-6">
            <PanelHeader title="Constraints" />
            <ul className="divide-y divide-border">
              {data.constraints.map((c) => (
                <li
                  key={c}
                  className="px-4 py-3 font-mono text-[0.75rem] leading-relaxed tabular-nums text-foreground/90"
                >
                  {c}
                </li>
              ))}
            </ul>
          </Panel>

          <div className="mt-5">
            <TagList tags={data.tags} />
          </div>
        </article>

        <section className="min-w-0 space-y-4" aria-labelledby="attempt-heading">
          <h2
            id="attempt-heading"
            className="font-mono text-[0.625rem] tracking-[0.18em] text-muted-foreground uppercase"
          >
            Your attempt
          </h2>
          <CodeEditor
            value={code}
            onChange={setCode}
            language={data.language}
            label="Solution"
            id="attempt-code"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="rounded-none bg-accent font-mono text-[0.625rem] tracking-[0.16em] text-accent-foreground uppercase hover:bg-accent/90"
              onClick={() => setConfirmOpen(true)}
              disabled={!code.trim()}
            >
              Submit attempt
            </Button>
            <Button
              variant="outline"
              className="rounded-none font-mono text-[0.625rem] tracking-[0.16em] uppercase"
              onClick={() => setCode(data.starter_code)}
            >
              Reset to starter
            </Button>
          </div>

          <Panel>
            <PanelHeader title="Submission history" />
            {submissionsQ.isPending ? (
              <p className="px-4 py-4 font-mono text-[0.625rem] text-subtle-foreground">Loading…</p>
            ) : (submissionsQ.data ?? []).length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No submissions yet"
                  description="Attempts you submit in this session show up here with their queue state."
                />
              </div>
            ) : (
              <ol className="divide-y divide-border">
                {(submissionsQ.data ?? []).map((s) => (
                  <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[0.6875rem] text-foreground">{s.id}</p>
                      {s.note ? (
                        <p className="mt-1 text-xs break-words text-muted-foreground">{s.note}</p>
                      ) : null}
                    </div>
                    <p className="font-mono text-[0.625rem] tabular-nums text-subtle-foreground">
                      {s.state} · {formatRelative(s.submitted_at)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </section>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-none border-border bg-surface">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Submit this attempt?</DialogTitle>
            <DialogDescription className="text-[0.8125rem]">
              It gets queued against {data.title}. Nothing is executed at this stage — add a note on
              what you tried and what you think is still wrong.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="attempt-note" className="text-xs">
              Note (optional)
            </Label>
            <Textarea
              id="attempt-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Handles the truncated tail, still wrong on zero padding."
              className="rounded-none border-border bg-background text-[0.8125rem]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-none font-mono text-[0.625rem] tracking-[0.16em] uppercase"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-none bg-accent font-mono text-[0.625rem] tracking-[0.16em] text-accent-foreground uppercase hover:bg-accent/90"
              disabled={submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? "Submitting…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RouteFade>
  );
}
