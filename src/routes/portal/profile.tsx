import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Panel,
  PanelHeader,
  RouteFade,
  RowSkeletons,
  StaggerItem,
  TagList,
  formatDate,
  formatRelative,
} from "@/organization/components/ui";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { updateMember } from "@/organization/data/api";
import { useDataMode } from "@/organization/data/data-mode";
import { portalQueries } from "@/organization/data/queries";
import type { Member } from "@/organization/data/types";

export const Route = createFileRoute("/portal/profile")({
  head: () => ({
    meta: [
      { title: "Profile — CCC Member Portal" },
      {
        name: "description",
        content: "Your identity, skills, contribution history and earned achievements.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { mode } = useDataMode();
  const memberQ = useQuery(portalQueries.member(mode));
  const activityQ = useQuery(portalQueries.activity(mode));
  const achievementsQ = useQuery(portalQueries.achievements(mode));

  return (
    <RouteFade>
      <PageHeader
        title="Profile"
        description="What the club knows about you, and what you've done here."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {memberQ.isPending ? (
            <Panel className="space-y-3 p-4">
              <Skeleton className="h-12 w-12 rounded-none" />
              <Skeleton className="h-4 w-40 rounded-none" />
              <Skeleton className="h-3 w-full rounded-none" />
            </Panel>
          ) : memberQ.isError || !memberQ.data ? (
            <ErrorState
              message="Your profile couldn't be loaded."
              onRetry={() => void memberQ.refetch()}
            />
          ) : (
            <IdentityCard member={memberQ.data} />
          )}

          <Panel>
            <PanelHeader title="Contribution history" />
            {activityQ.isPending ? (
              <div className="p-4">
                <RowSkeletons count={3} />
              </div>
            ) : activityQ.isError ? (
              <div className="p-4">
                <ErrorState
                  message="History couldn't be loaded."
                  onRetry={() => void activityQ.refetch()}
                />
              </div>
            ) : (activityQ.data ?? []).length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="Nothing recorded yet"
                  description="Editorials, fixes, sessions you run and problems you solve all land here."
                />
              </div>
            ) : (
              <ol className="divide-y divide-border">
                {(activityQ.data ?? []).map((a, i) => (
                  <li key={a.id}>
                    <StaggerItem index={i} className="px-4 py-3.5">
                      <p className="text-[0.8125rem] leading-snug text-foreground">{a.title}</p>
                      {a.detail ? (
                        <p className="mt-1 text-xs text-muted-foreground">{a.detail}</p>
                      ) : null}
                      <p className="mt-1.5 font-mono text-[0.625rem] tabular-nums text-subtle-foreground">
                        {formatRelative(a.occurred_at)}
                      </p>
                    </StaggerItem>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <Panel>
          <PanelHeader title="Achievements" />
          {achievementsQ.isPending ? (
            <div className="p-4">
              <RowSkeletons count={4} />
            </div>
          ) : achievementsQ.isError ? (
            <div className="p-4">
              <ErrorState
                message="Achievements couldn't be loaded."
                onRetry={() => void achievementsQ.refetch()}
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {(achievementsQ.data ?? []).map((a, i) => (
                <li key={a.id}>
                  <StaggerItem index={i} className="px-4 py-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[0.8125rem] text-foreground">{a.name}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {a.description}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          a.earned_at
                            ? "shrink-0 rounded-none border-accent/60 bg-transparent font-mono text-[0.5625rem] tracking-[0.16em] text-accent uppercase"
                            : "shrink-0 rounded-none border-border bg-transparent font-mono text-[0.5625rem] tracking-[0.16em] text-subtle-foreground uppercase"
                        }
                      >
                        {a.earned_at ? "earned" : "locked"}
                      </Badge>
                    </div>
                    {a.progress ? (
                      <div className="mt-3">
                        <Progress
                          value={Math.min(100, (a.progress.current / a.progress.target) * 100)}
                          className="h-1 rounded-none bg-surface-raised"
                        />
                        <p className="mt-1.5 font-mono text-[0.625rem] tabular-nums text-subtle-foreground">
                          {a.progress.current} / {a.progress.target}
                        </p>
                      </div>
                    ) : a.earned_at ? (
                      <p className="mt-2 font-mono text-[0.625rem] tabular-nums text-subtle-foreground">
                        {formatDate(a.earned_at)}
                      </p>
                    ) : null}
                  </StaggerItem>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </RouteFade>
  );
}

function IdentityCard({ member }: { member: Member }) {
  const { mode } = useDataMode();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: member.full_name,
    bio: member.bio ?? "",
    skills: member.skills.join(", "),
  });

  const save = useMutation({
    mutationFn: () =>
      updateMember(mode, {
        full_name: form.full_name.trim(),
        bio: form.bio.trim() || null,
        skills: form.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: (updated) => {
      qc.setQueryData(portalQueries.member(mode).queryKey, updated);
      setEditing(false);
      toast("Profile updated");
    },
    onError: () => toast.error("Couldn't save those changes."),
  });

  return (
    <Panel>
      <PanelHeader
        title="Identity"
        aside={
          editing ? (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 rounded-none px-2"
                aria-label="Cancel editing"
                onClick={() => {
                  setEditing(false);
                  setForm({
                    full_name: member.full_name,
                    bio: member.bio ?? "",
                    skills: member.skills.join(", "),
                  });
                }}
              >
                <X className="size-3.5" aria-hidden />
              </Button>
              <Button
                size="sm"
                className="h-7 rounded-none bg-accent px-2 text-accent-foreground hover:bg-accent/90"
                aria-label="Save profile"
                disabled={save.isPending}
                onClick={() => save.mutate()}
              >
                <Check className="size-3.5" aria-hidden />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 rounded-none px-2 font-mono text-[0.5625rem] tracking-[0.16em] uppercase"
              onClick={() => setEditing(true)}
            >
              <Pencil className="mr-1 size-3" aria-hidden /> Edit
            </Button>
          )
        }
      />
      <div className="space-y-5 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-12 shrink-0 rounded-none border border-border-strong">
            <AvatarFallback className="rounded-none bg-surface-raised font-mono text-xs">
              {member.full_name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            {editing ? (
              <div className="space-y-1.5">
                <Label htmlFor="full-name" className="text-xs">
                  Full name
                </Label>
                <Input
                  id="full-name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="rounded-none border-border bg-background text-[0.8125rem]"
                />
              </div>
            ) : (
              <>
                <p className="truncate font-display text-lg text-foreground">{member.full_name}</p>
                <p className="truncate font-mono text-[0.6875rem] text-subtle-foreground">
                  @{member.handle} · {member.email}
                </p>
              </>
            )}
          </div>
        </div>

        <div>
          {editing ? (
            <div className="space-y-1.5">
              <Label htmlFor="bio" className="text-xs">
                Bio
              </Label>
              <Textarea
                id="bio"
                rows={3}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="What are you working on, and what is currently broken about it?"
                className="rounded-none border-border bg-background text-[0.8125rem]"
              />
            </div>
          ) : member.bio ? (
            <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">{member.bio}</p>
          ) : (
            <p className="text-[0.8125rem] leading-relaxed text-subtle-foreground">
              No bio yet. One line about what you&apos;re building is enough.
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 font-mono text-[0.5625rem] tracking-[0.16em] text-subtle-foreground uppercase">
            Skills
          </p>
          {editing ? (
            <div className="space-y-1.5">
              <Label htmlFor="skills" className="text-xs">
                Comma separated
              </Label>
              <Input
                id="skills"
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
                className="rounded-none border-border bg-background text-[0.8125rem]"
              />
            </div>
          ) : member.skills.length ? (
            <TagList tags={member.skills} />
          ) : (
            <p className="text-[0.8125rem] text-subtle-foreground">
              Nothing listed yet — add what you want to be asked about.
            </p>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4">
          <div>
            <dt className="font-mono text-[0.5625rem] tracking-[0.16em] text-subtle-foreground uppercase">
              Joined
            </dt>
            <dd className="mt-1 font-mono text-[0.6875rem] tabular-nums text-foreground">
              {formatDate(member.joined_at)}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[0.5625rem] tracking-[0.16em] text-subtle-foreground uppercase">
              Year / branch
            </dt>
            <dd className="mt-1 font-mono text-[0.6875rem] tabular-nums text-foreground">
              {member.year ? `Y${member.year}` : "—"} · {member.branch ?? "—"}
            </dd>
          </div>
        </dl>
      </div>
    </Panel>
  );
}
