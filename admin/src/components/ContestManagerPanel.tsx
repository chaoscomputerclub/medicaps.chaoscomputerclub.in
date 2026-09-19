import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Trophy,
  Plus,
  Search,
  Calendar,
  Clock,
  MapPin,
  Users,
  ShieldCheck,
  ShieldAlert,
  Edit3,
  Trash2,
  Copy,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Code2,
  Settings2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  adminContestApi,
  type AdminContestSummary,
  type AdminContestDetail,
  type ProblemPayload,
  type ContestCreatePayload,
  type AssessmentUpdatePayload,
} from "../api/adminContestApi";
import { ProblemEditorModal } from "./ProblemEditorModal";
import { ContestCreateModal } from "./ContestCreateModal";

interface ContestManagerPanelProps {
  onContestListChanged?: () => void;
}

export function ContestManagerPanel({ onContestListChanged }: ContestManagerPanelProps) {
  const [contests, setContests] = useState<AdminContestSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "upcoming" | "live" | "finished">("all");

  // Selected Contest Full Detail
  const [detail, setDetail] = useState<AdminContestDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [activeWorkbenchTab, setActiveWorkbenchTab] = useState<"overview" | "assessment" | "arena_questions" | "assessment_questions">("overview");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isProblemModalOpen, setIsProblemModalOpen] = useState(false);
  const [editingProblem, setEditingProblem] = useState<Partial<ProblemPayload> | null>(null);
  const [problemModalTarget, setProblemModalTarget] = useState<"contest" | "assessment" | "both">("both");
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState<string | null>(null);

  // Editable form state for Contest Overview
  const [contestForm, setContestForm] = useState<any>({});
  const [isSavingContest, setIsSavingContest] = useState(false);

  // Editable form state for Assessment
  const [assessmentForm, setAssessmentForm] = useState<AssessmentUpdatePayload>({});
  const [isSavingAssessment, setIsSavingAssessment] = useState(false);

  // Load contest master list
  const loadContests = useCallback(async (preferredSlug?: string) => {
    setIsLoading(true);
    try {
      const list = await adminContestApi.list();
      setContests(list || []);
      if (list && list.length > 0) {
        const nextSlug = preferredSlug || (list.some((c) => c.slug === selectedSlug) ? selectedSlug : list[0].slug);
        setSelectedSlug(nextSlug);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load contest list.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedSlug]);

  // Load detailed contest dossier
  const loadDetail = useCallback(async (slug: string) => {
    if (!slug) return;
    setIsLoadingDetail(true);
    try {
      const data = await adminContestApi.getDetail(slug);
      setDetail(data);

      // Initialize Contest Form
      if (data?.contest) {
        const c = data.contest;
        setContestForm({
          title: c.title || "",
          season: c.season || "",
          cadence: c.cadence || "weekly",
          edition: c.edition ?? 1,
          division: c.division || "open",
          status: c.status || "upcoming",
          starts_at: c.starts_at ? new Date(c.starts_at).toISOString().slice(0, 16) : "",
          ends_at: c.ends_at ? new Date(c.ends_at).toISOString().slice(0, 16) : "",
          check_in_opens_at: c.check_in_opens_at ? new Date(c.check_in_opens_at).toISOString().slice(0, 16) : "",
          venue: c.venue || "",
          seat_capacity: c.seat_capacity || 60,
          environment: c.environment || "",
          prize_pool: c.prize_pool || "",
          sponsor: c.sponsor || "",
          summary: c.summary || "",
        });
      }

      // Initialize Assessment Form
      if (data?.assessment) {
        const a = data.assessment;
        setAssessmentForm({
          title: a.title || "",
          summary: a.summary || "",
          duration_minutes: a.duration_minutes || 90,
          starts_at: a.starts_at ? new Date(a.starts_at).toISOString().slice(0, 16) : "",
          ends_at: a.ends_at ? new Date(a.ends_at).toISOString().slice(0, 16) : "",
          max_violations: a.max_violations ?? 3,
          is_active: a.is_active ?? true,
        });
      } else {
        setAssessmentForm({
          title: "",
          summary: "",
          duration_minutes: 90,
          starts_at: null,
          ends_at: null,
          max_violations: 3,
          is_active: true,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load contest detail.");
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    loadContests();
  }, []);

  useEffect(() => {
    if (selectedSlug) {
      loadDetail(selectedSlug);
    }
  }, [selectedSlug, loadDetail]);

  // Filtered master list
  const filteredContests = useMemo(() => {
    return contests.filter((c) => {
      const matchSearch =
        searchQuery === "" ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [contests, searchQuery, statusFilter]);

  // Handler: Save Contest Overview
  const handleSaveContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlug) return;
    setIsSavingContest(true);
    try {
      const payload = {
        ...contestForm,
        edition: Number(contestForm.edition),
        seat_capacity: Number(contestForm.seat_capacity),
        starts_at: contestForm.starts_at ? new Date(contestForm.starts_at).toISOString() : undefined,
        ends_at: contestForm.ends_at ? new Date(contestForm.ends_at).toISOString() : undefined,
        check_in_opens_at: contestForm.check_in_opens_at
          ? new Date(contestForm.check_in_opens_at).toISOString()
          : undefined,
      };
      await adminContestApi.update(selectedSlug, payload);
      toast.success("Contest specifications updated successfully!");
      loadContests(selectedSlug);
      loadDetail(selectedSlug);
      onContestListChanged?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to update contest.");
    } finally {
      setIsSavingContest(false);
    }
  };

  // Handler: Save Assessment
  const handleSaveAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlug) return;
    setIsSavingAssessment(true);
    try {
      const payload: AssessmentUpdatePayload = {
        ...assessmentForm,
        duration_minutes: Number(assessmentForm.duration_minutes),
        max_violations: Number(assessmentForm.max_violations),
        starts_at: assessmentForm.starts_at ? new Date(assessmentForm.starts_at).toISOString() : null,
        ends_at: assessmentForm.ends_at ? new Date(assessmentForm.ends_at).toISOString() : null,
      };
      await adminContestApi.updateAssessment(selectedSlug, payload);
      toast.success("Screening assessment configuration saved!");
      loadDetail(selectedSlug);
      onContestListChanged?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to update assessment.");
    } finally {
      setIsSavingAssessment(false);
    }
  };

  // Handler: Auto-fill canonical assessment window (24h before contest starts)
  const handleAutoSetAssessmentWindow = () => {
    if (!contestForm.starts_at) {
      toast.error("Please ensure contest start time is configured first.");
      return;
    }
    const contestStart = new Date(contestForm.starts_at);
    const windowStart = new Date(contestStart.getTime() - 24 * 60 * 60 * 1000);
    setAssessmentForm((prev) => ({
      ...prev,
      title: prev.title || `${contestForm.title || "Contest"} — Online Screening Round`,
      summary: prev.summary || `Phase 1 online qualification round for ${contestForm.title}.`,
      starts_at: windowStart.toISOString().slice(0, 16),
      ends_at: contestStart.toISOString().slice(0, 16),
    }));
    toast.info("Assessment window auto-aligned: Opens 24h prior, closes at contest start.");
  };

  // Handler: Change Status
  const handleChangeStatus = async (newStatus: string) => {
    if (!selectedSlug) return;
    try {
      await adminContestApi.changeStatus(selectedSlug, newStatus, true);
      toast.success(`Contest status transitioned to '${newStatus.toUpperCase()}'.`);
      loadContests(selectedSlug);
      loadDetail(selectedSlug);
      onContestListChanged?.();
    } catch (err: any) {
      toast.error(err.message || `Failed to change status to ${newStatus}.`);
    }
  };

  // Handler: Clone Contest
  const handleCloneContest = async () => {
    if (!detail?.contest) return;
    const current = detail.contest;
    const newEdition = (current.edition ?? 1) + 1;
    const newTitle = `CCC Weekly Contest #${newEdition}`;
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(15, 0, 0, 0);

    const confirmed = window.confirm(
      `Clone this contest into Edition #${newEdition} scheduled for next week?`
    );
    if (!confirmed) return;

    try {
      const res = await adminContestApi.clone(current.slug, {
        new_title: newTitle,
        new_edition: newEdition,
        starts_at: nextWeek.toISOString(),
      });
      toast.success(`Contest cloned successfully as '${res.slug}'!`);
      loadContests(res.slug);
      onContestListChanged?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to clone contest.");
    }
  };

  // Handler: Delete Contest
  const handleDeleteContest = async () => {
    if (!deleteConfirmSlug) return;
    try {
      await adminContestApi.delete(deleteConfirmSlug);
      toast.success(`Contest '${deleteConfirmSlug}' deleted permanently.`);
      setDeleteConfirmSlug(null);
      loadContests();
      onContestListChanged?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete contest.");
    }
  };

  // Handler: Save Problem
  const handleSaveProblem = async (problem: ProblemPayload, target: "contest" | "assessment" | "both") => {
    if (!selectedSlug) return;
    await adminContestApi.saveProblem(selectedSlug, problem, target);
    loadDetail(selectedSlug);
    loadContests(selectedSlug);
    onContestListChanged?.();
  };

  // Handler: Delete Problem
  const handleDeleteProblem = async (problemIndex: string, target: "contest" | "assessment" | "both") => {
    if (!selectedSlug) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete Problem ${problemIndex} from ${target.toUpperCase()}?`
    );
    if (!confirmed) return;

    try {
      await adminContestApi.deleteProblem(selectedSlug, problemIndex, target);
      toast.success(`Problem ${problemIndex} removed successfully.`);
      loadDetail(selectedSlug);
      loadContests(selectedSlug);
      onContestListChanged?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete problem.");
    }
  };

  // Handler: Sync Problems
  const handleSyncProblems = async (direction: "contest_to_assessment" | "assessment_to_contest") => {
    if (!selectedSlug) return;
    const text =
      direction === "contest_to_assessment"
        ? "Copy all Contest Arena problems to Phase 1 Screening Assessment?"
        : "Copy all Screening Assessment problems to Contest Arena?";
    if (!window.confirm(text)) return;

    try {
      const res = await adminContestApi.syncProblems(selectedSlug, direction);
      toast.success(res.message || "Problems synchronized successfully!");
      loadDetail(selectedSlug);
      loadContests(selectedSlug);
      onContestListChanged?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to sync problems.");
    }
  };

  // Handler: Create Contest from modal
  const handleCreateContest = async (payload: ContestCreatePayload) => {
    const res = await adminContestApi.create(payload);
    loadContests(res.slug || payload.slug);
    onContestListChanged?.();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "live":
        return (
          <Badge className="bg-lime-400/10 text-lime-400 border-lime-400/40 text-[10px] font-mono font-bold uppercase rounded-none tracking-wider px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-none bg-lime-400 animate-ping inline-block mr-1.5" />
            LIVE
          </Badge>
        );
      case "finished":
        return (
          <Badge className="bg-zinc-900 text-zinc-400 border-white/10 text-[10px] font-mono font-bold uppercase rounded-none tracking-wider px-2 py-0.5">
            FINISHED
          </Badge>
        );
      default:
        return (
          <Badge className="bg-cyan-400/10 text-cyan-400 border-cyan-400/40 text-[10px] font-mono font-bold uppercase rounded-none tracking-wider px-2 py-0.5">
            UPCOMING
          </Badge>
        );
    }
  };

  const getDifficultyBadge = (difficulty?: string) => {
    switch (difficulty?.toUpperCase()) {
      case "HARD":
        return (
          <span className="border border-rose-500/40 bg-rose-500/10 text-rose-400 text-[9px] px-1.5 py-0.5 font-bold">
            HARD
          </span>
        );
      case "EASY":
        return (
          <span className="border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[9px] px-1.5 py-0.5 font-bold">
            EASY
          </span>
        );
      default:
        return (
          <span className="border border-amber-500/40 bg-amber-500/10 text-amber-400 text-[9px] px-1.5 py-0.5 font-bold">
            MEDIUM
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 font-mono">
      {/* Top Controls Header */}
      <div className="admin-card p-4 bg-[#09090d] border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-lime-400/10 border border-lime-400/40 flex items-center justify-center text-lime-400">
              <Trophy className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-base font-bold uppercase tracking-wider text-white">
              Contest Engineering Workbench
            </h1>
            <span className="text-[10px] bg-zinc-900 text-zinc-400 border border-white/10 px-1.5 py-0.5 uppercase">
              CRUD & ASSESSMENT AUTHORING
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Author tournament specifications, configure Phase 1 screening assessments, and curate dual problem suites with 1-click sync.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="h-9 rounded-none bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs font-extrabold uppercase tracking-wider px-4 shadow-[0_0_12px_rgba(204,255,0,0.25)] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5 stroke-[3]" /> Initialize New Contest
          </Button>
        </div>
      </div>

      {/* Split-Screen Workbench Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT RAIL: Contests Master List (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="admin-card p-3.5 bg-[#09090d] border border-white/10 space-y-3">
            {/* Search & Status Filters */}
            <div className="relative">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title or slug..."
                className="bg-black border-white/15 text-xs text-white h-8 pl-8 font-mono focus-visible:ring-2 focus-visible:ring-lime-400"
              />
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5 pointer-events-none" />
            </div>

            <div className="flex gap-1 border-b border-white/10 pb-2">
              {(["all", "upcoming", "live", "finished"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                    statusFilter === st
                      ? "bg-lime-400 text-black border-lime-400 font-extrabold"
                      : "bg-black text-zinc-400 border-white/10 hover:text-white"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Contests Count & Refresh */}
            <div className="flex items-center justify-between text-[10px] text-zinc-400">
              <span>Found: {filteredContests.length} contest(s)</span>
              <button
                onClick={() => loadContests()}
                className="text-zinc-400 hover:text-lime-400 underline cursor-pointer"
              >
                Refresh List
              </button>
            </div>
          </div>

          {/* Cards List */}
          <div className="space-y-2 max-h-[750px] overflow-y-auto pr-1">
            {isLoading && contests.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 bg-[#09090d] border border-white/10">
                Loading contests...
              </div>
            ) : filteredContests.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 bg-[#09090d] border border-white/10">
                No matching contests found.
              </div>
            ) : (
              filteredContests.map((c) => {
                const isSelected = c.slug === selectedSlug;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedSlug(c.slug)}
                    className={`p-3.5 border transition-all cursor-pointer rounded-none space-y-2 text-left ${
                      isSelected
                        ? "bg-zinc-900 border-lime-400 shadow-[0_0_15px_rgba(204,255,0,0.15)]"
                        : "bg-[#09090d] border-white/10 hover:border-white/30 hover:bg-zinc-900/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">
                            #{c.edition ?? "--"}
                          </span>
                          <span className="text-xs font-bold text-white leading-tight">
                            {c.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 block truncate font-mono">
                          /{c.slug}
                        </span>
                      </div>
                      {getStatusBadge(c.status)}
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[10px] text-zinc-400 pt-1 border-t border-white/5">
                      <div className="flex items-center gap-1 truncate">
                        <Calendar className="w-3 h-3 text-zinc-500" />
                        <span>{new Date(c.starts_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1 truncate">
                        <Users className="w-3 h-3 text-zinc-500" />
                        <span className="tabular-nums">
                          {c.registered_count}/{c.seat_capacity} seats
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-1 text-zinc-400">
                      <span className="text-zinc-400">
                        {c.problem_count} Arena Problem(s)
                      </span>
                      {c.has_assessment ? (
                        <span className="text-lime-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Screening Attached
                        </span>
                      ) : (
                        <span className="text-zinc-600">No Assessment</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT RAIL: Deep Contest & Assessment Workbench (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {isLoadingDetail ? (
            <div className="p-12 text-center text-xs text-zinc-500 admin-card bg-[#09090d] border border-white/10">
              Loading contest dossier...
            </div>
          ) : !detail?.contest ? (
            <div className="p-12 text-center text-xs text-zinc-500 admin-card bg-[#09090d] border border-white/10">
              Select a contest from the left panel to configure assessment and problem sets.
            </div>
          ) : (
            <div className="admin-card bg-[#09090d] border border-white/10 rounded-none overflow-hidden space-y-4 p-5">
              {/* Top Banner for Selected Contest */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white uppercase tracking-wider">
                      {detail.contest.title}
                    </span>
                    {getStatusBadge(detail.contest.status)}
                  </div>
                  <span className="text-xs text-lime-400 font-mono">
                    /{detail.contest.slug}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCloneContest}
                    className="h-8 rounded-none border-white/15 text-xs text-zinc-300 hover:text-white"
                  >
                    <Copy className="size-3 mr-1" /> Clone Edition
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteConfirmSlug(detail.contest.slug)}
                    className="h-8 rounded-none border-rose-500/40 text-xs text-rose-400 hover:bg-rose-500/10"
                  >
                    <Trash2 className="size-3 mr-1" /> Delete
                  </Button>
                </div>
              </div>

              {/* Tactical Workbench Tabs */}
              <div className="flex border-b border-white/10 gap-1 overflow-x-auto">
                {[
                  { id: "overview", label: "Contest Specifications", icon: Settings2 },
                  { id: "assessment", label: "Phase 1 Screening Round", icon: ShieldCheck },
                  {
                    id: "arena_questions",
                    label: `Arena Problems (${detail.contest_problems?.length || 0})`,
                    icon: Trophy,
                  },
                  {
                    id: "assessment_questions",
                    label: `Screening Problems (${detail.assessment_problems?.length || 0})`,
                    icon: Code2,
                  },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveWorkbenchTab(id as any)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer shrink-0 ${
                      activeWorkbenchTab === id
                        ? "border-lime-400 text-lime-400 bg-white/5"
                        : "border-transparent text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* TAB 1: Overview & Settings */}
              {activeWorkbenchTab === "overview" && (
                <form onSubmit={handleSaveContest} className="space-y-4">
                  {/* Status controls */}
                  <div className="p-3 bg-zinc-900/60 border border-white/10 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400 font-bold uppercase">
                        Contest State Machine:
                      </span>
                      {getStatusBadge(detail.contest.status)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        disabled={detail.contest.status === "upcoming"}
                        onClick={() => handleChangeStatus("upcoming")}
                        className="h-7 text-[10px] rounded-none bg-cyan-950 text-cyan-300 border border-cyan-800 hover:bg-cyan-900 font-bold"
                      >
                        Reset to Upcoming
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={detail.contest.status === "live"}
                        onClick={() => handleChangeStatus("live")}
                        className="h-7 text-[10px] rounded-none bg-lime-400 hover:bg-lime-300 text-black font-bold"
                      >
                        <Play className="size-3 mr-1 fill-current" /> Transition to LIVE
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={detail.contest.status === "finished"}
                        onClick={() => handleChangeStatus("finished")}
                        className="h-7 text-[10px] rounded-none bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10 font-bold"
                      >
                        Conclude Contest
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                        Title:
                      </label>
                      <Input
                        value={contestForm.title || ""}
                        onChange={(e) => setContestForm({ ...contestForm, title: e.target.value })}
                        className="bg-black border-white/15 text-xs text-white rounded-none h-9"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                        Edition Number:
                      </label>
                      <Input
                        type="number"
                        value={contestForm.edition ?? 1}
                        onChange={(e) => setContestForm({ ...contestForm, edition: Number(e.target.value) })}
                        className="bg-black border-white/15 text-xs text-white rounded-none h-9 tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                        Season:
                      </label>
                      <Input
                        value={contestForm.season || ""}
                        onChange={(e) => setContestForm({ ...contestForm, season: e.target.value })}
                        className="bg-black border-white/15 text-xs text-white rounded-none h-9"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                        Cadence:
                      </label>
                      <select
                        value={contestForm.cadence || "weekly"}
                        onChange={(e) => setContestForm({ ...contestForm, cadence: e.target.value })}
                        className="w-full bg-black border border-white/15 text-xs text-white rounded-none h-9 px-2.5 focus-visible:ring-2 focus-visible:ring-lime-400"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Biweekly</option>
                        <option value="special">Special</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                        Division:
                      </label>
                      <select
                        value={contestForm.division || "open"}
                        onChange={(e) => setContestForm({ ...contestForm, division: e.target.value })}
                        className="w-full bg-black border border-white/15 text-xs text-white rounded-none h-9 px-2.5 focus-visible:ring-2 focus-visible:ring-lime-400"
                      >
                        <option value="open">Open</option>
                        <option value="division_1">Division 1</option>
                        <option value="division_2">Division 2</option>
                        <option value="division_3">Division 3</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-900/40 border border-white/10 space-y-2">
                    <span className="text-xs font-bold text-lime-400 uppercase">
                      Lab Final Timings (Local Time)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-zinc-400 mb-1">
                          Check-in Opens:
                        </label>
                        <Input
                          type="datetime-local"
                          value={contestForm.check_in_opens_at || ""}
                          onChange={(e) => setContestForm({ ...contestForm, check_in_opens_at: e.target.value })}
                          className="bg-black border-white/15 text-xs text-white rounded-none h-9"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-zinc-400 mb-1">
                          Starts At:
                        </label>
                        <Input
                          type="datetime-local"
                          value={contestForm.starts_at || ""}
                          onChange={(e) => setContestForm({ ...contestForm, starts_at: e.target.value })}
                          className="bg-black border-white/15 text-xs text-white rounded-none h-9"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-zinc-400 mb-1">
                          Ends At:
                        </label>
                        <Input
                          type="datetime-local"
                          value={contestForm.ends_at || ""}
                          onChange={(e) => setContestForm({ ...contestForm, ends_at: e.target.value })}
                          className="bg-black border-white/15 text-xs text-white rounded-none h-9"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                        Venue:
                      </label>
                      <Input
                        value={contestForm.venue || ""}
                        onChange={(e) => setContestForm({ ...contestForm, venue: e.target.value })}
                        className="bg-black border-white/15 text-xs text-white rounded-none h-9"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                        Workstation Seats:
                      </label>
                      <Input
                        type="number"
                        value={contestForm.seat_capacity ?? 60}
                        onChange={(e) => setContestForm({ ...contestForm, seat_capacity: Number(e.target.value) })}
                        className="bg-black border-white/15 text-xs text-white rounded-none h-9 tabular-nums"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                      Summary / Briefing:
                    </label>
                    <Textarea
                      value={contestForm.summary || ""}
                      onChange={(e) => setContestForm({ ...contestForm, summary: e.target.value })}
                      rows={3}
                      className="bg-black border-white/15 text-xs text-white rounded-none font-mono"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      disabled={isSavingContest}
                      className="h-10 rounded-none bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs font-bold uppercase tracking-wider px-6"
                    >
                      {isSavingContest ? "Saving Changes..." : "Save Contest Specifications"}
                    </Button>
                  </div>
                </form>
              )}

              {/* TAB 2: Phase 1 Screening Assessment */}
              {activeWorkbenchTab === "assessment" && (
                <form onSubmit={handleSaveAssessment} className="space-y-4">
                  <div className="p-3 bg-zinc-900/60 border border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white uppercase block">
                        Phase 1 Online Screening Assessment
                      </span>
                      <span className="text-[10px] text-zinc-400 block">
                        Candidates take this preliminary test to qualify for the Top 30 Air-Gapped Lab Final.
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAutoSetAssessmentWindow}
                      className="h-8 rounded-none border-lime-400/40 text-lime-400 hover:bg-lime-400/10 text-xs font-mono"
                    >
                      <Clock className="size-3 mr-1.5" /> Auto-Align 24h Window
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                        Assessment Title:
                      </label>
                      <Input
                        value={assessmentForm.title || ""}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, title: e.target.value })}
                        placeholder="e.g. Weekly Contest 1 — Online Screening Round"
                        className="bg-black border-white/15 text-xs text-white rounded-none h-9"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                        Attempt Duration (Minutes):
                      </label>
                      <Input
                        type="number"
                        min={15}
                        max={360}
                        value={assessmentForm.duration_minutes ?? 90}
                        onChange={(e) =>
                          setAssessmentForm({ ...assessmentForm, duration_minutes: Number(e.target.value) })
                        }
                        className="bg-black border-white/15 text-xs text-white rounded-none h-9 tabular-nums"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                        Screening Window Opens (Starts At):
                      </label>
                      <Input
                        type="datetime-local"
                        value={assessmentForm.starts_at || ""}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, starts_at: e.target.value })}
                        className="bg-black border-white/15 text-xs text-white rounded-none h-9"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                        Screening Window Closes (Ends At):
                      </label>
                      <Input
                        type="datetime-local"
                        value={assessmentForm.ends_at || ""}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, ends_at: e.target.value })}
                        className="bg-black border-white/15 text-xs text-white rounded-none h-9"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                        Max Anti-Cheat Warnings Allowed:
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={assessmentForm.max_violations ?? 3}
                        onChange={(e) =>
                          setAssessmentForm({ ...assessmentForm, max_violations: Number(e.target.value) })
                        }
                        className="bg-black border-white/15 text-xs text-white rounded-none h-9 tabular-nums"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id="is_active_assessment"
                        checked={assessmentForm.is_active ?? true}
                        onChange={(e) =>
                          setAssessmentForm({ ...assessmentForm, is_active: e.target.checked })
                        }
                        className="size-4 accent-lime-400 cursor-pointer"
                      />
                      <label htmlFor="is_active_assessment" className="text-xs text-white font-bold cursor-pointer">
                        Assessment Round Active & Available to Registered Cadets
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                      Assessment Overview Summary:
                    </label>
                    <Textarea
                      value={assessmentForm.summary || ""}
                      onChange={(e) => setAssessmentForm({ ...assessmentForm, summary: e.target.value })}
                      rows={3}
                      className="bg-black border-white/15 text-xs text-white rounded-none font-mono"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      disabled={isSavingAssessment}
                      className="h-10 rounded-none bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs font-bold uppercase tracking-wider px-6"
                    >
                      {isSavingAssessment ? "Saving..." : "Save Assessment Configuration"}
                    </Button>
                  </div>
                </form>
              )}

              {/* TAB 3: Contest Arena Questions (Phase 2 Final) */}
              {activeWorkbenchTab === "arena_questions" && (
                <div className="space-y-4">
                  <div className="p-3 bg-zinc-900/60 border border-white/10 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-lime-400 uppercase block">
                        Phase 2 On-Premise Air-Gapped Arena Questions
                      </span>
                      <span className="text-[10px] text-zinc-400 block">
                        Challenges solved by Top 30 qualified cadets during the physical final.
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSyncProblems("contest_to_assessment")}
                        className="h-8 rounded-none border-white/15 text-xs text-zinc-300 hover:text-white"
                        title="Copy all problems to Phase 1 Screening Round"
                      >
                        <ArrowRightLeft className="size-3 mr-1.5" /> Sync to Screening Round
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setEditingProblem(null);
                          setProblemModalTarget("contest");
                          setIsProblemModalOpen(true);
                        }}
                        className="h-8 rounded-none bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs font-bold"
                      >
                        <Plus className="size-3.5 mr-1" /> Add Arena Problem
                      </Button>
                    </div>
                  </div>

                  {/* Problems Cards */}
                  <div className="space-y-2.5">
                    {detail.contest_problems?.length === 0 ? (
                      <div className="p-8 text-center text-xs text-zinc-500 border border-white/10 bg-black/40">
                        No arena problems created yet. Click '+ Add Arena Problem' to create Challenge A.
                      </div>
                    ) : (
                      detail.contest_problems.map((p) => (
                        <div
                          key={p.problem_index}
                          className="p-4 bg-black/60 border border-white/10 rounded-none flex items-center justify-between gap-4 hover:border-white/20 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex size-8 items-center justify-center bg-lime-400 text-black font-mono font-black text-xs">
                              {p.problem_index}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-xs font-bold text-white">{p.title}</h3>
                                {getDifficultyBadge(p.difficulty)}
                                <span className="text-[10px] text-zinc-400 tabular-nums font-bold">
                                  {p.points} pts
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-zinc-500 pt-0.5">
                                <span>Topic: {p.topic || "Algorithms"}</span>
                                <span>•</span>
                                <span>Limit: {p.time_limit}s / {p.memory_limit}MB</span>
                                <span>•</span>
                                <span>
                                  {p.sample_testcases?.length || 0} Sample(s),{" "}
                                  {p.hidden_testcases?.length || 0} Hidden
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingProblem({ ...p, target: "contest" });
                                setProblemModalTarget("contest");
                                setIsProblemModalOpen(true);
                              }}
                              className="h-7 text-xs rounded-none border-white/15 text-zinc-300 hover:text-white"
                            >
                              <Edit3 className="size-3 mr-1" /> Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteProblem(p.problem_index, "contest")}
                              className="h-7 text-xs rounded-none border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: Assessment Questions (Phase 1 Screening) */}
              {activeWorkbenchTab === "assessment_questions" && (
                <div className="space-y-4">
                  <div className="p-3 bg-zinc-900/60 border border-white/10 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-cyan-400 uppercase block">
                        Phase 1 Online Screening Assessment Questions
                      </span>
                      <span className="text-[10px] text-zinc-400 block">
                        Online problem set presented during the 90-minute timed screening round.
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSyncProblems("assessment_to_contest")}
                        className="h-8 rounded-none border-white/15 text-xs text-zinc-300 hover:text-white"
                        title="Copy all problems to Contest Arena"
                      >
                        <ArrowRightLeft className="size-3 mr-1.5" /> Sync from Arena
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setEditingProblem(null);
                          setProblemModalTarget("assessment");
                          setIsProblemModalOpen(true);
                        }}
                        className="h-8 rounded-none bg-cyan-400 hover:bg-cyan-300 text-black font-mono text-xs font-bold"
                      >
                        <Plus className="size-3.5 mr-1" /> Add Screening Problem
                      </Button>
                    </div>
                  </div>

                  {/* Problems Cards */}
                  <div className="space-y-2.5">
                    {detail.assessment_problems?.length === 0 ? (
                      <div className="p-8 text-center text-xs text-zinc-500 border border-white/10 bg-black/40">
                        No screening assessment questions configured yet. Click '+ Add Screening Problem' or sync from the Arena.
                      </div>
                    ) : (
                      detail.assessment_problems.map((p) => (
                        <div
                          key={p.problem_index}
                          className="p-4 bg-black/60 border border-white/10 rounded-none flex items-center justify-between gap-4 hover:border-white/20 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex size-8 items-center justify-center bg-cyan-400 text-black font-mono font-black text-xs">
                              {p.problem_index}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-xs font-bold text-white">{p.title}</h3>
                                {getDifficultyBadge(p.difficulty)}
                                <span className="text-[10px] text-zinc-400 tabular-nums font-bold">
                                  {p.points} pts
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-zinc-500 pt-0.5">
                                <span>Limit: {p.time_limit}s / {p.memory_limit}MB</span>
                                <span>•</span>
                                <span>
                                  {p.sample_testcases?.length || 0} Sample(s),{" "}
                                  {p.hidden_testcases?.length || 0} Hidden
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingProblem({ ...p, target: "assessment" });
                                setProblemModalTarget("assessment");
                                setIsProblemModalOpen(true);
                              }}
                              className="h-7 text-xs rounded-none border-white/15 text-zinc-300 hover:text-white"
                            >
                              <Edit3 className="size-3 mr-1" /> Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteProblem(p.problem_index, "assessment")}
                              className="h-7 text-xs rounded-none border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Problem Editor Modal */}
      <ProblemEditorModal
        isOpen={isProblemModalOpen}
        onClose={() => setIsProblemModalOpen(false)}
        onSave={handleSaveProblem}
        initialProblem={editingProblem}
        defaultTarget={problemModalTarget}
      />

      {/* Contest Create Modal */}
      <ContestCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateContest}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmSlug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 font-mono">
          <div className="w-full max-w-md bg-zinc-950 border border-rose-500/50 p-6 space-y-4 rounded-none shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="size-5" />
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Confirm Contest Deletion
              </h3>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to permanently delete contest{" "}
              <strong className="text-rose-400">{deleteConfirmSlug}</strong>?
              This will cascade-delete its problem suites, screening assessments, and registrations.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteConfirmSlug(null)}
                className="h-9 rounded-none border-white/15 text-zinc-400 hover:text-white text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDeleteContest}
                className="h-9 rounded-none bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase"
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
